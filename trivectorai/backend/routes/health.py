from fastapi import APIRouter

from database.db import get_conn

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health():
    db_ok = False
    db_error = None
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            db_ok = cur.fetchone() is not None
    except Exception as exc:
        db_error = str(exc)

    return {
        "status": "ok" if db_ok else "degraded",
        "version": "0.3.0",
        "db": "connected" if db_ok else "unavailable",
        **(  {"db_error": db_error} if db_error else {}),
    }
