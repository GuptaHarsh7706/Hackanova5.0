# TriVectorAI — Phase 4: Full Integration Spec
## Connect Every Frontend Screen to Every Backend Endpoint

> **AGENT INSTRUCTIONS — READ BEFORE TOUCHING ANY FILE:**
>
> 1. **First action:** Scan the entire codebase. Read every file in `frontend/src/` and `backend/`. Build a mental map before changing anything.
> 2. **Do not rewrite.** Your job is to wire existing code together. Only modify files that need API connections.
> 3. **One contract:** Every API call shape is defined in Section 3. If the backend returns something different, fix the backend to match — never change the frontend to accept broken data.
> 4. **Test each connection** before moving to the next. The checklist in Section 9 is your definition of done.
> 5. **If a file from Phase 2 or Phase 3 is missing**, create it using the spec from those documents. Do not skip it.

---

## 1. What This Phase Does

Phase 2 built a complete static frontend (all screens, mock data, stubbed API calls).
Phase 3 built a complete backend (FastAPI, AI agent, backtest engine, SQLite).

**Phase 4 makes them talk to each other.**

Every `strategyApi.js` mock gets replaced with a real HTTP call.
Every component that displays mock data gets replaced with live API data.
Every loading state, error state, and empty state gets wired to real conditions.

Nothing else changes. No new features. No UI redesigns. Just wiring.

---

## 2. Codebase Scan Checklist — Do This First

Before writing a single line, open and read each of these files and note what exists:

### Backend — verify these files exist and are complete:
```
backend/
├── main.py                         ← FastAPI app, CORS config
├── .env / .env.example             ← GEMINI_API_KEY present?
├── requirements.txt                ← all packages listed?
├── routes/
│   ├── strategy.py                 ← POST /api/parse-strategy
│   ├── backtest.py                 ← POST /api/run-backtest
│   ├── history.py                  ← GET /api/history, GET /api/history/:id, DELETE /api/history/:id
│   └── health.py                   ← GET /api/health
├── agent/
│   ├── strategy_agent.py           ← run_agent() function present?
│   ├── memory.py                   ← AgentMemory class present?
│   ├── tool_registry.py            ← TOOL_DEFINITIONS list present?
│   └── tools/
│       ├── parse_tool.py           ← execute_parse_tool() present?
│       ├── validate_tool.py        ← execute_validate_tool() present?
│       ├── clarify_tool.py         ← execute_clarify_tool() present?
│       ├── backtest_tool.py        ← execute_backtest_tool() present?
│       └── narrate_tool.py         ← execute_narrate_tool() present?
├── engine/
│   ├── data_fetcher.py             ← fetch_ohlcv() with @lru_cache present?
│   ├── indicator_builder.py        ← compute_indicators() present?
│   ├── signal_builder.py           ← build_signals() present?
│   ├── backtest_runner.py          ← run_backtest() present?
│   └── result_formatter.py        ← format_result() present?
├── models/
│   ├── strategy_schema.py          ← ParsedStrategy, TradingRule models present?
│   ├── backtest_schema.py          ← BacktestResult, Trade, BacktestMetrics present?
│   └── api_schema.py               ← ParseRequest, ParseResponse, BacktestRequest present?
├── database/
│   ├── db.py                       ← init_db(), get_conn() present?
│   └── repository.py               ← save/load functions present?
└── prompts/
    └── strategy_agent_system.txt   ← system prompt present?
```

### Frontend — verify these files exist and are complete:
```
frontend/src/
├── api/
│   └── strategyApi.js              ← ALL functions present (even if still mocked)?
├── store/
│   └── useStrategyStore.js         ← Zustand store with all state fields?
├── pages/
│   ├── ChatPage.jsx                ← uses strategyApi.parseStrategy?
│   ├── ResultsPage.jsx             ← uses strategyApi.runBacktest or getResults?
│   ├── HistoryPage.jsx             ← uses strategyApi.getHistory?
│   ├── ComparePage.jsx             ← uses strategyApi.getHistory for dropdowns?
│   └── SettingsPage.jsx            ← uses strategyApi.saveSettings?
├── components/
│   ├── chat/ChatInput.jsx          ← onSubmit calls store action?
│   ├── chat/ChatWindow.jsx         ← reads messages from store?
│   ├── strategy/StrategyPanel.jsx  ← reads strategy from store?
│   └── results/EquityCurveChart.jsx← accepts data prop?
└── data/
    └── mockData.js                 ← mock data still present (keep as fallback)
```

**If any file is missing:** create it from the Phase 2 or Phase 3 spec before continuing.

---

## 3. API Contract — The Single Source of Truth

Every frontend call and every backend response MUST match these exactly.
If there is a mismatch anywhere, fix the backend response shape — never accept broken data silently in the frontend.

### 3.1 POST `/api/parse-strategy`

