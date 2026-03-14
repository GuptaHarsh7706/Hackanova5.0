from __future__ import annotations

from copy import deepcopy
from enum import Enum

from models.strategy_schema import ParsedStrategy

TIMEFRAME_ALIASES = {
    "daily": "1d",
    "day": "1d",
    "1day": "1d",
    "hourly": "1h",
    "hour": "1h",
    "1hour": "1h",
    "weekly": "1w",
    "week": "1w",
}

INDICATOR_ALIASES = {
    "moving_average": "SMA",
    "ma": "SMA",
    "bollinger": "BBANDS",
    "bollinger_bands": "BBANDS",
}

CONDITION_ALIASES = {
    "gt": "greater_than",
    "lt": "less_than",
    "cross_above": "crosses_above",
    "cross_below": "crosses_below",
}


def _normalize_timeframe(value: str | None) -> str:
    if not value:
        return "1d"
    key = str(value).strip().lower()
    return TIMEFRAME_ALIASES.get(key, key)


def _enum_to_token(value) -> str:
    """Normalize enum-like values to raw token strings.

    Supports:
    - Enum instances (IndicatorType.RSI -> RSI)
    - prefixed strings ("IndicatorType.RSI" -> "RSI")
    - plain strings ("RSI" / "less_than")
    """
    if value is None:
        return ""
    if isinstance(value, Enum):
        value = value.value
    text = str(value).strip()
    if "." in text:
        text = text.split(".")[-1]
    return text


def infer_asset_class(ticker: str | None, current: str | None = None) -> str | None:
    if current:
        return current
    if not ticker:
        return None
    symbol = ticker.upper().strip()
    if symbol.endswith("USDT") or symbol in {"BTC", "ETH", "SOL", "XRP"}:
        return "crypto"
    if symbol in {"EURUSD", "GBPUSD", "USDJPY", "AUDUSD"}:
        return "forex"
    return "equity"


def _normalize_rule(rule: dict, *, index: int) -> dict:
    item = deepcopy(rule or {})
    indicator = _enum_to_token(item.get("indicator")).upper()
    indicator = INDICATOR_ALIASES.get(indicator.lower(), indicator)
    item["indicator"] = indicator

    condition = _enum_to_token(item.get("condition")).lower()
    condition = CONDITION_ALIASES.get(condition, condition)
    item["condition"] = condition

    if index == 0:
        item["logic_operator"] = "NONE"
    else:
        logic = str(item.get("logic_operator", "AND")).upper()
        if logic not in {"AND", "OR", "NONE"}:
            logic = "AND"
        item["logic_operator"] = logic

    params = item.get("params") or {}
    item["params"] = {
        "period": params.get("period"),
        "fast_period": params.get("fast_period"),
        "slow_period": params.get("slow_period"),
        "signal_period": params.get("signal_period"),
        "std_dev": params.get("std_dev"),
        "k_period": params.get("k_period"),
        "d_period": params.get("d_period"),
    }
    return item


def compile_strategy_payload(payload: dict | None) -> ParsedStrategy:
    base = deepcopy(payload or {})

    base["ticker"] = (base.get("ticker") or "").upper().strip() or None
    base["timeframe"] = _normalize_timeframe(base.get("timeframe"))
    base["asset_class"] = infer_asset_class(base.get("ticker"), base.get("asset_class"))

    entry_rules = base.get("entry_rules") or []
    exit_rules = base.get("exit_rules") or []
    base["entry_rules"] = [_normalize_rule(rule, index=i) for i, rule in enumerate(entry_rules)]
    base["exit_rules"] = [_normalize_rule(rule, index=i) for i, rule in enumerate(exit_rules)]

    if base.get("position_size") is None:
        base["position_size"] = 1.0

    return ParsedStrategy.model_validate(base)


def _rule_to_dsl(rule: dict) -> str:
    indicator = rule.get("indicator", "?")
    condition = rule.get("condition", "?")
    value = rule.get("value")
    params = rule.get("params") or {}

    param_bits = []
    for key in ("period", "fast_period", "slow_period", "signal_period", "std_dev", "k_period", "d_period"):
        if params.get(key) is not None:
            param_bits.append(f"{key}={params[key]}")
    param_suffix = f"[{', '.join(param_bits)}]" if param_bits else ""

    logic = rule.get("logic_operator", "AND")
    return f"{logic} {indicator}{param_suffix} {condition} {value}".strip()


def strategy_to_dsl(strategy: dict | ParsedStrategy) -> str:
    parsed = strategy if isinstance(strategy, ParsedStrategy) else compile_strategy_payload(strategy)
    data = parsed.model_dump()

    lines = [
        "STRATEGY:",
        f"  ticker: {data.get('ticker') or 'UNKNOWN'}",
        f"  timeframe: {data.get('timeframe')}",
        f"  asset_class: {data.get('asset_class') or 'unknown'}",
        "ENTRY:",
    ]

    if data.get("entry_rules"):
        lines.extend([f"  - {_rule_to_dsl(rule)}" for rule in data["entry_rules"]])
    else:
        lines.append("  - <empty>")

    lines.append("EXIT:")
    if data.get("exit_rules"):
        lines.extend([f"  - {_rule_to_dsl(rule)}" for rule in data["exit_rules"]])
    else:
        lines.append("  - <empty>")

    lines.extend(
        [
            "RISK:",
            f"  position_size: {data.get('position_size')}",
            f"  stop_loss_pct: {data.get('stop_loss_pct')}",
            f"  take_profit_pct: {data.get('take_profit_pct')}",
            f"  short_allowed: {str(data.get('short_allowed')).lower()}",
        ]
    )
    return "\n".join(lines)
