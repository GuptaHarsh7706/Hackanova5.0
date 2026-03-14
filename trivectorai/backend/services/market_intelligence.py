from __future__ import annotations

import hashlib
import json
import math
import os
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import yfinance as yf

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover
    genai = None


GLOBAL_INDEX_MAP = {
    "^GSPC": "S&P 500",
    "^DJI": "Dow Jones",
    "^IXIC": "Nasdaq",
    "^FTSE": "FTSE 100",
    "^GDAXI": "DAX",
    "^N225": "Nikkei 225",
}

CRYPTO_MAP = {
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "BNB": "BNB-USD",
    "SOL": "SOL-USD",
}

COMMODITY_FOREX_MAP = {
    "GC=F": ("Gold", "commodity", 2150),
    "SI=F": ("Silver", "commodity", 24),
    "CL=F": ("Crude Oil", "commodity", 78),
    "NG=F": ("Natural Gas", "commodity", 2.7),
    "EURUSD=X": ("EUR/USD", "forex", 1.09),
    "GBPUSD=X": ("GBP/USD", "forex", 1.28),
    "USDJPY=X": ("USD/JPY", "forex", 149.5),
}

SECTORS = [
    "technology",
    "finance",
    "energy",
    "healthcare",
    "consumer",
    "industrials",
    "utilities",
    "real_estate",
    "materials",
]

_TIMEFRAME_TO_INTERVAL = {
    "1m": ("1m", "7d"),
    "5m": ("5m", "60d"),
    "15m": ("15m", "60d"),
    "1h": ("60m", "730d"),
    "4h": ("60m", "730d"),
    "1d": ("1d", "5y"),
}

_CACHE_LOCK = threading.Lock()
_CACHE: dict[str, tuple[float, object]] = {}

QUOTE_CACHE_TTL_SEC = 20
GLOBAL_MARKETS_CACHE_TTL_SEC = 10
WATCHLIST_CACHE_TTL_SEC = 10
CRYPTO_CACHE_TTL_SEC = 15
CHART_CACHE_TTL_SEC = 12
INSIGHT_CACHE_TTL_SEC = 12
SNAPSHOT_CACHE_TTL_SEC = 8


def _cache_get(key: str):
    now = time.time()
    with _CACHE_LOCK:
        row = _CACHE.get(key)
        if not row:
            return None
        expires_at, value = row
        if expires_at <= now:
            _CACHE.pop(key, None)
            return None
        return value


def _cache_set(key: str, ttl_sec: int, value):
    with _CACHE_LOCK:
        _CACHE[key] = (time.time() + max(1, ttl_sec), value)


@dataclass
class Quote:
    symbol: str
    price: float
    change_pct: float
    volume: int = 0
    market_cap: int = 0


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _seed(symbol: str) -> int:
    digest = hashlib.sha256(symbol.encode("utf-8")).hexdigest()[:12]
    return int(digest, 16)