**Request:**
```json
{
  "message": "Buy AAPL when 50 SMA crosses above 200 SMA",
  "conversation_history": [
    { "role": "user",  "content": "prior message" },
    { "role": "model", "content": "prior response" }
  ],
  "session_id": "uuid-string-or-null"
}
```

**Response — status: ok:**
```json
{
  "status": "ok",
  "strategy": {
    "ticker": "AAPL",
    "timeframe": "1d",
    "asset_class": "equity",
    "entry_rules": [
      {
        "indicator": "SMA",
        "condition": "crosses_above",
        "value": "SMA_200",
        "params": { "period": 50 },
        "logic_operator": "NONE"
      }
    ],
    "exit_rules": [],
    "position_size": 1.0,
    "stop_loss_pct": null,
    "take_profit_pct": null,
    "short_allowed": false,
    "missing_fields": [],
    "confidence_score": 0.95,
    "raw_input": "Buy AAPL when 50 SMA crosses above 200 SMA"
  },
  "agent_message": "Strategy parsed for AAPL on daily chart...",
  "missing_fields": [],
  "session_id": "abc-123"
}
```

**Response — status: needs_clarification:**
```json
{
  "status": "needs_clarification",
  "strategy": { "...partial strategy..." },
  "agent_message": "Which asset would you like to test this on?",
  "missing_fields": ["ticker"],
  "session_id": "abc-123"
}
```

**Response — status: error:**
```json
{
  "status": "error",
  "strategy": null,
  "agent_message": "I couldn't parse that strategy. Could you rephrase it?",
  "missing_fields": [],
  "session_id": null
}
```

---

### 3.2 POST `/api/run-backtest`

**Request:**
```json
{
  "strategy": { "...complete ParsedStrategy object..." },
  "session_id": "abc-123"
}
```

**Response:**
```json
{
  "status": "ok",
  "result": {
    "strategy": { "...strategy object..." },
    "ticker_used": "AAPL",
    "data_period": "2019-01-02 to 2024-12-31",
    "metrics": {
      "total_return_pct": 127.4,
      "cagr_pct": 23.1,
      "sharpe_ratio": 1.84,
      "max_drawdown_pct": -18.3,
      "win_rate_pct": 62.5,
      "total_trades": 48,
      "avg_win_pct": 18.4,
      "avg_loss_pct": -7.2,
      "largest_win_pct": 113.8,
      "largest_loss_pct": -15.1,
      "profit_factor": 2.56,
      "expectancy_usd": 342.0
    },
    "equity_curve": [
      { "date": "2019-01-02", "value": 10000.0, "benchmark": 10000.0 },
      { "date": "2019-01-03", "value": 9980.0,  "benchmark": 9960.0  }
    ],
    "monthly_returns": {
      "2019": [1.2, -0.8, 3.4, null, 2.1, -1.5, 4.2, 1.8, -2.3, 3.1, 1.9, 2.7]
    },
    "trades": [
      {
        "id": 0,
        "date_in": "2019-03-26",
        "date_out": "2019-08-05",
        "entry_price": 186.87,
        "exit_price": 204.02,
        "pnl_usd": 917.0,
        "return_pct": 9.18,
        "hold_days": 132,
        "side": "long"
      }
    ],
    "ai_narrative": "This golden cross strategy on AAPL performed well..."
  },
  "message": ""
}
```

---

### 3.3 GET `/api/history`

**Response:**
```json
[
  {
    "id": "uuid",
    "strategy": { "...ParsedStrategy..." },
    "metrics": { "...BacktestMetrics..." },
    "ticker_used": "AAPL",
    "data_period": "2019-01-02 to 2024-12-31",
    "created_at": "2024-01-15T10:30:00"
  }
]
```

---

### 3.4 GET `/api/history/:id`

**Response:** Same shape as a single item from GET `/api/history` but with full `equity_curve`, `trades`, and `monthly_returns` fields included.

---

### 3.5 DELETE `/api/history/:id`

**Response:**
```json
{ "deleted": true, "id": "uuid" }
```

---

### 3.6 GET `/api/health`

**Response:**
```json
{ "status": "ok", "version": "0.3.0" }
```

---

## 4. Frontend API Layer — `frontend/src/api/strategyApi.js`

Replace the entire file with this. This is the ONLY file that talks to the backend.
All other frontend files import from here — never use `fetch` or `axios` directly in components.

