from __future__ import annotations

import numpy as np
import pandas as pd


def _sma(close: pd.Series, period: int) -> pd.Series:
    return close.rolling(window=period, min_periods=period).mean()


def _ema(close: pd.Series, period: int) -> pd.Series:
    return close.ewm(span=period, adjust=False, min_periods=period).mean()


def _rsi(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def _macd(close: pd.Series, fast: int, slow: int, signal: int) -> tuple[pd.Series, pd.Series, pd.Series]:
    macd_line = _ema(close, fast) - _ema(close, slow)
    signal_line = macd_line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    histogram = macd_line - signal_line
    return macd_line, histogram, signal_line


def _bbands(close: pd.Series, period: int, std_dev: float) -> tuple[pd.Series, pd.Series, pd.Series]:
    middle = _sma(close, period)
    rolling_std = close.rolling(window=period, min_periods=period).std(ddof=0)
    upper = middle + (rolling_std * std_dev)
    lower = middle - (rolling_std * std_dev)
    return lower, middle, upper


def _atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int) -> pd.Series:
    prev_close = close.shift(1)
    true_range = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return true_range.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()


def _stoch(high: pd.Series, low: pd.Series, close: pd.Series, k_period: int, d_period: int) -> tuple[pd.Series, pd.Series]:
    lowest_low = low.rolling(window=k_period, min_periods=k_period).min()
    highest_high = high.rolling(window=k_period, min_periods=k_period).max()
    denominator = (highest_high - lowest_low).replace(0, np.nan)
    percent_k = ((close - lowest_low) / denominator) * 100
    percent_d = percent_k.rolling(window=d_period, min_periods=d_period).mean()
    return percent_k, percent_d


def compute_indicators(df: pd.DataFrame, strategy: dict) -> pd.DataFrame:
    all_rules = strategy.get("entry_rules", []) + strategy.get("exit_rules", [])

    for rule in all_rules:
        indicator = str(rule.get("indicator", "")).upper()
        params = rule.get("params", {}) or {}

        if indicator == "SMA":
            period = params.get("period", 20)
            col = f"SMA_{period}"
            if col not in df.columns:
                df[col] = _sma(df["Close"], period)

        elif indicator == "EMA":
            period = params.get("period", 20)
            col = f"EMA_{period}"
            if col not in df.columns:
                df[col] = _ema(df["Close"], period)

        elif indicator == "RSI":
            period = params.get("period", 14)
            col = f"RSI_{period}"
            if col not in df.columns:
                df[col] = _rsi(df["Close"], period)

        elif indicator == "MACD":
            fast = params.get("fast_period", 12)
            slow = params.get("slow_period", 26)
            signal = params.get("signal_period", 9)
            macd_line, histogram, signal_line = _macd(df["Close"], fast, slow, signal)
            df[f"MACD_{fast}_{slow}_{signal}"] = macd_line
            df[f"MACDh_{fast}_{slow}_{signal}"] = histogram
            df[f"MACDs_{fast}_{slow}_{signal}"] = signal_line

        elif indicator == "BBANDS":
            period = params.get("period", 20)
            std = params.get("std_dev", 2.0)
            lower, middle, upper = _bbands(df["Close"], period, std)
            df[f"BBL_{period}_{std}"] = lower
            df[f"BBM_{period}_{std}"] = middle
            df[f"BBU_{period}_{std}"] = upper

        elif indicator == "ATR":
            period = params.get("period", 14)
            col = f"ATR_{period}"
            if col not in df.columns:
                df[col] = _atr(df["High"], df["Low"], df["Close"], period)

        elif indicator == "STOCH":
            k_period = params.get("k_period", 14)
            d_period = params.get("d_period", 3)
            percent_k, percent_d = _stoch(df["High"], df["Low"], df["Close"], k_period, d_period)
            df[f"STOCHk_{k_period}_{d_period}"] = percent_k
            df[f"STOCHd_{k_period}_{d_period}"] = percent_d

    return df.dropna().copy()