def _mock_quote(symbol: str, base: float) -> Quote:
    now = _utc_now()
    minute_factor = int(now.timestamp() // 60)
    seed = _seed(symbol) + minute_factor
    rng = random.Random(seed)
    drift = math.sin(seed % 360) * 0.003
    noise = rng.uniform(-0.008, 0.008)
    change = drift + noise
    price = max(0.01, base * (1 + change))
    volume = int(abs(base) * 10000 + rng.randint(100_000, 2_000_000))
    market_cap = int(abs(base) * 2_000_000_000 + rng.randint(5_000_000_000, 900_000_000_000))
    return Quote(symbol=symbol, price=round(price, 2), change_pct=round(change * 100, 2), volume=volume, market_cap=market_cap)


def _run_with_timeout(fn, timeout_sec: float):
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(fn)
        try:
            return future.result(timeout=max(0.1, timeout_sec))
        except FuturesTimeoutError:
            return None
        except Exception:
            return None


def _fetch_fast_quote(symbol: str) -> Quote | None:
    try:
        tk = yf.Ticker(symbol)
        hist = _run_with_timeout(
            lambda: tk.history(period="2d", interval="1d", auto_adjust=False, timeout=2),
            timeout_sec=2.5,
        )
        if hist is None or hist.empty:
            return None
        close = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else close
        change_pct = ((close - prev) / max(prev, 0.0001)) * 100
        fast = getattr(tk, "fast_info", {}) or {}
        volume = int(fast.get("last_volume") or hist["Volume"].iloc[-1] or 0)
        market_cap = int(fast.get("market_cap") or 0)
        return Quote(symbol=symbol, price=round(close, 2), change_pct=round(change_pct, 2), volume=volume, market_cap=market_cap)
    except Exception:
        return None


def quote_for_symbol(symbol: str, base: float = 100.0) -> Quote:
    cache_key = f"quote::{symbol}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    quote = _fetch_fast_quote(symbol)
    if quote:
        _cache_set(cache_key, QUOTE_CACHE_TTL_SEC, quote)
        return quote
    fallback = _mock_quote(symbol, base=base)
    _cache_set(cache_key, QUOTE_CACHE_TTL_SEC, fallback)
    return fallback


def get_global_markets() -> list[dict]:
    cached = _cache_get("global_markets")
    if cached is not None:
        return cached

    now = _utc_now()
    fallback_bases = {
        "^GSPC": 5200,
        "^DJI": 39100,
        "^IXIC": 16800,
        "^FTSE": 8100,
        "^GDAXI": 18100,
        "^N225": 38700,
    }
    rows = []
    for symbol, name in GLOBAL_INDEX_MAP.items():
        q = quote_for_symbol(symbol, base=fallback_bases[symbol])
        rows.append(
            {
                "symbol": symbol,
                "name": name,
                "price": q.price,
                "change_pct": q.change_pct,
                "timestamp": now,
            }
        )
    _cache_set("global_markets", GLOBAL_MARKETS_CACHE_TTL_SEC, rows)
    return rows


def get_watchlist_assets(symbols: list[str]) -> list[dict]:
    watchlist_key = "|".join(symbols)
    cached = _cache_get(f"watchlist::{watchlist_key}")
    if cached is not None:
        return cached

    now = _utc_now()
    rows = []
    for idx, symbol in enumerate(symbols):
        q = quote_for_symbol(symbol, base=90 + idx * 40)
        rows.append(
            {
                "symbol": symbol,
                "price": q.price,
                "change_pct": q.change_pct,
                "volume": q.volume,
                "market_cap": q.market_cap,
                "timestamp": now,
            }
        )
    _cache_set(f"watchlist::{watchlist_key}", WATCHLIST_CACHE_TTL_SEC, rows)
    return rows


def _sparkline_from_series(series: pd.Series, points: int = 24) -> list[float]:
    if series is None or series.empty:
        return []
    trimmed = series.dropna().tail(points)
    return [round(float(v), 2) for v in trimmed.tolist()]


def get_crypto_assets(symbols: list[str] | None = None) -> list[dict]:
    now = _utc_now()
    use = symbols or ["BTC", "ETH", "BNB", "SOL"]
    crypto_key = "|".join(use)
    cached = _cache_get(f"crypto::{crypto_key}")
    if cached is not None:
        return cached

    rows = []
    for sym in use:
        yf_symbol = CRYPTO_MAP.get(sym, f"{sym}-USD")
        quote = quote_for_symbol(yf_symbol, base=1000)
        spark = []
        try:
            hist = _run_with_timeout(
                lambda: yf.download(yf_symbol, period="2d", interval="1h", progress=False, auto_adjust=False, timeout=3),
                timeout_sec=3.5,
            )
            if hist is None:
                raise RuntimeError("download_timeout")
            close_series = hist["Close"] if "Close" in hist else pd.Series(dtype=float)
            spark = _sparkline_from_series(close_series, points=24)
        except Exception:
            spark = []
        if not spark:
            rng = random.Random(_seed(sym) + int(now.timestamp() // 3600))
            base = max(quote.price, 1.0)
            spark = [round(base * (1 + rng.uniform(-0.02, 0.02)), 2) for _ in range(24)]
        rows.append(
            {
                "symbol": sym,
                "price": quote.price,
                "change_24h_pct": quote.change_pct,
                "volume_24h": float(quote.volume),
                "sparkline": spark,
                "timestamp": now,
            }
        )
    _cache_set(f"crypto::{crypto_key}", CRYPTO_CACHE_TTL_SEC, rows)
    return rows


def get_commodities_forex() -> list[dict]:
    key = "commodities_forex"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    now = _utc_now()
    rows = []
    for symbol, (name, category, base) in COMMODITY_FOREX_MAP.items():
        q = quote_for_symbol(symbol, base=base)
        rows.append(
            {
                "symbol": symbol,
                "name": name,
                "category": category,
                "price": q.price,
                "change_pct": q.change_pct,
                "timestamp": now,
            }
        )
    _cache_set(key, 12, rows)
    return rows


def build_order_book(symbol: str) -> dict:
    key = f"order_book::{symbol}"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    q = quote_for_symbol(symbol, base=100)
    now = _utc_now()
    mid = float(q.price)
    rng = random.Random(_seed(symbol) + int(now.timestamp() // 10))

    bids = []
    asks = []
    for i in range(6):
        delta = 0.01 * (i + 1)
        bid_px = round(mid - delta, 2)
        ask_px = round(mid + delta, 2)
        bid_size = round(0.6 + rng.random() * 5.4, 3)
        ask_size = round(0.6 + rng.random() * 5.4, 3)
        bids.append({"price": bid_px, "size": bid_size})
        asks.append({"price": ask_px, "size": ask_size})

    spread_abs = round(asks[0]["price"] - bids[0]["price"], 4)
    spread_pct = round((spread_abs / max(mid, 0.0001)) * 100, 5)
    payload = {
        "symbol": symbol,
        "bids": bids,
        "asks": asks,
        "spread_abs": spread_abs,
        "spread_pct": spread_pct,
        "timestamp": now,
    }
    _cache_set(key, 5, payload)
    return payload


def build_market_overview(global_markets: list[dict], watchlist: list[dict], crypto: list[dict]) -> dict:
    key = "market_overview"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    merged = []
    for row in global_markets:
        merged.append(float(row.get("change_pct") or 0.0))
    for row in watchlist:
        merged.append(float(row.get("change_pct") or 0.0))
    for row in crypto:
        merged.append(float(row.get("change_24h_pct") or 0.0))

    positives = sum(1 for x in merged if x >= 0)
    breadth_ratio_pct = round((positives / max(1, len(merged))) * 100, 2)

    # Approximation model for macro card values in absence of a dedicated feed.
    total_market_cap_trn = round(45 + (sum(abs(x) for x in merged) % 22), 2)
    total_24h_volume_bln = round(95 + (len(merged) * 1.7), 2)

    payload = {
        "total_market_cap_trn": total_market_cap_trn,
        "total_24h_volume_bln": total_24h_volume_bln,
        "breadth_ratio_pct": breadth_ratio_pct,
        "active_symbols": len(merged),
    }
    _cache_set(key, 8, payload)
    return payload


def build_gainers_losers(watchlist: list[dict], crypto: list[dict]) -> tuple[list[dict], list[dict]]:
    key = "movers"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    merged = []
    for row in watchlist:
        merged.append(
            {
                "symbol": row.get("symbol"),
                "name": row.get("symbol"),
                "change_pct": float(row.get("change_pct") or 0.0),
                "last_price": float(row.get("price") or 0.0),
            }
        )
    for row in crypto:
        merged.append(
            {
                "symbol": row.get("symbol"),
                "name": row.get("symbol"),
                "change_pct": float(row.get("change_24h_pct") or 0.0),
                "last_price": float(row.get("price") or 0.0),
            }
        )

    ranked = sorted(merged, key=lambda x: x["change_pct"], reverse=True)
    gainers = ranked[:5]
    losers = sorted(merged, key=lambda x: x["change_pct"])[:5]
    out = (gainers, losers)
    _cache_set(key, 8, out)
    return out


def _mock_history(symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
    now = _utc_now().replace(second=0, microsecond=0)
    interval_minutes = {
        "1m": 1,
        "5m": 5,
        "15m": 15,
        "1h": 60,
        "4h": 240,
        "1d": 1440,
    }[timeframe]
    seed = _seed(symbol + timeframe) + int(now.timestamp() // 3600)
    rng = random.Random(seed)

    idx = [now - timedelta(minutes=interval_minutes * i) for i in range(limit)][::-1]
    base = 100 + (seed % 500)
    prices = []
    value = float(base)
    for i in range(limit):
        wave = math.sin(i / 11.0) * 0.004
        shock = rng.uniform(-0.01, 0.01)
        value = max(1.0, value * (1 + wave + shock * 0.3))
        open_px = value * (1 + rng.uniform(-0.004, 0.004))
        close_px = value * (1 + rng.uniform(-0.004, 0.004))
        high_px = max(open_px, close_px) * (1 + rng.uniform(0.0, 0.008))
        low_px = min(open_px, close_px) * (1 - rng.uniform(0.0, 0.008))
        vol = int(300_000 + abs(close_px - open_px) * 180_000 + rng.randint(0, 600_000))
        prices.append((open_px, high_px, low_px, close_px, vol))

    df = pd.DataFrame(prices, columns=["Open", "High", "Low", "Close", "Volume"], index=pd.to_datetime(idx))
    return df


def get_chart_df(symbol: str, timeframe: str, limit: int = 200) -> pd.DataFrame:
    timeframe = timeframe if timeframe in _TIMEFRAME_TO_INTERVAL else "1h"
    interval, period = _TIMEFRAME_TO_INTERVAL[timeframe]

    try:
        hist = _run_with_timeout(
            lambda: yf.download(symbol, period=period, interval=interval, progress=False, auto_adjust=False, timeout=3),
            timeout_sec=3.5,
        )
        if hist is None:
            raise RuntimeError("download_timeout")
        if hist is None or hist.empty:
            raise RuntimeError("empty history")
        if timeframe == "4h":
            hist = hist.resample("4h").agg(
                {
                    "Open": "first",
                    "High": "max",
                    "Low": "min",
                    "Close": "last",
                    "Volume": "sum",
                }
            ).dropna()
        hist = hist.dropna(subset=["Open", "High", "Low", "Close"]).tail(limit)
        if hist.empty:
            raise RuntimeError("empty after tail")
        return hist
    except Exception:
        return _mock_history(symbol, timeframe, limit)


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _macd(close: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal = macd_line.ewm(span=9, adjust=False).mean()
    hist = macd_line - signal
    return macd_line, signal, hist


def build_chart_payload(symbol: str, timeframe: str, limit: int = 200) -> dict:
    chart_key = f"chart::{symbol}::{timeframe}::{limit}"
    cached = _cache_get(chart_key)
    if cached is not None:
        return cached

    df = get_chart_df(symbol, timeframe, limit=limit)
    rsi = _rsi(df["Close"], period=14)
    macd_line, macd_signal, macd_hist = _macd(df["Close"])

    points = []
    candles = []
    volumes = []
    for ts, row in df.iterrows():
        candles.append(
            {
                "ts": pd.Timestamp(ts).to_pydatetime().replace(tzinfo=timezone.utc),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
            }
        )
        volumes.append(int(row.get("Volume", 0) or 0))
        points.append(
            {
                "ts": pd.Timestamp(ts).to_pydatetime().replace(tzinfo=timezone.utc),
                "rsi": None if pd.isna(rsi.loc[ts]) else round(float(rsi.loc[ts]), 4),
                "macd": None if pd.isna(macd_line.loc[ts]) else round(float(macd_line.loc[ts]), 6),
                "macd_signal": None if pd.isna(macd_signal.loc[ts]) else round(float(macd_signal.loc[ts]), 6),
                "macd_hist": None if pd.isna(macd_hist.loc[ts]) else round(float(macd_hist.loc[ts]), 6),
            }
        )

    payload = {
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": candles,
        "volumes": volumes,
        "indicators": points,
        "last_price": round(float(df["Close"].iloc[-1]), 4),
        "generated_at": _utc_now(),
    }
    _cache_set(chart_key, CHART_CACHE_TTL_SEC, payload)
    return payload


def build_news_sentiment(limit: int = 6) -> list[dict]:
    now = _utc_now()
    templates = [
        ("Fed signals a measured path for rate cuts amid cooling inflation", "Bloomberg"),
        ("Semiconductor demand accelerates as AI capex cycle broadens", "Reuters"),
        ("Crude oil drifts lower after mixed OPEC production guidance", "CNBC"),
        ("Major banks face tighter capital rules in latest policy draft", "Financial Times"),
        ("Consumer confidence rebounds as labor market remains resilient", "WSJ"),
        ("China manufacturing surprise lifts global cyclical sentiment", "Nikkei"),
        ("Utilities lag as bond yields move higher", "MarketWatch"),
    ]

    def score_headline(text: str) -> float:
        positive_words = {"accelerates", "rebounds", "resilient", "lifts", "broadens", "cooling"}
        negative_words = {"lower", "tighter", "lags", "risk", "concerns", "headwinds"}
        words = {w.strip(".,").lower() for w in text.split()}
        score = 0.0
        score += 0.18 * sum(1 for w in words if w in positive_words)
        score -= 0.18 * sum(1 for w in words if w in negative_words)
        return max(-1.0, min(1.0, score))

    items = []
    for i, (headline, source) in enumerate(templates[: max(1, min(limit, len(templates)))]):
        score = score_headline(headline)
        sentiment = "neutral"
        if score >= 0.12:
            sentiment = "positive"
        elif score <= -0.12:
            sentiment = "negative"
        items.append(
            {
                "headline": headline,
                "source": source,
                "sentiment": sentiment,
                "sentiment_score": round(score, 3),
                "timestamp": now - timedelta(minutes=17 * i),
            }
        )
    return items


def build_sector_risk() -> list[dict]:
    now_bucket = int(_utc_now().timestamp() // 1800)
    rows = []
    for idx, sector in enumerate(SECTORS):
        rng = random.Random(_seed(sector) + now_bucket)
        risk = round(35 + rng.random() * 55, 2)
        vol = round(20 + rng.random() * 70, 2)
        sentiment = round(-1 + rng.random() * 2, 3)
        rows.append(
            {
                "sector": sector,
                "risk_score": risk,
                "volatility_score": vol,
                "sentiment_score": sentiment,
            }
        )
    return rows


def _rule_based_insight(symbol: str, timeframe: str, chart_payload: dict, news: list[dict], sectors: list[dict]) -> dict:
    indicators = chart_payload.get("indicators", [])
    if not indicators:
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "insight_summary": "Insufficient indicator history. Hold and wait for clearer trend confirmation.",
            "sentiment_score": 0.0,
            "risk_level": "moderate",
            "recommended_action": "hold",
            "confidence_score": 0.42,
            "drivers": ["limited_history"],
            "generated_at": _utc_now(),
        }

    last = indicators[-1]
    prev = indicators[-2] if len(indicators) > 1 else indicators[-1]
    rsi = last.get("rsi") or 50.0
    macd = last.get("macd") or 0.0
    signal = last.get("macd_signal") or 0.0
    macd_prev = prev.get("macd") or macd
    signal_prev = prev.get("macd_signal") or signal

    news_score = float(np.mean([n["sentiment_score"] for n in news])) if news else 0.0
    sector_risk = float(np.mean([s["risk_score"] for s in sectors])) if sectors else 50.0

    drivers = []
    score = 0.0

    if macd > signal and macd_prev <= signal_prev:
        score += 0.35
        drivers.append("macd_bullish_crossover")
    elif macd < signal and macd_prev >= signal_prev:
        score -= 0.35
        drivers.append("macd_bearish_crossover")

    if rsi < 30:
        score += 0.15
        drivers.append("rsi_oversold_reversal_setup")
    elif rsi > 70:
        score -= 0.15
        drivers.append("rsi_overbought_exhaustion")
    else:
        score += 0.08
        drivers.append("rsi_neutral_supportive")

    score += news_score * 0.35
    score -= ((sector_risk - 50) / 100) * 0.45

    sentiment_score = max(-1.0, min(1.0, score))
    if sentiment_score > 0.18:
        action = "buy"
        summary = "Momentum is improving with constructive indicator alignment and supportive sentiment."
    elif sentiment_score < -0.18:
        action = "sell"
        summary = "Momentum is weakening with risk-sensitive conditions and deteriorating signal structure."
    else:
        action = "hold"
        summary = "Signals are mixed; maintain neutral positioning until trend confirmation improves."

    if sector_risk > 70:
        risk_level = "high"
        if action == "buy":
            action = "reduce_risk"
            summary += " Elevated sector risk suggests reducing exposure size."
    elif sector_risk > 45:
        risk_level = "moderate"
    else:
        risk_level = "low"

    confidence = max(0.35, min(0.93, 0.55 + abs(sentiment_score) * 0.35))

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "insight_summary": summary,
        "sentiment_score": round(sentiment_score, 3),
        "risk_level": risk_level,
        "recommended_action": action,
        "confidence_score": round(confidence, 3),
        "drivers": drivers,
        "generated_at": _utc_now(),
    }


def _llm_insight(symbol: str, timeframe: str, chart_payload: dict, news: list[dict], sectors: list[dict]) -> dict | None:
    if genai is None:
        return None
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        indicators = chart_payload.get("indicators", [])
        latest = indicators[-1] if indicators else {}
        prompt = {
            "task": "Generate concise market insight JSON for trading dashboard",
            "symbol": symbol,
            "timeframe": timeframe,
            "latest_indicators": latest,
            "news": news[:5],
            "sector_risk": sectors,
            "required_keys": [
                "insight_summary",
                "sentiment_score",
                "risk_level",
                "recommended_action",
                "confidence_score",
                "drivers",
            ],
            "constraints": {
                "risk_level": ["low", "moderate", "high"],
                "recommended_action": ["buy", "sell", "hold", "reduce_risk"],
                "sentiment_score_range": [-1, 1],
                "confidence_score_range": [0, 1],
            },
        }

        response = model.generate_content(
            f"Return strict JSON only. Input:\n{json.dumps(prompt)}",
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2,
                max_output_tokens=350,
            ),
        )
        payload = json.loads(response.text)
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "insight_summary": str(payload.get("insight_summary", "")).strip() or "AI insight unavailable.",
            "sentiment_score": round(float(payload.get("sentiment_score", 0.0)), 3),
            "risk_level": str(payload.get("risk_level", "moderate")).lower(),
            "recommended_action": str(payload.get("recommended_action", "hold")).lower(),
            "confidence_score": round(float(payload.get("confidence_score", 0.5)), 3),
            "drivers": [str(x) for x in payload.get("drivers", [])][:6],
            "generated_at": _utc_now(),
        }
    except Exception:
        return None


def build_ai_insight(symbol: str, timeframe: str, chart_payload: dict, news: list[dict], sectors: list[dict]) -> dict:
    insight_key = f"insight::{symbol}::{timeframe}"
    cached = _cache_get(insight_key)
    if cached is not None:
        return cached

    use_llm = os.getenv("DASHBOARD_USE_LLM", "0").strip().lower() in {"1", "true", "yes", "on"}
    llm = _llm_insight(symbol, timeframe, chart_payload, news, sectors) if use_llm else None
    if llm:
        if llm.get("risk_level") not in {"low", "moderate", "high"}:
            llm["risk_level"] = "moderate"
        if llm.get("recommended_action") not in {"buy", "sell", "hold", "reduce_risk"}:
            llm["recommended_action"] = "hold"
        llm["sentiment_score"] = max(-1.0, min(1.0, float(llm.get("sentiment_score", 0.0))))
        llm["confidence_score"] = max(0.0, min(1.0, float(llm.get("confidence_score", 0.5))))
        _cache_set(insight_key, INSIGHT_CACHE_TTL_SEC, llm)
        return llm

    rule_based = _rule_based_insight(symbol, timeframe, chart_payload, news, sectors)
    _cache_set(insight_key, INSIGHT_CACHE_TTL_SEC, rule_based)
    return rule_based


def build_dashboard_snapshot(symbol: str = "^GSPC", timeframe: str = "1h", watchlist: list[str] | None = None) -> dict:
    watch = watchlist or ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM"]
    snapshot_key = f"snapshot::{symbol}::{timeframe}::{'|'.join(watch)}"
    cached = _cache_get(snapshot_key)
    if cached is not None:
        return cached

    chart_payload = build_chart_payload(symbol=symbol, timeframe=timeframe, limit=220)
    news = build_news_sentiment(limit=6)
    sectors = build_sector_risk()
    insight = build_ai_insight(symbol=symbol, timeframe=timeframe, chart_payload=chart_payload, news=news, sectors=sectors)

    global_markets = get_global_markets()
    watch_assets = get_watchlist_assets(watch)
    crypto_assets = get_crypto_assets(["BTC", "ETH", "BNB", "SOL"])
    commodities_forex = get_commodities_forex()
    order_book = build_order_book(watch[0] if watch else symbol)
    market_overview = build_market_overview(global_markets, watch_assets, crypto_assets)
    gainers, losers = build_gainers_losers(watch_assets, crypto_assets)

    payload = {
        "global_markets": global_markets,
        "watchlist": watch_assets,
        "crypto": crypto_assets,
        "commodities_forex": commodities_forex,
        "order_book": order_book,
        "news": news,
        "sector_risk": sectors,
        "market_overview": market_overview,
        "gainers": gainers,
        "losers": losers,
        "ai_insight": insight,
        "generated_at": _utc_now(),
        "refresh_after_sec": 10,
    }
    _cache_set(snapshot_key, SNAPSHOT_CACHE_TTL_SEC, payload)
    return payload
