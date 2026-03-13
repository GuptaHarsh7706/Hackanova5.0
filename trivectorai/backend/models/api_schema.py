from typing import Literal, Optional

from pydantic import BaseModel, Field


class ParseRequest(BaseModel):
    message: str
    conversation_history: list[dict] = Field(default_factory=list)
    session_id: Optional[str] = None


class ParseResponse(BaseModel):
    status: Literal["ok", "needs_clarification", "running", "error"]
    strategy: Optional[dict] = None
    agent_message: str = ""
    missing_fields: list[str] = Field(default_factory=list)
    session_id: Optional[str] = None
    can_run: bool = False
    parse_details: dict = Field(default_factory=dict)
    agent_trace: list[str] = Field(default_factory=list)


class BacktestRequest(BaseModel):
    strategy: dict
    session_id: Optional[str] = None


class BacktestResponse(BaseModel):
    status: Literal["ok", "error"]
    result: Optional[dict] = None
    message: str = ""


class CompareRequest(BaseModel):
    ids: list[str] = Field(default_factory=list)


class CompareResponse(BaseModel):
    status: Literal["ok", "error"] = "ok"
    items: list[dict] = Field(default_factory=list)
    message: str = ""
