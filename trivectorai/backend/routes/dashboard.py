from __future__ import annotations

import asyncio
import json
import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from database.repository import add_watchlist_symbol, get_watchlist_symbols, remove_watchlist_symbol
from models.dashboard_schema import (
    AddWatchlistRequest,
    AiInsightResponse,
    ChartResponse,
    CryptoAsset,
    DashboardSnapshotResponse,
    MarketQuote,
    NewsItem,
    SectorRiskItem,
    WatchlistAsset,
)
from services.market_intelligence import (
    build_ai_insight,
    build_chart_payload,
    build_dashboard_snapshot,
    build_news_sentiment,
    build_sector_risk,
    get_crypto_assets,
    get_global_markets,
    get_watchlist_assets,
)

log = logging.getLogger("trivectorai.dashboard")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

TIMEFRAMES = {"1m", "5m", "15m", "1h", "4h", "1d"}


@router.get("/global-markets", response_model=list[MarketQuote])
async def global_markets():
    return get_global_markets()


@router.get("/watchlist", response_model=list[WatchlistAsset])
async def watchlist_get():
    symbols = get_watchlist_symbols(asset_type="equity")
    return get_watchlist_assets(symbols)


@router.post("/watchlist", response_model=list[WatchlistAsset])
async def watchlist_add(payload: AddWatchlistRequest):
    try:
        add_watchlist_symbol(payload.symbol, asset_type="equity")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    symbols = get_watchlist_symbols(asset_type="equity")
    return get_watchlist_assets(symbols)


@router.delete("/watchlist/{symbol}", response_model=list[WatchlistAsset])
async def watchlist_delete(symbol: str):
    removed = remove_watchlist_symbol(symbol)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol.upper()} not found in watchlist")
    symbols = get_watchlist_symbols(asset_type="equity")
    return get_watchlist_assets(symbols)


@router.get("/crypto", response_model=list[CryptoAsset])
async def crypto_markets(
    symbols: str | None = Query(default=None, description="Comma-separated list, e.g. BTC,ETH,SOL"),
):
    parsed = None
    if symbols:
        parsed = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    return get_crypto_assets(parsed)


@router.get("/chart", response_model=ChartResponse)
async def market_chart(
    symbol: str = Query("^GSPC", description="Ticker symbol, e.g. AAPL, ^GSPC, BTC-USD"),
    timeframe: Literal["1m", "5m", "15m", "1h", "4h", "1d"] = Query("1h"),
    limit: int = Query(200, ge=50, le=500),
):
    return build_chart_payload(symbol=symbol.upper(), timeframe=timeframe, limit=limit)


@router.get("/news", response_model=list[NewsItem])
async def news_sentiment(limit: int = Query(6, ge=1, le=20)):
    return build_news_sentiment(limit=limit)


@router.get("/sector-risk", response_model=list[SectorRiskItem])
async def sector_risk():
    return build_sector_risk()


@router.get("/insights", response_model=AiInsightResponse)
async def ai_insights(
    symbol: str = Query("^GSPC", description="Ticker symbol for the insight context"),
    timeframe: Literal["1m", "5m", "15m", "1h", "4h", "1d"] = Query("1h"),
):
    if timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe: {timeframe}")

    chart_payload = build_chart_payload(symbol=symbol.upper(), timeframe=timeframe, limit=220)
    news = build_news_sentiment(limit=6)
    sectors = build_sector_risk()
    return build_ai_insight(symbol=symbol.upper(), timeframe=timeframe, chart_payload=chart_payload, news=news, sectors=sectors)


@router.get("/snapshot", response_model=DashboardSnapshotResponse)
async def dashboard_snapshot(
    symbol: str = Query("^GSPC"),
    timeframe: Literal["1m", "5m", "15m", "1h", "4h", "1d"] = Query("1h"),
):
    watchlist = get_watchlist_symbols(asset_type="equity")
    return build_dashboard_snapshot(symbol=symbol.upper(), timeframe=timeframe, watchlist=watchlist)


@router.get("/stream")
async def dashboard_stream(
    symbol: str = Query("^GSPC"),
    timeframe: Literal["1m", "5m", "15m", "1h", "4h", "1d"] = Query("1h"),
    interval_sec: int = Query(5, ge=2, le=60),
):
    async def event_generator():
        while True:
            watchlist = get_watchlist_symbols(asset_type="equity")
            payload = build_dashboard_snapshot(symbol=symbol.upper(), timeframe=timeframe, watchlist=watchlist)
            body = json.dumps(payload, default=str)
            yield f"event: snapshot\ndata: {body}\n\n"
            await asyncio.sleep(interval_sec)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    log.info("[DASHBOARD] SSE stream started symbol=%s timeframe=%s", symbol, timeframe)
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)
