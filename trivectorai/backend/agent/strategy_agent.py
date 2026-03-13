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
    context = json.dumps(memory.current_strategy) if memory.current_strategy else ""
    parsed_result = execute_parse_tool(text=user_message, context=context)
    if not parsed_result.get("success"):
        message = parsed_result.get("error", "I had trouble processing that. Could you rephrase your strategy?")
        memory.add_agent_message(message)
        return ParseResponse(status="error", strategy=memory.current_strategy, agent_message=message, session_id=memory.session_id)

    parsed_strategy = _merge_strategy(memory.current_strategy, parsed_result.get("strategy"))
    memory.current_strategy = parsed_strategy
    validation = execute_validate_tool(parsed_strategy)
    missing_fields = validation.get("missing_fields", [])
    if missing_fields:
        question = execute_clarify_tool(missing_fields=missing_fields, partial_strategy=parsed_strategy)
        memory.clarification_count += 1
        memory.add_agent_message(question.get("question", "Could you tell me more about your strategy?"))
        return ParseResponse(
            status="needs_clarification",
            strategy=parsed_strategy,
            agent_message=question.get("question", "Could you tell me more about your strategy?"),
            missing_fields=missing_fields,
            session_id=memory.session_id,
        )

    message = _build_confirmation_message(parsed_strategy)
    memory.add_agent_message(message)
    return ParseResponse(
        status="ok",
        strategy=parsed_strategy,
        agent_message=message,
        missing_fields=[],
        session_id=memory.session_id,
    )


def run_agent(user_message: str, memory: AgentMemory) -> ParseResponse:
    memory.add_user_message(user_message)

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _deterministic_parse_flow(user_message, memory)

    try:
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
                memory.add_agent_message(final_text)
                return ParseResponse(
                    status="ok",
                    strategy=parsed_strategy,
                    agent_message=final_text,
                    missing_fields=[],
                    session_id=memory.session_id,
                )

            if not function_call:
                break

            tool_name = function_call.name
            tool_args = dict(function_call.args)
            tool_result = TOOL_EXECUTORS[tool_name](**tool_args)

            if tool_name == "parse_strategy" and tool_result.get("success"):
                parsed_strategy = _merge_strategy(memory.current_strategy, tool_result.get("strategy"))
                memory.current_strategy = parsed_strategy

            if tool_name == "validate_strategy":
                missing_fields = tool_result.get("missing_fields", [])
                if missing_fields:
                    question = execute_clarify_tool(missing_fields=missing_fields, partial_strategy=parsed_strategy or {})
                    memory.clarification_count += 1
                    memory.add_agent_message(question["question"])
                    return ParseResponse(
                        status="needs_clarification",
                        strategy=parsed_strategy,
                        agent_message=question["question"],
                        missing_fields=missing_fields,
                        session_id=memory.session_id,
                    )
                confirmation = _build_confirmation_message(parsed_strategy or {})
                memory.add_agent_message(confirmation)
                return ParseResponse(
                    status="ok",
                    strategy=parsed_strategy,
                    agent_message=confirmation,
                    missing_fields=[],
                    session_id=memory.session_id,
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
        return _deterministic_parse_flow(user_message, memory)

    return _deterministic_parse_flow(user_message, memory)
