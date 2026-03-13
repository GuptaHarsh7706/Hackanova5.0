from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.db import init_db
from routes.backtest import router as backtest_router
from routes.health import router as health_router
from routes.history import router as history_router
from routes.strategy import router as strategy_router

load_dotenv()
init_db()

app = FastAPI(title="TriVectorAI", version="0.3.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strategy_router)
app.include_router(backtest_router)
app.include_router(history_router)
app.include_router(health_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
