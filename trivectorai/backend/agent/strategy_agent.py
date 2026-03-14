from __future__ import annotations

import json
import os
from pathlib import Path

import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

from models.api_schema import ParseResponse

from .memory import AgentMemory
from .tool_registry import TOOL_DEFINITIONS
from .tools.backtest_tool import execute_backtest_tool
from .tools.clarify_tool import execute_clarify_tool
from .tools.improve_tool import execute_improve_tool
from .tools.narrate_tool import execute_narrate_tool
from .tools.parse_tool import execute_parse_tool
from .tools.validate_tool import execute_validate_tool


TOOL_EXECUTORS = {
    "parse_strategy": execute_parse_tool,
    "validate_strategy": execute_validate_tool,
    "ask_clarification": execute_clarify_tool,
    "run_backtest": execute_backtest_tool,
    "narrate_results": execute_narrate_tool,
}

SYSTEM_PROMPT = Path(__file__).parent.parent / "prompts" / "strategy_agent_system.txt"

ASSET_RESEARCH_HINTS = {
    "equity": [
        "Equity data can gap between sessions; open/close behavior matters for crossover triggers.",
        "For daily equities, overnight risk and earnings-event volatility may distort short-term backtests.",
    ],
    "crypto": [
        "Crypto trades 24/7, so signal cadence can be more continuous than equities.",
        "Volatility clustering is common; risk controls (SL/TP) are especially important.",
    ],
    "forex": [
        "Forex liquidity varies strongly by session overlap (London/NY).",
        "Spread and rollover can materially affect intraday strategies.",
    ],
    "commodity": [
        "Commodities can show regime shifts around macro releases and inventory data.",
        "Session behavior differs by contract and venue; align timeframe with contract liquidity.",
    ],
}


def _build_gemini_tools():
    declarations = []
    for tool in TOOL_DEFINITIONS:
        declarations.append(
            FunctionDeclaration(
                name=tool["name"],
                description=tool["description"],
                parameters=tool["parameters"],
            )
        )
    return [Tool(function_declarations=declarations)]


def _build_confirmation_message(strategy: dict) -> str:
    entry_parts = []
    for rule in strategy.get("entry_rules", []):
        params = rule.get("params", {}) or {}
        period = params.get("period")
        label = f"{rule.get('indicator')}{f'({period})' if period else ''}"
        value = rule.get("value")
        entry_parts.append(f"{label} {str(rule.get('condition', '')).replace('_', ' ')} {value}".strip())
    exit_parts = []
    for rule in strategy.get("exit_rules", []):
        params = rule.get("params", {}) or {}
        period = params.get("period")
        label = f"{rule.get('indicator')}{f'({period})' if period else ''}"
        value = rule.get("value")
        exit_parts.append(f"{label} {str(rule.get('condition', '')).replace('_', ' ')} {value}".strip())

    lines = [
        f"Strategy parsed successfully for **{strategy.get('ticker', 'Unknown')}** on {strategy.get('timeframe', '1d')} chart.",
        f"Entry: {' AND '.join(entry_parts) if entry_parts else 'Not specified'}",
    ]
    if exit_parts:
        lines.append(f"Exit: {' AND '.join(exit_parts)}")
    if strategy.get("stop_loss_pct") is not None:
        lines.append(f"Stop loss: {strategy['stop_loss_pct']}%")
    if strategy.get("take_profit_pct") is not None:
        lines.append(f"Take profit: {strategy['take_profit_pct']}%")
    lines.append("Ready to run backtest!")
    return "\n".join(lines)


def _rule_to_text(rule: dict) -> str:
    params = rule.get("params", {}) or {}
    indicator = rule.get("indicator", "?")
    period = params.get("period")
    suffix = f"({period})" if period else ""
    condition = str(rule.get("condition", "")).replace("_", " ")
    value = rule.get("value")
    if value in (None, ""):
        return f"{indicator}{suffix} {condition}".strip()
    return f"{indicator}{suffix} {condition} {value}".strip()


