import logging
import time
import uuid

from fastapi import APIRouter, HTTPException

from agent.tools.backtest_tool import execute_backtest_tool
from agent.tools.narrate_tool import execute_narrate_tool
from database.repository import save_result
from models.api_schema import BacktestRequest, BacktestResponse

log = logging.getLogger("trivectorai.backtest")

router = APIRouter(prefix="/api", tags=["backtest"])


@router.post("/run-backtest", response_model=BacktestResponse)
async def run_backtest_endpoint(req: BacktestRequest):
    ticker = req.strategy.get("ticker", "unknown") if isinstance(req.strategy, dict) else getattr(req.strategy, "ticker", "unknown")
    t0 = time.time()
    log.info("[BACKTEST] ▶  ticker=%s  timeframe=%s",
             ticker,
             req.strategy.get("timeframe", "?") if isinstance(req.strategy, dict) else getattr(req.strategy, "timeframe", "?"))

    result = execute_backtest_tool(req.strategy)
    if not result.get("success"):
        log.error("[BACKTEST] ❌ engine error: %s", result.get("error"))
        raise HTTPException(status_code=422, detail=result.get("error"))

    backtest_result = result["result"]
    metrics = backtest_result.get("metrics", {})
    log.info("[BACKTEST] ✅ ticker=%s  return=%.2f%%  sharpe=%.2f  trades=%d  %.0fms",
             ticker,
             metrics.get("total_return_pct", 0),
             metrics.get("sharpe_ratio", 0),
             metrics.get("total_trades", 0),
             (time.time() - t0) * 1000)

    narration = execute_narrate_tool(
        metrics=backtest_result["metrics"],
        strategy=req.strategy,
        trades=backtest_result.get("trades", []),
    )
    if narration.get("success"):
        backtest_result["ai_narrative"] = narration["narrative"]
        log.info("[BACKTEST] 📝 AI narrative generated (%d chars)", len(narration["narrative"]))

    # Persist with a dedicated result id. strategy_id should point to parsed strategy id when available.
    result_id = str(uuid.uuid4())
    source_strategy_id = req.strategy.get("id") if isinstance(req.strategy, dict) else None
    backtest_result["id"] = result_id
    backtest_result["strategy_id"] = source_strategy_id

    try:
        save_result(result_id, backtest_result)
        log.info("[BACKTEST] 💾 saved result_id=%s", result_id)
    except Exception as exc:
        log.exception("[BACKTEST] ❌ failed to persist result_id=%s: %s", result_id, exc)
        raise HTTPException(status_code=500, detail="Backtest computed but failed to save result. Check database configuration.")

    return BacktestResponse(status="ok", result=backtest_result)
