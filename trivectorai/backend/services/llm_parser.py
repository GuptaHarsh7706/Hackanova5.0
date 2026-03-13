import json
import os
import re
import time
from copy import deepcopy
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).parent.parent
ENV_PATH = BACKEND_ROOT / ".env"
load_dotenv(dotenv_path=ENV_PATH)

SYSTEM_PROMPT = BACKEND_ROOT / "prompts" / "strategy_system_prompt.txt"
SYSTEM_PROMPT_TEXT = SYSTEM_PROMPT.read_text()

_model = None
_supports_system_instruction = True
_model_name = None

CACHE_TTL_SECONDS = 600
_response_cache: dict[str, tuple[float, dict]] = {}

PREFERRED_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
]

COMPACT_SYSTEM_PROMPT = """You are StrategyParserGPT.
Return valid JSON only.
Schema: ticker,timeframe,asset_class,entry_rules,exit_rules,position_size,stop_loss_pct,take_profit_pct,max_hold_days,short_allowed,missing_fields,confidence_score,raw_input.
Use null for unknown fields and include them in missing_fields.
TradingRule fields: indicator,condition,value,params,logic_operator.
Indicators: SMA,EMA,RSI,MACD,BBANDS,PRICE,VOLUME,STOCH,ATR,VWAP.
Conditions: crosses_above,crosses_below,greater_than,less_than,equals,between.
Mappings:
- golden cross => SMA(50) crosses_above SMA(200)
- death cross => SMA(50) crosses_below SMA(200)
- RSI below 30 => RSI less_than 30
- RSI above 70 => RSI greater_than 70
- stop loss X% => stop_loss_pct X
- take profit X% => take_profit_pct X
- daily => timeframe 1d, hourly => timeframe 1h, 4h => timeframe 4h
If missing_fields non-empty include agent_message asking for all missing details in one response.
"""


def build_generation_config() -> genai.GenerationConfig:
    try:
        return genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.1,
            max_output_tokens=384,
        )
    except TypeError:
        # Fallback for SDK variants that do not support response_mime_type.
        return genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=384,
        )


def normalize_history(history: list[dict]) -> list[dict]:
    """Use only recent turns and valid Gemini roles to reduce token usage."""
    trimmed = history[-4:]
    normalized = []
    for h in trimmed:
        role = h.get("role", "user")
        if role not in {"user", "model"}:
            role = "model" if role in {"assistant", "agent"} else "user"
        normalized.append({"role": role, "content": h.get("content", "")[:600]})
    return normalized


def cache_key(message: str, history: list[dict]) -> str:
    return json.dumps({"m": message.strip().lower(), "h": history}, sort_keys=True)


def get_cached_response(key: str) -> dict | None:
    now = time.time()
    item = _response_cache.get(key)
    if not item:
        return None
    ts, payload = item
    if now - ts > CACHE_TTL_SECONDS:
        _response_cache.pop(key, None)
        return None
    return deepcopy(payload)


def set_cached_response(key: str, payload: dict) -> None:
    _response_cache[key] = (time.time(), deepcopy(payload))