def _build_parse_details(strategy: dict | None, validation: dict | None, user_message: str) -> dict:
    strategy = strategy or {}
    validation = validation or {}
    entry_rules = strategy.get("entry_rules") or []
    exit_rules = strategy.get("exit_rules") or []
    missing = validation.get("missing_fields", [])
    issues = validation.get("issues", [])

    assumptions = []
    if "daily" not in user_message.lower() and strategy.get("timeframe") == "1d":
        assumptions.append("Defaulted timeframe to 1d")
    if strategy.get("position_size") == 1.0:
        assumptions.append("Using full capital position size (100%)")
    if strategy.get("stop_loss_pct") is None:
        assumptions.append("No stop loss provided")
    if strategy.get("take_profit_pct") is None:
        assumptions.append("No take profit target provided")

    quality = 100
    quality -= len(missing) * 22
    quality -= len(issues) * 14
    quality += 8 if entry_rules else 0
    quality += 4 if strategy.get("ticker") else 0
    quality += 2 if strategy.get("timeframe") else 0
    quality = max(0, min(100, quality))

    extracted_signals = [_rule_to_text(r) for r in entry_rules[:4]]
    exit_signals = [_rule_to_text(r) for r in exit_rules[:3]]

    asset_class = strategy.get("asset_class") or "equity"
    timeframe = strategy.get("timeframe") or "1d"
    context_profile = {
        "asset_class": asset_class,
        "timeframe": timeframe,
        "session_model": "24x7" if asset_class == "crypto" else "session_based",
        "research_notes": ASSET_RESEARCH_HINTS.get(asset_class, ASSET_RESEARCH_HINTS["equity"]),
    }

    agent_assignments = [
        {
            "agent": "IntentAgent",
            "role": "Interpret user objective and constraints",
            "status": "done",
            "output": f"Detected objective from message ({len(user_message.split())} tokens)",
        },
        {
            "agent": "ParserAgent",
            "role": "Convert natural language to structured trading rules",
            "status": "done" if entry_rules else "active",
            "output": f"Extracted {len(entry_rules)} entry rule(s) and {len(exit_rules)} exit rule(s)",
        },
        {
            "agent": "ContextAgent",
            "role": "Attach market/timeframe context and default assumptions",
            "status": "done",
            "output": f"Applied {asset_class} + {timeframe} context profile",
        },
        {
            "agent": "RiskAgent",
            "role": "Check risk controls and validation constraints",
            "status": "done" if not issues else "needs_attention",
            "output": "No blocking issues" if not issues else f"Detected {len(issues)} validation issue(s)",
        },
    ]

    reasoning_summary = (
        "Strategy is execution-ready with valid ticker/rules and no blocking issues."
        if validation.get("can_run")
        else "Strategy understanding is partial; additional clarification or fixes are required before backtest."
    )

    return {
        "readiness_score": quality,
        "can_run": bool(validation.get("can_run", False)),
        "missing_fields": missing,
        "issues": issues,
        "assumptions": assumptions,
        "extracted_signals": extracted_signals,
        "exit_signals": exit_signals,
        "summary": {
            "ticker": strategy.get("ticker"),
            "timeframe": strategy.get("timeframe"),
            "asset_class": strategy.get("asset_class"),
            "entry_rule_count": len(entry_rules),
            "exit_rule_count": len(exit_rules),
        },
        "dsl_preview": strategy.get("dsl_script", ""),
        "reasoning_summary": reasoning_summary,
        "context_profile": context_profile,
        "agent_assignments": agent_assignments,
    }


def _merge_strategy(base: dict | None, patch: dict | None) -> dict | None:
    if not patch:
        return base
    if not base:
        return patch
    merged = json.loads(json.dumps(base))
    for key, value in patch.items():
        if key in {"entry_rules", "exit_rules"}:
            if value:
                merged[key] = value
        elif value not in (None, "", []):
            merged[key] = value
    return merged


