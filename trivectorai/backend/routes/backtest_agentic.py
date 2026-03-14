from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from database.repository import get_result_by_id
from services.backtest_agentic_service import (
    format_sse,
    get_job,
    get_job_events_since,
    get_job_state,
    start_backtest_job,
)

router = APIRouter(prefix="/api/backtests", tags=["backtest-agentic"])


@router.post("/start")
async def start_agentic_backtest(payload: dict[str, Any]):
    strategy = payload.get("strategy") if isinstance(payload, dict) else None
    session_id = payload.get("session_id") if isinstance(payload, dict) else None
    natural_language = payload.get("natural_language") if isinstance(payload, dict) else None

    if not isinstance(strategy, dict):
        raise HTTPException(status_code=422, detail="strategy is required")

    job = start_backtest_job(strategy=strategy, session_id=session_id, natural_language=natural_language)

    return {
        "status": "accepted",
        "job_id": job.id,
        "stream_url": f"/api/backtests/{job.id}/stream",
        "status_url": f"/api/backtests/{job.id}",
        "result_url": f"/api/backtests/{job.id}/result",
        "equity_curve_url": f"/api/backtests/{job.id}/equity-curve",
        "trades_url": f"/api/backtests/{job.id}/trades",
        "insights_url": f"/api/backtests/{job.id}/insights",
    }


@router.get("/{job_id}")
async def get_backtest_job_status(job_id: str):
    state = get_job_state(job_id)
    if not state:
        raise HTTPException(status_code=404, detail="Backtest job not found")
    return state


@router.get("/{job_id}/stream")
async def stream_backtest_job(job_id: str, heartbeat_seconds: int = Query(10, ge=3, le=30)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Backtest job not found")

    async def event_generator():
        offset = 0
        while True:
            events = get_job_events_since(job_id, offset)
            if events:
                for event in events:
                    yield format_sse(event)
                offset += len(events)
            else:
                yield ": heartbeat\n\n"

            current = get_job(job_id)
            if not current:
                yield format_sse({"event": "error", "job_id": job_id, "message": "Job disappeared"})
                break
            if current.status in {"completed", "failed"} and offset >= len(current.events):
                break

            await asyncio.sleep(heartbeat_seconds if not events else 0.2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{job_id}/result")
async def get_backtest_job_result(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Backtest job not found")
    if job.status == "failed":
        raise HTTPException(status_code=422, detail=job.error or "Backtest failed")
    if job.status != "completed" or not job.result:
        return {
            "status": job.status,
            "message": "Result not ready",
            "job_id": job.id,
            "progress": job.progress,
            "current_step": job.current_step,
        }
    return {"status": "ok", "job_id": job.id, "result": job.result}


@router.get("/{job_id}/equity-curve")
async def get_equity_curve(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Backtest job not found")
    if not job.result_id and job.result:
        return {"job_id": job_id, "equity_curve": job.result.get("equity_curve", [])}
    if not job.result_id:
        return {"job_id": job_id, "equity_curve": [], "status": job.status}

    persisted = get_result_by_id(job.result_id)
    if not persisted:
        return {"job_id": job_id, "equity_curve": [], "status": job.status}

    return {
        "job_id": job_id,
        "result_id": job.result_id,
        "equity_curve": persisted.get("equity_curve", []),
        "portfolio_value_over_time": persisted.get("portfolio_value_over_time", persisted.get("equity_curve", [])),
    }


@router.get("/{job_id}/trades")
async def get_trade_log(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Backtest job not found")
    if not job.result:
        return {"job_id": job_id, "trades": [], "status": job.status}

    return {
        "job_id": job_id,
        "result_id": job.result_id,
        "trades": job.result.get("trade_log", job.result.get("trades", [])),
        "trade_statistics": job.result.get("trade_statistics", {}),
    }


@router.get("/{job_id}/insights")
async def get_backtest_insights(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Backtest job not found")
    if not job.result:
        return {"job_id": job_id, "insights": None, "status": job.status}

    return {
        "job_id": job_id,
        "result_id": job.result_id,
        "ai_narrative": job.result.get("ai_narrative"),
        "ai_analysis": job.result.get("ai_analysis", {}),
        "suggestions": (job.result.get("ai_analysis", {}) or {}).get("suggested_improvements", []),
        "report": job.result.get("report", {}),
    }
