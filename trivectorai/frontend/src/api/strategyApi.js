import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
})

export const parseStrategy = async (message, conversationHistory = []) => {
  const { data } = await api.post("/parse-strategy", {
    message,
    conversation_history: conversationHistory,
  })
  return data // ParseResponse
}