```javascript
import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,       // 60s — backtest can take a while
  headers: { "Content-Type": "application/json" }
})

// ─── Request interceptor: attach session_id from localStorage if present ───
api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem("trivector_session_id")
  if (sessionId && config.data) {
    config.data = { ...config.data, session_id: sessionId }
  }
  return config
})

// ─── Response interceptor: save session_id when backend returns one ───
api.interceptors.response.use(
  (response) => {
    const sessionId = response.data?.session_id
    if (sessionId) localStorage.setItem("trivector_session_id", sessionId)
    return response
  },
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      (error.code === "ECONNABORTED" ? "Request timed out. The backtest may be taking too long." :
       error.code === "ERR_NETWORK"  ? "Cannot connect to backend. Is it running on port 8000?" :
       "An unexpected error occurred.")
    return Promise.reject(new Error(message))
  }
)

// ─── Strategy parsing ───────────────────────────────────────────────────────

/**
 * Send a user message to the AI agent for strategy parsing.
 * @param {string} message - User's plain English strategy
 * @param {Array}  conversationHistory - [{role, content}, ...] from Zustand store
 * @returns {Promise<ParseResponse>}
 */
export const parseStrategy = async (message, conversationHistory = []) => {
  const { data } = await api.post("/parse-strategy", {
    message,
    conversation_history: conversationHistory,
  })
  return data
}

// ─── Backtest ───────────────────────────────────────────────────────────────

/**
 * Run a full backtest for a parsed strategy.
 * @param {Object} strategy - ParsedStrategy object from parseStrategy response
 * @returns {Promise<BacktestResponse>}
 */
export const runBacktest = async (strategy) => {
  const { data } = await api.post("/run-backtest", { strategy })
  return data
}

// ─── History ────────────────────────────────────────────────────────────────

/**
 * Fetch all saved backtest results for history page.
 * @returns {Promise<Array>}
 */
export const getHistory = async () => {
  const { data } = await api.get("/history")
  return data
}

/**
 * Fetch a single full result by id (includes equity_curve and trades).
 * @param {string} id
 * @returns {Promise<Object>}
 */
export const getResultById = async (id) => {
  const { data } = await api.get(`/history/${id}`)
  return data
}

/**
 * Delete a saved result.
 * @param {string} id
 * @returns {Promise<Object>}
 */
export const deleteResult = async (id) => {
  const { data } = await api.delete(`/history/${id}`)
  return data
}

// ─── Health check ───────────────────────────────────────────────────────────

export const checkHealth = async () => {
  const { data } = await api.get("/health")
  return data
}
```

---

## 5. Zustand Store — `frontend/src/store/useStrategyStore.js`

Replace with this complete version. Every API call goes through a store action — components never call the API directly.

