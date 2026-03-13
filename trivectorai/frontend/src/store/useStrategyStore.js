import { create } from "zustand"
import {
  parseStrategy,
  runBacktest,
  getHistory,
  getResultById,
  deleteResult,
  clearHistory,
} from "../api/strategyApi"

const initialSettings = {
  defaultTimeframe: "Daily",
  defaultCapital: "10000",
  defaultCommission: "0.1",
  defaultSlippage: "0.05",
  dataSource: "Yahoo Finance",
  lookback: "5 Years",
  model: "Gemini 1.5 Flash",
  responseDetail: "Concise",
  riskProfile: "Balanced",
  autosave: true,
  autoClarify: true,
  showConfidence: true,
  compactMode: false,
}

export const useStrategyStore = create((set, get) => ({
  onboardingSeen: false,
  onboardingStep: 1,
  settings: initialSettings,

  // ── Chat state ──────────────────────────────────────────────────────────
  messages: [],
  isLoading: false,
  loadingText: "",
  prefillMessage: "",

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

  // ── Backend health state ─────────────────────────────────────────────────
  backendStatus: "unknown",   // "unknown" | "online" | "offline"
  backendVersion: null,

  checkBackendHealth: async () => {
    try {
      const { checkHealth } = await import("../api/strategyApi")
      const data = await checkHealth()
      console.log("%c[TriVector] health", "color:#22c55e;font-weight:600", data)
      set({ backendStatus: data.db === "connected" ? "online" : "degraded", backendVersion: data.version })
    } catch {
      set({ backendStatus: "offline" })
    }
  },

  // ── Error state ─────────────────────────────────────────────────────────
  error: null,

  // ── Toast state ─────────────────────────────────────────────────────────
  toasts: [],

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
        const resultId  = result.strategy_id || result.id || `${currentStrategy.ticker}_${Date.now()}`

        set({
          backtestResult:  { ...result, id: resultId },
          currentResultId: resultId,
          backtestLoading: false,
          loadingText:     "",
        })

        addMessage("agent",
          `Backtest complete! **${result.metrics.total_return_pct > 0 ? "+" : ""}${result.metrics.total_return_pct}%** total return over ${result.data_period}.

${result.ai_narrative || ""}`,
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

  clearHistory: async () => {
    try {
      await clearHistory()
    } catch {
      // ignore
    }
    set({ history: [] })
  },

  setOnboardingSeen: (seen) => set({ onboardingSeen: seen }),
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  completeOnboarding: () => set({ onboardingSeen: true }),
  resetOnboarding: () => set({ onboardingSeen: false, onboardingStep: 1 }),

  updateSettings: (patch) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...patch,
      },
    })),
  setSetting: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value,
      },
    })),
  resetSettings: () => set({ settings: initialSettings }),

  // ════════════════════════════════════════════════════════════════════════
  // UTILITY ACTIONS
  // ════════════════════════════════════════════════════════════════

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

  addToast: (type = "info", message = "") => {
    if (!message) return null
    const toast = {
      id: Date.now() + Math.random(),
      type,
      message,
    }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    return toast.id
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clearToasts: () => set({ toasts: [] }),

  setPrefillMessage: (prefillMessage) => set({ prefillMessage }),
  consumePrefillMessage: () => {
    const value = get().prefillMessage
    set({ prefillMessage: "" })
    return value
  },
}))
