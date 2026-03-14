import logging
import sys

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from database.db import init_db
from routes.backtest_agentic import router as backtest_agentic_router
from routes.backtest_config import router as backtest_config_router
from routes.backtest import router as backtest_router
from routes.dashboard import router as dashboard_router
from routes.health import router as health_router
from routes.history import router as history_router
from routes.strategy import router as strategy_router
from routes.strategy_builder import router as strategy_builder_router

# ── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("trivectorai")

# yfinance can emit noisy ERROR logs when Yahoo intermittently returns empty/non-JSON
# responses. The app already has deterministic fallback data paths for these cases.
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

load_dotenv()

try:
    init_db()
    log.info("✅  Database initialised (PostgreSQL)")
except Exception as exc:
    log.warning("⚠️   DB init failed — running without persistence: %s", exc)

app = FastAPI(title="TriVectorAI", version="0.3.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    start = time.time()
    response = await call_next(request)
    ms = int((time.time() - start) * 1000)
    log.info("%-6s %-40s %d  %dms", request.method, request.url.path, response.status_code, ms)
    return response

app.include_router(strategy_router)
app.include_router(strategy_builder_router)
app.include_router(backtest_router)
app.include_router(backtest_agentic_router)
app.include_router(backtest_config_router)
app.include_router(history_router)
app.include_router(health_router)
app.include_router(dashboard_router)

log.info("🚀  TriVectorAI v0.3.0 — docs at http://localhost:8000/docs")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
