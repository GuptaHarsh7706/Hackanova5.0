# TriVectorAI: DSL, Agents, and Backtesting Implementation

## 1. Overview

This document explains how the current TriVectorAI codebase implements:

- DSL (domain-specific language) for trading strategies
- Agent-driven strategy parsing and orchestration
- Backtesting pipelines (synchronous and agentic/streaming)

The implementation spans backend services, routes, engine modules, and frontend orchestration.

---

## 2. What DSL Means in This Project

In this project, DSL is a normalized strategy representation that can be validated and executed deterministically.

A strategy is expressed as structured rules:

- ticker (for example, AAPL)
- timeframe (for example, 1h, 1d)
- entry_rules and exit_rules
- each rule includes indicator, condition, value, params, and logic_operator

### Core schema

The canonical schema is defined in:

- backend/models/strategy_schema.py

Important schema entities:

- IndicatorType (SMA, EMA, RSI, MACD, BBANDS, PRICE, VOLUME, STOCH, ATR, VWAP)
- ConditionType (crosses_above, crosses_below, greater_than, less_than, equals, between)
- TradingRule
- ParsedStrategy

---

## 3. How DSL Is Implemented

### 3.1 Parse natural language to structured strategy

File:

- backend/agent/tools/parse_tool.py

Main behavior:

- Extract ticker, timeframe, asset class, and common rule patterns from text
- Merge with prior session context when available
- Optionally use Gemini for parsing, with deterministic fallback
- Finalize output through the DSL compiler

### 3.2 Normalize and compile to DSL-safe payload

File:

- backend/dsl/strategy_dsl.py

Main behavior:

- Timeframe alias normalization (daily -> 1d, hourly -> 1h)
- Indicator alias normalization (ma -> SMA, moving_average -> SMA, bollinger -> BBANDS)
- Condition alias normalization (gt -> greater_than, cross_above -> crosses_above)
- Asset class inference from ticker
- Rule normalization and logic operator standardization
- Validation against ParsedStrategy model

Key functions:

- compile_strategy_payload(payload)
- strategy_to_dsl(strategy)
- infer_asset_class(ticker, current)

### 3.3 Validate DSL before execution

File:

- backend/agent/tools/validate_tool.py

Main checks:

- Required fields (ticker, entry_rules)
- Indicator/condition validity
- Parameter sanity (periods, MACD fast/slow relationship)
- Contradictory threshold detection
- Risk parameter bounds (position size, stop loss, take profit)

Output contract:

- valid
- missing_fields
- issues
- can_run

---

## 4. What Agents Are Used For

Agents are used to make parsing and execution explainable, staged, and resilient.

## 4.1 Strategy parsing agent

Primary file:

- backend/agent/strategy_agent.py

Memory/session:

- backend/agent/memory.py

Tool executors wired in agent:

- parse_strategy -> parse_tool
- validate_strategy -> validate_tool
- ask_clarification -> clarify_tool
- run_backtest -> backtest_tool
- narrate_results -> narrate_tool

Behavior:

- Receives user message
- Runs parse + validate flow
- Returns either:
  - ok (strategy ready)
  - needs_clarification (missing fields/issues)
  - error
- Emits parse_details with readiness score, assumptions, extracted signals, and agent assignments

This agent can run with Gemini tool-calling or deterministic fallback.

## 4.2 Agentic backtest orchestrator

Primary file:

- backend/services/backtest_agentic_service.py

Route exposure:

- backend/routes/backtest_agentic.py
- backend/routes/strategy_builder.py

Pipeline steps:

1. initialize
2. validate
3. load_data
4. indicators
5. signals
6. simulation
7. metrics
8. analysis
9. finalize

Features:

- In-memory job registry
- Progress state tracking
- SSE event emission (queued, progress, result_ready, error)
- Final result persistence

---

## 5. How Backtesting Works (Current Implementation)

There are two modes.

## 5.1 Synchronous mode

Routes/files:

- backend/routes/backtest.py
- backend/agent/tools/backtest_tool.py

Flow:

1. Fetch OHLCV data
2. Compute indicators from strategy rules
3. Build entry/exit signals
4. Run portfolio simulation
5. Format metrics/trade log/equity curve
6. Generate narrative
7. Save result

## 5.2 Agentic streaming mode

Routes/files:

- backend/routes/strategy_builder.py (start endpoint)
- backend/routes/backtest_agentic.py (status/stream/result endpoints)
- backend/services/backtest_agentic_service.py

