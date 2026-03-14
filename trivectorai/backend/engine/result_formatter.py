from __future__ import annotations

import uuid

import numpy as np
import pandas as pd


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        out = float(value)
        if np.isnan(out) or np.isinf(out):
            return default
        return out
    except Exception:
        return default


def _drawdown_periods(eq_curve: pd.Series, limit: int = 5) -> list[dict]:
    if eq_curve.empty:
        return []
    running_max = eq_curve.cummax()
    dd = (eq_curve / running_max) - 1.0

    periods = []
    in_period = False
    start_idx = None
    trough_idx = None
    trough_val = 0.0

    for i, value in enumerate(dd.values):
        if value < 0 and not in_period:
            in_period = True
            start_idx = i
            trough_idx = i
            trough_val = value
        elif value < 0 and in_period:
            if value < trough_val:
                trough_val = value
                trough_idx = i
        elif value >= 0 and in_period:
            end_idx = i
            periods.append(
                {
                    "start": str(pd.Timestamp(eq_curve.index[start_idx]).date()),
                    "trough": str(pd.Timestamp(eq_curve.index[trough_idx]).date()),
                    "recovery": str(pd.Timestamp(eq_curve.index[end_idx]).date()),
                    "drawdown_pct": round(abs(trough_val) * 100, 2),
                    "duration_bars": int(end_idx - start_idx),
                }
            )
            in_period = False

    if in_period and start_idx is not None and trough_idx is not None:
        periods.append(
            {
                "start": str(pd.Timestamp(eq_curve.index[start_idx]).date()),
                "trough": str(pd.Timestamp(eq_curve.index[trough_idx]).date()),
                "recovery": None,
                "drawdown_pct": round(abs(trough_val) * 100, 2),
                "duration_bars": int(len(eq_curve) - 1 - start_idx),
            }
        )

    periods.sort(key=lambda p: p["drawdown_pct"], reverse=True)
    return periods[:limit]


