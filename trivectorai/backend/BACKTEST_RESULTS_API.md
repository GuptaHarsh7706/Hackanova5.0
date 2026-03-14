# Backtesting Results API (Agentic + Streaming)

This document defines the backend APIs required to power the Backtesting Results screen.

## Overview

When the user clicks Run Backtest, call `POST /api/strategy-builder/run-backtest-agentic` (or `POST /api/backtests/start`) with the parsed DSL strategy.

The backend executes an AI-agent pipeline:

1. Validate strategy
2. Load historical data
3. Compute indicators
4. Generate signals
5. Run vectorbt simulation
6. Compute metrics and report
7. Generate AI analysis and recommendations
8. Stream progress events to frontend

---

## 1) Start Backtest Job

### Endpoint

`POST /api/strategy-builder/run-backtest-agentic`

Equivalent generic endpoint:

`POST /api/backtests/start`

### Request

```json
{
  "session_id": "session-abc123",
  "natural_language": "Buy when RSI is below 30, sell above 70",
  "strategy": {
    "id": "strategy-1",
    "ticker": "SPY",
    "timeframe": "1d",
    "entry_rules": [
      {"indicator": "RSI", "condition": "less_than", "value": 30, "params": {"period": 14}}
    ],
    "exit_rules": [
      {"indicator": "RSI", "condition": "greater_than", "value": 70, "params": {"period": 14}}
    ],
    "position_size": 0.8,
    "stop_loss_pct": 4,
    "take_profit_pct": 8,
    "max_hold_days": 20
  }
}
```

### Response

```json
{
  "status": "accepted",
  "job_id": "job-8ab6e1b8f6a2",
  "stream_url": "/api/backtests/job-8ab6e1b8f6a2/stream",
  "status_url": "/api/backtests/job-8ab6e1b8f6a2",
  "result_url": "/api/backtests/job-8ab6e1b8f6a2/result"
}
```

### Frontend Example

```javascript
const start = await fetch('/api/strategy-builder/run-backtest-agentic', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id, natural_language, strategy: dslStrategy })
});

const startPayload = await start.json();
const { job_id, stream_url, result_url } = startPayload;
```

---

## 2) Stream Live Backtest Progress (SSE)

### Endpoint

`GET /api/backtests/{job_id}/stream`

### Event Format

SSE events include `queued`, `progress`, `result_ready`, `error`.

### `progress` Event Example

```json
{
  "event": "progress",
  "job_id": "job-8ab6e1b8f6a2",
  "status": "running",
  "progress": 55,
  "current_step": "signals",
  "message": "Generating entry and exit signals",
  "timestamp": "2026-03-14T10:35:21Z"
}
```

### `result_ready` Event Example

```json
{
  "event": "result_ready",
  "job_id": "job-8ab6e1b8f6a2",
  "status": "completed",
  "progress": 100,
  "current_step": "finalize",
  "message": "Backtest completed",
  "result_id": "bt-4b787a4b8fc8",
  "summary": {
    "total_return_pct": 24.12,
    "sharpe_ratio": 1.18,
    "max_drawdown_pct": 13.91,
    "win_rate_pct": 52.47
  }
}
```

### Frontend Example

```javascript
const source = new EventSource(stream_url);

source.addEventListener('progress', (evt) => {
  const payload = JSON.parse(evt.data);
  setProgress(payload.progress);
  setStepMessage(payload.message);
});

source.addEventListener('result_ready', async (evt) => {
  const payload = JSON.parse(evt.data);
  source.close();
  const finalRes = await fetch(`/api/backtests/${payload.job_id}/result`);
  const finalData = await finalRes.json();
  setBacktestResult(finalData.result);
});

source.addEventListener('error', (evt) => {
  console.error('Backtest stream error', evt);
});
```

---

## 3) Poll Job Status

### Endpoint

`GET /api/backtests/{job_id}`

### Response

```json
{
  "job_id": "job-8ab6e1b8f6a2",
  "status": "running",
  "progress": 72,
  "current_step": "simulation",
  "message": "Trade simulation complete",
  "strategy_id": "strategy-1",
  "result_id": null,
  "error": null,
  "created_at": 1773484512.223
}
```

---

## 4) Fetch Full Backtest Result

### Endpoint

`GET /api/backtests/{job_id}/result`

### Response (trimmed)

