# TriVectorAI — Phase 1 Agent Specification
## Agentic Backtesting Tool: UI + LLM Strategy Parser

> **For the Code Agent:** This document is the single source of truth for Phase 1.
> Read every section fully before writing a single line of code.
> Follow the file structure, tech stack, and implementation notes exactly.

---

## 1. Project Overview

Build a **full-stack web app** where a user types a trading strategy in plain English and receives back a structured JSON representation of that strategy — validated, normalized, and ready for a backtesting engine.

**What Phase 1 delivers:**
- A beautiful, responsive chat-style UI (React + Vite + Tailwind)
- A FastAPI backend with a `/parse-strategy` endpoint
- LLM integration (Google Gemini Flash) that converts English → structured trading rules JSON
- A conversational clarification loop (agent asks follow-up if fields are missing)
- A live JSON preview panel that updates as the strategy is parsed
- Full error handling and loading states

---

## 2. Tech Stack (Strict — Do Not Substitute)

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 18.x |
| Frontend build | Vite | 5.x |
| Frontend styling | Tailwind CSS | 3.x |
| Frontend state | Zustand | 4.x |
| Frontend HTTP | Axios | 1.x |
| Backend | FastAPI | 0.110.x |
| Backend server | Uvicorn | 0.29.x |
| LLM | Google Generative AI SDK | `google-generativeai` latest |
| Validation | Pydantic v2 | 2.x |
| Python | CPython | 3.11+ |
| Package manager (FE) | npm | — |
| Package manager (BE) | pip | — |

---

## 3. File & Folder Structure

Create exactly this structure. Do not add or remove top-level folders.

```
trivectorai/
├── backend/
│   ├── main.py                   # FastAPI app entry point
│   ├── routes/
│   │   └── strategy.py           # /parse-strategy and /clarify endpoints
│   ├── services/
│   │   ├── llm_parser.py         # Gemini API call + prompt engineering
│   │   └── validator.py          # JSON schema validation + missing field detection
│   ├── models/
│   │   └── strategy_schema.py    # Pydantic models for request/response
│   ├── prompts/
│   │   └── strategy_system_prompt.txt  # Full system prompt (loaded at startup)
│   ├── requirements.txt
│   └── .env.example              # GEMINI_API_KEY=your_key_here
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── store/
│       │   └── useStrategyStore.js     # Zustand global state
│       ├── api/
│       │   └── strategyApi.js          # Axios calls to backend
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx         # Left nav / branding
│       │   │   └── Header.jsx          # Top bar
│       │   ├── chat/
│       │   │   ├── ChatWindow.jsx      # Main chat message list
│       │   │   ├── ChatMessage.jsx     # Individual message bubble
│       │   │   ├── ChatInput.jsx       # Text input + send button
│       │   │   └── TypingIndicator.jsx # Animated "agent is thinking" dots
│       │   ├── strategy/
│       │   │   ├── StrategyPanel.jsx   # Right panel: live JSON preview
│       │   │   ├── RuleCard.jsx        # Single parsed rule display
│       │   │   ├── MissingFieldAlert.jsx # Yellow banner for missing fields
│       │   │   └── StrategyBadge.jsx   # Pill badges (indicator, condition, etc.)
│       │   └── ui/
│       │       ├── Button.jsx
│       │       ├── Spinner.jsx
│       │       └── Tooltip.jsx
│       └── styles/
│           └── index.css             # Tailwind base imports only
│
└── README.md
```

---

## 4. Backend Implementation

### 4.1 `backend/requirements.txt`

```
fastapi==0.110.0
uvicorn[standard]==0.29.0
google-generativeai==0.5.4
pydantic==2.7.0
python-dotenv==1.0.1
httpx==0.27.0
```

### 4.2 Pydantic Models — `backend/models/strategy_schema.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, Literal, Union
from enum import Enum

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
    value: Union[float, str, None] = None   # number OR another indicator ref e.g. "SMA_200"
    params: IndicatorParams = Field(default_factory=IndicatorParams)
    logic_operator: Literal["AND", "OR", "NONE"] = "NONE"  # for chaining multiple rules