def _indicator_overlay(df: pd.DataFrame, max_points: int = 800) -> dict:
    base_cols = {"Open", "High", "Low", "Close", "Volume"}
    indicator_cols = [c for c in df.columns if c not in base_cols]
    if not indicator_cols:
        return {"series": []}

    sampled = df
    if len(df) > max_points:
        stride = max(1, len(df) // max_points)
        sampled = df.iloc[::stride].copy()

    series = []
    for col in indicator_cols:
        points = []
        for idx, val in sampled[col].items():
            if pd.isna(val):
                continue
            points.append(
                {
                    "date": str(pd.Timestamp(idx).date()),
                    "value": round(_safe_float(val), 6),
                }
            )
        series.append({"name": col, "points": points})
    return {"series": series}


def format_result(portfolio, df: pd.DataFrame, strategy: dict) -> dict:
    stats = portfolio.stats()
    trades = portfolio.trades.records_readable
    eq_curve = portfolio.value()
    init_cash = float(getattr(portfolio, "init_cash", 10_000))

    benchmark_val = (df["Close"] / df["Close"].iloc[0]) * init_cash

    total_return = _safe_float(stats.get("Total Return [%]", 0))
    sharpe = _safe_float(stats.get("Sharpe Ratio", 0))
    max_drawdown = _safe_float(stats.get("Max Drawdown [%]", 0))
    win_rate = _safe_float(stats.get("Win Rate [%]", 0))
    n_trades = int(stats.get("Total Trades", 0))

    n_years = max((df.index[-1] - df.index[0]).days / 365.25, 0.01)
    end_val = _safe_float(eq_curve.iloc[-1], init_cash)
    cagr = ((end_val / init_cash) ** (1 / n_years) - 1) * 100

    returns = eq_curve.pct_change().dropna()
    downside = returns[returns < 0]
    sortino = 0.0
    if len(downside) > 1 and downside.std() > 0:
        sortino = float((returns.mean() / downside.std()) * np.sqrt(252))
    volatility = float(returns.std() * np.sqrt(252) * 100) if len(returns) > 1 else 0.0

    equity_points = []
    for date, value in eq_curve.items():
        benchmark_value = _safe_float(benchmark_val.get(date, init_cash), init_cash)
        equity_points.append(
            {
                "date": str(pd.Timestamp(date).date()),
                "value": round(_safe_float(value), 2),
                "benchmark": round(benchmark_value, 2),
            }
        )

    monthly = {}
    eq_monthly = eq_curve.resample("ME").last().pct_change() * 100
    for date, ret in eq_monthly.items():
        year = date.year
        month = date.month - 1
        if year not in monthly:
            monthly[year] = [None] * 12
        monthly[year][month] = round(float(ret), 2) if not np.isnan(ret) else None

    trade_list = []
    if trades is not None and len(trades) > 0:
        for index, row in trades.iterrows():
            duration = row.get("Duration", pd.Timedelta(0))
            hold_days = int(getattr(duration, "days", 0)) if duration is not None else 0
            trade_list.append(
                {
                    "id": int(index) + 1,
                    "date_in": str(row.get("Entry Timestamp", ""))[:10],
                    "date_out": str(row.get("Exit Timestamp", ""))[:10],
                    "entry_price": round(_safe_float(row.get("Avg Entry Price", 0)), 2),
                    "exit_price": round(_safe_float(row.get("Avg Exit Price", 0)), 2),
                    "position_size": round(_safe_float(row.get("Size", strategy.get("position_size", 1.0)), strategy.get("position_size", 1.0)), 6),
                    "pnl_usd": round(_safe_float(row.get("PnL", 0)), 2),
                    "return_pct": round(_safe_float(row.get("Return [%]", 0)), 2),
                    "hold_days": hold_days,
                    "side": "long",
                }
            )

    winning = [trade for trade in trade_list if trade["return_pct"] > 0]
    losing = [trade for trade in trade_list if trade["return_pct"] <= 0]
    avg_win = np.mean([trade["return_pct"] for trade in winning]) if winning else 0.0
    avg_loss = np.mean([trade["return_pct"] for trade in losing]) if losing else 0.0
    largest_win = max([trade["return_pct"] for trade in winning], default=0.0)
    largest_loss = min([trade["return_pct"] for trade in losing], default=0.0)
    gross_profit = sum(trade["pnl_usd"] for trade in winning)
    gross_loss = abs(sum(trade["pnl_usd"] for trade in losing))
    profit_factor = round(gross_profit / max(gross_loss, 0.01), 2)
    expectancy = round((gross_profit - gross_loss) / max(n_trades, 1), 2)
    risk_reward_ratio = round(abs(float(avg_win)) / max(abs(float(avg_loss)), 0.01), 2)

    drawdown_periods = _drawdown_periods(eq_curve)
    indicator_overlay = _indicator_overlay(df)

    performance_metrics = {
        "total_return_pct": round(total_return, 2),
        "annualized_return_pct": round(cagr, 2),
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(_safe_float(sortino), 2),
        "max_drawdown_pct": round(abs(max_drawdown), 2),
        "profit_factor": profit_factor,
    }

    trade_statistics = {
        "total_trades": n_trades,
        "winning_trades": int(len(winning)),
        "losing_trades": int(len(losing)),
        "win_rate_pct": round(win_rate, 2),
    }

    trade_distribution = {
        "average_win_pct": round(float(avg_win), 2),
        "average_loss_pct": round(float(avg_loss), 2),
        "largest_win_pct": round(float(largest_win), 2),
        "largest_loss_pct": round(float(largest_loss), 2),
    }

    risk_metrics = {
        "volatility_pct": round(_safe_float(volatility), 2),
        "drawdown_periods": drawdown_periods,
        "risk_reward_ratio": risk_reward_ratio,
    }

    strategy_id = strategy.get("id") or f"{strategy.get('ticker', 'strategy').lower()}-{uuid.uuid4().hex[:8]}"
    return {
        "strategy_id": strategy_id,
        "strategy": strategy,
        "ticker_used": strategy.get("ticker", ""),
        "data_period": f"{str(df.index[0].date())} to {str(df.index[-1].date())}",
        "status": "completed",
        "metrics": {
            "total_return_pct": performance_metrics["total_return_pct"],
            "cagr_pct": performance_metrics["annualized_return_pct"],
            "sharpe_ratio": performance_metrics["sharpe_ratio"],
            "sortino_ratio": performance_metrics["sortino_ratio"],
            "max_drawdown_pct": performance_metrics["max_drawdown_pct"],
            "win_rate_pct": trade_statistics["win_rate_pct"],
            "total_trades": trade_statistics["total_trades"],
            "avg_win_pct": trade_distribution["average_win_pct"],
            "avg_loss_pct": trade_distribution["average_loss_pct"],
            "largest_win_pct": trade_distribution["largest_win_pct"],
            "largest_loss_pct": trade_distribution["largest_loss_pct"],
            "profit_factor": profit_factor,
            "expectancy_usd": expectancy,
            "volatility_pct": risk_metrics["volatility_pct"],
            "risk_reward_ratio": risk_metrics["risk_reward_ratio"],
        },
        "performance_metrics": performance_metrics,
        "trade_statistics": trade_statistics,
        "trade_distribution": trade_distribution,
        "risk_metrics": risk_metrics,
        "equity_curve": equity_points,
        "portfolio_value_over_time": equity_points,
        "indicator_overlay": indicator_overlay,
        "monthly_returns": monthly,
        "trades": trade_list,
        "trade_log": trade_list,
        "report": {
            "strategy_summary": {
                "strategy_id": strategy_id,
                "ticker": strategy.get("ticker"),
                "timeframe": strategy.get("timeframe"),
                "entry_rules": len(strategy.get("entry_rules", [])),
                "exit_rules": len(strategy.get("exit_rules", [])),
            },
            "performance_metrics": performance_metrics,
            "risk_metrics": risk_metrics,
            "trade_statistics": trade_statistics,
            "trade_distribution": trade_distribution,
            "ai_insights": {},
        },
        "ai_narrative": None,
        "ai_analysis": {
            "strengths": [],
            "weaknesses": [],
            "best_market_conditions": [],
            "risk_assessment": "pending",
            "suggested_improvements": [],
            "summary": "Analysis pending",
        },
    }
