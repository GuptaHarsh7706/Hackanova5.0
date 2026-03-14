# Backtest Configuration API

This API powers the Backtest Configuration screen with institutional-style workflow modules:
- strategy summary
- asset universe and data source selection
- historical range metadata and runtime estimation
- validation and AI configuration scoring
- configuration save/load
- run backtest from a saved or inline configuration

Base URL: `http://localhost:8000/api/backtest-config`

## 1) Strategy Summary

### GET `/strategy-summary?strategy_id=<optional>`

Response:
```json
{
  "strategy_id": "strat-abc123",
  "strategy_name": "Golden Cross Momentum",
  "strategy_type": "Momentum Crossover",
  "timeframe": "1h",
  "indicators_active": 6,
  "confidence_score": 82.0
}
```

## 2) Asset Universe

### GET `/assets?asset_class=equity`

Response:
```json
{
  "items": [
    { "symbol": "AAPL", "display_name": "AAPL", "asset_class": "equity" },
    { "symbol": "MSFT", "display_name": "MSFT", "asset_class": "equity" }
  ],
  "defaults": ["AAPL", "MSFT", "GOOGL", "TSLA"]
}
```

### POST `/assets`

Request:
```json
{
  "symbol": "NFLX",
  "asset_class": "equity"
}
```

Response:
```json
{
  "status": "ok",
  "symbol": "NFLX"
}
```

## 3) Data Sources

### GET `/data-sources`

Response:
```json
{
  "items": [
    { "id": "bloomberg", "label": "Bloomberg", "institutional": true, "connected": true },
    { "id": "yahoo_finance", "label": "Yahoo Finance", "institutional": false, "connected": true }
  ]
}
```

## 4) Data Range Metadata + Runtime Estimate

### POST `/data-range`

Request:
```json
{
  "start_date": "2020-01-01",
  "end_date": "2024-01-15",
  "timeframe": "1h",
  "selected_assets": ["AAPL", "MSFT", "GOOGL", "TSLA"]
}
```

Response:
```json
{
  "duration_days": 1475,
  "trading_days_estimate": 1018,
  "estimated_data_points": 28504,
  "coverage_label": "institutional_backfill",
  "estimated_runtime_seconds": 19
}
```

## 5) Validate Configuration

### POST `/validate`

Request:
```json
{
  "config": {
    "strategy_id": "strat-abc123",
    "name": "Momentum Config V1",
    "data_source": "yahoo_finance",
    "asset_class": "equity",
    "selected_assets": ["AAPL", "MSFT", "GOOGL", "TSLA"],
    "start_date": "2020-01-01",
    "end_date": "2024-01-15",
    "timeframe": "1h",
    "initial_capital": 100000,
    "position_sizing_method": "% of Capital",
    "position_pct": 5,
    "risk_parameters": {
      "stop_loss_pct": 2,
      "take_profit_pct": 5,
      "max_position_usd": 5000,
      "max_drawdown_pct": 15,
      "max_concurrent_trades": 3
    },
    "transaction_costs": {
      "commission_per_trade": 0.5,
      "slippage_pct": 0.05
    }
  }
}
```

Response:
```json
{
  "valid": true,
  "readiness_score": 100,
  "can_run": true,
  "issues": []
}
```

## 6) AI Scoring

### POST `/score`

Request: same body as `/validate`.

Response:
```json
{
  "score": 96,
  "score_band": "excellent",
  "risk_label": "moderate",
  "estimated_runtime_seconds": 19,
  "estimated_data_points": 28504,
  "strengths": ["Diversified cross-asset set selected."],
  "warnings": [],
  "suggestions": []
}
```

## 7) Save / Load Configuration

### POST `/save`

Request: same body as `/validate`.

Response:
```json
{
  "status": "ok",
  "configuration_id": "cfg-1a2b3c4d5e6f",
  "message": "Configuration saved"
}
```

### GET `/saved?strategy_id=<optional>&limit=50`

Response:
```json
{
  "items": [
    {
      "id": "cfg-1a2b3c4d5e6f",
      "strategy_id": "strat-abc123",
      "name": "Momentum Config V1",
      "selected_assets": ["AAPL", "MSFT", "GOOGL", "TSLA"],
      "score": 96,
      "created_at": "2026-03-13T09:22:11.123456+00:00",
      "updated_at": "2026-03-13T09:22:11.123456+00:00"
    }
  ]
}
```

### GET `/saved/{configuration_id}`

Response: complete saved configuration payload.

## 8) Run Backtest From Configuration

### POST `/run`

Option A: by configuration id
```json
{
  "configuration_id": "cfg-1a2b3c4d5e6f",
  "strategy": {
    "id": "strat-abc123",
    "ticker": "AAPL",
    "timeframe": "1h",
    "asset_class": "equity",
    "entry_rules": ["SMA50 crosses above SMA200"],
    "exit_rules": ["SMA50 crosses below SMA200"]
  },
  "session_id": "session-xyz",
  "natural_language": "Run with conservative risk"
}
```

Option B: inline unsaved config
```json
{
  "config": {
    "strategy_id": "strat-abc123",
    "selected_assets": ["AAPL", "MSFT", "GOOGL", "TSLA"],
    "start_date": "2020-01-01",
    "end_date": "2024-01-15",
    "timeframe": "1h",
    "initial_capital": 100000,
    "position_sizing_method": "% of Capital",
    "position_pct": 5,
    "risk_parameters": {
      "stop_loss_pct": 2,
      "take_profit_pct": 5,
      "max_position_usd": 5000,
      "max_drawdown_pct": 15,
      "max_concurrent_trades": 3
    },
    "transaction_costs": {
      "commission_per_trade": 0.5,
      "slippage_pct": 0.05
    }
  },
  "strategy": {"ticker": "AAPL", "timeframe": "1h", "asset_class": "equity"}
}
```

Response:
```json
{
  "status": "accepted",
  "job_id": "job-abc123",
  "stream_url": "/api/backtests/job-abc123/stream",
  "status_url": "/api/backtests/job-abc123",
  "result_url": "/api/backtests/job-abc123/result"
}
```

## Frontend Integration Snippets

```js
import axios from "axios"

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/backtest-config`,
})

export const getStrategySummary = (strategyId) => api.get(`/strategy-summary`, { params: { strategy_id: strategyId } }).then((r) => r.data)
export const getAssets = () => api.get(`/assets`).then((r) => r.data)
export const getDataRangeMeta = (config) => api.post(`/data-range`, config).then((r) => r.data)
export const validateConfig = (config) => api.post(`/validate`, { config }).then((r) => r.data)
export const scoreConfig = (config) => api.post(`/score`, { config }).then((r) => r.data)
export const saveConfig = (config) => api.post(`/save`, { config }).then((r) => r.data)
export const runFromConfig = (payload) => api.post(`/run`, payload).then((r) => r.data)
```
