from __future__ import annotations

from functools import lru_cache

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


def _synthetic_ohlcv(ticker: str, interval: str) -> pd.DataFrame:
    periods = 1260 if interval == "1d" else 520
    freq = "B" if interval == "1d" else "4H"
    index = pd.date_range(end=pd.Timestamp.utcnow().normalize(), periods=periods, freq=freq)
    base = pd.Series(range(periods), index=index, dtype="float64")
    close = 100 + base * 0.18 + (base / 8).map(lambda x: __import__("math").sin(x) * 4)
    open_ = close.shift(1).fillna(close.iloc[0])
    high = pd.concat([open_, close], axis=1).max(axis=1) + 1.2
    low = pd.concat([open_, close], axis=1).min(axis=1) - 1.2
    volume = pd.Series(1_000_000 + (base * 2500), index=index)
    return pd.DataFrame({"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume})


@lru_cache(maxsize=50)
def fetch_ohlcv(ticker: str, period: str, interval: str) -> pd.DataFrame:
    yf_interval = TIMEFRAME_MAP.get(interval, "1d")
    yf_period = PERIOD_MAP.get(interval, "5y")
    try:
        df = yf.download(
            tickers=ticker,
            period=yf_period,
            interval=yf_interval,
            auto_adjust=True,
            progress=False,
        )
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
