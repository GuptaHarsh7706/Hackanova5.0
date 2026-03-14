from __future__ import annotations

import json
import os
import re

import google.generativeai as genai

from dsl.strategy_dsl import compile_strategy_payload, strategy_to_dsl


PARSE_SYSTEM_PROMPT = """
You are a trading strategy parser. Convert natural language into a structured JSON object.
Output ONLY valid JSON with these keys:
ticker, timeframe, asset_class, entry_rules, exit_rules, position_size,
stop_loss_pct, take_profit_pct, short_allowed, missing_fields, confidence_score.
Use null for unknown fields and include them in missing_fields.
Golden cross means SMA(50) crosses_above SMA(200).
Death cross means SMA(50) crosses_below SMA(200).
RSI oversold means RSI(14) less_than 30.
RSI overbought means RSI(14) greater_than 70.
MACD crossover means MACD crosses_above SIGNAL.
Daily means timeframe 1d. Hourly means 1h. 4h means 4h.
"""

KNOWN_SYMBOLS = {
    "bitcoin": "BTCUSDT",
    "btc": "BTCUSDT",
    "ethereum": "ETHUSDT",
    "eth": "ETHUSDT",
    "spy": "SPY",
    "aapl": "AAPL",
    "tsla": "TSLA",
    "nvda": "NVDA",
    "ethusdt": "ETHUSDT",
    "btcusdt": "BTCUSDT",
    "eurusd": "EURUSD",
    "gbpusd": "GBPUSD",
    "usdjpy": "USDJPY",
}


def _blank_params(**updates):
    params = {
        "period": None,
        "fast_period": None,
        "slow_period": None,
        "signal_period": None,
        "std_dev": None,
        "k_period": None,
        "d_period": None,
    }
    params.update(updates)
    return params


def _append_rule(rules: list[dict], indicator: str, condition: str, value, params: dict, joiner: str):
    rules.append(
        {
            "indicator": indicator,
            "condition": condition,
            "value": value,
            "params": params,
            "logic_operator": "NONE" if not rules else joiner,
        }
    )


def _extract_ticker(text: str) -> str | None:
    low = text.lower()
    for key, symbol in KNOWN_SYMBOLS.items():
        if re.search(rf"\b{re.escape(key)}\b", low):
            return symbol
    for token in re.findall(r"\b[A-Z]{2,10}\b", text):
        if token not in {"SMA", "EMA", "RSI", "MACD", "ATR", "VWAP", "PRICE", "VOLUME", "STOCH", "BBANDS", "AND", "OR"}:
            return token
    return None


def _extract_timeframe(text: str) -> str:
    low = text.lower()
    if "15m" in low or "15-minute" in low:
        return "15m"
    if "30m" in low or "30-minute" in low:
        return "30m"
    if "5m" in low or "5-minute" in low:
        return "5m"
    if "1m" in low or "1-minute" in low:
        return "1m"
    if "4h" in low:
        return "4h"
    if "1h" in low or "hourly" in low or "hour" in low:
        return "1h"
    if "1w" in low or "weekly" in low:
        return "1w"
    return "1d"


def _extract_asset_class(text: str, ticker: str | None) -> str | None:
    low = text.lower()
    if any(token in low for token in ["btc", "eth", "crypto", "bitcoin", "ethereum"]) or (ticker and ticker.endswith("USDT")):
        return "crypto"
    if any(token in low for token in ["eurusd", "gbpusd", "usdjpy", "forex"]):
        return "forex"
    if ticker:
        return "equity"
    return None


def _extract_percent(text: str, pattern: str):
    match = re.search(pattern, text.lower())
    return float(match.group(1)) if match else None


def _merge_strategy(base: dict | None, patch: dict) -> dict:
    if not base:
        return patch
    merged = json.loads(json.dumps(base))
    for key, value in patch.items():
        if key in {"entry_rules", "exit_rules"}:
            if value:
                merged[key] = value
            elif key not in merged:
                merged[key] = []
        elif key == "missing_fields":
            continue
        elif value not in (None, "", []):
            merged[key] = value
    return merged


