from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from agent.tools.narrate_tool import execute_narrate_tool
from agent.tools.validate_tool import execute_validate_tool
from database.repository import save_result
from engine.backtest_runner import run_backtest
from engine.data_fetcher import fetch_ohlcv
from engine.indicator_builder import compute_indicators
from engine.result_formatter import format_result
from engine.signal_builder import build_signals
from services.strategy_builder_service import ai_suggestions


PIPELINE_STEPS = [
    ("initialize", "Initializing strategy engine", 5),
    ("validate", "Validating strategy DSL", 12),
    ("load_data", "Loading historical market data", 24),
    ("indicators", "Computing indicators", 40),
    ("signals", "Generating entry and exit signals", 55),
    ("simulation", "Simulating trades with vectorbt", 72),
    ("metrics", "Calculating portfolio equity and metrics", 86),
    ("analysis", "Generating AI insights", 96),
    ("finalize", "Finalizing backtest report", 100),
]


@dataclass
class BacktestJob:
    id: str
    created_at: float
    status: str = "queued"
    progress: int = 0
    current_step: str = "queued"
    message: str = "Queued"
    strategy_id: str | None = None
    result_id: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    events: list[dict[str, Any]] = field(default_factory=list)
    lock: threading.Lock = field(default_factory=threading.Lock)


_JOBS: dict[str, BacktestJob] = {}
_JOBS_LOCK = threading.Lock()


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _emit(job: BacktestJob, event_type: str, **payload) -> None:
    event = {
        "event": event_type,
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "current_step": job.current_step,
        "message": job.message,
        "timestamp": _now_iso(),
    }
    event.update(payload)
    with job.lock:
        job.events.append(event)


def _set_step(job: BacktestJob, step_key: str, message: str, progress: int) -> None:
    job.current_step = step_key
    job.message = message
    job.progress = max(0, min(100, int(progress)))
    _emit(job, "progress")


def _build_ai_analysis(result: dict[str, Any], strategy: dict[str, Any], natural_language: str | None) -> dict[str, Any]:
    metrics = result.get("metrics", {})
    total_return = float(metrics.get("total_return_pct", 0.0) or 0.0)
    sharpe = float(metrics.get("sharpe_ratio", 0.0) or 0.0)
    drawdown = float(metrics.get("max_drawdown_pct", 0.0) or 0.0)
    win_rate = float(metrics.get("win_rate_pct", 0.0) or 0.0)

    strengths = []
    weaknesses = []
    conditions = []

    if total_return > 0:
        strengths.append("Positive total return over the backtest window")
    else:
        weaknesses.append("Negative total return indicates weak profitability")

    if sharpe >= 1.0:
        strengths.append("Risk-adjusted returns are acceptable based on Sharpe ratio")
    else:
        weaknesses.append("Sharpe ratio is low, suggesting unstable risk-adjusted performance")

    if drawdown <= 20:
        strengths.append("Drawdown remained within a controlled range")
    else:
        weaknesses.append("Large drawdown implies elevated capital risk")

    if win_rate >= 50:
        strengths.append("Trade win rate is above 50%")
    else:
        weaknesses.append("Trade consistency is weak based on win rate")

    if sharpe >= 1.0 and total_return > 0:
        conditions.append("Trending market regimes")
    if drawdown > 20:
        conditions.append("Low-volatility or range-bound markets may be safer")

    risk_assessment = "low" if drawdown <= 10 else ("moderate" if drawdown <= 20 else "high")

    suggestions = ai_suggestions(
        natural_language or "",
        strategy,
        {
            "valid": True,
            "missing_fields": [],
            "issues": [] if total_return > -10 else ["low_performance"],
            "can_run": True,
        },
    )

    summary = (
        f"The strategy delivered {total_return:.2f}% return with Sharpe {sharpe:.2f} and max drawdown {drawdown:.2f}%. "
        f"Win rate was {win_rate:.2f}%."
    )

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "best_market_conditions": conditions,
        "risk_assessment": risk_assessment,
        "suggested_improvements": suggestions,
        "summary": summary,
    }


