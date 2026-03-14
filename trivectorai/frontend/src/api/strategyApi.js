import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

// ─── Logger helpers ─────────────────────────────────────────────────────────
const tag  = (label, color) => [`%c[TriVector] ${label}`, `color:${color};font-weight:600`]
const info  = (label, ...args) => console.log(...tag(label, "#7f77dd"), ...args)
const ok    = (label, ...args) => console.log(...tag(label, "#22c55e"), ...args)
const warn  = (label, ...args) => console.warn(...tag(label, "#f59e0b"), ...args)
const err   = (label, ...args) => console.error(...tag(label, "#ef4444"), ...args)

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
})

// ─── Request interceptor: attach session_id + timing ────────────────────────
api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem("trivector_session_id")
  if (sessionId && config.data) {
    config.data = { ...config.data, session_id: sessionId }
  }
  config.metadata = { startTime: Date.now() }
  info(`→ ${config.method?.toUpperCase()} ${config.url}`, config.data ?? "")
  return config
})

// ─── Response interceptor: log result + save session_id ─────────────────────
api.interceptors.response.use(
  (response) => {
    const ms = Date.now() - (response.config.metadata?.startTime ?? Date.now())
    ok(`← ${response.config.method?.toUpperCase()} ${response.config.url}  ${response.status}  (${ms}ms)`, response.data)
    const sessionId = response.data?.session_id
    if (sessionId) {
      localStorage.setItem("trivector_session_id", sessionId)
      info("session_id saved", sessionId)
    }
    return response
  },
  (error) => {
    const ms = Date.now() - (error.config?.metadata?.startTime ?? Date.now())
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      (error.code === "ECONNABORTED" ? "Request timed out. The backtest may be taking too long." :
       error.code === "ERR_NETWORK"  ? "Cannot connect to backend. Is it running on port 8000?" :
       "An unexpected error occurred.")
    err(`✗ ${error.config?.method?.toUpperCase()} ${error.config?.url}  ${error.response?.status ?? "ERR"}  (${ms}ms)`, message)
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

export const clearHistory = async () => {
  const { data } = await api.delete("/history")
  return data
}

export const compareHistory = async (ids = []) => {
  const { data } = await api.post("/history/compare", { ids })
  return data
}

// alias for legacy import name used by SettingsPage
export const clearHistoryApi = clearHistory

// ─── Health check ───────────────────────────────────────────────────────────

export const checkHealth = async () => {
  const { data } = await api.get("/health")
  return data
}