class ParsedStrategy(BaseModel):
    ticker: Optional[str] = None
    timeframe: Literal["1m","5m","15m","30m","1h","4h","1d","1w"] = "1d"
    asset_class: Optional[Literal["equity","crypto","forex","commodity"]] = None
    entry_rules: list[TradingRule] = []
    exit_rules: list[TradingRule] = []
    position_size: float = 1.0          # fraction of capital, 0.01–1.0
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None
    max_hold_days: Optional[int] = None
    short_allowed: bool = False
    missing_fields: list[str] = []
    confidence_score: float = 1.0       # LLM self-reported 0–1
    raw_input: str = ""

class ParseRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []  # [{role, content}, ...]

class ParseResponse(BaseModel):
    status: Literal["ok", "needs_clarification", "error"]
    strategy: Optional[ParsedStrategy] = None
    agent_message: str = ""             # natural language reply shown in chat
    missing_fields: list[str] = []
```

### 4.3 System Prompt — `backend/prompts/strategy_system_prompt.txt`

Write exactly this content to the file:

```
You are StrategyParserGPT — an expert quantitative trading strategy parser.

Your ONLY job is to convert the user's plain-English trading strategy into a structured JSON object.

## OUTPUT RULES (CRITICAL)
- Output ONLY valid JSON. No preamble. No explanation. No markdown fences. Raw JSON only.
- If you cannot determine a field with high confidence, set it to null and add the field name to "missing_fields".
- Never hallucinate indicator parameters. Use standard defaults when not specified.
- If the user mentions selling or exit conditions, put them in exit_rules NOT entry_rules.

## JSON SCHEMA TO OUTPUT
{
  "ticker": string or null,
  "timeframe": "1m"|"5m"|"15m"|"30m"|"1h"|"4h"|"1d"|"1w",
  "asset_class": "equity"|"crypto"|"forex"|"commodity"|null,
  "entry_rules": [ ...TradingRule... ],
  "exit_rules": [ ...TradingRule... ],
  "position_size": float (0.01-1.0, default 1.0),
  "stop_loss_pct": float or null,
  "take_profit_pct": float or null,
  "max_hold_days": int or null,
  "short_allowed": boolean,
  "missing_fields": [list of field names that are null/uncertain],
  "confidence_score": float 0.0-1.0,
  "raw_input": the original user message
}

TradingRule shape:
{
  "indicator": "SMA"|"EMA"|"RSI"|"MACD"|"BBANDS"|"PRICE"|"VOLUME"|"STOCH"|"ATR"|"VWAP",
  "condition": "crosses_above"|"crosses_below"|"greater_than"|"less_than"|"equals"|"between",
  "value": number or indicator_string or null,
  "params": { "period": int or null, "fast_period": int or null, "slow_period": int or null, "signal_period": int or null },
  "logic_operator": "AND"|"OR"|"NONE"
}

## INDICATOR DEFAULT PARAMETERS
SMA/EMA: period required (infer from context e.g. "50-day" → period 50)
RSI: period default 14, overbought default 70, oversold default 30
MACD: fast 12, slow 26, signal 9
Bollinger Bands: period 20, std_dev 2.0
Stochastic: k_period 14, d_period 3
ATR: period 14

## PHRASE → FIELD MAPPINGS (learn these patterns)
"50-day moving average" / "50 MA" / "50 SMA" → indicator: SMA, params.period: 50
"exponential moving average" / "EMA" → indicator: EMA
"golden cross" → entry: SMA(50) crosses_above SMA(200)
"death cross" → entry: SMA(50) crosses_below SMA(200)
"RSI above 70" / "RSI overbought" → indicator: RSI, condition: greater_than, value: 70
"RSI below 30" / "RSI oversold" → indicator: RSI, condition: less_than, value: 30
"price breaks above" / "breakout above" → indicator: PRICE, condition: crosses_above
"MACD crossover" → MACD line crosses_above signal line
"Bollinger Band squeeze" / "price touches upper band" → indicator: BBANDS
"volume spike" / "high volume" → indicator: VOLUME, condition: greater_than
"stop loss 2%" → stop_loss_pct: 2.0
"take profit 5%" → take_profit_pct: 5.0
"daily chart" / "1 day" → timeframe: 1d
"hourly" → timeframe: 1h
"crypto" / "bitcoin" / "BTC" → asset_class: crypto

