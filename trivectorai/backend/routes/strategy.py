import logging
import time

from fastapi import APIRouter, HTTPException

from agent.memory import AgentMemory
from agent.strategy_agent import run_agent
from database.repository import load_memory, save_memory, save_strategy
from models.api_schema import ParseRequest, ParseResponse

log = logging.getLogger("trivectorai.strategy")

router = APIRouter(prefix="/api", tags=["strategy"])


@router.post("/parse-strategy", response_model=ParseResponse)
async def parse_strategy(req: ParseRequest):
    t0 = time.time()
    log.info("[PARSE] message=%r  session=%s", req.message[:80], req.session_id)

    memory = AgentMemory.from_dict(load_memory(req.session_id) if req.session_id else {})
    if req.conversation_history and not memory.conversation_history:
        memory.conversation_history = req.conversation_history

    try:
        response = run_agent(req.message, memory)
        if response.strategy:
            strategy_id = response.strategy.get("id") or f"{response.strategy.get('ticker', 'draft')}-{memory.session_id[:8]}"
            save_strategy(strategy_id, response.strategy)
            details = response.parse_details or {}
            log.info("[PARSE] ✅ ticker=%s  status=%s  confidence=%.2f  %.0fms",
                     response.strategy.get("ticker"), response.status,
                     response.strategy.get("confidence_score", 0),
                     (time.time() - t0) * 1000)
            log.info("[PARSE] details can_run=%s readiness=%s missing=%s issues=%d",
                     response.can_run,
                     details.get("readiness_score"),
                     response.missing_fields,
                     len(details.get("issues", [])))
        else:
            log.info("[PARSE] ⚠️  no strategy extracted  status=%s", response.status)
        save_memory(memory.session_id, memory.to_dict())
        return response
    except Exception as exc:
        log.exception("[PARSE] ❌ error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

