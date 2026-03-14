from __future__ import annotations

from datetime import date

from models.backtest_config_schema import BacktestConfiguration, ValidationIssue


_DATA_SOURCES = [
    {"id": "bloomberg", "label": "Bloomberg", "institutional": True, "connected": True},
    {"id": "yahoo_finance", "label": "Yahoo Finance", "institutional": False, "connected": True},
    {"id": "alpha_vantage", "label": "Alpha Vantage", "institutional": False, "connected": True},
    {"id": "custom_csv", "label": "Custom CSV Upload", "institutional": False, "connected": True},
]


def supported_data_sources() -> list[dict]:
    return list(_DATA_SOURCES)


def estimate_data_range(start_date: date, end_date: date, timeframe: str, assets_count: int) -> dict:
    duration_days = max(1, (end_date - start_date).days)
    trading_days_est = max(1, int(duration_days * (252.0 / 365.0)))

    tf = (timeframe or "1d").lower()
    bars_per_day = {
        "1m": 390,
        "5m": 78,
        "15m": 26,
        "30m": 13,
        "1h": 7,
        "4h": 2,
        "1d": 1,
        "1wk": 1 / 5,
    }.get(tf, 1)

    est_points = int(max(1, trading_days_est * max(1, assets_count) * bars_per_day))
    est_runtime = estimate_runtime_seconds(est_points)

    if duration_days < 365:
        coverage_label = "short_horizon"
    elif duration_days < 365 * 3:
        coverage_label = "balanced"
    else:
        coverage_label = "institutional_backfill"

    return {
        "duration_days": duration_days,
        "trading_days_estimate": trading_days_est,
        "estimated_data_points": est_points,
        "coverage_label": coverage_label,
        "estimated_runtime_seconds": est_runtime,
    }


def estimate_runtime_seconds(estimated_data_points: int) -> int:
    # Runtime model: fixed orchestration overhead + linear data scaling.
    runtime = 8 + int(estimated_data_points / 2500)
    return max(6, min(240, runtime))


def validate_configuration(config: BacktestConfiguration) -> tuple[list[ValidationIssue], int, bool]:
    issues: list[ValidationIssue] = []

    if not config.selected_assets:
        issues.append(ValidationIssue(field="selected_assets", severity="error", message="Select at least one asset."))

    if config.end_date <= config.start_date:
        issues.append(ValidationIssue(field="date_range", severity="error", message="End date must be after start date."))

    if config.initial_capital < 1000:
        issues.append(ValidationIssue(field="initial_capital", severity="error", message="Initial capital must be at least $1,000."))

    if config.position_pct <= 0 or config.position_pct > 100:
        issues.append(ValidationIssue(field="position_pct", severity="error", message="Risk per trade must be between 0 and 100%."))

    if config.risk_parameters.stop_loss_pct <= 0:
        issues.append(ValidationIssue(field="stop_loss_pct", severity="error", message="Stop loss must be greater than 0."))

    if config.risk_parameters.take_profit_pct <= config.risk_parameters.stop_loss_pct:
        issues.append(
            ValidationIssue(
                field="take_profit_pct",
                severity="warning",
                message="Take profit is not greater than stop loss; risk-reward may be suboptimal.",
            )
        )

    if config.risk_parameters.max_drawdown_pct > 25:
        issues.append(
            ValidationIssue(
                field="max_drawdown_pct",
                severity="warning",
                message="Max drawdown limit above 25% may exceed institutional risk budgets.",
            )
        )

    if config.transaction_costs.commission_per_trade < 0 or config.transaction_costs.slippage_pct < 0:
        issues.append(
            ValidationIssue(
                field="transaction_costs",
                severity="error",
                message="Commission and slippage must be non-negative.",
            )
        )

    score = 100
    for issue in issues:
        if issue.severity == "error":
            score -= 20
        elif issue.severity == "warning":
            score -= 8
        else:
            score -= 2

    if len(config.selected_assets) >= 3:
        score += 5
    if config.risk_parameters.take_profit_pct > config.risk_parameters.stop_loss_pct * 1.5:
        score += 4

    score = max(0, min(100, score))
    can_run = not any(issue.severity == "error" for issue in issues)
    return issues, score, can_run


def score_configuration(config: BacktestConfiguration) -> dict:
    issues, readiness_score, can_run = validate_configuration(config)
    range_meta = estimate_data_range(
        start_date=config.start_date,
        end_date=config.end_date,
        timeframe=config.timeframe,
        assets_count=len(config.selected_assets),
    )

    strengths: list[str] = []
    warnings: list[str] = []
    suggestions: list[str] = []

    if len(config.selected_assets) >= 3:
        strengths.append("Diversified cross-asset set selected.")
    else:
        warnings.append("Low diversification. Add more non-correlated assets.")

    if config.risk_parameters.take_profit_pct > config.risk_parameters.stop_loss_pct:
        strengths.append("Positive risk-reward profile.")
    else:
        warnings.append("Take profit should exceed stop loss for asymmetric payoff.")

    if config.transaction_costs.slippage_pct > 0.3:
        warnings.append("High slippage assumption may suppress expected returns.")

    if range_meta["duration_days"] < 365:
        suggestions.append("Increase lookback window to at least 2 years for robustness.")

    if len(config.selected_assets) < 3:
        suggestions.append("Use at least 3 assets for better generalization.")

    if config.position_pct > 8:
        suggestions.append("Consider reducing risk per trade below 8% for smoother drawdowns.")

    if readiness_score >= 85:
        score_band = "excellent"
    elif readiness_score >= 70:
        score_band = "good"
    elif readiness_score >= 50:
        score_band = "fair"
    else:
        score_band = "poor"

    if config.risk_parameters.max_drawdown_pct <= 12:
        risk_label = "low"
    elif config.risk_parameters.max_drawdown_pct <= 22:
        risk_label = "moderate"
    else:
        risk_label = "high"

    warnings.extend(issue.message for issue in issues if issue.severity != "info")

    return {
        "can_run": can_run,
        "readiness_score": readiness_score,
        "score": readiness_score,
        "score_band": score_band,
        "risk_label": risk_label,
        "estimated_runtime_seconds": range_meta["estimated_runtime_seconds"],
        "estimated_data_points": range_meta["estimated_data_points"],
        "strengths": strengths,
        "warnings": warnings,
        "suggestions": suggestions,
    }