## MULTI-CONDITION STRATEGIES
If user mentions "AND" or "both conditions" → set logic_operator: "AND" on subsequent rules
If user mentions "OR" or "either" → set logic_operator: "OR"
First rule in a list always has logic_operator: "NONE"

## CLARIFICATION
After outputting JSON, if missing_fields is non-empty, also output a separate JSON key:
"agent_message": "I need a bit more info: [natural explanation of what's missing]"

If the user's message is a clarification (building on prior conversation), merge the new info with what was established before. The conversation history will be provided.
```

### 4.4 LLM Service — `backend/services/llm_parser.py`

```python
import os
import json
import re
from pathlib import Path
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

SYSTEM_PROMPT = Path(__file__).parent.parent / "prompts" / "strategy_system_prompt.txt"
SYSTEM_PROMPT_TEXT = SYSTEM_PROMPT.read_text()

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    system_instruction=SYSTEM_PROMPT_TEXT,
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.1,        # low temp = deterministic, structured
        max_output_tokens=1024,
    )
)

def build_conversation(history: list[dict], new_message: str) -> list[dict]:
    """Build Gemini-format conversation turns."""
    turns = []
    for h in history:
        turns.append({"role": h["role"], "parts": [h["content"]]})
    turns.append({"role": "user", "parts": [new_message]})
    return turns

def parse_strategy_with_llm(message: str, history: list[dict]) -> dict:
    """
    Call Gemini and return parsed strategy dict.
    Raises ValueError on unparseable response.
    """
    turns = build_conversation(history, message)
    
    try:
        response = model.generate_content(turns)
        raw = response.text.strip()
        
        # Strip markdown fences if model adds them despite instruction
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        
        parsed = json.loads(raw)
        parsed["raw_input"] = message
        return parsed

    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}")
    except Exception as e:
        raise RuntimeError(f"Gemini API error: {e}")
```

### 4.5 Validator — `backend/services/validator.py`

```python
from models.strategy_schema import ParsedStrategy, ParseResponse

REQUIRED_FOR_BACKTEST = ["ticker", "entry_rules"]

FRIENDLY_NAMES = {
    "ticker": "which stock, crypto, or asset to test (e.g. AAPL, BTCUSDT)",
    "entry_rules": "the entry condition (when to BUY)",
    "exit_rules": "the exit condition (when to SELL) — optional but recommended",
    "timeframe": "the chart timeframe (e.g. daily, hourly)",
    "stop_loss_pct": "a stop-loss percentage",
    "take_profit_pct": "a take-profit target percentage",
}

def validate_and_respond(raw_dict: dict) -> ParseResponse:
    """
    Takes raw LLM JSON dict, validates it, returns ParseResponse.
    """
    try:
        strategy = ParsedStrategy(**raw_dict)
    except Exception as e:
        return ParseResponse(
            status="error",
            agent_message=f"I had trouble parsing that strategy. Could you rephrase it? ({e})"
        )

    missing = strategy.missing_fields or []

    # Also check required fields ourselves
    if not strategy.ticker:
        if "ticker" not in missing:
            missing.append("ticker")
    if not strategy.entry_rules:
        if "entry_rules" not in missing:
            missing.append("entry_rules")

    if missing:
        friendly = [FRIENDLY_NAMES.get(f, f) for f in missing]
        msg = "Got it! Just need a couple more details:\n" + "\n".join(
            f"  • {f}" for f in friendly
        )
        return ParseResponse(
            status="needs_clarification",
            strategy=strategy,
            agent_message=msg,
            missing_fields=missing
        )

    agent_message = build_confirmation_message(strategy)

    return ParseResponse(
        status="ok",
        strategy=strategy,
        agent_message=agent_message,
        missing_fields=[]
    )

