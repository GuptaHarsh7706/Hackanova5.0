from __future__ import annotations

import pandas as pd


def _resolve_value(df: pd.DataFrame, value, rule: dict) -> pd.Series:
    if isinstance(value, (int, float)):
        return pd.Series(float(value), index=df.index)
    if isinstance(value, str):
        if value in df.columns:
            return df[value]
        if value.startswith("SMA_") and value in df.columns:
            return df[value]
        if value.startswith("EMA_") and value in df.columns:
            return df[value]
        params = rule.get("params", {}) or {}
        if value == "SIGNAL":
            fast = params.get("fast_period", 12)
            slow = params.get("slow_period", 26)
            signal = params.get("signal_period", 9)
            col = f"MACDs_{fast}_{slow}_{signal}"
            if col in df.columns:
                return df[col]
        if value == "UPPER_BAND":
            period = params.get("period", 20)
            std = params.get("std_dev", 2.0)
            col = f"BBU_{period}_{std}"
            if col in df.columns:
                return df[col]
        if value == "LOWER_BAND":
            period = params.get("period", 20)
            std = params.get("std_dev", 2.0)
            col = f"BBL_{period}_{std}"
            if col in df.columns:
                return df[col]
    return pd.Series(0.0, index=df.index)


def _get_indicator_series(df: pd.DataFrame, rule: dict) -> pd.Series:
    indicator = str(rule.get("indicator", "")).upper()
    params = rule.get("params", {}) or {}
    if indicator == "SMA":
        return df.get(f"SMA_{params.get('period', 20)}", df["Close"])
    if indicator == "EMA":
        return df.get(f"EMA_{params.get('period', 20)}", df["Close"])
    if indicator == "RSI":
        return df.get(f"RSI_{params.get('period', 14)}", pd.Series(50.0, index=df.index))
    if indicator == "MACD":
        fast = params.get("fast_period", 12)
        slow = params.get("slow_period", 26)
        signal = params.get("signal_period", 9)
        return df.get(f"MACD_{fast}_{slow}_{signal}", pd.Series(0.0, index=df.index))
    if indicator == "BBANDS":
        return df["Close"]
    if indicator == "PRICE":
        return df["Close"]
    if indicator == "VOLUME":
        return df["Volume"]
    if indicator == "ATR":
        return df.get(f"ATR_{params.get('period', 14)}", pd.Series(0.0, index=df.index))
    return df["Close"]


def _apply_condition(series_a: pd.Series, condition: str, series_b: pd.Series) -> pd.Series:
    if condition == "crosses_above":
        return (series_a > series_b) & (series_a.shift(1) <= series_b.shift(1))
    if condition == "crosses_below":
        return (series_a < series_b) & (series_a.shift(1) >= series_b.shift(1))
    if condition == "greater_than":
        return series_a > series_b
    if condition == "less_than":
        return series_a < series_b
    if condition == "equals":
        return series_a == series_b
    if condition == "between":
        return (series_a >= series_b * 0.95) & (series_a <= series_b * 1.05)
    return pd.Series(False, index=series_a.index)


def _build_signal_for_rules(df: pd.DataFrame, rules: list) -> pd.Series:
    if not rules:
        return pd.Series(False, index=df.index)

    accumulated = None
    for rule in rules:
        indicator_series = _get_indicator_series(df, rule)
        value_series = _resolve_value(df, rule.get("value"), rule)
        signal = _apply_condition(indicator_series, rule.get("condition", "greater_than"), value_series)
        operator = rule.get("logic_operator", "NONE")

        if accumulated is None or operator == "NONE":
            accumulated = signal
        elif operator == "AND":
            accumulated = accumulated & signal
        elif operator == "OR":
            accumulated = accumulated | signal

    return accumulated.fillna(False)


def build_signals(df: pd.DataFrame, strategy: dict):
    entry_signals = _build_signal_for_rules(df, strategy.get("entry_rules", []))
    exit_signals = _build_signal_for_rules(df, strategy.get("exit_rules", []))
    if not strategy.get("exit_rules"):
        exit_signals = pd.Series(False, index=df.index)

    hold_bars = strategy.get("holding_period_bars")
    if hold_bars is None:
        hold_bars = strategy.get("max_hold_days")

    try:
        hold_bars = int(hold_bars) if hold_bars is not None else None
    except Exception:
        hold_bars = None

    if hold_bars and hold_bars > 0:
        timed_exits = pd.Series(False, index=df.index)
        in_position = False
        entry_index = None

        for i, idx in enumerate(df.index):
            if not in_position and bool(entry_signals.iloc[i]):
                in_position = True
                entry_index = i
            elif in_position:
                bars_held = i - (entry_index or 0)
                if bars_held >= hold_bars:
                    timed_exits.iloc[i] = True
                    in_position = False
                    entry_index = None
                elif bool(exit_signals.iloc[i]):
                    in_position = False
                    entry_index = None

        exit_signals = (exit_signals | timed_exits).fillna(False)

    return entry_signals.values, exit_signals.values
