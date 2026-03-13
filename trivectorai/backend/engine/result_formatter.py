from __future__ import annotations

import uuid

import numpy as np
import pandas as pd


def format_result(portfolio, df: pd.DataFrame, strategy: dict) -> dict:
    stats = portfolio.stats()
    trades = portfolio.trades.records_readable
    eq_curve = portfolio.value()
    init_cash = float(getattr(portfolio, "init_cash", 10_000))

    benchmark_val = (df["Close"] / df["Close"].iloc[0]) * init_cash

    total_return = float(stats.get("Total Return [%]", 0))
    sharpe = float(stats.get("Sharpe Ratio", 0))
    max_drawdown = float(stats.get("Max Drawdown [%]", 0))
    win_rate = float(stats.get("Win Rate [%]", 0))
    n_trades = int(stats.get("Total Trades", 0))

    n_years = max((df.index[-1] - df.index[0]).days / 365.25, 0.01)
    end_val = float(eq_curve.iloc[-1])
    cagr = ((end_val / init_cash) ** (1 / n_years) - 1) * 100

    equity_points = []
    for date, value in eq_curve.items():
        benchmark_value = float(benchmark_val.get(date, init_cash))
        equity_points.append(
            {
                "date": str(pd.Timestamp(date).date()),
                "value": round(float(value), 2),
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
                    "entry_price": round(float(row.get("Avg Entry Price", 0)), 2),
                    "exit_price": round(float(row.get("Avg Exit Price", 0)), 2),
                    "pnl_usd": round(float(row.get("PnL", 0)), 2),
                    "return_pct": round(float(row.get("Return [%]", 0)), 2),
                    "hold_days": hold_days,
                    "side": "long",
                }
            )

    winning = [trade for trade in trade_list if trade["return_pct"] > 0]
    losing = [trade for trade in trade_list if trade["return_pct"] <= 0]
    avg_win = np.mean([trade["return_pct"] for trade in winning]) if winning else 0
    avg_loss = np.mean([trade["return_pct"] for trade in losing]) if losing else 0
    largest_win = max([trade["return_pct"] for trade in winning], default=0)
    largest_loss = min([trade["return_pct"] for trade in losing], default=0)
    gross_profit = sum(trade["pnl_usd"] for trade in winning)
    gross_loss = abs(sum(trade["pnl_usd"] for trade in losing))
    profit_factor = round(gross_profit / max(gross_loss, 0.01), 2)
    expectancy = round((gross_profit - gross_loss) / max(n_trades, 1), 2)

    strategy_id = strategy.get("id") or f"{strategy.get('ticker', 'strategy').lower()}-{uuid.uuid4().hex[:8]}"
    return {
        "strategy_id": strategy_id,
        "strategy": strategy,
        "ticker_used": strategy.get("ticker", ""),
        "data_period": f"{str(df.index[0].date())} to {str(df.index[-1].date())}",
        "metrics": {
            "total_return_pct": round(total_return, 2),
            "cagr_pct": round(cagr, 2),
            "sharpe_ratio": round(sharpe, 2),
            "max_drawdown_pct": round(abs(max_drawdown), 2),
            "win_rate_pct": round(win_rate, 2),
            "total_trades": n_trades,
            "avg_win_pct": round(float(avg_win), 2),
            "avg_loss_pct": round(float(avg_loss), 2),
            "largest_win_pct": round(float(largest_win), 2),
            "largest_loss_pct": round(float(largest_loss), 2),
            "profit_factor": profit_factor,
            "expectancy_usd": expectancy,
        },
        "equity_curve": equity_points,
        "monthly_returns": monthly,
        "trades": trade_list,
        "ai_narrative": None,
    }