def build_confirmation_message(s: ParsedStrategy) -> str:
    entry_summary = []
    for r in s.entry_rules:
        param_str = f"({r.params.period})" if r.params.period else ""
        val_str = f" {r.value}" if r.value is not None else ""
        entry_summary.append(f"{r.indicator}{param_str} {r.condition.replace('_',' ')}{val_str}")

    exit_summary = []
    for r in s.exit_rules:
        param_str = f"({r.params.period})" if r.params.period else ""
        val_str = f" {r.value}" if r.value is not None else ""
        exit_summary.append(f"{r.indicator}{param_str} {r.condition.replace('_',' ')}{val_str}")

    lines = [
        f"Strategy parsed successfully for **{s.ticker}** on {s.timeframe} chart.",
        f"Entry: {' AND '.join(entry_summary) if entry_summary else 'None specified'}",
    ]
    if exit_summary:
        lines.append(f"Exit: {' AND '.join(exit_summary)}")
    if s.stop_loss_pct:
        lines.append(f"Stop loss: {s.stop_loss_pct}%")
    if s.take_profit_pct:
        lines.append(f"Take profit: {s.take_profit_pct}%")
    lines.append("Ready to run backtest!")
    return "\n".join(lines)
```

### 4.6 Route — `backend/routes/strategy.py`

```python
from fastapi import APIRouter, HTTPException
from models.strategy_schema import ParseRequest, ParseResponse
from services.llm_parser import parse_strategy_with_llm
from services.validator import validate_and_respond

router = APIRouter(prefix="/api", tags=["strategy"])

@router.post("/parse-strategy", response_model=ParseResponse)
async def parse_strategy(req: ParseRequest):
    try:
        raw_dict = parse_strategy_with_llm(req.message, req.conversation_history)
        return validate_and_respond(raw_dict)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

@router.get("/health")
async def health():
    return {"status": "ok"}
```

### 4.7 Main App — `backend/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.strategy import router

app = FastAPI(title="TriVectorAI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
```

---

## 5. Frontend Implementation

### 5.1 `frontend/package.json`

```json
{
  "name": "trivectorai-frontend",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.2",
    "zustand": "^4.5.2",
    "react-markdown": "^9.0.1",
    "lucide-react": "^0.383.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1",
    "tailwindcss": "^3.4.4",
    "postcss": "^8.4.39",
    "autoprefixer": "^10.4.19"
  }
}
```

### 5.2 Tailwind Config — `frontend/tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eeedfe",
          100: "#cecbf6",
          400: "#7f77dd",
          600: "#534ab7",
          900: "#26215c",
        },
        surface: {
          DEFAULT: "#0f0f13",
          card:    "#17171e",
          border:  "#2a2a36",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "pulse-dot": "pulseDot 1.2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulseDot: { "0%,80%,100%": { transform: "scale(0.6)", opacity: 0.4 }, "40%": { transform: "scale(1)", opacity: 1 } },
      }
    }
  },
  plugins: []
}
```

### 5.3 Global Store — `frontend/src/store/useStrategyStore.js`

```js
import { create } from "zustand"

