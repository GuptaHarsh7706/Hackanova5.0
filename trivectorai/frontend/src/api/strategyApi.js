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

export const clearHistory = async () => {
  const { data } = await api.delete("/history")
  return data
}

// alias for legacy import name used by SettingsPage
export const clearHistoryApi = clearHistory

// ─── Health check ───────────────────────────────────────────────────────────

export const checkHealth = async () => {
  const { data } = await api.get("/health")
  return data
}
