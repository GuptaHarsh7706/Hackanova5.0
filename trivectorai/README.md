# TriVectorAI - Phase 3

Agentic strategy parsing and backtesting tool with a React frontend, FastAPI backend, SQLite persistence, and a tool-driven Gemini workflow.

## What Phase 3 Includes

- React + Vite + Tailwind multi-route frontend
- FastAPI backend with parse, backtest, history, and health routes
- Agent memory persisted by session in SQLite
- Structured strategy parsing with Gemini-backed and deterministic fallback flows
- Historical backtests with indicator generation, signal building, and result formatting
- Results dashboard wired to live backend responses
- Strategy history and compare views backed by stored backtest results

## Project Structure

```text
trivectorai/
├── backend/
│   ├── agent/
│   ├── database/
│   ├── engine/
│   ├── models/
│   ├── prompts/
│   └── routes/
├── frontend/
│   └── src/
└── README.md
```

## Setup

```bash
# Backend setup
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
# Add your GEMINI_API_KEY to .env if you want Gemini parsing and AI narration.
# Without it, the app falls back to deterministic parsing and templated analysis.

uvicorn main:app --reload

# Frontend setup (separate terminal)
cd frontend
npm install
npm run dev

# Optional frontend env override
# VITE_API_BASE_URL=http://localhost:8000
```

## API Surface

- `POST /api/parse-strategy`
- `POST /api/run-backtest`
- `GET /api/history`
- `DELETE /api/history`
- `GET /api/health`

## Example Strategies to Test

| User Input | Expected Parse |
|---|---|
| "Buy AAPL when 50 SMA crosses above 200 SMA" | SMA golden cross, ticker AAPL, missing exit |
| "Golden cross strategy on BTC daily" | SMA(50) > SMA(200), ticker BTC, timeframe 1d |
| "Buy when RSI drops below 30, sell when RSI goes above 70 on TSLA" | RSI entry + exit, ticker TSLA |
| "MACD crossover on ETH hourly with 2% stop loss" | MACD, 1h, stop_loss 2.0 |
| "Bollinger Band breakout - buy when price closes above upper band on NVDA" | BBANDS, PRICE closes above |
| "Buy when 50 EMA crosses above 200 EMA AND RSI is below 60" | Multi-condition AND logic |
| "Short EURUSD when 20 SMA crosses below 50 SMA on 4h chart" | short_allowed: true, forex |

## Notes

- `GET /api/history` returns stored backtest results, which the frontend normalizes into history cards and comparison items.
- If market data download fails, the backend falls back to synthetic OHLCV data so the workflow still executes offline.
- If `vectorbt` is unavailable at runtime, the backend falls back to a manual portfolio simulation path.
