from enum import Enum
from typing import Literal, Optional, Union

from pydantic import BaseModel, Field


class IndicatorType(str, Enum):
    SMA = "SMA"
    EMA = "EMA"
    RSI = "RSI"
    MACD = "MACD"
    BBANDS = "BBANDS"
    PRICE = "PRICE"
    VOLUME = "VOLUME"
    STOCH = "STOCH"
    ATR = "ATR"
    VWAP = "VWAP"


class ConditionType(str, Enum):
    CROSSES_ABOVE = "crosses_above"
    CROSSES_BELOW = "crosses_below"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    EQUALS = "equals"
    BETWEEN = "between"


class IndicatorParams(BaseModel):
    period: Optional[int] = None
    fast_period: Optional[int] = None
    slow_period: Optional[int] = None
    signal_period: Optional[int] = None
    std_dev: Optional[float] = None
    k_period: Optional[int] = None
    d_period: Optional[int] = None


class TradingRule(BaseModel):
    indicator: IndicatorType
    condition: ConditionType
    value: Union[float, str, None] = None  # number OR another indicator ref e.g. "SMA_200"
    params: IndicatorParams = Field(default_factory=IndicatorParams)
    logic_operator: Literal["AND", "OR", "NONE"] = "NONE"  # for chaining multiple rules


class ParsedStrategy(BaseModel):
    ticker: Optional[str] = None
    timeframe: Literal["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] = "1d"
    asset_class: Optional[Literal["equity", "crypto", "forex", "commodity"]] = None
    entry_rules: list[TradingRule] = []
    exit_rules: list[TradingRule] = []
    position_size: float = 1.0  # fraction of capital, 0.01-1.0
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None
    max_hold_days: Optional[int] = None
    short_allowed: bool = False
    missing_fields: list[str] = []
    confidence_score: float = 1.0  # LLM self-reported 0-1
    raw_input: str = ""


class ParseRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []  # [{role, content}, ...]


class ParseResponse(BaseModel):
    status: Literal["ok", "needs_clarification", "error"]
    strategy: Optional[ParsedStrategy] = None
    agent_message: str = ""  # natural language reply shown in chat
    missing_fields: list[str] = []