export const useStrategyStore = create((set, get) => ({
  // Chat state
  messages: [],          // { id, role: "user"|"agent", content, timestamp }
  isLoading: false,

  // Parsed strategy state
  strategy: null,        // ParsedStrategy object from backend
  parseStatus: null,     // "ok" | "needs_clarification" | "error" | null
  missingFields: [],

  // Conversation history for LLM context
  conversationHistory: [],

  // Actions
  addMessage: (role, content) => {
    const msg = {
      id: Date.now(),
      role,
      content,
      timestamp: new Date().toISOString(),
    }
    set(s => ({ messages: [...s.messages, msg] }))
    return msg
  },

  setLoading: (val) => set({ isLoading: val }),

  updateStrategy: (strategyData, status, missing) => set({
    strategy: strategyData,
    parseStatus: status,
    missingFields: missing || [],
  }),

  appendToHistory: (role, content) => set(s => ({
    conversationHistory: [...s.conversationHistory, { role, content }]
  })),

  reset: () => set({
    messages: [],
    strategy: null,
    parseStatus: null,
    missingFields: [],
    conversationHistory: [],
    isLoading: false,
  }),
}))
```

### 5.4 API Layer — `frontend/src/api/strategyApi.js`

```js
import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" }
})

export const parseStrategy = async (message, conversationHistory = []) => {
  const { data } = await api.post("/parse-strategy", {
    message,
    conversation_history: conversationHistory,
  })
  return data  // ParseResponse
}
```

### 5.5 Component Specifications

#### `ChatInput.jsx` — behaviour
- Textarea (auto-grows up to 4 lines, then scrolls)
- `Cmd+Enter` or `Ctrl+Enter` to submit (in addition to the send button)
- Disabled while `isLoading` is true
- Placeholder rotates through examples:
  - "e.g. Buy when 50 SMA crosses above 200 SMA on AAPL..."
  - "e.g. RSI below 30 on BTC, sell when RSI crosses above 70..."
  - "e.g. Golden cross strategy with 2% stop loss on TSLA..."
- Clear button (×) appears when input has text

#### `ChatMessage.jsx` — behaviour
- User messages: right-aligned, brand-600 background, white text, rounded-2xl rounded-br-sm
- Agent messages: left-aligned, surface-card background, gray-100 text, rounded-2xl rounded-bl-sm
- Agent messages support `react-markdown` (bold, lists, code blocks)
- Each message shows a subtle timestamp on hover
- Agent avatar: small circular icon with "TV" initials in brand purple

#### `TypingIndicator.jsx` — behaviour
- Three dots with staggered `pulse-dot` animation
- Only shown when `isLoading === true`
- Appears as an agent message bubble

#### `StrategyPanel.jsx` — behaviour
- Right panel, fixed width 380px on desktop, collapsible on mobile
- Shows placeholder state ("Your parsed strategy will appear here") when `strategy === null`
- When strategy is loaded:
  - Header: ticker pill + timeframe badge + confidence score bar
  - Entry Rules section with `RuleCard` per rule
  - Exit Rules section with `RuleCard` per rule
  - Risk section: stop loss, take profit, position size
  - Missing fields section: yellow `MissingFieldAlert` if any
  - "Run Backtest" button (disabled in Phase 1, grayed out with tooltip "Coming in Phase 2")
- Animate in with `slide-up` when strategy first appears
- JSON raw view toggle (expand/collapse with `<>` icon, shows formatted JSON in monospace)

#### `RuleCard.jsx` — behaviour
- Shows: `[INDICATOR badge] [period pill] [condition chip] [value]`
- Color-coded by indicator type:
  - SMA/EMA: blue
  - RSI: orange  
  - MACD: purple
  - BBANDS: teal
  - PRICE: gray
  - VOLUME: green
- AND/OR connector shown between cards when logic_operator is set

#### `MissingFieldAlert.jsx` — behaviour
- Yellow/amber warning banner
- Lists each missing field as a bullet
- Has a subtle "Click chat to fill these in" hint

### 5.6 App Layout — `frontend/src/App.jsx`

```jsx
// Layout: full-height flex row
// [Sidebar 220px] [ChatWindow flex-1] [StrategyPanel 380px]
// On mobile (<768px): StrategyPanel slides up as a bottom sheet
// Dark theme only (class="dark" on <html>)
```

The sidebar contains:
- TriVectorAI logo + name at top
- Navigation items: "New Strategy", "History" (disabled, Phase 2), "Settings" (disabled)
- At bottom: a small "Phase 1 — Parser" version badge
- Collapsible to icon-only on small screens

### 5.7 UX Flow (Implement Exactly)

```
1. User opens app → sees welcome message from agent:
   "Hi! I'm TriVectorAI. Describe any trading strategy in plain English 
    and I'll parse it into structured rules ready for backtesting.
    Try: 'Buy AAPL when the 50-day SMA crosses above the 200-day SMA'"

