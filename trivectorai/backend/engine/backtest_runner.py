from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

try:
    import vectorbt as vbt
except Exception:  # pragma: no cover - optional fallback path
    vbt = None


class _FallbackTrades:
    def __init__(self, records_readable: pd.DataFrame):
        self.records_readable = records_readable


@dataclass
class FallbackPortfolio:
    init_cash: float
    _equity_curve: pd.Series
    _trades_df: pd.DataFrame
    _stats: dict

    @property
    def trades(self):
        return _FallbackTrades(self._trades_df)

    def value(self):
        return self._equity_curve

    def stats(self):
        return self._stats


def _manual_backtest(df, entry_signals, exit_signals, init_cash, fees, slippage, size, stop_loss_pct=None, take_profit_pct=None):
    closes = df["Close"]
    cash = float(init_cash)
    shares = 0.0
    entry_price = None
    entry_time = None
    equity = []
    trades = []

    for index, price in closes.items():
        should_enter = bool(entry_signals[df.index.get_loc(index)])
        should_exit = bool(exit_signals[df.index.get_loc(index)])

        if shares > 0 and entry_price is not None:
            if stop_loss_pct is not None and price <= entry_price * (1 - stop_loss_pct / 100):
                should_exit = True
            if take_profit_pct is not None and price >= entry_price * (1 + take_profit_pct / 100):
                should_exit = True

        if shares == 0 and should_enter:
            fill_price = price * (1 + slippage)
            deployable_cash = cash * float(size)
            if deployable_cash > 0:
                shares = (deployable_cash * (1 - fees)) / fill_price
                cash -= deployable_cash
                entry_price = fill_price
                entry_time = index

        elif shares > 0 and should_exit:
            fill_price = price * (1 - slippage)
            gross = shares * fill_price
            proceeds = gross * (1 - fees)
            cash += proceeds
            pnl = proceeds - (shares * entry_price)
            ret = ((fill_price - entry_price) / entry_price) * 100 if entry_price else 0.0
            trades.append(
                {
                    "Entry Timestamp": entry_time,
                    "Exit Timestamp": index,
                    "Avg Entry Price": entry_price,
                    "Avg Exit Price": fill_price,
                    "PnL": pnl,
                    "Return [%]": ret,
                    "Duration": index - entry_time,
                }
            )
            shares = 0.0
            entry_price = None
            entry_time = None

        equity.append(cash + shares * price)

    if shares > 0 and entry_price is not None:
        final_price = closes.iloc[-1] * (1 - slippage)
        proceeds = shares * final_price * (1 - fees)
        cash += proceeds
        pnl = proceeds - (shares * entry_price)
        ret = ((final_price - entry_price) / entry_price) * 100 if entry_price else 0.0
        trades.append(
            {
                "Entry Timestamp": entry_time,
                "Exit Timestamp": closes.index[-1],
                "Avg Entry Price": entry_price,
                "Avg Exit Price": final_price,
                "PnL": pnl,
                "Return [%]": ret,
                "Duration": closes.index[-1] - entry_time,
            }
        )
        equity[-1] = cash

    equity_curve = pd.Series(equity, index=df.index)
    returns = equity_curve.pct_change().dropna()
    total_return = ((equity_curve.iloc[-1] / init_cash) - 1) * 100
    max_drawdown = ((equity_curve / equity_curve.cummax()) - 1).min() * 100
    sharpe = (returns.mean() / returns.std()) * np.sqrt(252) if returns.std() not in (0, np.nan) and len(returns) else 0.0
    trades_df = pd.DataFrame(trades)
    win_rate = float((trades_df["PnL"] > 0).mean() * 100) if not trades_df.empty else 0.0
    stats = {
        "Total Return [%]": total_return,
        "Sharpe Ratio": float(sharpe) if np.isfinite(sharpe) else 0.0,
        "Max Drawdown [%]": abs(float(max_drawdown)),
        "Win Rate [%]": win_rate,
        "Total Trades": int(len(trades_df)),
    }
    return FallbackPortfolio(init_cash=init_cash, _equity_curve=equity_curve, _trades_df=trades_df, _stats=stats)


def run_backtest(df, entry_signals, exit_signals, init_cash=10_000, fees=0.001, slippage=0.0005, size=1.0, stop_loss_pct=None, take_profit_pct=None):
    if vbt is not None:
        try:
            return vbt.Portfolio.from_signals(
                close=df["Close"],
                entries=entry_signals,
                exits=exit_signals,
                init_cash=init_cash,
                fees=fees,
                slippage=slippage,
                size=size,
                size_type="percent",
                sl_stop=(stop_loss_pct / 100) if stop_loss_pct else None,
                tp_stop=(take_profit_pct / 100) if take_profit_pct else None,
                freq="D",
            )
        except Exception:
            pass
    return _manual_backtest(df, entry_signals, exit_signals, init_cash, fees, slippage, size, stop_loss_pct, take_profit_pct)
