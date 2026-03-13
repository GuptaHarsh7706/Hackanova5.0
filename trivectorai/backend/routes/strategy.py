from fastapi import APIRouter, HTTPException

from models.strategy_schema import ParseRequest, ParseResponse
from services.llm_parser import parse_strategy_with_llm
from services.validator import validate_and_respond

router = APIRouter(prefix="/api", tags=["strategy"])


@router.post("/parse-strategy", response_model=ParseResponse)
async def parse_strategy(req: ParseRequest):
    try:
        raw_dict = parse_strategy_with_llm(req.message, req.conversation_history)
        return validate_and_respond(raw_dict)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        msg = str(e).lower()
        if "429" in msg or "resourceexhausted" in msg or "quota" in msg or "rate limit" in msg:
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/health")
async def health():
    return {"status": "ok"}
