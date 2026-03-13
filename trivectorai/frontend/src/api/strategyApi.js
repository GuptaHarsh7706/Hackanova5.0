const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "")

const buildUrl = (path) => `${API_ROOT}${path.startsWith("/api") ? path : `/api${path}`}`

const extractError = async (response) => {
  try {
    const payload = await response.json()
    return payload.detail || payload.message || "Request failed"
  } catch {
    return `Request failed with status ${response.status}`
  }
}

const request = async (path, options = {}) => {
  const response = await fetch(buildUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(await extractError(response))
  }

  return response.json()
}

export const normalizeBacktestResult = (payload) => {
  if (!payload) return null

  const result = payload.result ? payload.result : payload
  const metrics = result.metrics || {}
  return {
    ...result,
    ...metrics,
    strategy_id: result.strategy_id || result.id,
    strategy: result.strategy || null,
    equity_curve: result.equity_curve || [],
    monthly_returns: result.monthly_returns || {},
    trades: result.trades || [],
    ai_narrative: result.ai_narrative || "",
  }
}

export const normalizeHistoryItem = (payload) => {
  const result = normalizeBacktestResult(payload)
  const strategy = result?.strategy || {}
  return {
    id: result?.strategy_id || payload?.id,
    name: strategy.name || `${strategy.ticker || result?.ticker_used || "Strategy"} Backtest`,
    ticker: strategy.ticker || result?.ticker_used || "-",
    timeframe: strategy.timeframe || "1d",
    asset_class: strategy.asset_class || "equity",
    entry_rules: strategy.entry_rules || [],
    exit_rules: strategy.exit_rules || [],
    stop_loss_pct: strategy.stop_loss_pct ?? null,
    take_profit_pct: strategy.take_profit_pct ?? null,
    confidence_score: strategy.confidence_score ?? 1,
    created_at: payload?.created_at || new Date().toISOString(),
    favorited: Boolean(payload?.favorited),
    in_progress: false,
    results: result,
  }
}

export const parseStrategy = (message, history = [], sessionId = null) =>
  request("/parse-strategy", {
    method: "POST",
    body: JSON.stringify({
      message,
      conversation_history: history,
      session_id: sessionId,
    }),
  })

export const runBacktest = (strategy, sessionId = null) =>
  request("/run-backtest", {
    method: "POST",
    body: JSON.stringify({ strategy, session_id: sessionId }),
  })

export const getHistory = async () => {
  const response = await request("/history")
  return response.map(normalizeHistoryItem)
}

export const clearHistoryApi = () =>
  request("/history", {
    method: "DELETE",
  })