```javascript
import { create } from "zustand"
import {
  parseStrategy,
  runBacktest,
  getHistory,
  getResultById,
  deleteResult,
} from "../api/strategyApi"

export const useStrategyStore = create((set, get) => ({

  // ── Chat state ──────────────────────────────────────────────────────────
  messages: [],
  isLoading: false,
  loadingText: "",

  // ── Strategy state ──────────────────────────────────────────────────────
  currentStrategy: null,
  parseStatus: null,        // "ok" | "needs_clarification" | "error" | null
  missingFields: [],
  sessionId: null,

  // ── Backtest state ──────────────────────────────────────────────────────
  backtestResult: null,
  backtestLoading: false,
  currentResultId: null,

  // ── History state ───────────────────────────────────────────────────────
  history: [],
  historyLoading: false,

  // ── Error state ─────────────────────────────────────────────────────────
  error: null,

  // ════════════════════════════════════════════════════════════════════════
  // CHAT ACTIONS
  // ════════════════════════════════════════════════════════════════════════

  addMessage: (role, content, meta = {}) => {
    const msg = {
      id:        Date.now() + Math.random(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...meta,
    }
    set((s) => ({ messages: [...s.messages, msg] }))
    return msg
  },

  /**
   * Main action: send user message → call agent → handle response.
   * Called by ChatInput when user submits.
   */
  sendMessage: async (userText) => {
    const { addMessage, messages, sessionId } = get()

    // 1. Add user message to chat immediately
    addMessage("user", userText)
    set({ isLoading: true, loadingText: "Parsing your strategy...", error: null })

    // 2. Build conversation history from existing messages (for LLM context)
    const conversationHistory = messages
      .filter((m) => m.role === "user" || m.role === "agent")
      .map((m) => ({
        role:    m.role === "agent" ? "model" : "user",
        content: m.content,
      }))

    try {
      // 3. Call the AI agent
      const response = await parseStrategy(userText, conversationHistory)

      // 4. Save session_id for continuity across turns
      if (response.session_id) set({ sessionId: response.session_id })

      // 5. Update strategy state
      set({
        currentStrategy: response.strategy || null,
        parseStatus:     response.status,
        missingFields:   response.missing_fields || [],
      })

      // 6. Add agent reply to chat
      if (response.status === "ok") {
        addMessage("agent", response.agent_message, {
          type:     "confirmation",
          strategy: response.strategy,
        })
      } else if (response.status === "needs_clarification") {
        addMessage("agent", response.agent_message, {
          type:          "clarification",
          missingFields: response.missing_fields,
          strategy:      response.strategy,
        })
      } else {
        addMessage("agent", response.agent_message || "Something went wrong.", {
          type: "error",
        })
      }

    } catch (err) {
      const errMsg = err.message || "Connection failed."
      set({ error: errMsg })
      addMessage("agent", errMsg, { type: "error" })
    } finally {
      set({ isLoading: false, loadingText: "" })
    }
  },

  // ════════════════════════════════════════════════════════════════════════
  // BACKTEST ACTIONS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Run backtest for currentStrategy. Called by "Run Backtest" button.
   * Navigates to results page after success (pass navigate fn from component).
   */
  runBacktest: async (navigate) => {
    const { currentStrategy, addMessage } = get()
    if (!currentStrategy) return

    set({ backtestLoading: true, loadingText: "Running backtest..." })
    addMessage("agent", `Running backtest for **${currentStrategy.ticker}**... This may take a few seconds.`)

    try {
      const response = await runBacktest(currentStrategy)

      if (response.status === "ok" && response.result) {
        const result    = response.result
        const resultId  = `${currentStrategy.ticker}_${Date.now()}`

        set({
          backtestResult:  result,
          currentResultId: resultId,
          backtestLoading: false,
          loadingText:     "",
        })

        addMessage("agent",
          `Backtest complete! **${result.metrics.total_return_pct > 0 ? "+" : ""}${result.metrics.total_return_pct}%** total return over ${result.data_period}.\n\n${result.ai_narrative || ""}`,
          { type: "backtest_complete", resultId }
        )

        if (navigate) navigate(`/app/results/${resultId}`)
      } else {
        throw new Error(response.message || "Backtest failed.")
      }
    } catch (err) {
      set({ backtestLoading: false, loadingText: "" })
      addMessage("agent", `Backtest failed: ${err.message}`, { type: "error" })
    }
  },

  // ════════════════════════════════════════════════════════════════════════
  // HISTORY ACTIONS
  // ════════════════════════════════════════════════════════════════════════

  fetchHistory: async () => {
    set({ historyLoading: true })
    try {
      const history = await getHistory()
      set({ history, historyLoading: false })
    } catch (err) {
      set({ historyLoading: false, error: err.message })
    }
  },

  fetchResultById: async (id) => {
    set({ backtestLoading: true })
    try {
      const result = await getResultById(id)
      set({ backtestResult: result, currentResultId: id, backtestLoading: false })
      return result
    } catch (err) {
      set({ backtestLoading: false, error: err.message })
      return null
    }
  },

  deleteHistoryItem: async (id) => {
    try {
      await deleteResult(id)
      set((s) => ({ history: s.history.filter((h) => h.id !== id) }))
    } catch (err) {
      set({ error: err.message })
    }
  },

  // ════════════════════════════════════════════════════════════════════════
  // UTILITY ACTIONS
  // ════════════════════════════════════════════════════════════════════════

  resetChat: () => set({
    messages:        [],
    currentStrategy: null,
    parseStatus:     null,
    missingFields:   [],
    backtestResult:  null,
    currentResultId: null,
    error:           null,
    sessionId:       null,
    isLoading:       false,
    loadingText:     "",
  }),

  setError:   (error)   => set({ error }),
  clearError: ()        => set({ error: null }),
}))
```

---

## 6. Component Wiring — Exact Changes Per File

### 6.1 `ChatPage.jsx` — Wire send message

Find the `ChatInput` submit handler. It currently calls the mock. Replace:

```javascript
// FIND this pattern (however it's written):
const handleSubmit = async (text) => {
  // mock or empty
}

// REPLACE WITH:
import { useStrategyStore } from "../store/useStrategyStore"
import { useNavigate } from "react-router-dom"

const ChatPage = () => {
  const navigate  = useNavigate()
  const { sendMessage, isLoading, messages, currentStrategy, runBacktest, backtestLoading } = useStrategyStore()

  const handleSubmit = async (text) => {
    if (!text.trim() || isLoading) return
    await sendMessage(text)
  }

  const handleRunBacktest = async () => {
    await runBacktest(navigate)
  }

  // Pass handleSubmit to ChatInput
  // Pass handleRunBacktest to the "Run Backtest" button in StrategyPanel or ConfirmationCard
  // Pass isLoading || backtestLoading to disable input and show TypingIndicator
}
```

### 6.2 `ChatWindow.jsx` — Read messages from store

```javascript
// FIND: const messages = MOCK_CHAT_MESSAGES or hardcoded array
// REPLACE WITH:
import { useStrategyStore } from "../../store/useStrategyStore"

const ChatWindow = () => {
  const messages        = useStrategyStore((s) => s.messages)
  const isLoading       = useStrategyStore((s) => s.isLoading)
  const backtestLoading = useStrategyStore((s) => s.backtestLoading)
  const loadingText     = useStrategyStore((s) => s.loadingText)

  // Show TypingIndicator when isLoading OR backtestLoading is true
  // Pass loadingText as subtitle of TypingIndicator if it accepts one
}
```

### 6.3 `ChatMessage.jsx` — Handle message types

The store adds `type` metadata to messages. Use it to render different cards:

