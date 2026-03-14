from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MarketQuote(BaseModel):
    symbol: str
    name: str
    price: float
    change_pct: float
    timestamp: datetime


class WatchlistAsset(BaseModel):
    symbol: str
    price: float
    change_pct: float
    volume: int
    market_cap: int
    timestamp: datetime


class AddWatchlistRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)


class CryptoAsset(BaseModel):
    symbol: str
    price: float
    change_24h_pct: float
    volume_24h: float
    sparkline: list[float] = Field(default_factory=list)
    timestamp: datetime


class Candle(BaseModel):
    ts: datetime
    open: float
    high: float
    low: float
    close: float


class IndicatorPoint(BaseModel):
    ts: datetime
    rsi: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None


class ChartResponse(BaseModel):
    symbol: str
    timeframe: Literal["1m", "5m", "15m", "1h", "4h", "1d"]
    candles: list[Candle]
    volumes: list[int]
    indicators: list[IndicatorPoint]
    last_price: float
    generated_at: datetime


class NewsItem(BaseModel):
    headline: str
    source: str
    sentiment: Literal["positive", "neutral", "negative"]
    sentiment_score: float
    timestamp: datetime


class SectorRiskItem(BaseModel):
    sector: str
    risk_score: float
    volatility_score: float
    sentiment_score: float


class AiInsightResponse(BaseModel):
    symbol: str
    timeframe: Literal["1m", "5m", "15m", "1h", "4h", "1d"]
    insight_summary: str
    sentiment_score: float
    risk_level: Literal["low", "moderate", "high"]
    recommended_action: Literal["buy", "sell", "hold", "reduce_risk"]
    confidence_score: float
    drivers: list[str] = Field(default_factory=list)
    generated_at: datetime


class DashboardSnapshotResponse(BaseModel):
    global_markets: list[MarketQuote]
    watchlist: list[WatchlistAsset]
    crypto: list[CryptoAsset]
    news: list[NewsItem]
    sector_risk: list[SectorRiskItem]
    ai_insight: AiInsightResponse
    generated_at: datetime
    refresh_after_sec: int = 10