def _run_pipeline(job: BacktestJob, strategy: dict[str, Any], session_id: str | None, natural_language: str | None) -> None:
    del session_id  # Reserved for future persistence of per-session orchestration state.
    try:
        job.status = "running"
        for key, label, pct in PIPELINE_STEPS:
            _set_step(job, key, label, pct if key == "initialize" else job.progress)
            if key == "initialize":
                time.sleep(0.15)

            elif key == "validate":
                validation = execute_validate_tool(strategy)
                if not validation.get("can_run"):
                    missing = ", ".join(validation.get("missing_fields", []))
                    issues = "; ".join(validation.get("issues", []))
                    raise ValueError(f"Strategy validation failed. Missing: {missing or '-'}; Issues: {issues or '-'}")
                _set_step(job, key, "Strategy validated", pct)

            elif key == "load_data":
                ticker = str(strategy.get("ticker", "")).upper()
                timeframe = strategy.get("timeframe", "1d")
                df = fetch_ohlcv(ticker=ticker, period="5y", interval=timeframe)
                if df is None or len(df) < 50:
                    raise ValueError(f"Insufficient historical data for {ticker or 'symbol'}")
                _set_step(job, key, f"Loaded {len(df)} bars for {ticker}", pct)

            elif key == "indicators":
                df = compute_indicators(df, strategy)
                indicator_count = max(0, len(df.columns) - 5)
                _set_step(job, key, f"Indicators ready ({indicator_count} derived series)", pct)

            elif key == "signals":
                entry_signals, exit_signals = build_signals(df, strategy)
                _set_step(job, key, "Signals generated", pct)

            elif key == "simulation":
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
                _set_step(job, key, "Trade simulation complete", pct)

            elif key == "metrics":
                result = format_result(portfolio, df, strategy)
                _set_step(job, key, "Performance metrics computed", pct)

            elif key == "analysis":
                narration = execute_narrate_tool(
                    metrics=result.get("metrics", {}),
                    strategy=strategy,
                    trades=result.get("trades", []),
                )
                if narration.get("success"):
                    result["ai_narrative"] = narration.get("narrative")
                result["ai_analysis"] = _build_ai_analysis(result, strategy, natural_language)
                result["report"]["ai_insights"] = result["ai_analysis"]
                _set_step(job, key, "AI analysis generated", pct)

            elif key == "finalize":
                result_id = f"bt-{uuid.uuid4().hex[:12]}"
                result["id"] = result_id
                result["strategy_id"] = strategy.get("id")
                result["job_id"] = job.id
                save_result(result_id, result)

                job.result_id = result_id
                job.result = result
                job.strategy_id = strategy.get("id")
                job.status = "completed"
                _set_step(job, key, "Backtest completed", pct)
                _emit(
                    job,
                    "result_ready",
                    result_id=result_id,
                    summary={
                        "total_return_pct": result.get("metrics", {}).get("total_return_pct"),
                        "sharpe_ratio": result.get("metrics", {}).get("sharpe_ratio"),
                        "max_drawdown_pct": result.get("metrics", {}).get("max_drawdown_pct"),
                        "win_rate_pct": result.get("metrics", {}).get("win_rate_pct"),
                    },
                )

    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        job.message = "Backtest failed"
        _emit(job, "error", error=job.error)


def start_backtest_job(strategy: dict[str, Any], session_id: str | None = None, natural_language: str | None = None) -> BacktestJob:
    job_id = f"job-{uuid.uuid4().hex[:12]}"
    job = BacktestJob(id=job_id, created_at=time.time(), message="Queued")
    with _JOBS_LOCK:
        _JOBS[job_id] = job

    thread = threading.Thread(
        target=_run_pipeline,
        args=(job, strategy, session_id, natural_language),
        daemon=True,
    )
    thread.start()
    _emit(job, "queued")
    return job


def get_job(job_id: str) -> BacktestJob | None:
    with _JOBS_LOCK:
        return _JOBS.get(job_id)


def get_job_state(job_id: str) -> dict[str, Any] | None:
    job = get_job(job_id)
    if not job:
        return None
    return {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "current_step": job.current_step,
        "message": job.message,
        "strategy_id": job.strategy_id,
        "result_id": job.result_id,
        "error": job.error,
        "created_at": job.created_at,
    }


def get_job_events_since(job_id: str, offset: int = 0) -> list[dict[str, Any]]:
    job = get_job(job_id)
    if not job:
        return []
    with job.lock:
        return job.events[offset:]


def format_sse(event: dict[str, Any]) -> str:
    event_name = event.get("event", "message")
    payload = json.dumps(event, default=str)
    return f"event: {event_name}\ndata: {payload}\n\n"