def local_parse_strategy(message: str) -> dict | None:
    """Parse obvious strategies locally to avoid LLM calls for simple cases."""
    text = message.strip()
    low = text.lower()

    timeframe = "1d"
    if "15m" in low:
        timeframe = "15m"
    elif "30m" in low:
        timeframe = "30m"
    elif "5m" in low:
        timeframe = "5m"
    elif "1m" in low:
        timeframe = "1m"
    elif "hourly" in low or " 1h" in low:
        timeframe = "1h"
    elif "4h" in low:
        timeframe = "4h"
    elif "1w" in low or "weekly" in low:
        timeframe = "1w"

    ticker = None
    blocked_tokens = {
        "SMA",
        "EMA",
        "RSI",
        "MACD",
        "BBANDS",
        "PRICE",
        "VOLUME",
        "STOCH",
        "ATR",
        "VWAP",
        "AND",
        "OR",
        "BUY",
        "SELL",
        "SHORT",
    }
    ticker_candidates = re.findall(r"\b([A-Z]{2,10})\b", text)
    for token in ticker_candidates:
        if token not in blocked_tokens:
            ticker = token
            break

    # Keep common forex symbols if user types them lowercase.
    if not ticker:
        fx_match = re.search(r"\b([a-z]{6})\b", low)
        if fx_match:
            maybe = fx_match.group(1).upper()
            if maybe in {"EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD"}:
                ticker = maybe

    stop_loss = None
    take_profit = None
    sl = re.search(r"stop\s*loss\s*(\d+(?:\.\d+)?)%", low) or re.search(r"(\d+(?:\.\d+)?)%\s*stop\s*loss", low)
    tp = re.search(r"take\s*profit\s*(\d+(?:\.\d+)?)%", low) or re.search(r"(\d+(?:\.\d+)?)%\s*take\s*profit", low)
    if sl:
        stop_loss = float(sl.group(1))
    if tp:
        take_profit = float(tp.group(1))

    entry_rules: list[dict] = []
    exit_rules: list[dict] = []

    def default_params(period: int | None = None) -> dict:
        return {
            "period": period,
            "fast_period": None,
            "slow_period": None,
            "signal_period": None,
            "std_dev": None,
            "k_period": None,
            "d_period": None,
        }

    def append_rule(bucket: list[dict], indicator: str, condition: str, value, params: dict):
        logic = "NONE" if not bucket else ("OR" if " either " in f" {low} " or " or " in f" {low} " else "AND")
        bucket.append(
            {
                "indicator": indicator,
                "condition": condition,
                "value": value,
                "params": params,
                "logic_operator": logic,
            }
        )

    if "golden cross" in low:
        append_rule(entry_rules, "SMA", "crosses_above", "SMA_200", default_params(50))

    if "death cross" in low:
        append_rule(entry_rules, "SMA", "crosses_below", "SMA_200", default_params(50))

    sma_cross = re.search(r"(\d{1,3})\s*sma\s*cross(?:es)?\s*above\s*(\d{1,3})\s*sma", low)
    if sma_cross:
        fast = int(sma_cross.group(1))
        slow = int(sma_cross.group(2))
        append_rule(entry_rules, "SMA", "crosses_above", f"SMA_{slow}", default_params(fast))

    sma_cross_below = re.search(r"(\d{1,3})\s*sma\s*cross(?:es)?\s*below\s*(\d{1,3})\s*sma", low)
    if sma_cross_below:
        fast = int(sma_cross_below.group(1))
        slow = int(sma_cross_below.group(2))
        target_bucket = entry_rules if "buy" in low else (entry_rules if "short" in low else exit_rules)
        append_rule(target_bucket, "SMA", "crosses_below", f"SMA_{slow}", default_params(fast))

    ema_cross = re.search(r"(\d{1,3})\s*ema\s*cross(?:es)?\s*above\s*(\d{1,3})\s*ema", low)
    if ema_cross:
        fast = int(ema_cross.group(1))
        slow = int(ema_cross.group(2))
        append_rule(entry_rules, "EMA", "crosses_above", f"EMA_{slow}", default_params(fast))

    ema_cross_below = re.search(r"(\d{1,3})\s*ema\s*cross(?:es)?\s*below\s*(\d{1,3})\s*ema", low)
    if ema_cross_below:
        fast = int(ema_cross_below.group(1))
        slow = int(ema_cross_below.group(2))
        target_bucket = entry_rules if "short" in low else exit_rules
        append_rule(target_bucket, "EMA", "crosses_below", f"EMA_{slow}", default_params(fast))

    rsi_below = re.search(r"rsi\s*(?:is\s*|drops\s*|goes\s*)?below\s*(\d{1,3})", low)
    rsi_above = re.search(r"rsi\s*(?:is\s*|drops\s*|goes\s*)?above\s*(\d{1,3})", low)
    if rsi_below:
        append_rule(entry_rules, "RSI", "less_than", float(rsi_below.group(1)), default_params(14))
    if "sell" in low and rsi_above:
        append_rule(exit_rules, "RSI", "greater_than", float(rsi_above.group(1)), default_params(14))

    # MACD crossover support.
    if "macd crossover" in low or "macd cross" in low:
        append_rule(entry_rules, "MACD", "crosses_above", "MACD_SIGNAL", {"period": None, "fast_period": 12, "slow_period": 26, "signal_period": 9, "std_dev": None, "k_period": None, "d_period": None})

    # Bollinger breakout/touch support.
    if "bollinger" in low or "bbands" in low:
        if "upper band" in low and any(k in low for k in ["breakout", "breaks above", "closes above", "touches"]):
            append_rule(entry_rules, "BBANDS", "greater_than", "UPPER_BAND", {"period": 20, "fast_period": None, "slow_period": None, "signal_period": None, "std_dev": 2.0, "k_period": None, "d_period": None})
        elif "lower band" in low and any(k in low for k in ["breakdown", "breaks below", "closes below", "touches"]):
            target_bucket = entry_rules if "short" in low else exit_rules
            append_rule(target_bucket, "BBANDS", "less_than", "LOWER_BAND", {"period": 20, "fast_period": None, "slow_period": None, "signal_period": None, "std_dev": 2.0, "k_period": None, "d_period": None})

    # Price breakout helper when user does not explicitly mention BBANDS.
    if any(k in low for k in ["price breaks above", "breakout above", "closes above"]):
        append_rule(entry_rules, "PRICE", "crosses_above", None, default_params())

    # Short forex shorthand.
    if "short" in low:
        if not any(r.get("condition") == "crosses_below" for r in entry_rules):
            short_sma = re.search(r"(\d{1,3})\s*sma\s*cross(?:es)?\s*below\s*(\d{1,3})\s*sma", low)
            if short_sma:
                fast = int(short_sma.group(1))
                slow = int(short_sma.group(2))
                append_rule(entry_rules, "SMA", "crosses_below", f"SMA_{slow}", default_params(fast))

    # If user supplied only exit RSI phrase and no explicit sell keyword, still infer exit.
    if rsi_above and not exit_rules and any(k in low for k in ["exit", "sell", "take profit", "tp"]):
        append_rule(exit_rules, "RSI", "greater_than", float(rsi_above.group(1)), default_params(14))

    if not entry_rules:
        return None

    missing = []
    if not ticker:
        missing.append("ticker")

    agent_message = ""
    if missing:
        agent_message = "I need a bit more info: please share the ticker/symbol to test."

    return {
        "ticker": ticker,
        "timeframe": timeframe,
        "asset_class": (
            "crypto"
            if any(x in low for x in ["btc", "eth", "crypto", "bitcoin"])
            else ("forex" if any(x in low for x in ["forex", "eurusd", "gbpusd", "usdjpy"]) else None)
        ),
        "entry_rules": entry_rules,
        "exit_rules": exit_rules,
        "position_size": 1.0,
        "stop_loss_pct": stop_loss,
        "take_profit_pct": take_profit,
        "max_hold_days": None,
        "short_allowed": "short" in low,
        "missing_fields": missing,
        "confidence_score": 0.92,
        "raw_input": message,
        "agent_message": agent_message,
    }


