from fastapi import APIRouter

from database.repository import clear_all_results, get_all_results


router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def get_history():
    return get_all_results()


@router.delete("/history")
async def clear_history():
    clear_all_results()
    return {"status": "ok"}
