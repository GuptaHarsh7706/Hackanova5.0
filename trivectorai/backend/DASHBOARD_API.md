# Dashboard Backend API Contract

This backend powers the Bloomberg-style dashboard modules with live-or-mock market intelligence data.

## Base URL

- Local: `http://localhost:8000/api/dashboard`

## 1) Global Markets

- Endpoint: `GET /global-markets`
- Response fields: `symbol`, `name`, `price`, `change_pct`, `timestamp`

Sample response:

```json
[
  {
    "symbol": "^GSPC",
    "name": "S&P 500",
    "price": 5231.44,
    "change_pct": 0.84,
    "timestamp": "2026-03-14T11:40:12.123456+00:00"
  }
]
```

## 2) Watchlist

- Fetch: `GET /watchlist`
- Add symbol: `POST /watchlist`
- Remove symbol: `DELETE /watchlist/{symbol}`

POST request format:

```json
{
  "symbol": "NFLX"
}
```

Watchlist item response fields:
- `symbol`, `price`, `change_pct`, `volume`, `market_cap`, `timestamp`

## 3) Crypto Market

- Endpoint: `GET /crypto`
- Optional query: `symbols=BTC,ETH,SOL`

Response fields:
- `symbol`, `price`, `change_24h_pct`, `volume_24h`, `sparkline[]`, `timestamp`

## 4) Main Market Chart

- Endpoint: `GET /chart`
- Query params:
  - `symbol` (example: `AAPL`, `^GSPC`, `BTC-USD`)
  - `timeframe` (`1m|5m|15m|1h|4h|1d`)
  - `limit` (50-500)

Response fields:
- `candles[]` with `ts/open/high/low/close`
- `volumes[]`
- `indicators[]` with `rsi/macd/macd_signal/macd_hist`
- `last_price`, `generated_at`

## 5) Technical Indicators

Indicators are embedded in `/chart` response under `indicators`:
- RSI(14)
- MACD line/signal/histogram
- Volume series in `volumes`

## 6) AI Market Insights

- Endpoint: `GET /insights?symbol=^GSPC&timeframe=1h`

Response fields:
- `insight_summary`
- `sentiment_score`
- `risk_level`
- `recommended_action`
- `confidence_score`
- `drivers[]`

The service uses Gemini when `GEMINI_API_KEY` is set; otherwise a deterministic rule-based AI fallback runs.

## 7) News Sentiment

- Endpoint: `GET /news?limit=6`

Response fields:
- `headline`, `source`, `sentiment`, `sentiment_score`, `timestamp`

## 8) Sector Risk Heatmap

- Endpoint: `GET /sector-risk`

Response fields:
- `sector`, `risk_score`, `volatility_score`, `sentiment_score`

## Real-time Support

### Polling
- Call `GET /snapshot` every `refresh_after_sec` from response.

### Server-Sent Events (SSE)
- Endpoint: `GET /stream?symbol=^GSPC&timeframe=1h&interval_sec=5`
- Event name: `snapshot`

## Frontend Integration Snippets

```js
// Global markets
const markets = await fetch('/api/dashboard/global-markets').then((r) => r.json())

// Watchlist CRUD
await fetch('/api/dashboard/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: 'NFLX' }) })
await fetch('/api/dashboard/watchlist/TSLA', { method: 'DELETE' })

// Chart + indicators
const chart = await fetch('/api/dashboard/chart?symbol=^GSPC&timeframe=1h&limit=220').then((r) => r.json())

// AI insights
const insight = await fetch('/api/dashboard/insights?symbol=^GSPC&timeframe=1h').then((r) => r.json())

// Snapshot polling
const snapshot = await fetch('/api/dashboard/snapshot?symbol=^GSPC&timeframe=1h').then((r) => r.json())
```
