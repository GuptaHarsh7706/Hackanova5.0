import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
})

const mapError = (error) => {
  const detail =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "Request failed"
  return new Error(detail)
}

export const runSandboxSimulation = async (strategy, naturalLanguage = "") => {
  try {
    const { data } = await api.post("/sandbox/run", {
      strategy,
      natural_language: naturalLanguage,
    })
    return data
  } catch (error) {
    throw mapError(error)
  }
}

export const saveSandboxVersion = async ({ strategy, resultId, label, notes }) => {
  try {
    const { data } = await api.post("/sandbox/versions", {
      strategy,
      result_id: resultId,
      label,
      notes,
    })
    return data
  } catch (error) {
    throw mapError(error)
  }
}

export const getSandboxVersions = async (limit = 20) => {
  try {
    const { data } = await api.get("/sandbox/versions", { params: { limit } })
    return data
  } catch (error) {
    throw mapError(error)
  }
}

export const restoreSandboxVersion = async (versionId) => {
  try {
    const { data } = await api.post(`/sandbox/versions/${versionId}/restore`)
    return data
  } catch (error) {
    throw mapError(error)
  }
}

export const compareSandboxVersions = async (ids = []) => {
  try {
    const { data } = await api.post("/sandbox/versions/compare", { ids })
    return data
  } catch (error) {
    throw mapError(error)
  }
}
