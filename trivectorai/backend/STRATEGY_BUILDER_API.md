# Strategy Builder Backend API Contract

This API powers the Strategy Builder screen with natural-language parsing, DSL generation, validation, suggestions, persistence, and backtest triggering.

## Base URL

- Local: `http://localhost:8000/api/strategy-builder`

## Endpoints

## 1) Strategy Templates

- `GET /templates`

Response:

```json
{
  "items": [
    {
      "name": "Golden Cross",
      "description": "MA crossover strategy with momentum confirmation",
      "natural_language": "Buy when the 50-day moving average crosses above...",
      "default_parameters": {"timeframe": "1d", "position_size": 1.0},
      "example_dsl": {"ticker": "SPY", "entry_rules": []}
    }
  ]
}
```

## 2) Available Indicators

- `GET /indicators`

Response:

```json
{
  "groups": {
    "Trend Indicators": [{"name": "Moving Average", "code": "MA", "params": ["period"]}],
    "Momentum Indicators": [{"name": "Relative Strength Index", "code": "RSI", "params": ["period"]}]
  }
}
```

## 3) Parse Natural Language Strategy

- `POST /parse`

Request:

```json
{
  "text": "Buy when the 50-day moving average crosses above the 200-day moving average and RSI is below 30. Sell when RSI exceeds 70.",
  "session_id": "optional-session-id",
  "conversation_history": []
}
```

Response:

```json
{
  "status": "ok",
  "session_id": "...",
  "natural_language": "...",
  "strategy": {"ticker": "SPY", "timeframe": "1d", "entry_rules": [], "exit_rules": [], "dsl_script": "..."},
  "dsl": {"ticker": "SPY", "timeframe": "1d", "entry_rules": [], "exit_rules": []},
  "detected_indicators": ["SMA (50)", "RSI (14)"],
  "detected_rules": {"entry": ["Buy Condition: ..."], "exit": ["Sell Condition: ..."]},
  "validation": {"valid": true, "missing_fields": [], "issues": [], "can_run": true},
  "suggestions": ["Add stop loss", "Include volume filter"],
  "parse_details": {},
  "agent_trace": [],
  "agent_message": "Strategy parsed successfully..."
}
```

## 4) Validate Strategy DSL

- `POST /validate`

Request:

```json
{
  "strategy": {"ticker": "SPY", "entry_rules": []}
}
```

Response:

```json
{
  "valid": false,
  "missing_fields": ["entry_rules"],
  "issues": [],
  "can_run": false
}
```

## 5) Generate Suggestions

- `POST /suggestions`

Request:

```json
{
  "text": "Buy SPY when RSI is below 30",
  "strategy": {"ticker": "SPY", "entry_rules": [{"indicator": "RSI", "condition": "less_than", "value": 30}]}
}
```

Response:

```json
{
  "suggestions": ["Add stop loss", "Define risk/reward ratio"]
}
```

## 6) Save Strategy

- `POST /save`

Request:

```json
{
  "natural_language": "Buy SPY when RSI below 30 and sell above 70",
  "strategy": {"ticker": "SPY", "timeframe": "1d", "entry_rules": [], "exit_rules": []}
}
```

Response:

```json
{
  "status": "ok",
  "strategy_id": "strategy-abc123",
  "message": "Strategy saved"
}
```

## 7) Fetch Saved Strategies

- `GET /saved?limit=100`
- `GET /saved/{strategy_id}`

## 8) Clear Current Strategy Session Context

- `POST /clear`

Request:

```json
{
  "session_id": "existing-session-id"
}
```

Response:

```json
{
  "status": "ok",
  "session_id": "existing-session-id",
  "message": "Strategy cleared"
}
```

## 9) Run Backtest from Builder DSL

- `POST /run-backtest`

Request:

```json
{
  "strategy": {"ticker": "SPY", "timeframe": "1d", "entry_rules": [], "exit_rules": []}
}
```

## 10) Run Agentic Backtest (Streaming)

- `POST /run-backtest-agentic`

Request:

```json
{
  "session_id": "optional-session-id",
  "natural_language": "Buy SPY when RSI below 30 and sell above 70",
  "strategy": {"ticker": "SPY", "timeframe": "1d", "entry_rules": [], "exit_rules": []}
}
```

Response:

```json
{
  "status": "accepted",
  "job_id": "job-8ab6e1b8f6a2",
  "stream_url": "/api/backtests/job-8ab6e1b8f6a2/stream",
  "status_url": "/api/backtests/job-8ab6e1b8f6a2",
  "result_url": "/api/backtests/job-8ab6e1b8f6a2/result"
}
```

See `backend/BACKTEST_RESULTS_API.md` for full streaming and result APIs.

Response:

```json
{
  "status": "ok",
  "result": {
    "metrics": {
      "total_return_pct": 18.2,
      "sharpe_ratio": 2.18,
      "max_drawdown_pct": 3.2,
      "win_rate_pct": 68.5
    },
    "equity_curve": [],
    "trades": []
  },
  "summary": {
    "total_return_pct": 18.2,
    "sharpe_ratio": 2.18,
    "max_drawdown_pct": 3.2,
    "win_rate_pct": 68.5,
    "latency_ms": 842
  }
}
```

## Frontend Integration Examples

```js
// 1) Load templates
const tpl = await fetch('/api/strategy-builder/templates').then((r) => r.json())

// 2) Parse NL strategy to DSL
const parsed = await fetch('/api/strategy-builder/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: draft, session_id: sessionId, conversation_history: [] })
}).then((r) => r.json())

// 3) Validate DSL
const validation = await fetch('/api/strategy-builder/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ strategy: parsed.strategy })
}).then((r) => r.json())

// 4) Suggestions
const tips = await fetch('/api/strategy-builder/suggestions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: draft, strategy: parsed.strategy })
}).then((r) => r.json())

// 5) Save strategy
const saved = await fetch('/api/strategy-builder/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ natural_language: draft, strategy: parsed.strategy })
}).then((r) => r.json())

// 6) Run backtest
const bt = await fetch('/api/strategy-builder/run-backtest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ strategy: parsed.strategy })
}).then((r) => r.json())

// 7) Run agentic backtest + stream progress
const start = await fetch('/api/strategy-builder/run-backtest-agentic', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id: sessionId, natural_language: draft, strategy: parsed.strategy })
}).then((r) => r.json())

const source = new EventSource(start.stream_url)
source.addEventListener('progress', (evt) => {
  const p = JSON.parse(evt.data)
  console.log(p.progress, p.message)
})
```

## AI Agent Pipeline Notes

The `POST /parse` endpoint executes an agentic pipeline with these responsibilities:

1. Strategy Understanding Agent
2. Indicator Detection Agent
3. Rule Extraction Agent
4. DSL Generation Agent
5. Validation Agent
6. Suggestion Agent

If Gemini is configured (`GEMINI_API_KEY`), model-based interpretation is used. Otherwise deterministic rule-based parsing and validation runs as fallback.
