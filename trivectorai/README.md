# TriVectorAI - Phase 1

Agentic Backtesting Tool: UI + LLM Strategy Parser.

## What Phase 1 Includes

- React + Vite + Tailwind chat-style strategy parser UI
- FastAPI backend with `/api/parse-strategy` and `/api/health`
- Google Gemini Flash integration for English -> structured strategy JSON
- Clarification loop for missing required fields
- Live strategy JSON preview panel
- Error handling for network, timeout, validation, and service errors

## Project Structure

```text
trivectorai/
├── backend/
├── frontend/
└── README.md
```

## Setup

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Add your GEMINI_API_KEY to .env
uvicorn main:app --reload

# Frontend setup (separate terminal)
cd frontend
npm install
npm run dev

# App runs at:
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs
```

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
```

## Notes

- "Run Backtest" is disabled in Phase 1 and marked as coming in Phase 2.
- Type `reset` in chat or click "New Strategy" to clear state.
