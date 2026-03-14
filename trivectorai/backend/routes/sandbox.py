from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from models.sandbox_schema import (
    SandboxCompareRequest,
    SandboxCompareResponse,
    SandboxRunRequest,
    SandboxRunResponse,
    SandboxSaveVersionRequest,
    SandboxSaveVersionResponse,
    SandboxVersionsResponse,
)
from services.sandbox_service import (
    compare_sandbox_versions,
    get_sandbox_version,
    list_sandbox_versions,
    run_sandbox_simulation,
    save_sandbox_version,
)


router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])


@router.post("/run", response_model=SandboxRunResponse)
async def run_sandbox(req: SandboxRunRequest):
    try:
        payload = run_sandbox_simulation(req.strategy, req.natural_language)
        return SandboxRunResponse(status="ok", result=payload["result"], workflow=payload["workflow"], message="Simulation complete")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/versions", response_model=SandboxSaveVersionResponse)
async def save_version(req: SandboxSaveVersionRequest):
    version = save_sandbox_version(
        strategy=req.strategy,
        result_id=req.result_id,
        label=req.label,
        notes=req.notes,
    )
    return SandboxSaveVersionResponse(status="ok", version=version, message="Sandbox version saved")


@router.get("/versions", response_model=SandboxVersionsResponse)
async def list_versions(limit: int = Query(20, ge=1, le=100)):
    return SandboxVersionsResponse(status="ok", versions=list_sandbox_versions(limit=limit))


@router.get("/versions/{version_id}", response_model=SandboxSaveVersionResponse)
async def get_version(version_id: str):
    version = get_sandbox_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Sandbox version not found")
    return SandboxSaveVersionResponse(status="ok", version=version, message="Sandbox version loaded")


@router.post("/versions/{version_id}/restore", response_model=SandboxSaveVersionResponse)
async def restore_version(version_id: str):
    version = get_sandbox_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Sandbox version not found")
    return SandboxSaveVersionResponse(status="ok", version=version, message="Sandbox version restored")


@router.post("/versions/compare", response_model=SandboxCompareResponse)
async def compare_versions(req: SandboxCompareRequest):
    if len(req.ids) < 2:
        raise HTTPException(status_code=422, detail="Select at least 2 sandbox version IDs to compare")
    items = compare_sandbox_versions(req.ids)
    if len(items) < 2:
        raise HTTPException(status_code=404, detail="Could not find enough sandbox versions to compare")
    return SandboxCompareResponse(status="ok", items=items)
