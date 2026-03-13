import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException

from agent.tools.backtest_tool import execute_backtest_tool
from agent.tools.narrate_tool import execute_narrate_tool
from database.repository import save_result
from models.api_schema import BacktestRequest, BacktestResponse


router = APIRouter(prefix="/api", tags=["backtest"])


@router.post("/run-backtest", response_model=BacktestResponse)
async def run_backtest_endpoint(req: BacktestRequest, background_tasks: BackgroundTasks):
    result = execute_backtest_tool(req.strategy)
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error"))

    backtest_result = result["result"]
    narration = execute_narrate_tool(
        metrics=backtest_result["metrics"],
        strategy=req.strategy,
        trades=backtest_result.get("trades", []),
    )
    if narration.get("success"):
        backtest_result["ai_narrative"] = narration["narrative"]

    result_id = backtest_result.get("strategy_id") or str(uuid.uuid4())
    backtest_result["strategy_id"] = result_id
    background_tasks.add_task(save_result, result_id, backtest_result)
    return BacktestResponse(status="ok", result=backtest_result)
