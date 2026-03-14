from __future__ import annotations

import json
import os
import uuid
from typing import Any

import google.generativeai as genai

from agent.tools.validate_tool import execute_validate_tool
from dsl.strategy_dsl import compile_strategy_payload

TEMPLATES = [
    {
        "name": "Golden Cross",
        "description": "MA crossover strategy with momentum confirmation",
        "natural_language": "Buy when the 50-day moving average crosses above the 200-day moving average and RSI is below 30. Sell when RSI exceeds 70.",
        "default_parameters": {"timeframe": "1d", "position_size": 1.0, "stop_loss_pct": 4, "take_profit_pct": 8},
        "example_dsl": {
            "ticker": "SPY",
            "timeframe": "1d",
            "asset_class": "equity",
            "entry_rules": [
                {"indicator": "SMA", "condition": "crosses_above", "value": "SMA_200", "params": {"period": 50}},
                {"indicator": "RSI", "condition": "less_than", "value": 30, "params": {"period": 14}},
            ],
            "exit_rules": [{"indicator": "RSI", "condition": "greater_than", "value": 70, "params": {"period": 14}}],
            "position_size": 1.0,
            "stop_loss_pct": 4,
            "take_profit_pct": 8,
            "max_hold_days": 20,
            "short_allowed": False,
        },
    },
    {
        "name": "RSI Reversal",
        "description": "Oversold/overbought reversal trading setup",
        "natural_language": "Buy SPY when RSI(14) is below 29 and sell when RSI(14) is above 70.",
        "default_parameters": {"timeframe": "1d", "position_size": 1.0},
        "example_dsl": {
            "ticker": "SPY",
            "timeframe": "1d",
            "asset_class": "equity",
            "entry_rules": [{"indicator": "RSI", "condition": "less_than", "value": 29, "params": {"period": 14}}],
            "exit_rules": [{"indicator": "RSI", "condition": "greater_than", "value": 70, "params": {"period": 14}}],
            "position_size": 1.0,
            "stop_loss_pct": 4,
            "take_profit_pct": 8,
            "max_hold_days": 20,
            "short_allowed": False,
        },
    },
    {
        "name": "Breakout",
        "description": "Volume-supported breakout entries",
        "natural_language": "Buy TSLA when price breaks above the 20-day high with strong volume. Exit when RSI goes above 72.",
        "default_parameters": {"timeframe": "1h", "position_size": 0.6},
        "example_dsl": {
            "ticker": "TSLA",
            "timeframe": "1h",
            "asset_class": "equity",
            "entry_rules": [{"indicator": "PRICE", "condition": "crosses_above", "value": "RESISTANCE_20", "params": {}}],
            "exit_rules": [{"indicator": "RSI", "condition": "greater_than", "value": 72, "params": {"period": 14}}],
            "position_size": 0.6,
            "short_allowed": False,
        },
    },
    {
        "name": "Mean Reversion",
        "description": "Statistical mean reversion entries",
        "natural_language": "Buy QQQ when RSI is below 30 and price is near lower Bollinger band, exit at RSI 55.",
        "default_parameters": {"timeframe": "1d", "position_size": 0.7},
        "example_dsl": {
            "ticker": "QQQ",
            "timeframe": "1d",
            "asset_class": "equity",
            "entry_rules": [
                {"indicator": "RSI", "condition": "less_than", "value": 30, "params": {"period": 14}},
                {"indicator": "BBANDS", "condition": "less_than", "value": "LOWER_BAND", "params": {"period": 20, "std_dev": 2}},
            ],
            "exit_rules": [{"indicator": "RSI", "condition": "greater_than", "value": 55, "params": {"period": 14}}],
            "position_size": 0.7,
            "short_allowed": False,
        },
    },
    {
        "name": "Momentum",
        "description": "Trend-following momentum strategy",
        "natural_language": "Buy NVDA when EMA 20 crosses above EMA 50 and MACD crosses above signal. Exit on MACD cross below signal.",
        "default_parameters": {"timeframe": "4h", "position_size": 0.8},
        "example_dsl": {
            "ticker": "NVDA",
            "timeframe": "4h",
            "asset_class": "equity",
            "entry_rules": [
                {"indicator": "EMA", "condition": "crosses_above", "value": "EMA_50", "params": {"period": 20}},
                {"indicator": "MACD", "condition": "crosses_above", "value": "SIGNAL", "params": {"fast_period": 12, "slow_period": 26, "signal_period": 9}},
            ],
            "exit_rules": [{"indicator": "MACD", "condition": "crosses_below", "value": "SIGNAL", "params": {"fast_period": 12, "slow_period": 26, "signal_period": 9}}],
            "position_size": 0.8,
            "short_allowed": False,
        },
    },
    {
        "name": "Grid Trading",
        "description": "Range-bound grid order placement",
        "natural_language": "Trade ETHUSDT on 1h with mean reversion entries and fixed stop loss/take profit per grid level.",
        "default_parameters": {"timeframe": "1h", "position_size": 0.5, "stop_loss_pct": 2.5, "take_profit_pct": 3.5},
        "example_dsl": {
            "ticker": "ETHUSDT",
            "timeframe": "1h",
            "asset_class": "crypto",
            "entry_rules": [{"indicator": "RSI", "condition": "less_than", "value": 35, "params": {"period": 14}}],
            "exit_rules": [{"indicator": "RSI", "condition": "greater_than", "value": 60, "params": {"period": 14}}],
            "position_size": 0.5,
            "stop_loss_pct": 2.5,
            "take_profit_pct": 3.5,
            "short_allowed": False,
        },
    },
]