def get_model() -> genai.GenerativeModel:
    global _model
    global _supports_system_instruction
    global _model_name
    if _model is not None:
        return _model

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing or empty in backend/.env")

    genai.configure(api_key=api_key)

    available_models = []
    try:
        for model in genai.list_models():
            supported = getattr(model, "supported_generation_methods", []) or []
            if "generateContent" in supported:
                available_models.append(model.name.replace("models/", ""))
    except Exception:
        # If model listing fails (network/permissions), keep preferred defaults.
        available_models = []

    _model_name = None
    if available_models:
        for preferred in PREFERRED_MODELS:
            if preferred in available_models:
                _model_name = preferred
                break
        if _model_name is None:
            _model_name = available_models[0]
    else:
        _model_name = PREFERRED_MODELS[0]

    try:
        _model = genai.GenerativeModel(
            model_name=_model_name,
            system_instruction=COMPACT_SYSTEM_PROMPT,
            generation_config=build_generation_config(),
        )
        _supports_system_instruction = True
    except TypeError:
        _model = genai.GenerativeModel(
            model_name=_model_name,
            generation_config=build_generation_config(),
        )
        _supports_system_instruction = False
    return _model


def build_conversation(history: list[dict], new_message: str) -> list[dict]:
    """Build Gemini-format conversation turns."""
    turns = []
    if not _supports_system_instruction:
        turns.append(
            {
                "role": "user",
                "parts": [
                    "Follow these strict instructions and output valid JSON only:\n\n"
                    + SYSTEM_PROMPT_TEXT
                ],
            }
        )
    for h in history:
        turns.append({"role": h["role"], "parts": [h["content"]]})
    turns.append({"role": "user", "parts": [new_message]})
    return turns


def parse_strategy_with_llm(message: str, history: list[dict]) -> dict:
    """
    Parse strategy locally when possible, otherwise call Gemini.
    Raises ValueError on unparseable response.
    """
    try:
        fast_path = local_parse_strategy(message)
        if fast_path is not None:
            return fast_path

        trimmed_history = normalize_history(history)
        key = cache_key(message, trimmed_history)
        cached = get_cached_response(key)
        if cached is not None:
            return cached

        model = get_model()
        turns = build_conversation(trimmed_history, message)
        response = model.generate_content(turns)
        raw = (getattr(response, "text", "") or "").strip()
        if not raw:
            raise RuntimeError("Gemini returned an empty response")

        # Strip markdown fences if model adds them despite instruction
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        parsed = json.loads(raw)
        parsed["raw_input"] = message
        set_cached_response(key, parsed)
        return parsed

    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}")
    except Exception as e:
        if _model_name:
            raise RuntimeError(f"Gemini API error (model={_model_name}): {e}")
        raise RuntimeError(f"Gemini API error: {e}")