def _parse_locally(text: str, base: dict | None = None) -> dict:
    low = text.lower()
    joiner = "OR" if " or " in f" {low} " or " either " in f" {low} " else "AND"

    strategy = {
        "ticker": _extract_ticker(text),
        "timeframe": _extract_timeframe(text),
        "asset_class": None,
        "entry_rules": [],
        "exit_rules": [],
        "position_size": 1.0,
        "stop_loss_pct": _extract_percent(text, r"stop\s*loss\s*(\d+(?:\.\d+)?)%") or _extract_percent(text, r"(\d+(?:\.\d+)?)%\s*stop\s*loss"),
        "take_profit_pct": _extract_percent(text, r"take\s*profit\s*(\d+(?:\.\d+)?)%") or _extract_percent(text, r"(\d+(?:\.\d+)?)%\s*(?:target|take\s*profit)"),
        "short_allowed": "short" in low,
        "missing_fields": [],
        "confidence_score": 0.82,
        "raw_input": text,
    }
    strategy["asset_class"] = _extract_asset_class(text, strategy["ticker"])

    if "golden cross" in low:
        _append_rule(strategy["entry_rules"], "SMA", "crosses_above", "SMA_200", _blank_params(period=50), joiner)
    if "death cross" in low:
        _append_rule(strategy["entry_rules"], "SMA", "crosses_below", "SMA_200", _blank_params(period=50), joiner)

    for indicator in ("SMA", "EMA"):
        cross = re.search(rf"(\d{{1,3}})\s*{indicator.lower()}\s*(?:crosses|cross)?\s*above\s*(\d{{1,3}})\s*{indicator.lower()}", low)
        if cross:
            fast, slow = int(cross.group(1)), int(cross.group(2))
            _append_rule(strategy["entry_rules"], indicator, "crosses_above", f"{indicator}_{slow}", _blank_params(period=fast), joiner)
        cross_below = re.search(rf"(\d{{1,3}})\s*{indicator.lower()}\s*(?:crosses|cross)?\s*below\s*(\d{{1,3}})\s*{indicator.lower()}", low)
        if cross_below:
            fast, slow = int(cross_below.group(1)), int(cross_below.group(2))
            target = strategy["entry_rules"] if "short" in low or "buy" in low else strategy["exit_rules"]
            _append_rule(target, indicator, "crosses_below", f"{indicator}_{slow}", _blank_params(period=fast), joiner)

    rsi_buy = re.search(r"(?:buy|entry|when) .*?rsi.*?(?:below|less than|drops below)\s*(\d{1,3})", low)
    rsi_sell = re.search(r"(?:sell|exit).*?rsi.*?(?:above|greater than|goes above|exceeds)\s*(\d{1,3})", low)
    rsi_generic_low = re.search(r"rsi.*?(?:below|less than|oversold)\s*(\d{1,3})?", low)
    rsi_generic_high = re.search(r"rsi.*?(?:above|greater than|overbought|exceeds)\s*(\d{1,3})?", low)
    if rsi_buy:
        _append_rule(strategy["entry_rules"], "RSI", "less_than", float(rsi_buy.group(1)), _blank_params(period=14), joiner)
    elif "rsi oversold" in low:
        _append_rule(strategy["entry_rules"], "RSI", "less_than", 30.0, _blank_params(period=14), joiner)
    elif rsi_generic_low and "sell" not in low:
        value = float(rsi_generic_low.group(1)) if rsi_generic_low.group(1) else 30.0
        _append_rule(strategy["entry_rules"], "RSI", "less_than", value, _blank_params(period=14), joiner)

    if rsi_sell:
        _append_rule(strategy["exit_rules"], "RSI", "greater_than", float(rsi_sell.group(1)), _blank_params(period=14), joiner)
    elif "rsi overbought" in low:
        _append_rule(strategy["exit_rules"], "RSI", "greater_than", 70.0, _blank_params(period=14), joiner)
    elif rsi_generic_high and any(token in low for token in ["sell", "exit"]):
        value = float(rsi_generic_high.group(1)) if rsi_generic_high.group(1) else 70.0
        _append_rule(strategy["exit_rules"], "RSI", "greater_than", value, _blank_params(period=14), joiner)

    if "macd crossover" in low or "macd cross" in low:
        _append_rule(
            strategy["entry_rules"],
            "MACD",
            "crosses_above",
            "SIGNAL",
            _blank_params(fast_period=12, slow_period=26, signal_period=9),
            joiner,
        )
    if re.search(r"sell .*?macd.*?(?:below|crosses below)", low):
        _append_rule(
            strategy["exit_rules"],
            "MACD",
            "crosses_below",
            "SIGNAL",
            _blank_params(fast_period=12, slow_period=26, signal_period=9),
            joiner,
        )

    if "bollinger" in low or "upper band" in low:
        if any(token in low for token in ["upper band", "breakout", "closes above", "breaks above"]):
            _append_rule(strategy["entry_rules"], "BBANDS", "greater_than", "UPPER_BAND", _blank_params(period=20, std_dev=2.0), joiner)

    if not strategy["entry_rules"] and base:
        strategy["entry_rules"] = base.get("entry_rules", [])
    if not strategy["exit_rules"] and base:
        strategy["exit_rules"] = base.get("exit_rules", [])
    if not strategy["ticker"] and base:
        strategy["ticker"] = base.get("ticker")
    if strategy["timeframe"] == "1d" and base and _extract_timeframe(text) == "1d":
        strategy["timeframe"] = base.get("timeframe", "1d")
    if not strategy["asset_class"] and base:
        strategy["asset_class"] = base.get("asset_class")

    strategy = _merge_strategy(base, strategy)
    missing = []
    if not strategy.get("ticker"):
        missing.append("ticker")
    if not strategy.get("entry_rules"):
        missing.append("entry_rules")
    strategy["missing_fields"] = missing
    strategy["confidence_score"] = 0.9 if strategy.get("entry_rules") else 0.45
    return strategy