```javascript
const ChatMessage = ({ message }) => {
  const { role, content, type, strategy, missingFields } = message

  // Agent messages with type="confirmation" → render ConfirmationCard
  if (role === "agent" && type === "confirmation" && strategy) {
    return (
      <div className="message-bubble agent">
        <ConfirmationCard strategy={strategy} content={content} />
      </div>
    )
  }

  // Agent messages with type="clarification" → render ClarificationCard
  if (role === "agent" && type === "clarification") {
    return (
      <div className="message-bubble agent">
        <ClarificationCard
          content={content}
          missingFields={missingFields}
          partialStrategy={strategy}
        />
      </div>
    )
  }

  // Agent messages with type="error" → red border styling
  if (role === "agent" && type === "error") {
    return (
      <div className="message-bubble agent error-bubble">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    )
  }

  // Default: plain text bubble with markdown
  return (
    <div className={`message-bubble ${role}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
```

### 6.4 `StrategyPanel.jsx` — Read strategy from store

```javascript
// FIND: const strategy = MOCK_STRATEGIES[0] or hardcoded
// REPLACE WITH:
import { useStrategyStore } from "../../store/useStrategyStore"

const StrategyPanel = () => {
  const strategy        = useStrategyStore((s) => s.currentStrategy)
  const parseStatus     = useStrategyStore((s) => s.parseStatus)
  const missingFields   = useStrategyStore((s) => s.missingFields)
  const backtestLoading = useStrategyStore((s) => s.backtestLoading)
  const runBacktest     = useStrategyStore((s) => s.runBacktest)
  const navigate        = useNavigate()

  if (!strategy) return <EmptyState ... />

  return (
    // existing panel JSX
    // wire "Run Backtest" button:
    <Button
      onClick={() => runBacktest(navigate)}
      loading={backtestLoading}
      disabled={!strategy || backtestLoading}
    >
      {backtestLoading ? "Running..." : "Run Backtest →"}
    </Button>
  )
}
```

### 6.5 `ResultsPage.jsx` — Load real results

```javascript
import { useParams, useNavigate } from "react-router-dom"
import { useStrategyStore } from "../store/useStrategyStore"
import { useEffect } from "react"

const ResultsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    backtestResult,
    currentResultId,
    backtestLoading,
    fetchResultById,
  } = useStrategyStore()

  useEffect(() => {
    // If we already have this result in store (just ran it), use it directly.
    // Otherwise fetch it from the history API (user navigated directly to URL).
    if (!backtestResult || currentResultId !== id) {
      fetchResultById(id)
    }
  }, [id])

  if (backtestLoading) return <FullPageSpinner text="Loading results..." />
  if (!backtestResult)  return <EmptyState title="Result not found" action={{ label: "← Back", onClick: () => navigate("/app") }} />

  const { metrics, equity_curve, trades, monthly_returns, ai_narrative, strategy, data_period } = backtestResult

  return (
    // Pass real data to each sub-component:

    <MetricsStrip metrics={metrics} />

    <EquityCurveChart
      data={equity_curve}           // [{date, value, benchmark}]
      strategy={strategy}
    />

    <TradeLogTable
      trades={trades}               // [{id, date_in, date_out, return_pct, ...}]
    />

    <MonthlyHeatmap
      data={monthly_returns}        // {year: [jan..dec]}
    />

    <AdditionalMetrics metrics={metrics} />

    <AIInsightPanel narrative={ai_narrative} />

    <StrategySummaryCard strategy={strategy} dataPeriod={data_period} />
  )
}
```

### 6.6 `HistoryPage.jsx` — Load real history

```javascript
import { useStrategyStore } from "../store/useStrategyStore"
import { useEffect } from "react"

const HistoryPage = () => {
  const { history, historyLoading, fetchHistory, deleteHistoryItem } = useStrategyStore()

  // Fetch on mount
  useEffect(() => { fetchHistory() }, [])

  if (historyLoading) return <FullPageSpinner text="Loading history..." />

  if (!history.length) return (
    <EmptyState
      icon="Clock"
      title="No strategies yet"
      description="Run your first backtest to see it here."
      action={{ label: "Go to Chat →", href: "/app" }}
    />
  )

  return (
    <HistoryGrid
      items={history}
      onDelete={deleteHistoryItem}    // wire delete button
      onOpen={(item) => navigate(`/app/results/${item.id}`)}
    />
  )
}
```

### 6.7 `ComparePage.jsx` — Load history for dropdowns

```javascript
import { useStrategyStore } from "../store/useStrategyStore"
import { useEffect, useState } from "react"

