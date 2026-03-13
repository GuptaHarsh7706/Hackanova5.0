from fastapi import APIRouter, HTTPException

from database.repository import get_all_results, get_result_by_id, delete_result, clear_all_results

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def get_history():
    """Return all saved backtest results, newest first, summary only (no equity_curve)."""
    results = get_all_results()
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
