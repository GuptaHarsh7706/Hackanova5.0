import logging

from fastapi import APIRouter, HTTPException

from database.repository import get_all_results, get_result_by_id, delete_result, clear_all_results
from models.api_schema import CompareRequest, CompareResponse

log = logging.getLogger("trivectorai.history")

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def get_history():
    """Return all saved backtest results, newest first, summary only (no equity_curve)."""
    log.info("[HISTORY] fetching all results")
    results = get_all_results()
    log.info("[HISTORY] returned %d results", len(results))
    # Strip equity_curve and trades from list view to keep response small
    return [
        {
            "id":          r.get("id") or r.get("strategy_id"),
            "strategy":    r.get("strategy"),
            "metrics":     r.get("metrics"),
            "ticker_used": r.get("ticker_used"),
            "data_period": r.get("data_period"),
            "created_at":  r.get("created_at"),
        }
        for r in results
    ]


@router.get("/history/{result_id}")
async def get_history_item(result_id: str):
    """Return full result including equity_curve, trades, monthly_returns."""
    result = get_result_by_id(result_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Result {result_id} not found")
    return result


@router.delete("/history/{result_id}")
async def delete_history_item(result_id: str):
    success = delete_result(result_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Result {result_id} not found")
    return {"deleted": True, "id": result_id}


@router.delete("/history")
async def clear_history():
    clear_all_results()
    return {"status": "ok"}


@router.post("/history/compare", response_model=CompareResponse)
async def compare_history_items(req: CompareRequest):
    if len(req.ids) < 2:
        raise HTTPException(status_code=422, detail="Select at least 2 result IDs to compare")

    items = []
    for result_id in req.ids[:5]:
        result = get_result_by_id(result_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Result {result_id} not found")

        strategy = result.get("strategy", {}) or {}
        metrics = result.get("metrics", {}) or {}

        items.append(
            {
                "id": result.get("id") or result.get("strategy_id"),
                "name": strategy.get("ticker") or result.get("ticker_used") or result.get("ticker") or "Strategy",
                "created_at": result.get("created_at"),
                "strategy": strategy,
                "results": {
                    **metrics,
                    "equity_curve": result.get("equity_curve", []),
                    "trades": result.get("trades", []),
                    "monthly_returns": result.get("monthly_returns", []),
                },
            }
        )

    log.info("[COMPARE] returned %d items for ids=%s", len(items), req.ids)
    return CompareResponse(status="ok", items=items)
