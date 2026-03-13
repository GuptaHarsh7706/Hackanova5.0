from fastapi import APIRouter, HTTPException

from agent.memory import AgentMemory
from agent.strategy_agent import run_agent
from database.repository import load_memory, save_memory, save_strategy
from models.api_schema import ParseRequest, ParseResponse


router = APIRouter(prefix="/api", tags=["strategy"])


@router.post("/parse-strategy", response_model=ParseResponse)
async def parse_strategy(req: ParseRequest):
    memory = AgentMemory.from_dict(load_memory(req.session_id) if req.session_id else {})
    if req.conversation_history and not memory.conversation_history:
        memory.conversation_history = req.conversation_history

    try:
        response = run_agent(req.message, memory)
        if response.strategy:
            strategy_id = response.strategy.get("id") or f"{response.strategy.get('ticker', 'draft')}-{memory.session_id[:8]}"
            save_strategy(strategy_id, response.strategy)
        save_memory(memory.session_id, memory.to_dict())
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

