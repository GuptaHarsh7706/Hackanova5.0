from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class StrategyTemplate(BaseModel):
    name: str
    description: str
    natural_language: str
    default_parameters: dict[str, Any] = Field(default_factory=dict)
    example_dsl: dict[str, Any] = Field(default_factory=dict)


class IndicatorCatalogItem(BaseModel):
    name: str
    code: str
    category: str
    params: list[str] = Field(default_factory=list)


class ParseStrategyBuilderRequest(BaseModel):
    text: str = Field(..., min_length=3)
    session_id: str | None = None
    conversation_history: list[dict[str, Any]] = Field(default_factory=list)


class ValidateStrategyRequest(BaseModel):
    strategy: dict[str, Any]


class SuggestionsRequest(BaseModel):
    text: str = ""
    strategy: dict[str, Any] | None = None


class SaveStrategyRequest(BaseModel):
    natural_language: str
    strategy: dict[str, Any]


class StrategyBuilderResponse(BaseModel):
    status: Literal["ok", "needs_clarification", "error"]
    session_id: str | None = None
    natural_language: str = ""
    strategy: dict[str, Any] = Field(default_factory=dict)
    dsl: dict[str, Any] = Field(default_factory=dict)
    detected_indicators: list[str] = Field(default_factory=list)
    detected_rules: dict[str, list[str]] = Field(default_factory=dict)
    validation: dict[str, Any] = Field(default_factory=dict)
    suggestions: list[str] = Field(default_factory=list)
    parse_details: dict[str, Any] = Field(default_factory=dict)
    agent_trace: list[str] = Field(default_factory=list)
    agent_message: str = ""


class SaveStrategyResponse(BaseModel):
    status: Literal["ok", "error"] = "ok"
    strategy_id: str | None = None
    message: str = ""


class ClearStrategyResponse(BaseModel):
    status: Literal["ok"] = "ok"
    session_id: str | None = None
    message: str = ""


# ---------------------------------------------------------------------------
# Conversational chat
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    text: str = Field(..., min_length=1)
    session_id: str | None = None


class ChatResponse(BaseModel):
    session_id: str | None = None
    agent_message: str = ""
    status: str = "ok"
    strategy: dict[str, Any] | None = None
    can_run: bool = False
    parse_details: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Strategy improvement
# ---------------------------------------------------------------------------

class ImproveStrategyRequest(BaseModel):
    strategy: dict[str, Any]
    backtest_metrics: dict[str, Any] = Field(default_factory=dict)
    session_id: str | None = None


class ImproveStrategyResponse(BaseModel):
    success: bool = True
    improved_strategy: dict[str, Any] = Field(default_factory=dict)
    natural_language: str = ""
    issues: list[dict[str, Any]] = Field(default_factory=list)
    general_tips: list[str] = Field(default_factory=list)
    summary: str = ""
