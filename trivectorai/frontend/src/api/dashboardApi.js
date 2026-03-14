import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const dashboardApi = axios.create({
  baseURL: `${BASE_URL}/dashboard`,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
})

export const getDashboardSnapshot = async ({ symbol = "^GSPC", timeframe = "1h" } = {}) => {
  const { data } = await dashboardApi.get("/snapshot", { params: { symbol, timeframe } })
  return data
}

export const getDashboardChart = async ({ symbol = "^GSPC", timeframe = "1h", limit = 220 } = {}) => {
  const { data } = await dashboardApi.get("/chart", { params: { symbol, timeframe, limit } })
  return data
}

export const getGlobalMarkets = async () => {
  const { data } = await dashboardApi.get("/global-markets")
  return data
}

export const getWatchlist = async () => {
  const { data } = await dashboardApi.get("/watchlist")
  return data
}

export const addWatchlistSymbol = async (symbol) => {
  const { data } = await dashboardApi.post("/watchlist", { symbol })
  return data
}

export const removeWatchlistSymbol = async (symbol) => {
  const { data } = await dashboardApi.delete(`/watchlist/${encodeURIComponent(symbol)}`)
  return data
}

export const getCrypto = async (symbols) => {
  const params = symbols?.length ? { symbols: symbols.join(",") } : undefined
  const { data } = await dashboardApi.get("/crypto", { params })
  return data
}

export const getNewsSentiment = async (limit = 6) => {
  const { data } = await dashboardApi.get("/news", { params: { limit } })
  return data
}

export const getSectorRisk = async () => {
  const { data } = await dashboardApi.get("/sector-risk")
  return data
}

export const getAiInsights = async ({ symbol = "^GSPC", timeframe = "1h" } = {}) => {
  const { data } = await dashboardApi.get("/insights", { params: { symbol, timeframe } })
  return data
}
