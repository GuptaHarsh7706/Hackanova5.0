import { create } from "zustand"
import {
  parseStrategy,
  runBacktest,
  getHistory,
  getResultById,
  deleteResult,
  clearHistory,
  compareHistory,
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
  processingSteps: [],
  prefillMessage: "",

  // ── Strategy state ──────────────────────────────────────────────────────
  currentStrategy: null,
  parseStatus: null,        // "ok" | "needs_clarification" | "error" | null
  parseCanRun: false,
  parseDetails: {},
  agentTrace: [],
  missingFields: [],
  sessionId: null,

  // ── Backtest state ──────────────────────────────────────────────────────
  backtestResult: null,
  backtestLoading: false,
  currentResultId: null,

  // ── History state ───────────────────────────────────────────────────────
  history: [],
  historyLoading: false,

  // ── Compare state ───────────────────────────────────────────────────────
  compareItems: [],
  compareLoading: false,

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

  parseStrategyDraft: async (draftText) => {
    if (!draftText?.trim()) return null

    set({
      isLoading: true,
      loadingText: "ParserAgent: compiling natural language into strategy DSL...",
      error: null,
      processingSteps: [
        { id: "intent", label: "Interpret intent", agent: "IntentAgent", detail: "Detect objective and constraints", status: "done" },
        { id: "parser", label: "Compile to strategy schema", agent: "ParserAgent", detail: "Extract rules, ticker, timeframe", status: "active" },
        { id: "risk", label: "Validate strategy", agent: "RiskAgent", detail: "Check missing fields and issues", status: "pending" },
      ],
    })

    try {
      const response = await parseStrategy(draftText, [])
      set({
        currentStrategy: response.strategy || null,
        parseStatus: response.status,
        parseCanRun: !!response.can_run,
        parseDetails: response.parse_details || {},
        agentTrace: response.agent_trace || [],
        missingFields: response.missing_fields || [],
        sessionId: response.session_id || null,
        processingSteps: [],
      })
      return response
    } catch (err) {
      set({ error: err.message || "Failed to parse strategy draft.", processingSteps: [] })
      return null
    } finally {
      set({ isLoading: false, loadingText: "" })
    }
  },

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
    const stepOrder = ["intent", "parser", "context", "risk", "compose"]
    const frameText = {
      intent: "IntentAgent: understanding objective and constraints...",
      parser: "ParserAgent: extracting ticker, timeframe, and logic...",
      context: "ContextAgent: attaching market profile and assumptions...",
      risk: "RiskAgent: validating rules and risk controls...",
      compose: "ResponseAgent: preparing your strategy summary...",
    }

    const applyActiveStep = (activeId) => {
      set((s) => {
        const activeIndex = stepOrder.indexOf(activeId)
        return {
          loadingText: frameText[activeId] || s.loadingText,
          processingSteps: s.processingSteps.map((step) => {
            const idx = stepOrder.indexOf(step.id)
            if (idx < activeIndex) return { ...step, status: "done" }
            if (step.id === activeId) return { ...step, status: "active" }
            return { ...step, status: "pending" }
          }),
        }
      })
    }

    // 1. Add user message to chat immediately
    addMessage("user", userText)
    set({
      isLoading: true,
      loadingText: frameText.intent,
      error: null,
      processingSteps: [
        { id: "intent", label: "Interpret strategy intent", agent: "IntentAgent", detail: "Detect objective, market, and constraints", status: "active" },
        { id: "parser", label: "Parse strategy to schema", agent: "ParserAgent", detail: "Extract ticker, timeframe, entry/exit rules", status: "pending" },
        { id: "context", label: "Attach market context", agent: "ContextAgent", detail: "Map asset class profile and assumptions", status: "pending" },
        { id: "risk", label: "Validate and risk-check", agent: "RiskAgent", detail: "Check missing fields and conflicting rules", status: "pending" },
        { id: "compose", label: "Generate response", agent: "ResponseAgent", detail: "Create clear output + next action", status: "pending" },
      ],
    })

    let frameIdx = 0
    const spinner = setInterval(() => {
      frameIdx = Math.min(frameIdx + 1, stepOrder.length - 1)
      applyActiveStep(stepOrder[frameIdx])
    }, 900)

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

      clearInterval(spinner)

      set((s) => ({
        loadingText: "Finalizing parse result...",
        processingSteps: s.processingSteps.map((step) => ({ ...step, status: "done" })),
      }))

      // 4. Save session_id for continuity across turns
      if (response.session_id) set({ sessionId: response.session_id })

      // 5. Update strategy state
      set({
        currentStrategy: response.strategy || null,
        parseStatus:     response.status,
        parseCanRun:     !!response.can_run,
        parseDetails:    response.parse_details || {},
        agentTrace:      response.agent_trace || [],
        missingFields:   response.missing_fields || [],
      })

      // Override live steps with backend agent assignments when available.
      if (Array.isArray(response.parse_details?.agent_assignments) && response.parse_details.agent_assignments.length > 0) {
        set({
          processingSteps: response.parse_details.agent_assignments.map((item, idx) => ({
            id: `agent-${idx}`,
            label: item.role || item.agent,
            agent: item.agent,
            detail: item.output || "",
            status: item.status === "needs_attention" ? "error" : "done",
          })),
        })
      }

      // 6. Add agent reply to chat
      if (response.status === "ok") {
        addMessage("agent", response.agent_message, {
          type:     "confirmation",
          strategy: response.strategy,
          parseDetails: response.parse_details || {},
          canRun: !!response.can_run,
          agentTrace: response.agent_trace || [],
        })
      } else if (response.status === "needs_clarification") {
        addMessage("agent", response.agent_message, {
          type:          "clarification",
          missingFields: response.missing_fields,
          strategy:      response.strategy,
          parseDetails:  response.parse_details || {},
          canRun:        !!response.can_run,
          agentTrace:    response.agent_trace || [],
        })
      } else {
        addMessage("agent", response.agent_message || "Something went wrong.", {
          type: "error",
          parseDetails: response.parse_details || {},
          agentTrace: response.agent_trace || [],
        })
      }

    } catch (err) {
      clearInterval(spinner)
      const errMsg = err.message || "Connection failed."
      set({ error: errMsg })
      addMessage("agent", errMsg, { type: "error" })
    } finally {
      set({ isLoading: false, loadingText: "", processingSteps: [] })
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

    const stepOrder = ["prep", "engine", "metrics", "narrative", "save"]
    const frameText = {
      prep: "ExecutionAgent: checking strategy payload...",
      engine: "BacktestAgent: simulating historical trades...",
      metrics: "MetricsAgent: calculating risk/return stats...",
      narrative: "NarrativeAgent: drafting performance explanation...",
      save: "PersistenceAgent: saving result to history...",
    }

    set({
      backtestLoading: true,
      loadingText: frameText.prep,
      processingSteps: [
        { id: "prep", label: "Validate strategy payload", agent: "ExecutionAgent", detail: "Check required fields before simulation", status: "active" },
        { id: "engine", label: "Run market simulation", agent: "BacktestAgent", detail: "Execute vectorized strategy backtest", status: "pending" },
        { id: "metrics", label: "Compute key metrics", agent: "MetricsAgent", detail: "Sharpe, drawdown, win-rate, trade count", status: "pending" },
        { id: "narrative", label: "Generate AI summary", agent: "NarrativeAgent", detail: "Translate metrics into readable insight", status: "pending" },
        { id: "save", label: "Persist run result", agent: "PersistenceAgent", detail: "Store result for history and compare", status: "pending" },
      ],
    })

    let frameIdx = 0
    const spinner = setInterval(() => {
      frameIdx = Math.min(frameIdx + 1, stepOrder.length - 1)
      set((s) => {
        const active = stepOrder[frameIdx]
        const activeIndex = stepOrder.indexOf(active)
        return {
          loadingText: frameText[active],
          processingSteps: s.processingSteps.map((step) => {
            const idx = stepOrder.indexOf(step.id)
            if (idx < activeIndex) return { ...step, status: "done" }
            if (step.id === active) return { ...step, status: "active" }
            return { ...step, status: "pending" }
          }),
        }
      })
    }, 950)

    addMessage("agent", `Running backtest for **${currentStrategy.ticker}**... This may take a few seconds.`)

    try {
      const response = await runBacktest(currentStrategy)
      clearInterval(spinner)
      set((s) => ({
        loadingText: "Finalizing results...",
        processingSteps: s.processingSteps.map((step) => ({ ...step, status: "done" })),
      }))

      if (response.status === "ok" && response.result) {
        const result    = response.result
        const resultId  = result.id || result.strategy_id || `${currentStrategy.ticker}_${Date.now()}`

        set((s) => ({
          backtestResult:  { ...result, id: resultId },
          currentResultId: resultId,
          backtestLoading: false,
          loadingText:     "",
          processingSteps: s.processingSteps.map((step) => ({ ...step, status: "done" })),
        }))

        addMessage("agent",
          `Backtest complete! **${result.metrics.total_return_pct > 0 ? "+" : ""}${result.metrics.total_return_pct}%** total return over ${result.data_period}.

${result.ai_narrative || ""}`,
          { type: "backtest_complete", resultId }
        )

        set({ processingSteps: [] })

        if (navigate) navigate(`/app/results/${resultId}`)
      } else {
        throw new Error(response.message || "Backtest failed.")
      }
    } catch (err) {
      clearInterval(spinner)
      set((s) => ({
        backtestLoading: false,
        loadingText: "",
        processingSteps: s.processingSteps.map((step) =>
          step.status === "active" ? { ...step, status: "error" } : step
        ),
      }))
      addMessage("agent", `Backtest failed: ${err.message}`, { type: "error" })
      set({ processingSteps: [] })
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

  fetchCompareItems: async (ids = []) => {
    if (!Array.isArray(ids) || ids.length < 2) {
      set({ compareItems: [], compareLoading: false })
      return []
    }
    set({ compareLoading: true, error: null })
    try {
      const response = await compareHistory(ids)
      const items = response?.items || []
      set({ compareItems: items, compareLoading: false })
      return items
    } catch (err) {
      set({ compareItems: [], compareLoading: false, error: err.message })
      return []
    }
  },

  setOnboardingSeen: (seen) => set({ onboardingSeen: seen }),
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  completeOnboarding: () => set({ onboardingSeen: true }),
  resetOnboarding: () => set({ onboardingSeen: false, onboardingStep: 1 }),

  updateCurrentStrategy: (patch = {}) =>
    set((state) => ({
      currentStrategy: {
        ...(state.currentStrategy || {}),
        ...patch,
      },
    })),

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
    parseCanRun:     false,
    parseDetails:    {},
    agentTrace:      [],
    missingFields:   [],
    backtestResult:  null,
    currentResultId: null,
    error:           null,
    sessionId:       null,
    isLoading:       false,
    loadingText:     "",
    processingSteps: [],
  }),

  setProcessingSteps: (steps = []) => set({ processingSteps: steps }),
  clearProcessingSteps: () => set({ processingSteps: [] }),

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
