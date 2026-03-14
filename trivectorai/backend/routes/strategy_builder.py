from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, Query

from agent.memory import AgentMemory
from agent.strategy_agent import run_agent
from agent.tools.backtest_tool import execute_backtest_tool
from database.repository import (
    get_strategy_by_id,
    list_saved_strategies,
    load_memory,
    save_memory,
    save_result,
    save_strategy,
)
from models.strategy_builder_schema import (
    ClearStrategyResponse,
    ParseStrategyBuilderRequest,
    SaveStrategyRequest,
    SaveStrategyResponse,
    StrategyBuilderResponse,
)
from services.strategy_builder_service import (
    ai_suggestions,
    available_indicators,
    detected_indicators,
    detected_rules,
    normalize_strategy_for_save,
    strategy_templates,
    validate_strategy,
)
from services.backtest_agentic_service import start_backtest_job

router = APIRouter(prefix="/api/strategy-builder", tags=["strategy-builder"])


@router.get("/templates")
async def get_templates():
    return {"items": strategy_templates()}


@router.get("/indicators")
async def get_indicators():
    return {"groups": available_indicators()}


@router.post("/parse", response_model=StrategyBuilderResponse)
async def parse_strategy_builder(req: ParseStrategyBuilderRequest):
    memory = AgentMemory.from_dict(load_memory(req.session_id) if req.session_id else {})
    if req.conversation_history and not memory.conversation_history:
        memory.conversation_history = req.conversation_history

    response = run_agent(req.text, memory)
    save_memory(memory.session_id, memory.to_dict())

    strategy = response.strategy or {}
    validation = validate_strategy(strategy) if strategy else {"valid": False, "missing_fields": ["ticker", "entry_rules"], "issues": [], "can_run": False}
    suggestions = ai_suggestions(req.text, strategy, validation)

    return StrategyBuilderResponse(
        status=response.status,
        session_id=response.session_id,
        natural_language=req.text,
        strategy=strategy,
        dsl=strategy,
        detected_indicators=detected_indicators(strategy),
        detected_rules=detected_rules(strategy),
        validation=validation,
        suggestions=suggestions,
        parse_details=response.parse_details or {},
        agent_trace=response.agent_trace or [],
        agent_message=response.agent_message or "",
    )


@router.post("/validate")
async def validate_strategy_builder(payload: dict):
    strategy = payload.get("strategy") if isinstance(payload, dict) else None
    if not isinstance(strategy, dict):
        raise HTTPException(status_code=422, detail="strategy is required")
    return validate_strategy(strategy)


@router.post("/suggestions")
async def strategy_suggestions(payload: dict):
    text = str(payload.get("text", "")) if isinstance(payload, dict) else ""
    strategy = payload.get("strategy") if isinstance(payload, dict) else None
    validation = validate_strategy(strategy or {}) if isinstance(strategy, dict) else {"valid": False, "missing_fields": [], "issues": [], "can_run": False}
    return {"suggestions": ai_suggestions(text, strategy if isinstance(strategy, dict) else None, validation)}


@router.post("/save", response_model=SaveStrategyResponse)
async def save_strategy_builder(req: SaveStrategyRequest):
    try:
        strategy = normalize_strategy_for_save(req.strategy)
        strategy["raw_input"] = req.natural_language
        save_strategy(strategy["id"], strategy)
        return SaveStrategyResponse(status="ok", strategy_id=strategy["id"], message="Strategy saved")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Unable to save strategy: {exc}") from exc


@router.get("/saved")
async def get_saved_strategies(limit: int = Query(100, ge=1, le=500)):
    items = list_saved_strategies(limit=limit)
    return {"items": items}


@router.get("/saved/{strategy_id}")
async def get_saved_strategy(strategy_id: str):
    item = get_strategy_by_id(strategy_id)
    if not item:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return item


@router.post("/clear", response_model=ClearStrategyResponse)
async def clear_strategy(payload: dict):
    session_id = payload.get("session_id") if isinstance(payload, dict) else None
    if not session_id:
        return ClearStrategyResponse(status="ok", session_id=None, message="No active session provided")

    memory = AgentMemory.from_dict(load_memory(session_id) or {"session_id": session_id})
    memory.current_strategy = None
    memory.add_agent_message("Strategy context cleared.")
    save_memory(session_id, memory.to_dict())
    return ClearStrategyResponse(status="ok", session_id=session_id, message="Strategy cleared")


@router.post("/run-backtest")
async def run_backtest_from_builder(payload: dict):
    strategy = payload.get("strategy") if isinstance(payload, dict) else None
    if not isinstance(strategy, dict):
        raise HTTPException(status_code=422, detail="strategy is required")

    t0 = time.time()
    result = execute_backtest_tool(strategy)
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Backtest failed"))

    backtest_result = result["result"]
    result_id = backtest_result.get("id") or f"bt-{int(time.time())}"
    backtest_result["id"] = result_id
    backtest_result["strategy_id"] = strategy.get("id")

    save_result(result_id, backtest_result)

    metrics = backtest_result.get("metrics", {})
    return {
        "status": "ok",
        "result": backtest_result,
        "summary": {
            "total_return_pct": metrics.get("total_return_pct"),
            "sharpe_ratio": metrics.get("sharpe_ratio"),
            "max_drawdown_pct": metrics.get("max_drawdown_pct"),
            "win_rate_pct": metrics.get("win_rate_pct"),
            "latency_ms": int((time.time() - t0) * 1000),
        },
    }


@router.post("/run-backtest-agentic")
async def run_backtest_from_builder_agentic(payload: dict):
    strategy = payload.get("strategy") if isinstance(payload, dict) else None
    if not isinstance(strategy, dict):
        raise HTTPException(status_code=422, detail="strategy is required")

    job = start_backtest_job(
        strategy=strategy,
        session_id=payload.get("session_id") if isinstance(payload, dict) else None,
        natural_language=payload.get("natural_language") if isinstance(payload, dict) else None,
    )

    return {
        "status": "accepted",
        "job_id": job.id,
        "stream_url": f"/api/backtests/{job.id}/stream",
        "status_url": f"/api/backtests/{job.id}",
        "result_url": f"/api/backtests/{job.id}/result",
    }
