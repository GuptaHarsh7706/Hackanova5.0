import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const api = axios.create({
  baseURL: `${BASE_URL}/backtest-config`,
  timeout: 60000,
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

export const getStrategySummary = async (strategyId) => {
  try {
    const { data } = await api.get("/strategy-summary", { params: { strategy_id: strategyId || undefined } })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const getBacktestAssets = async (assetClass = "equity") => {
  try {
    const { data } = await api.get("/assets", { params: { asset_class: assetClass } })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const addBacktestAsset = async ({ symbol, asset_class = "equity" }) => {
  try {
    const { data } = await api.post("/assets", { symbol, asset_class })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const getDataSources = async () => {
  try {
    const { data } = await api.get("/data-sources")
    return data?.items || []
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const estimateDataRangeMeta = async (payload) => {
  try {
    const { data } = await api.post("/data-range", payload)
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const scoreBacktestConfig = async (config) => {
  try {
    const { data } = await api.post("/score", { config })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const saveBacktestConfig = async (config) => {
  try {
    const { data } = await api.post("/save", { config })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const validateBacktestConfig = async (config) => {
  try {
    const { data } = await api.post("/validate", { config })
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const listSavedBacktestConfigs = async ({ strategy_id, limit = 50 } = {}) => {
  try {
    const { data } = await api.get("/saved", {
      params: {
        strategy_id: strategy_id || undefined,
        limit,
      },
    })
    return data?.items || []
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const getSavedBacktestConfig = async (configurationId) => {
  try {
    const { data } = await api.get(`/saved/${encodeURIComponent(configurationId)}`)
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const runFromBacktestConfig = async (payload) => {
  try {
    const { data } = await api.post("/run", payload)
    return data
  } catch (error) {
    throw new Error(toError(error))
  }
}

export const resolveBacktestConfigApiUrl = (path = "") => {
  if (!path) return ""
  if (/^https?:\/\//i.test(path)) return path

  const origin = BASE_URL.replace(/\/api\/?$/i, "")
  if (path.startsWith("/")) return `${origin}${path}`
  return `${origin}/${path}`
}