const ComparePage = () => {
  const { history, fetchHistory } = useStrategyStore()
  const [strategyA, setStrategyA] = useState(null)
  const [strategyB, setStrategyB] = useState(null)

  useEffect(() => { fetchHistory() }, [])

  // Populate dropdowns with history items
  // When user selects from dropdown, set strategyA or strategyB
  // CompareMetricTable and OverlaidChart receive strategyA and strategyB as props

  const options = history.map((h) => ({
    value: h.id,
    label: `${h.ticker_used} — ${h.strategy?.entry_rules?.[0]?.indicator || "Strategy"}`,
    data:  h,
  }))

  return (
    // pass real data to:
    <CompareMetricTable a={strategyA?.metrics} b={strategyB?.metrics} />
    <OverlaidChart
      curveA={strategyA?.equity_curve}
      curveB={strategyB?.equity_curve}
      labelA={strategyA?.ticker_used}
      labelB={strategyB?.ticker_used}
    />
  )
}
```

---

## 7. Chart Components — Replace Static SVG with Real Data

### 7.1 `EquityCurveChart.jsx`

The Phase 2 version used hardcoded SVG paths. Replace the data source:

```javascript
// EXISTING component already accepts a `data` prop — just verify the prop is passed.
// The component should map data like this:

const EquityCurveChart = ({ data = [] }) => {
  // data = [{date: "2019-01-02", value: 10000, benchmark: 10000}, ...]

  if (!data.length) return <div className="chart-empty">No data</div>

  // If using static SVG paths: replace the hardcoded path coords with
  // computed ones from the data array.
  //
  // Simple approach for hackathon — normalize values to SVG coordinate space:
  const W = 600, H = 200
  const values     = data.map((d) => d.value)
  const benchmarks = data.map((d) => d.benchmark)
  const minVal = Math.min(...values, ...benchmarks)
  const maxVal = Math.max(...values, ...benchmarks)
  const range  = maxVal - minVal || 1

  const toX = (i)   => (i / (data.length - 1)) * W
  const toY = (val) => H - ((val - minVal) / range) * H

  const strategyPath  = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(" ")
  const benchmarkPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.benchmark).toFixed(1)}`).join(" ")

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <path d={strategyPath}  fill="none" stroke="#7f77dd" strokeWidth="2" />
      <path d={benchmarkPath} fill="none" stroke="#4a4a62" strokeWidth="1.5" strokeDasharray="6 3" />
    </svg>
  )
}
```

### 7.2 `MonthlyHeatmap.jsx`

```javascript
// data = { 2019: [1.2, -0.8, 3.4, ...12 values], 2020: [...], ... }
// null values = no trade that month → render as empty cell

const MonthlyHeatmap = ({ data = {} }) => {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const years  = Object.keys(data).sort()

  const getColor = (val) => {
    if (val === null || val === undefined) return "bg-[--border-subtle]"
    if (val >  5)  return "bg-green-700"
    if (val >  2)  return "bg-green-600"
    if (val >  0)  return "bg-green-500/60"
    if (val > -2)  return "bg-red-500/60"
    if (val > -5)  return "bg-red-600"
    return "bg-red-700"
  }

  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th></th>
            {MONTHS.map((m) => <th key={m} className="text-xs text-muted">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="text-xs text-secondary pr-3">{year}</td>
              {(data[year] || Array(12).fill(null)).map((val, i) => (
                <td key={i}>
                  <div
                    className={`w-8 h-7 rounded text-[10px] flex items-center justify-center cursor-default ${getColor(val)}`}
                    title={val !== null ? `${MONTHS[i]} ${year}: ${val > 0 ? "+" : ""}${val?.toFixed(1)}%` : "No trades"}
                  >
                    {val !== null ? (val > 0 ? `+${val.toFixed(0)}` : val.toFixed(0)) : ""}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### 7.3 `MetricCard.jsx` and `MetricsStrip.jsx`

```javascript
// MetricsStrip receives the metrics object and renders 6 MetricCards.
// The metrics keys from the API are:
//   total_return_pct, sharpe_ratio, max_drawdown_pct,
//   win_rate_pct, total_trades, cagr_pct

const METRIC_CONFIG = [
  { key: "total_return_pct",  label: "Total Return", suffix: "%", positive: (v) => v > 0 },
  { key: "sharpe_ratio",      label: "Sharpe Ratio", suffix: "",  positive: (v) => v > 1 },
  { key: "max_drawdown_pct",  label: "Max Drawdown", suffix: "%", positive: (v) => v > -20 },
  { key: "win_rate_pct",      label: "Win Rate",     suffix: "%", positive: (v) => v > 50 },
  { key: "total_trades",      label: "Total Trades", suffix: "",  positive: () => true },
  { key: "cagr_pct",          label: "CAGR",         suffix: "%", positive: (v) => v > 0 },
]

