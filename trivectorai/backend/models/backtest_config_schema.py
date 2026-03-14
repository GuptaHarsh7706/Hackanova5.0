from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


class StrategySummaryResponse(BaseModel):
    strategy_id: str | None = None
    strategy_name: str
    strategy_type: str
    timeframe: str
    indicators_active: int
    confidence_score: float


class AssetItem(BaseModel):
    symbol: str
    display_name: str
    asset_class: str = "equity"


class AssetsResponse(BaseModel):
    items: list[AssetItem] = Field(default_factory=list)
    defaults: list[str] = Field(default_factory=list)


class DataRangeRequest(BaseModel):
    start_date: date
    end_date: date
    timeframe: str = "1d"
    selected_assets: list[str] = Field(default_factory=list)


class DataRangeResponse(BaseModel):
    duration_days: int
    trading_days_estimate: int
    estimated_data_points: int
    coverage_label: str
    estimated_runtime_seconds: int


class RiskParameters(BaseModel):
    stop_loss_pct: float = 2.0
    take_profit_pct: float = 5.0
    max_position_usd: float = 5000.0
    max_drawdown_pct: float = 15.0
    max_concurrent_trades: int = 3


class TransactionCosts(BaseModel):
    commission_per_trade: float = 0.5
    slippage_pct: float = 0.05


class BacktestConfiguration(BaseModel):
    id: str | None = None
    strategy_id: str | None = None
    name: str | None = None
    data_source: str = "yahoo_finance"
    asset_class: str = "equity"
    selected_assets: list[str] = Field(default_factory=list)
    start_date: date
    end_date: date
    timeframe: str = "1h"
    initial_capital: float = 100000.0
    position_sizing_method: str = "% of Capital"
    position_pct: float = 5.0
    risk_parameters: RiskParameters = Field(default_factory=RiskParameters)
    transaction_costs: TransactionCosts = Field(default_factory=TransactionCosts)


class ValidationIssue(BaseModel):
    field: str
    severity: Literal["info", "warning", "error"]
    message: str


class ValidateConfigResponse(BaseModel):
    valid: bool
    readiness_score: int
    can_run: bool
    issues: list[ValidationIssue] = Field(default_factory=list)


class ScoreConfigResponse(BaseModel):
    score: int
    score_band: Literal["excellent", "good", "fair", "poor"]
    risk_label: Literal["low", "moderate", "high"]
    estimated_runtime_seconds: int
    estimated_data_points: int
    strengths: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class SaveConfigRequest(BaseModel):
    config: BacktestConfiguration


class SaveConfigResponse(BaseModel):
    status: Literal["ok", "error"] = "ok"
    configuration_id: str
    message: str


class RunConfigRequest(BaseModel):
    configuration_id: str | None = None
    config: BacktestConfiguration | None = None
    strategy: dict[str, Any] = Field(default_factory=dict)
    session_id: str | None = None
    natural_language: str | None = None


class RunConfigResponse(BaseModel):
    status: Literal["accepted"] = "accepted"
    job_id: str
    stream_url: str
    status_url: str
    result_url: str