def _parse_context(context: str) -> dict | None:
    if not context:
        return None


def _finalize_strategy(strategy: dict) -> dict:
    compiled = compile_strategy_payload(strategy)
    output = compiled.model_dump()
    output["dsl_script"] = strategy_to_dsl(compiled)
    return output
    try:
        return json.loads(context)
    except Exception:
        return None


def execute_parse_tool(text: str, context: str = "") -> dict:
    base_strategy = _parse_context(context)
    local_strategy = _parse_locally(text, base_strategy)

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        try:
            return {"success": True, "strategy": _finalize_strategy(local_strategy)}
        except Exception:
            return {"success": True, "strategy": local_strategy}

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=PARSE_SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.05,
                max_output_tokens=1024,
            ),
        )
        prompt = text if not context else f"Context from conversation: {context}\n\nStrategy to parse: {text}"
        response = model.generate_content(prompt)
        raw = re.sub(r"^```json\s*", "", response.text.strip())
        raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)
        parsed["raw_input"] = text
        merged = _merge_strategy(base_strategy, parsed)
        if not merged.get("entry_rules") and local_strategy.get("entry_rules"):
            merged["entry_rules"] = local_strategy["entry_rules"]
        if not merged.get("ticker"):
            merged["ticker"] = local_strategy.get("ticker")
        if merged.get("timeframe") == "1d" and local_strategy.get("timeframe") != "1d":
            merged["timeframe"] = local_strategy["timeframe"]
        if not merged.get("asset_class"):
            merged["asset_class"] = local_strategy.get("asset_class")
        if merged.get("stop_loss_pct") is None:
            merged["stop_loss_pct"] = local_strategy.get("stop_loss_pct")
        if merged.get("take_profit_pct") is None:
            merged["take_profit_pct"] = local_strategy.get("take_profit_pct")
        if not merged.get("missing_fields"):
            merged["missing_fields"] = local_strategy.get("missing_fields", [])
        try:
            return {"success": True, "strategy": _finalize_strategy(merged)}
        except Exception:
            return {"success": True, "strategy": merged}
    except Exception:
        try:
            return {"success": True, "strategy": _finalize_strategy(local_strategy)}
        except Exception:
            return {"success": True, "strategy": local_strategy}
