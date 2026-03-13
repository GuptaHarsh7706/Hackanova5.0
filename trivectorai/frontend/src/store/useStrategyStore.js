import { create } from "zustand"

const WELCOME_MESSAGE =
  "Hi! I'm TriVectorAI. Describe any trading strategy in plain English\nand I'll parse it into structured rules ready for backtesting.\nTry: 'Buy AAPL when the 50-day SMA crosses above the 200-day SMA'"

const welcomeAgentMessage = {
  id: Date.now(),
  role: "agent",
  content: WELCOME_MESSAGE,
  timestamp: new Date().toISOString(),
}

export const useStrategyStore = create((set) => ({
  // Chat state
  messages: [welcomeAgentMessage], // { id, role: "user"|"agent", content, timestamp }
  isLoading: false,

  // Parsed strategy state
  strategy: null, // ParsedStrategy object from backend
  parseStatus: null, // "ok" | "needs_clarification" | "error" | null
  missingFields: [],

  // Conversation history for LLM context
  conversationHistory: [],

  // UI state
  isMobilePanelOpen: false,
  toast: null,

  // Actions
  addMessage: (role, content) => {
    const msg = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      role,
      content,
      timestamp: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, msg] }))
    return msg
  },

  setLoading: (val) => set({ isLoading: val }),

  updateStrategy: (strategyData, status, missing) =>
    set({
      strategy: strategyData,
      parseStatus: status,
      missingFields: missing || [],
    }),

  appendToHistory: (role, content) =>
    set((s) => ({
      conversationHistory: [...s.conversationHistory, { role, content }],
    })),

  setMobilePanelOpen: (open) => set({ isMobilePanelOpen: open }),

  showToast: (type, message) =>
    set({
      toast: { id: Date.now(), type, message },
    }),

  clearToast: () => set({ toast: null }),

  reset: () =>
    set({
      messages: [
        {
          id: Date.now(),
          role: "agent",
          content: WELCOME_MESSAGE,
          timestamp: new Date().toISOString(),
        },
      ],
      strategy: null,
      parseStatus: null,
      missingFields: [],
      conversationHistory: [],
      isLoading: false,
      isMobilePanelOpen: false,
      toast: null,
    }),
}))