const MetricsStrip = ({ metrics }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
    {METRIC_CONFIG.map((cfg) => (
      <MetricCard
        key={cfg.key}
        label={cfg.label}
        value={metrics?.[cfg.key]}
        suffix={cfg.suffix}
        isPositive={cfg.positive(metrics?.[cfg.key] ?? 0)}
      />
    ))}
  </div>
)
```

### 7.4 `TradeLogTable.jsx`

```javascript
// trades = [{id, date_in, date_out, entry_price, exit_price, pnl_usd, return_pct, hold_days}]
// Already built in Phase 2 — just verify the prop name matches what ResultsPage passes.
// The component should accept: <TradeLogTable trades={trades} />
// Each row: date_in, date_out, entry_price, exit_price, pnl_usd (green/red), return_pct, hold_days
```

---

## 8. Backend — Missing Routes to Implement

### `routes/history.py` — Must implement these 3 routes:

```python
from fastapi import APIRouter, HTTPException
from database.repository import get_all_results, get_result_by_id, delete_result

router = APIRouter(prefix="/api", tags=["history"])

@router.get("/history")
async def get_history():
    """Return all saved backtest results, newest first, summary only (no equity_curve)."""
    results = get_all_results()
    # Strip equity_curve and trades from list view to keep response small
    return [
        {
            "id":          r.get("id") or r.get("strategy_id"),
            "strategy":    r.get("strategy"),
            "metrics":     r.get("metrics"),
            "ticker_used": r.get("ticker_used"),
            "data_period": r.get("data_period"),
            "created_at":  r.get("created_at"),
        }
        for r in results
    ]

@router.get("/history/{result_id}")
async def get_history_item(result_id: str):
    """Return full result including equity_curve, trades, monthly_returns."""
    result = get_result_by_id(result_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Result {result_id} not found")
    return result

@router.delete("/history/{result_id}")
async def delete_history_item(result_id: str):
    success = delete_result(result_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Result {result_id} not found")
    return {"deleted": True, "id": result_id}
```

### `database/repository.py` — Add missing functions:

```python
def get_result_by_id(result_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, data, created_at FROM results WHERE id=?", (result_id,)
        ).fetchone()
    if not row:
        return None
    result = json.loads(row["data"])
    result["id"]         = row["id"]
    result["created_at"] = row["created_at"]
    return result

def delete_result(result_id: str) -> bool:
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM results WHERE id=?", (result_id,))
    return cursor.rowcount > 0

def get_all_results() -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, data, created_at FROM results ORDER BY created_at DESC LIMIT 100"
        ).fetchall()
    results = []
    for row in rows:
        item = json.loads(row["data"])
        item["id"]         = row["id"]
        item["created_at"] = row["created_at"]
        results.append(item)
    return results
```

### `routes/health.py`:

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health")
async def health():
    return {"status": "ok", "version": "0.3.0"}
```

---

## 9. Environment & Startup

### `frontend/.env` (create this file):
```
VITE_API_URL=http://localhost:8000/api
```

### `frontend/vite.config.js` — add proxy as fallback:
```javascript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      }
    }
  }
})
```

### `backend/.env` (create from .env.example):
```
GEMINI_API_KEY=your_actual_key_here
```

### Startup commands:
```bash
# Terminal 1 — Backend
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

---

## 10. Integration Test Script — Run These in Order

Run these manually after wiring to verify each connection works end to end.
Do NOT mark Phase 4 done until every test passes.

### Test 1 — Health check
```bash
curl http://localhost:8000/api/health
# Expected: {"status":"ok","version":"0.3.0"}
```

### Test 2 — Parse complete strategy
```bash
curl -X POST http://localhost:8000/api/parse-strategy \
  -H "Content-Type: application/json" \
  -d '{"message": "Buy AAPL when 50 SMA crosses above 200 SMA", "conversation_history": []}'
# Expected: status="ok", strategy.ticker="AAPL", strategy.entry_rules non-empty
```

### Test 3 — Parse incomplete strategy (no ticker)
```bash
curl -X POST http://localhost:8000/api/parse-strategy \
  -H "Content-Type: application/json" \
  -d '{"message": "Buy when RSI drops below 30", "conversation_history": []}'
# Expected: status="needs_clarification", missing_fields contains "ticker"
```

### Test 4 — Clarification follow-up (uses session_id from Test 3)
```bash
curl -X POST http://localhost:8000/api/parse-strategy \
  -H "Content-Type: application/json" \
  -d '{"message": "AAPL", "conversation_history": [], "session_id": "<id_from_test_3>"}'
# Expected: status="ok", strategy.ticker="AAPL"
```

### Test 5 — Run backtest
```bash
curl -X POST http://localhost:8000/api/run-backtest \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": {
      "ticker": "AAPL", "timeframe": "1d",
      "entry_rules": [{"indicator":"SMA","condition":"crosses_above","value":"SMA_200","params":{"period":50},"logic_operator":"NONE"}],
      "exit_rules": [], "position_size": 1.0
    }
  }'