Flow:

1. Start async job
2. Stream progress over SSE
3. On completion, emit result_ready
4. Fetch full result via result endpoint

---

## 6. Backtesting Engine Modules

## 6.1 Data fetcher

File:

- backend/engine/data_fetcher.py

Behavior:

- Uses yfinance with retries/backoff
- Maps app timeframes to provider intervals
- Resamples for 4h when needed
- Falls back to deterministic synthetic OHLCV when provider fails
- Uses LRU caching for repeated requests

## 6.2 Indicator builder

File:

- backend/engine/indicator_builder.py

Computes only indicators required by strategy rules:

- SMA, EMA, RSI, MACD, BBANDS, ATR, STOCH

## 6.3 Signal builder

File:

- backend/engine/signal_builder.py

Behavior:

- Resolves indicator series and value targets (including SIGNAL and band aliases)
- Applies rule conditions (crosses_above, crosses_below, greater_than, less_than, etc.)
- Combines signals with logic operators (NONE/AND/OR)
- Supports timed exits via holding_period_bars/max_hold_days

## 6.4 Portfolio runner

File:

- backend/engine/backtest_runner.py

Behavior:

- Uses vectorbt when available
- Falls back to manual simulator when vectorbt unavailable or errors
- Applies fees, slippage, position size, stop loss, take profit

## 6.5 Result formatter

File:

- backend/engine/result_formatter.py

Output includes:

- metrics (return, sharpe, drawdown, win rate, profit factor, etc.)
- equity_curve and benchmark alignment
- monthly_returns
- trade log
- risk analytics (drawdown periods, volatility)
- indicator overlay series
- report sections for UI consumption

---

## 7. API Surface Used By Frontend

### Strategy parsing and execution

- POST /api/parse-strategy
- POST /api/run-backtest

Routes:

- backend/routes/strategy.py
- backend/routes/backtest.py

### Strategy Builder endpoints

- POST /api/strategy-builder/parse
- POST /api/strategy-builder/validate
- POST /api/strategy-builder/run-backtest
- POST /api/strategy-builder/run-backtest-agentic

Route:

- backend/routes/strategy_builder.py

### Agentic backtest job endpoints

- POST /api/backtests/start
- GET /api/backtests/{job_id}
- GET /api/backtests/{job_id}/stream
- GET /api/backtests/{job_id}/result
- GET /api/backtests/{job_id}/equity-curve
- GET /api/backtests/{job_id}/trades
- GET /api/backtests/{job_id}/insights

Route:

- backend/routes/backtest_agentic.py

---

## 8. End-to-End Example

Input:

Buy when 50 MA crosses above 200 MA and RSI below 30. Sell when RSI above 70.

What happens:

1. Parse step identifies ticker/timeframe/rules:
   - backend/agent/tools/parse_tool.py
2. DSL compiler normalizes aliases and validates schema:
   - backend/dsl/strategy_dsl.py
3. Validator ensures strategy can run:
   - backend/agent/tools/validate_tool.py
4. Indicator builder creates required columns (SMA, RSI):
   - backend/engine/indicator_builder.py
5. Signal builder generates entry/exit arrays:
   - backend/engine/signal_builder.py
6. Runner simulates portfolio:
   - backend/engine/backtest_runner.py
7. Formatter builds final analytics payload:
   - backend/engine/result_formatter.py
8. Route returns and persists result:
   - backend/routes/backtest.py or agentic pipeline files

---

## 9. Frontend Integration Notes

Frontend state and progress UX are managed in:

- frontend/src/store/useStrategyStore.js

UI pages calling these APIs include:

- frontend/src/pages/StrategyBuilderPage.jsx
- frontend/src/pages/BacktestConfigPage.jsx
- frontend/src/pages/ResultsPage.jsx
- frontend/src/pages/TradeAnalyticsPage.jsx

Agentic mode in UI:

- Start job
- Subscribe to SSE progress
- On result_ready, fetch final result and navigate to analytics/results

---

## 10. Why This Architecture Works

- Deterministic core: DSL schema + validators make execution predictable
- Resilient parsing: Gemini tool-calling with deterministic fallback
- Resilient market data: retry + synthetic fallback
- Scalable UX: async backtest jobs with streamable progress
- Explainability: parse_details and agent assignments surface intermediate reasoning

This gives a practical balance between AI assistance and strict execution guarantees.
