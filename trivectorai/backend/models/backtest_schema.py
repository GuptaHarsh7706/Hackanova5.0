from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from .strategy_schema import ParsedStrategy


class Trade(BaseModel):
    id: int
    date_in: str
    date_out: str
    entry_price: float
    exit_price: float
    pnl_usd: float
    return_pct: float
    hold_days: int
    side: str = "long"


class BacktestMetrics(BaseModel):
    total_return_pct: float
    cagr_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    win_rate_pct: float
    total_trades: int
    avg_win_pct: float
    avg_loss_pct: float
    largest_win_pct: float
    largest_loss_pct: float
    profit_factor: float
    expectancy_usd: float


class EquityPoint(BaseModel):
    date: str
    value: float
    benchmark: float


class BacktestResult(BaseModel):
    strategy_id: str
    strategy: ParsedStrategy | dict
    metrics: BacktestMetrics
    equity_curve: list[EquityPoint] = Field(default_factory=list)
    monthly_returns: dict = Field(default_factory=dict)
    trades: list[Trade] = Field(default_factory=list)
    ai_narrative: Optional[str] = None
    data_period: str
    ticker_used: str