# Expected: status="ok", result.metrics.total_trades > 0, result.equity_curve non-empty
# This call takes 3–8 seconds — normal
```

### Test 6 — History
```bash
curl http://localhost:8000/api/history
# Expected: array with at least the result from Test 5
```

### Test 7 — Frontend chat flow
```
1. Open http://localhost:5173
2. Type: "Golden cross strategy on AAPL"
3. Expected: typing indicator appears → confirmation card appears in chat → strategy panel populates
4. Click "Run Backtest"
5. Expected: loading message in chat → redirects to /app/results/{id}
6. Expected: real metrics, real equity curve, real trade log on results page
```

### Test 8 — History page
```
1. Navigate to /app/history
2. Expected: the AAPL backtest from Test 7 appears as a card
3. Click the card
4. Expected: navigates to full results page for that run
```

### Test 9 — Compare page
```
1. Navigate to /app/compare
2. Expected: dropdown A and dropdown B both populated from history
3. Select two strategies
4. Expected: side-by-side metrics table renders with real data
```

### Test 10 — Error handling
```
1. Stop the backend (Ctrl+C in terminal 1)
2. Type anything in the chat
3. Expected: "Cannot connect to backend. Is it running on port 8000?" error message in chat
4. NOT expected: blank screen, unhandled promise rejection, console error only
```

---

## 11. Common Problems and Exact Fixes

### Problem: CORS error in browser console
```
Access to XMLHttpRequest at 'http://localhost:8000' from origin 'http://localhost:5173' has been blocked
```
**Fix:** In `backend/main.py`, verify `allow_origins` includes `"http://localhost:5173"`.
If it still fails after that, add `"http://127.0.0.1:5173"` as well.

---

### Problem: `ModuleNotFoundError` when starting backend
```
ModuleNotFoundError: No module named 'vectorbt'
```
**Fix:** You are running Python outside the venv. Run `source venv/bin/activate` first, then `uvicorn main:app --reload`.

---

### Problem: `vectorbt` install fails on Windows
```
error: Microsoft Visual C++ 14.0 or greater is required
```
**Fix:** Install Visual C++ Build Tools from https://visualstudio.microsoft.com/visual-cpp-build-tools/ OR use WSL2.
Alternative: replace vectorbt with `backtesting` library — simpler install, less powerful but works.

---

### Problem: yfinance returns empty DataFrame
```python
df = fetch_ohlcv("AAPL", ...)  # returns None or empty
```
**Fix 1:** Ticker is wrong format. Crypto needs "BTC-USD" not "BTCUSDT". Forex needs "EURUSD=X".
**Fix 2:** yfinance rate-limited. Add `time.sleep(1)` before the download call.
**Fix 3:** Check that `auto_adjust=True` and `progress=False` are set.

---

### Problem: Gemini returns text instead of JSON
```
"Sure! Here is your parsed strategy: ```json {...}```"
```
**Fix:** Ensure `response_mime_type="application/json"` is set in GenerationConfig. Also add the regex strip in `parse_tool.py` to remove any fences that slip through.

---

### Problem: `pandas-ta` AttributeError
```
AttributeError: 'DataFrame' object has no attribute 'ta'
```
**Fix:** Add `import pandas_ta as ta` at the top of `indicator_builder.py`. The `df.ta` accessor only activates after the import.

---

### Problem: Frontend shows stale mock data after wiring
**Fix:** In `strategyApi.js`, verify the import at the top of the file was replaced — there may be two versions of the file. Check that no component is still importing directly from `mockData.js` instead of reading from the Zustand store.

---

### Problem: Results page shows nothing after backtest completes
**Fix:** The `useParams()` `id` from the URL may not match `currentResultId` in the store.
The store's `runBacktest` action sets `currentResultId = \`${ticker}_${Date.now()}\`` but `navigate` is called with that same id. Check both use the identical string.

---

### Problem: Backtest takes >30 seconds and request times out
**Fix:** Increase Axios timeout: in `strategyApi.js` change `timeout: 60000` to `timeout: 120000`.
Also check if `@lru_cache` is working on `fetch_ohlcv` — if the cache is missing, yfinance downloads data every call.

---

## 12. Definition of Done — Phase 4 Complete When:

- [ ] All 10 integration tests pass
- [ ] Zero CORS errors in browser console
- [ ] Zero unhandled promise rejections in browser console
- [ ] Zero `console.log` or `console.error` from application code (only from libraries)
- [ ] Chat input disabled while loading, re-enables after response
- [ ] TypingIndicator appears for every in-flight request
- [ ] "Run Backtest" button disabled until strategy is fully parsed (no missing_fields)
- [ ] Results page shows real equity curve (not the Phase 2 static SVG)
- [ ] Monthly heatmap renders real data (real colours based on actual monthly returns)
- [ ] Trade log shows real trades with correct dates and PnL
- [ ] History page loads real history from SQLite
- [ ] Deleting a history item removes it immediately from the UI
- [ ] Compare page dropdowns populated from real history
- [ ] Error messages appear in chat (not just console) for all failure modes
- [ ] App fully functional on mobile (375px) — no horizontal scroll, no overlapping elements
- [ ] Backend `/docs` Swagger UI shows all 6 endpoints with working "Try it out"