def _deterministic_parse_flow(user_message: str, memory: AgentMemory) -> ParseResponse:
    trace = ["Received user message", "Running deterministic parser"]
    context = json.dumps(memory.current_strategy) if memory.current_strategy else ""
    parsed_result = execute_parse_tool(text=user_message, context=context)
    if not parsed_result.get("success"):
        message = parsed_result.get("error", "I had trouble processing that. Could you rephrase your strategy?")
        memory.add_agent_message(message)
        return ParseResponse(
            status="error",
            strategy=memory.current_strategy,
            agent_message=message,
            session_id=memory.session_id,
            can_run=False,
            parse_details={},
            agent_trace=trace,
        )

    trace.append("Merged with session strategy context")
    parsed_strategy = _merge_strategy(memory.current_strategy, parsed_result.get("strategy"))
    memory.current_strategy = parsed_strategy
    validation = execute_validate_tool(parsed_strategy)
    trace.append("Validated strategy structure")

    missing_fields = validation.get("missing_fields", [])
    issues = validation.get("issues", [])
    parse_details = _build_parse_details(parsed_strategy, validation, user_message)

    if missing_fields or issues:
        question = execute_clarify_tool(missing_fields=missing_fields, partial_strategy=parsed_strategy)
        issue_block = ""
        if issues:
            issue_lines = "\n".join(f"- {item}" for item in issues[:4])
            issue_block = f"\n\nI also found a few things to fix before backtesting:\n{issue_lines}"

        memory.clarification_count += 1
        msg = f"{question.get('question', 'Could you tell me more about your strategy?')}{issue_block}"
        memory.add_agent_message(msg)
        trace.append("Asked clarification question")
        return ParseResponse(
            status="needs_clarification",
            strategy=parsed_strategy,
            agent_message=msg,
            missing_fields=missing_fields,
            session_id=memory.session_id,
            can_run=False,
            parse_details=parse_details,
            agent_trace=trace,
        )

    message = _build_confirmation_message(parsed_strategy)
    memory.add_agent_message(message)
    trace.append("Strategy ready for backtest")
    return ParseResponse(
        status="ok",
        strategy=parsed_strategy,
        agent_message=message,
        missing_fields=[],
        session_id=memory.session_id,
        can_run=True,
        parse_details=parse_details,
        agent_trace=trace,
    )


def run_agent(user_message: str, memory: AgentMemory) -> ParseResponse:
    memory.add_user_message(user_message)
    trace = ["Received user message"]

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _deterministic_parse_flow(user_message, memory)

    try:
        trace.append("Routing to Gemini tool-calling agent")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=SYSTEM_PROMPT.read_text(),
            tools=_build_gemini_tools(),
            generation_config=genai.GenerationConfig(temperature=0.1),
        )
        chat = model.start_chat(history=memory.get_gemini_history()[:-1])

        parsed_strategy = memory.current_strategy
        response = None
        for iteration in range(8):
            if iteration == 0:
                response = chat.send_message(user_message)

            candidate = response.candidates[0]
            function_call = None
            final_text = None
            for part in candidate.content.parts:
                if getattr(part, "function_call", None):
                    function_call = part.function_call
                    break
                if getattr(part, "text", None):
                    final_text = part.text
                    break

            if final_text and not function_call:
                validation = execute_validate_tool(parsed_strategy or {})
                details = _build_parse_details(parsed_strategy, validation, user_message)
                memory.add_agent_message(final_text)
                return ParseResponse(
                    status="ok" if validation.get("can_run") else "needs_clarification",
                    strategy=parsed_strategy,
                    agent_message=final_text,
                    missing_fields=validation.get("missing_fields", []),
                    session_id=memory.session_id,
                    can_run=bool(validation.get("can_run", False)),
                    parse_details=details,
                    agent_trace=trace,
                )

            if not function_call:
                break

            tool_name = function_call.name
            tool_args = dict(function_call.args)
            trace.append(f"Tool call: {tool_name}")
            tool_result = TOOL_EXECUTORS[tool_name](**tool_args)

            if tool_name == "parse_strategy" and tool_result.get("success"):
                parsed_strategy = _merge_strategy(memory.current_strategy, tool_result.get("strategy"))
                memory.current_strategy = parsed_strategy

            if tool_name == "validate_strategy":
                missing_fields = tool_result.get("missing_fields", [])
                issues = tool_result.get("issues", [])
                details = _build_parse_details(parsed_strategy, tool_result, user_message)
                if missing_fields or issues:
                    question = execute_clarify_tool(missing_fields=missing_fields, partial_strategy=parsed_strategy or {})
                    issue_block = ""
                    if issues:
                        issue_lines = "\n".join(f"- {item}" for item in issues[:4])
                        issue_block = f"\n\nI also found a few things to fix before backtesting:\n{issue_lines}"
                    memory.clarification_count += 1
                    msg = f"{question['question']}{issue_block}"
                    memory.add_agent_message(msg)
                    return ParseResponse(
                        status="needs_clarification",
                        strategy=parsed_strategy,
                        agent_message=msg,
                        missing_fields=missing_fields,
                        session_id=memory.session_id,
                        can_run=False,
                        parse_details=details,
                        agent_trace=trace,
                    )
                confirmation = _build_confirmation_message(parsed_strategy or {})
                memory.add_agent_message(confirmation)
                return ParseResponse(
                    status="ok",
                    strategy=parsed_strategy,
                    agent_message=confirmation,
                    missing_fields=[],
                    session_id=memory.session_id,
                    can_run=True,
                    parse_details=details,
                    agent_trace=trace,
                )

            response = chat.send_message(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=tool_name,
                        response={"result": json.dumps(tool_result, default=str)},
                    )
                )
            )
    except Exception:
        trace.append("Gemini path failed; fell back to deterministic parser")
        return _deterministic_parse_flow(user_message, memory)

    return _deterministic_parse_flow(user_message, memory)


