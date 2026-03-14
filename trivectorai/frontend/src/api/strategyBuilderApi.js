import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const api = axios.create({
  baseURL: `${BASE_URL}/strategy-builder`,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
})

const backtestsApi = axios.create({
  baseURL: `${BASE_URL}/backtests`,
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
})

const toError = (error) => {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "Request failed"
  )
}

export const fetchStrategyTemplates = async () => {
  try {
    const { data } = await api.get("/templates")
    return data?.items || []
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const fetchIndicatorCatalog = async () => {
  try {
    const { data } = await api.get("/indicators")
    return data?.groups || {}
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const parseStrategyBuilder = async (payload) => {
  try {
    const { data } = await api.post("/parse", payload)
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const suggestStrategyImprovements = async (payload) => {
  try {
    const { data } = await api.post("/suggestions", payload)
    return data?.suggestions || []
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const saveBuilderStrategy = async (payload) => {
  try {
    const { data } = await api.post("/save", payload)
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const clearBuilderSession = async (sessionId) => {
  try {
    const { data } = await api.post("/clear", { session_id: sessionId })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const runBuilderBacktest = async (strategy) => {
  try {
    const { data } = await api.post("/run-backtest", { strategy })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const startBuilderAgenticBacktest = async ({ strategy, session_id, natural_language } = {}) => {
  try {
    const { data } = await api.post("/run-backtest-agentic", {
      strategy,
      session_id,
      natural_language,
    })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const getBacktestJobStatus = async (jobId) => {
  try {
    const { data } = await backtestsApi.get(`/${encodeURIComponent(jobId)}`)
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const getBacktestJobResult = async (jobId) => {
  try {
    const { data } = await backtestsApi.get(`/${encodeURIComponent(jobId)}/result`)
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const resolveApiUrl = (path = "") => {
  if (!path) return ""
  if (/^https?:\/\//i.test(path)) return path

  const origin = BASE_URL.replace(/\/api\/?$/i, "")
  if (path.startsWith("/")) return `${origin}${path}`
  return `${origin}/${path}`
}
