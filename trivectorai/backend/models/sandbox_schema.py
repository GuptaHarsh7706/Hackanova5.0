from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class SandboxRunRequest(BaseModel):
    strategy: dict[str, Any]
    natural_language: str | None = None


class SandboxWorkflowStep(BaseModel):
    agent: str
    status: Literal["ok", "warning", "error"] = "ok"
    detail: str = ""


class SandboxRunResponse(BaseModel):
    status: Literal["ok", "error"] = "ok"
    result: dict[str, Any] = Field(default_factory=dict)
    workflow: list[SandboxWorkflowStep] = Field(default_factory=list)
    message: str = ""


class SandboxSaveVersionRequest(BaseModel):
    strategy: dict[str, Any]
    result_id: str | None = None
    label: str | None = None
    notes: str | None = None


class SandboxVersionSummary(BaseModel):
    id: str
    label: str
    created_at: str
    strategy: dict[str, Any] = Field(default_factory=dict)
    result_id: str | None = None
    notes: str = ""
    metrics: dict[str, Any] = Field(default_factory=dict)


class SandboxSaveVersionResponse(BaseModel):
    status: Literal["ok", "error"] = "ok"
    version: SandboxVersionSummary | None = None
    message: str = ""


class SandboxVersionsResponse(BaseModel):
    status: Literal["ok", "error"] = "ok"
    versions: list[SandboxVersionSummary] = Field(default_factory=list)


class SandboxCompareRequest(BaseModel):
    ids: list[str] = Field(default_factory=list)


class SandboxCompareResponse(BaseModel):
    status: Literal["ok", "error"] = "ok"
    items: list[dict[str, Any]] = Field(default_factory=list)
    message: str = ""