# ---------------------------------------------------------------------------
# Conversational chat helpers
# ---------------------------------------------------------------------------

_STRATEGY_KEYWORDS = {
    "buy", "sell", "rsi", "macd", "sma", "ema", "ma", "moving average",
    "crossover", "cross above", "cross below", "bollinger", "band",
    "breakout", "momentum", "entry", "exit", "stop loss", "take profit",
    "backtest", "ticker", "timeframe", "strategy", "trade", "position",
    "oversold", "overbought", "golden cross", "death cross", "signal",
}

_CONVERSATIONAL_KEYWORDS = {
    "hello", "hi", "hey", "thanks", "thank you", "what can you",
    "how do you", "what is", "explain", "tell me about", "what are",
    "help me understand", "who are you", "what do you do",
    "good morning", "good evening", "good afternoon",
}

_INDICATOR_QA: dict[str, str] = {
    "rsi": (
        "RSI (Relative Strength Index) is a momentum oscillator from 0–100.\n"
        "• RSI > 70 → overbought (potential sell)\n"
        "• RSI < 30 → oversold (potential buy)\n"
        "Example: 'Buy when RSI(14) drops below 30, sell when it rises above 70.'"
    ),
    "macd": (
        "MACD compares a 12-period and 26-period EMA to track trend momentum.\n"
        "• MACD crosses above signal line → bullish\n"
        "• MACD crosses below signal line → bearish\n"
        "Example: 'Buy when MACD crosses above the signal line.'"
    ),
    "bollinger": (
        "Bollinger Bands are volatility channels around a moving average.\n"
        "• Upper band = MA + 2σ  |  Lower band = MA − 2σ\n"
        "Use for mean-reversion: buy near lower band, sell near upper band."
    ),
    "moving average": (
        "Moving averages smooth price data to reveal trends:\n"
        "• SMA (Simple) – equal weight over N periods\n"
        "• EMA (Exponential) – more weight on recent prices, faster reaction\n"
        "Famous pattern: Golden Cross (50-MA crosses above 200-MA → bullish)."
    ),
}

_FALLBACK_GREETING = (
    "Hello! I'm TriVectorAI — your AI-powered trading strategy assistant.\n"
    "You can:\n"
    "• Describe a strategy in plain English (e.g. 'Buy AAPL when RSI < 30')\n"
    "• Ask me follow-up questions or respond to my clarifications\n"
    "• Request analysis and improvements after a backtest\n\n"
    "What would you like to build today?"
)

_IDENTITY_RESPONSE = (
    "I'm TriVectorAI — a multi-agent quantitative trading assistant. Here's what I can do:\n"
    "• Parse natural-language strategies into executable rules\n"
    "• Validate strategies for completeness and risk issues\n"
    "• Run multi-step agentic backtests on historical data\n"
    "• Analyse results and suggest data-driven improvements\n"
    "• Answer questions about indicators, strategies, and market concepts"
)


def _is_general_conversation(message: str) -> bool:
    """Return True when the message looks like general chat rather than a strategy."""
    msg = message.lower().strip()
    has_conv = any(kw in msg for kw in _CONVERSATIONAL_KEYWORDS)
    has_strat = any(kw in msg for kw in _STRATEGY_KEYWORDS)
    if has_conv and not has_strat:
        return True
    if len(msg.split()) <= 6 and not has_strat:
        return True
    return False


