from __future__ import annotations

import threading
import time
import uuid
from copy import deepcopy
from typing import Any

from agent.tools.narrate_tool import execute_narrate_tool
from agent.tools.validate_tool import execute_validate_tool
from database.repository import get_result_by_id, save_result
from engine.backtest_runner import run_backtest
from engine.data_fetcher import fetch_ohlcv
from engine.indicator_builder import compute_indicators
from engine.result_formatter import format_result
from engine.signal_builder import build_signals


_VERSIONS_LOCK = threading.Lock()
_VERSIONS: dict[str, dict[str, Any]] = {}


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _workflow_step(agent: str, detail: str, status: str = "ok") -> dict[str, str]:
    return {"agent": agent, "status": status, "detail": detail}


def _build_quick_analysis(result: dict[str, Any]) -> dict[str, Any]:
    metrics = result.get("metrics", {}) or {}
    total_return = float(metrics.get("total_return_pct", 0) or 0)
    sharpe = float(metrics.get("sharpe_ratio", 0) or 0)
    drawdown = float(metrics.get("max_drawdown_pct", 0) or 0)
    win_rate = float(metrics.get("win_rate_pct", 0) or 0)

    suggestions = []
    if total_return < 0:
        suggestions.append("Tighten entry conditions to reduce false positives.")
    if sharpe < 1:
        suggestions.append("Reduce position size or add volatility filter for smoother equity.")
    if drawdown > 20:
        suggestions.append("Use stricter stop loss and shorten max hold period.")
    if win_rate < 45:
        suggestions.append("Increase signal confirmation before entries.")

    if not suggestions:
        suggestions.append("Performance is stable; test across additional symbols and regimes.")

    return {
        "summary": f"Return {total_return:.2f}% | Sharpe {sharpe:.2f} | Max DD {drawdown:.2f}% | Win {win_rate:.2f}%.",
        "suggested_improvements": suggestions,
        "risk_assessment": "low" if drawdown <= 10 else ("moderate" if drawdown <= 20 else "high"),
    }


def run_sandbox_simulation(strategy: dict[str, Any], natural_language: str | None = None) -> dict[str, Any]:
    workflow: list[dict[str, str]] = []

    validation = execute_validate_tool(strategy)
    if not validation.get("can_run"):
        missing = validation.get("missing_fields", [])
        issues = validation.get("issues", [])
        detail = f"Validation failed. Missing: {', '.join(missing) if missing else '-'}; Issues: {', '.join(issues) if issues else '-'}"
        workflow.append(_workflow_step("StrategyGuardAgent", detail, "error"))
        raise ValueError(detail)

    workflow.append(_workflow_step("StrategyGuardAgent", "Strategy schema validated."))

    ticker = str(strategy.get("ticker", "")).upper()
    timeframe = str(strategy.get("timeframe", "1d"))

    df = fetch_ohlcv(ticker=ticker, period="5y", interval=timeframe)
    if df is None or len(df) < 50:
        detail = f"Insufficient data for {ticker or 'symbol'} in timeframe {timeframe}."
        workflow.append(_workflow_step("MarketDataAgent", detail, "error"))
        raise ValueError(detail)

    workflow.append(_workflow_step("MarketDataAgent", f"Loaded {len(df)} bars for {ticker} ({timeframe})."))

    df = compute_indicators(df, strategy)
    entry_signals, exit_signals = build_signals(df, strategy)
    workflow.append(_workflow_step("SignalEngineerAgent", "Indicators and signals generated."))

    portfolio = run_backtest(
        df=df,
        entry_signals=entry_signals,
        exit_signals=exit_signals,
        init_cash=float(strategy.get("initial_capital", 10_000)),
        fees=float(strategy.get("fees", 0.001)),
        slippage=float(strategy.get("slippage", 0.0005)),
        size=float(strategy.get("position_size", 1.0)),
        stop_loss_pct=strategy.get("stop_loss_pct"),
        take_profit_pct=strategy.get("take_profit_pct"),
    )
    workflow.append(_workflow_step("SimulationAgent", "Historical simulation complete."))

    result = format_result(portfolio, df, strategy)

    narration = execute_narrate_tool(
        metrics=result.get("metrics", {}),
        strategy=strategy,
        trades=result.get("trades", []),
    )
    if narration.get("success"):
        result["ai_narrative"] = narration.get("narrative", "")

    analysis = _build_quick_analysis(result)
    result["ai_analysis"] = analysis
    report = result.get("report", {})
    report["ai_insights"] = {
        "summary": analysis.get("summary", ""),
        "suggested_improvements": analysis.get("suggested_improvements", []),
        "user_prompt": natural_language or "",
    }
    result["report"] = report

    workflow.append(_workflow_step("InsightAgent", "Narrative and strategy improvement hints generated."))

    result_id = f"sbx-{uuid.uuid4().hex[:12]}"
    result["id"] = result_id
    result["strategy_id"] = strategy.get("id")
    save_result(result_id, result)

    workflow.append(_workflow_step("PersistenceAgent", f"Saved simulation result {result_id}."))

    return {"result": result, "workflow": workflow}


def save_sandbox_version(strategy: dict[str, Any], result_id: str | None = None, label: str | None = None, notes: str | None = None) -> dict[str, Any]:
    version_id = f"v-{uuid.uuid4().hex[:10]}"
    created_at = _now_iso()

    metrics: dict[str, Any] = {}
    if result_id:
        persisted = get_result_by_id(result_id)
        if persisted:
            metrics = persisted.get("metrics", {}) or {}

    version = {
        "id": version_id,
        "label": label or f"Sandbox {created_at[11:19]}",
        "created_at": created_at,
        "strategy": deepcopy(strategy),
        "result_id": result_id,
        "notes": notes or "",
        "metrics": metrics,
    }

    with _VERSIONS_LOCK:
        _VERSIONS[version_id] = version

    return deepcopy(version)


def list_sandbox_versions(limit: int = 20) -> list[dict[str, Any]]:
    with _VERSIONS_LOCK:
        items = list(_VERSIONS.values())

    items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return [deepcopy(item) for item in items[: max(1, min(limit, 100))]]


def get_sandbox_version(version_id: str) -> dict[str, Any] | None:
    with _VERSIONS_LOCK:
        item = _VERSIONS.get(version_id)
    return deepcopy(item) if item else None


def compare_sandbox_versions(ids: list[str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for version_id in ids[:5]:
        version = get_sandbox_version(version_id)
        if not version:
            continue

        metrics = version.get("metrics", {}) or {}
        strategy = version.get("strategy", {}) or {}
        items.append(
            {
                "id": version.get("id"),
                "name": version.get("label") or strategy.get("name") or "Sandbox Version",
                "created_at": version.get("created_at"),
                "strategy": strategy,
                "results": {
                    "total_return_pct": metrics.get("total_return_pct", 0),
                    "sharpe_ratio": metrics.get("sharpe_ratio", 0),
                    "max_drawdown_pct": metrics.get("max_drawdown_pct", 0),
                    "win_rate_pct": metrics.get("win_rate_pct", 0),
                    "total_trades": metrics.get("total_trades", 0),
                },
                "result_id": version.get("result_id"),
            }
        )
    return items