2. User types a strategy → hits Enter

3. User message appears in chat immediately (optimistic)

4. TypingIndicator appears (agent is thinking)

5. POST /api/parse-strategy with message + conversation history

6. On response:
   a. If status === "ok":
      - Agent message: confirmation text from response.agent_message
      - StrategyPanel updates with full parsed strategy
      - "Run Backtest" button appears (disabled, Phase 2 badge)
   
   b. If status === "needs_clarification":
      - Agent message: the clarification question from response.agent_message
      - StrategyPanel shows partial strategy (what was parsed so far)
      - MissingFieldAlert shows in panel
      - User can reply in chat to fill in missing info
      - Next request includes full conversation_history
   
   c. If status === "error":
      - Agent message: error explanation
      - Red toast notification

7. User can type "reset" or click "New Strategy" to clear everything
```

---

## 6. Example Strategies to Test (Include in README)

The agent must handle all of these correctly:

| User Input | Expected Parse |
|---|---|
| `"Buy AAPL when 50 SMA crosses above 200 SMA"` | SMA golden cross, ticker AAPL, missing exit |
| `"Golden cross strategy on BTC daily"` | SMA(50) > SMA(200), ticker BTC, timeframe 1d |
| `"Buy when RSI drops below 30, sell when RSI goes above 70 on TSLA"` | RSI entry + exit, ticker TSLA |
| `"MACD crossover on ETH hourly with 2% stop loss"` | MACD, 1h, stop_loss 2.0 |
| `"Bollinger Band breakout — buy when price closes above upper band on NVDA"` | BBANDS, PRICE closes above |
| `"Buy when 50 EMA crosses above 200 EMA AND RSI is below 60"` | Multi-condition AND logic |
| `"Short EURUSD when 20 SMA crosses below 50 SMA on 4h chart"` | short_allowed: true, forex |

---

## 7. Error Handling Requirements

- **Network error**: Show "Connection failed. Is the backend running?" in chat
- **422 Unprocessable**: Show the validation error details
- **503 Service Unavailable**: Show "LLM service is unavailable. Check your API key."
- **Timeout (>30s)**: Show "That took too long. Please try again."
- All errors must appear as agent messages in chat, NOT just console.error
- Never show raw stack traces to the user

---

## 8. Environment Setup Instructions (for README)

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

---

## 9. DO NOT DO List (For the Agent)

- Do NOT use `create-react-app` — use Vite only
- Do NOT use any CSS framework other than Tailwind
- Do NOT use `localStorage` for state — use Zustand only
- Do NOT make the UI light-mode — dark theme only
- Do NOT skip the Pydantic models — all request/response must be typed
- Do NOT use `openai` SDK — use `google-generativeai` only
- Do NOT put API keys in the frontend code — backend only
- Do NOT use `useEffect` with empty dep arrays as a crutch — prefer Zustand actions
- Do NOT mock the LLM — wire it for real
- Do NOT skip CORS middleware — frontend and backend run on different ports

---

## 10. Definition of Done (Phase 1 Complete When...)

- [ ] `npm run dev` and `uvicorn main:app --reload` start without errors
- [ ] All 7 test strategies in Section 6 parse correctly
- [ ] Clarification loop works (missing ticker prompts a follow-up)
- [ ] StrategyPanel updates live with each parse
- [ ] JSON raw view toggle works
- [ ] Mobile layout works (tested at 375px width)
- [ ] All error states show user-friendly messages in chat
- [ ] `/docs` FastAPI swagger UI shows all routes documented