def _rule_based_chat_response(message: str) -> str:
    msg = message.lower()
    if any(t in msg for t in ("who are you", "what do you do", "what can you")):
        return _IDENTITY_RESPONSE
    for keyword, answer in _INDICATOR_QA.items():
        if keyword in msg:
            return answer
    if any(t in msg for t in ("hello", "hi", "hey", "good morning", "good evening", "good afternoon")):
        return _FALLBACK_GREETING
    if any(t in msg for t in ("thank", "thanks")):
        return "You're welcome! Let me know if you'd like to build or improve a strategy."
    return (
        "I'm here to help you build and backtest trading strategies! "
        "Try: 'Buy SPY when the 50-day MA crosses above the 200-day MA and RSI < 35. "
        "Sell when RSI > 70.' — or ask me about any trading indicator."
    )


def handle_chat(user_message: str, memory: AgentMemory) -> ParseResponse:
    """
    Handle a conversational message that is *not* a strategy description.
    Preserves session continuity but does not alter the current strategy state.
    """
    memory.add_user_message(user_message)
    trace = ["Received message", "Classified: general conversation"]

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=(
                    "You are TriVectorAI, a friendly and knowledgeable quantitative trading assistant. "
                    "Answer trading questions clearly and concisely (under 180 words). "
                    "When the user seems ready to describe a strategy, encourage them. "
                    "Do NOT fabricate market data or prices."
                ),
                generation_config=genai.GenerationConfig(temperature=0.4),
            )
            chat = model.start_chat(history=memory.get_gemini_history()[:-1])
            response = chat.send_message(user_message)
            text = response.candidates[0].content.parts[0].text
            memory.add_agent_message(text)
            trace.append("Gemini conversational response generated")
            return ParseResponse(
                status="ok",
                strategy=memory.current_strategy,
                agent_message=text,
                session_id=memory.session_id,
                can_run=bool(memory.current_strategy),
                parse_details={},
                agent_trace=trace,
            )
        except Exception:
            trace.append("Gemini failed; falling back to rule-based response")

    text = _rule_based_chat_response(user_message)
    memory.add_agent_message(text)
    trace.append("Rule-based response generated")
    return ParseResponse(
        status="ok",
        strategy=memory.current_strategy,
        agent_message=text,
        session_id=memory.session_id,
        can_run=bool(memory.current_strategy),
        parse_details={},
        agent_trace=trace,
    )


# ---------------------------------------------------------------------------
# Strategy improvement
# ---------------------------------------------------------------------------

def improve_strategy(strategy: dict, backtest_metrics: dict) -> dict:
    """
    Try Gemini-powered improvement first; fall back to rule-based execute_improve_tool.
    Always returns the shape produced by execute_improve_tool.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config=genai.GenerationConfig(temperature=0.2),
            )
            prompt = (
                "You are an expert quantitative analyst. Analyse this backtest result and "
                "suggest a concise, actionable improved strategy.\n\n"
                f"Original Strategy:\n{json.dumps(strategy, indent=2)}\n\n"
                "Backtest Metrics:\n"
                f"  Total Return: {backtest_metrics.get('total_return_pct', 'N/A')}%\n"
                f"  Win Rate: {backtest_metrics.get('win_rate_pct', 'N/A')}%\n"
                f"  Sharpe Ratio: {backtest_metrics.get('sharpe_ratio', 'N/A')}\n"
                f"  Max Drawdown: {backtest_metrics.get('max_drawdown_pct', 'N/A')}%\n"
                f"  Total Trades: {backtest_metrics.get('total_trades', 'N/A')}\n\n"
                "Respond ONLY with a JSON object:\n"
                '{"summary":"...","issues":[{"id":"...","suggestion":"..."}],'
                '"general_tips":["...","..."],"natural_language":"improved strategy in plain English"}'
            )
            response = model.generate_content(prompt)
            raw = response.candidates[0].content.parts[0].text.strip()
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            gemini_data = json.loads(raw)

            base = execute_improve_tool(strategy, backtest_metrics)
            base["summary"] = gemini_data.get("summary", base["summary"])
            base["issues"] = gemini_data.get("issues", base["issues"])
            base["general_tips"] = gemini_data.get("general_tips", base["general_tips"])
            if gemini_data.get("natural_language"):
                base["natural_language"] = gemini_data["natural_language"]
            return base
        except Exception:
            pass  # Fall through to rule-based

    return execute_improve_tool(strategy, backtest_metrics)