```json
{
  "status": "ok",
  "job_id": "job-8ab6e1b8f6a2",
  "result": {
    "id": "bt-4b787a4b8fc8",
    "strategy_id": "strategy-1",
    "metrics": {
      "total_return_pct": 24.12,
      "cagr_pct": 4.42,
      "sharpe_ratio": 1.18,
      "sortino_ratio": 1.63,
      "max_drawdown_pct": 13.91,
      "win_rate_pct": 52.47,
      "total_trades": 162,
      "avg_win_pct": 2.09,
      "avg_loss_pct": -1.19,
      "largest_win_pct": 8.71,
      "largest_loss_pct": -6.04,
      "profit_factor": 1.34,
      "expectancy_usd": 23.12,
      "volatility_pct": 19.84,
      "risk_reward_ratio": 1.76
    },
    "performance_metrics": {
      "total_return_pct": 24.12,
      "annualized_return_pct": 4.42,
      "sharpe_ratio": 1.18,
      "sortino_ratio": 1.63,
      "max_drawdown_pct": 13.91,
      "profit_factor": 1.34
    },
    "trade_statistics": {
      "total_trades": 162,
      "winning_trades": 85,
      "losing_trades": 77,
      "win_rate_pct": 52.47
    },
    "trade_distribution": {
      "average_win_pct": 2.09,
      "average_loss_pct": -1.19,
      "largest_win_pct": 8.71,
      "largest_loss_pct": -6.04
    },
    "risk_metrics": {
      "volatility_pct": 19.84,
      "risk_reward_ratio": 1.76,
      "drawdown_periods": []
    },
    "equity_curve": [{"date": "2021-01-04", "value": 10000, "benchmark": 10000}],
    "portfolio_value_over_time": [{"date": "2021-01-04", "value": 10000, "benchmark": 10000}],
    "indicator_overlay": {
      "series": [
        {
          "name": "RSI_14",
          "points": [{"date": "2021-01-04", "value": 52.11}]
        }
      ]
    },
    "trade_log": [
      {
        "id": 1,
        "date_in": "2021-02-01",
        "date_out": "2021-02-12",
        "entry_price": 372.3,
        "exit_price": 381.1,
        "position_size": 0.8,
        "pnl_usd": 188.4,
        "return_pct": 2.36,
        "hold_days": 11,
        "side": "long"
      }
    ],
    "ai_analysis": {
      "strengths": ["Positive total return over the backtest window"],
      "weaknesses": [],
      "best_market_conditions": ["Trending market regimes"],
      "risk_assessment": "moderate",
      "suggested_improvements": ["Add stop loss", "Include volume filter"],
      "summary": "The strategy delivered 24.12% return with Sharpe 1.18 and max drawdown 13.91%. Win rate was 52.47%."
    },
    "report": {
      "strategy_summary": {},
      "performance_metrics": {},
      "risk_metrics": {},
      "trade_statistics": {},
      "trade_distribution": {},
      "ai_insights": {}
    }
  }
}
```

---

## 5) Retrieve Equity Curve Only

### Endpoint

`GET /api/backtests/{job_id}/equity-curve`

### Response

```json
{
  "job_id": "job-8ab6e1b8f6a2",
  "result_id": "bt-4b787a4b8fc8",
  "equity_curve": [{"date": "2021-01-04", "value": 10000, "benchmark": 10000}],
  "portfolio_value_over_time": [{"date": "2021-01-04", "value": 10000, "benchmark": 10000}]
}
```

### Frontend Example

```javascript
const r = await fetch(`/api/backtests/${jobId}/equity-curve`);
const { equity_curve } = await r.json();
setEquitySeries(equity_curve);
```

---

## 6) Retrieve Trade Log

### Endpoint

`GET /api/backtests/{job_id}/trades`

### Response

```json
{
  "job_id": "job-8ab6e1b8f6a2",
  "result_id": "bt-4b787a4b8fc8",
  "trade_statistics": {
    "total_trades": 162,
    "winning_trades": 85,
    "losing_trades": 77,
    "win_rate_pct": 52.47
  },
  "trades": [
    {
      "id": 1,
      "date_in": "2021-02-01",
      "date_out": "2021-02-12",
      "entry_price": 372.3,
      "exit_price": 381.1,
      "position_size": 0.8,
      "pnl_usd": 188.4,
      "return_pct": 2.36,
      "hold_days": 11,
      "side": "long"
    }
  ]
}
```

---

## 7) Retrieve AI Insights and Report

### Endpoint

`GET /api/backtests/{job_id}/insights`

### Response

```json
{
  "job_id": "job-8ab6e1b8f6a2",
  "result_id": "bt-4b787a4b8fc8",
  "ai_narrative": "The strategy shows moderate profitability...",
  "ai_analysis": {
    "strengths": [],
    "weaknesses": [],
    "best_market_conditions": [],
    "risk_assessment": "moderate",
    "suggested_improvements": ["Add stop loss", "Adjust indicator thresholds"],
    "summary": "..."
  },
  "suggestions": ["Add stop loss", "Adjust indicator thresholds"],
  "report": {
    "strategy_summary": {},
    "performance_metrics": {},
    "risk_metrics": {},
    "trade_statistics": {},
    "trade_distribution": {},
    "ai_insights": {}
  }
}
```

---

## Notes for Frontend Integration

- Preferred flow:
  - Start job
  - Open SSE stream
  - Update animated progress per event
  - On `result_ready`, fetch full result and render charts/tables
- Keep fallback polling (`GET /api/backtests/{job_id}`) if SSE disconnects.
- Existing synchronous endpoint (`POST /api/strategy-builder/run-backtest`) remains available for backward compatibility.
