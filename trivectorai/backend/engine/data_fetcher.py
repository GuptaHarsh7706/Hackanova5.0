from __future__ import annotations

import hashlib
from functools import lru_cache
import logging
import math
import random
import time

import numpy as np
import pandas as pd
import yfinance as yf


TIMEFRAME_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "60m",
    "4h": "60m",
    "1d": "1d",
    "1w": "1wk",
}

PERIOD_MAP = {
    "1m": "7d",
    "5m": "60d",
    "15m": "60d",
    "30m": "60d",
    "1h": "2y",
    "4h": "5y",
    "1d": "5y",
    "1w": "10y",
}

log = logging.getLogger("trivectorai.data_fetcher")


def _download_with_retries(ticker: str, yf_period: str, yf_interval: str, retries: int = 3) -> pd.DataFrame | None:
    """Retry Yahoo download on transient failures before falling back to synthetic data."""
    last_exc = None
    for attempt in range(retries + 1):
        try:
            df = yf.download(
                tickers=ticker,
                period=yf_period,
                interval=yf_interval,
                auto_adjust=True,
                progress=False,
            )
            if df is not None and not df.empty:
                return df
        except Exception as exc:  # pragma: no cover - network/provider dependent
            last_exc = exc

        if attempt < retries:
            # Exponential backoff to absorb temporary provider/API instability.
            time.sleep(0.4 * (2**attempt))

    if last_exc:
        log.warning("yfinance download failed for %s after retries: %s", ticker, last_exc)
    else:
        log.warning("yfinance returned empty data for %s after retries", ticker)
    return None


def _synthetic_ohlcv(ticker: str, interval: str) -> pd.DataFrame:
    periods = 1260 if interval == "1d" else 520
    freq = "B" if interval == "1d" else "4H"
    index = pd.date_range(end=pd.Timestamp.utcnow().normalize(), periods=periods, freq=freq)

    # Deterministic seed per ticker/interval so fallback is stable across runs.
    seed = int(hashlib.sha256(f"{ticker}:{interval}".encode("utf-8")).hexdigest()[:16], 16)
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)

    price = 100 + (seed % 35)
    closes = []
    opens = []
    highs = []
    lows = []
    vols = []

    regime_len = 70 if interval == "1d" else 42
    for i in range(periods):
        regime = (i // regime_len) % 4
        if regime == 0:
            drift = 0.0007
        elif regime == 1:
            drift = -0.0006
        elif regime == 2:
            drift = 0.0
        else:
            drift = 0.0003

        cyc = 0.009 * math.sin(i / 9.5) + 0.004 * math.sin(i / 3.7)
        shock = float(np_rng.normal(0, 0.006))
        ret = drift + cyc + shock

        open_px = price * (1 + float(np_rng.normal(0, 0.002)))
        close_px = max(1.0, open_px * (1 + ret))

        wick_up = abs(float(np_rng.normal(0.0045, 0.0015)))
        wick_dn = abs(float(np_rng.normal(0.0045, 0.0015)))
        high_px = max(open_px, close_px) * (1 + wick_up)
        low_px = min(open_px, close_px) * (1 - wick_dn)

        vol_base = 1_000_000 if interval == "1d" else 350_000
        vol = int(vol_base * (1 + abs(ret) * 30) + rng.randint(25_000, 280_000))

        opens.append(open_px)
        closes.append(close_px)
        highs.append(high_px)
        lows.append(max(0.5, low_px))
        vols.append(max(1_000, vol))
        price = close_px

    df = pd.DataFrame(
        {
            "Open": opens,
            "High": highs,
            "Low": lows,
            "Close": closes,
            "Volume": vols,
        },
        index=index,
    )
    return df


@lru_cache(maxsize=50)
def fetch_ohlcv(ticker: str, period: str, interval: str) -> pd.DataFrame:
    yf_interval = TIMEFRAME_MAP.get(interval, "1d")
    yf_period = PERIOD_MAP.get(interval, "5y")
    try:
        df = _download_with_retries(ticker=ticker, yf_period=yf_period, yf_interval=yf_interval, retries=3)
        if df is None or df.empty:
            return _synthetic_ohlcv(ticker, interval)
        df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
        df = df.dropna()
        if interval == "4h" and len(df) > 0:
            df = df.resample("4H").agg(
                {
                    "Open": "first",
                    "High": "max",
                    "Low": "min",
                    "Close": "last",
                    "Volume": "sum",
                }
            ).dropna()
        return df if not df.empty else _synthetic_ohlcv(ticker, interval)
    except Exception:
        return _synthetic_ohlcv(ticker, interval)