INDICATOR_CATALOG = {
    "Trend Indicators": [
        {"name": "Moving Average", "code": "MA", "category": "trend", "params": ["period"]},
        {"name": "Exponential Moving Average", "code": "EMA", "category": "trend", "params": ["period"]},
        {"name": "Simple Moving Average", "code": "SMA", "category": "trend", "params": ["period"]},
        {"name": "MACD", "code": "MACD", "category": "trend", "params": ["fast_period", "slow_period", "signal_period"]},
        {"name": "ADX", "code": "ADX", "category": "trend", "params": ["period"]},
    ],
    "Momentum Indicators": [
        {"name": "Relative Strength Index", "code": "RSI", "category": "momentum", "params": ["period"]},
        {"name": "Stochastic Oscillator", "code": "STOCH", "category": "momentum", "params": ["k_period", "d_period"]},
        {"name": "Commodity Channel Index", "code": "CCI", "category": "momentum", "params": ["period"]},
        {"name": "Rate of Change", "code": "ROC", "category": "momentum", "params": ["period"]},
    ],
}


def strategy_templates() -> list[dict[str, Any]]:
    return json.loads(json.dumps(TEMPLATES))


def available_indicators() -> dict[str, list[dict[str, Any]]]:
    return json.loads(json.dumps(INDICATOR_CATALOG))


def detected_indicators(strategy: dict[str, Any] | None) -> list[str]:
    if not strategy:
        return []
    items = []
    seen = set()
    for rule in (strategy.get("entry_rules") or []) + (strategy.get("exit_rules") or []):
        indicator = str(rule.get("indicator", "")).upper()
        params = rule.get("params", {}) or {}
        period = params.get("period")
        label = f"{indicator} ({period})" if period else indicator
        if indicator and label not in seen:
            seen.add(label)
            items.append(label)
    return items


def detected_rules(strategy: dict[str, Any] | None) -> dict[str, list[str]]:
    strategy = strategy or {}

    def _fmt(prefix: str, rule: dict[str, Any]) -> str:
        indicator = str(rule.get("indicator", "")).upper()
        condition = str(rule.get("condition", "")).replace("_", " ")
        value = rule.get("value")
        params = rule.get("params", {}) or {}
        period = params.get("period")
        suffix = f" ({period})" if period else ""
        if value in (None, ""):
            return f"{prefix}: {indicator}{suffix} {condition}".strip()
        return f"{prefix}: {indicator}{suffix} {condition} {value}".strip()

    return {
        "entry": [_fmt("Buy Condition", r) for r in strategy.get("entry_rules", [])],
        "exit": [_fmt("Sell Condition", r) for r in strategy.get("exit_rules", [])],
    }


def validate_strategy(strategy: dict[str, Any]) -> dict[str, Any]:
    return execute_validate_tool(strategy)


def _rule_based_suggestions(text: str, strategy: dict[str, Any] | None, validation: dict[str, Any]) -> list[str]:
    low = text.lower()
    strategy = strategy or {}
    suggestions = []

    if strategy.get("stop_loss_pct") is None:
        suggestions.append("Add stop loss")
    if strategy.get("take_profit_pct") is None:
        suggestions.append("Define risk/reward ratio")
    if not any(str(r.get("indicator", "")).upper() == "VOLUME" for r in strategy.get("entry_rules", [])):
        suggestions.append("Include volume filter")

    has_rsi = any(str(r.get("indicator", "")).upper() == "RSI" for r in strategy.get("entry_rules", []))
    if not has_rsi:
        suggestions.append("Set RSI threshold")

    has_ma = any(str(r.get("indicator", "")).upper() in {"SMA", "EMA", "MA"} for r in strategy.get("entry_rules", []))
    if not has_ma:
        suggestions.append("Add moving average")

    if validation.get("issues"):
        suggestions.append("Resolve validation issues before backtest")

    if "position size" not in low and strategy.get("position_size", 1.0) >= 1.0:
        suggestions.append("Tune position sizing for risk control")

    ordered = []
    seen = set()
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            ordered.append(s)
    return ordered[:6]


def ai_suggestions(text: str, strategy: dict[str, Any] | None, validation: dict[str, Any]) -> list[str]:
    fallback = _rule_based_suggestions(text, strategy, validation)
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return fallback

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = {
            "task": "Return up to 6 concise strategy improvement suggestions as JSON array of strings",
            "strategy_text": text,
            "strategy": strategy or {},
            "validation": validation,
            "style": "short_action_phrases",
            "examples": ["Add stop loss", "Include volume filter", "Set RSI threshold", "Define risk/reward ratio"],
        }
        res = model.generate_content(
            f"Return strict JSON only as an array of strings.\nInput:\n{json.dumps(prompt)}",
            generation_config=genai.GenerationConfig(response_mime_type="application/json", temperature=0.2, max_output_tokens=220),
        )
        arr = json.loads(res.text)
        if not isinstance(arr, list):
            return fallback
        out = []
        for item in arr:
            s = str(item).strip()
            if s and s not in out:
                out.append(s)
        return out[:6] if out else fallback
    except Exception:
        return fallback


def normalize_strategy_for_save(strategy: dict[str, Any]) -> dict[str, Any]:
    compiled = compile_strategy_payload(strategy)
    payload = compiled.model_dump()
    payload.setdefault("id", strategy.get("id") or f"strategy-{uuid.uuid4().hex[:10]}")
    return payload
