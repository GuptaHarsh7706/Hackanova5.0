import { create } from "zustand"
import { persist } from "zustand/middleware"

import { EXAMPLE_STRATEGIES, MOCK_CHAT_MESSAGES, MOCK_STRATEGIES } from "../data/mockData"

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

export const useStrategyStore = create(
  persist(
    (set, get) => ({
      onboardingSeen: false,
      onboardingStep: 1,
      prefillMessage: "",

      messages: [...MOCK_CHAT_MESSAGES],
      conversationHistory: [],
      isLoading: false,
      isBacktestRunning: false,
      sessionId: null,

      strategy: null,
      parseStatus: null,
      missingFields: [],
      currentBacktestResult: null,
      showRawJson: false,
      strategyPanelOpen: true,
      mobileStrategySheetOpen: false,

      toasts: [],

      history: MOCK_STRATEGIES.map((s, i) => ({
        ...s,
        created_at: new Date(Date.now() - i * 172800000).toISOString(),
        favorited: i === 0,
        in_progress: i === 2,
      })),
      compare: {
        selected: ["mock-1", "mock-2"],
      },

      settings: initialSettings,

      setOnboardingStep: (step) => set({ onboardingStep: step }),
      completeOnboarding: () => set({ onboardingSeen: true }),

      setPrefillMessage: (prefillMessage) => set({ prefillMessage }),
      consumePrefillMessage: () => {
        const value = get().prefillMessage
        set({ prefillMessage: "" })
        return value
      },

      addMessage: (role, content, type = "text") => {
        const item = {
          id: Date.now() + Math.round(Math.random() * 1000),
          role,
          type,
          content,
          timestamp: new Date().toISOString(),
        }
        set((state) => ({ messages: [...state.messages, item] }))
      },
      setLoading: (isLoading) => set({ isLoading }),
      setBacktestRunning: (isBacktestRunning) => set({ isBacktestRunning }),
      setSessionId: (sessionId) => set({ sessionId }),
      pushHistoryContext: (role, content) =>
        set((state) => ({
          conversationHistory: [...state.conversationHistory, { role, content }],
        })),
      updateStrategy: (strategy, parseStatus, missingFields = []) =>
        set({ strategy, parseStatus, missingFields }),
      setCurrentBacktestResult: (currentBacktestResult) => set({ currentBacktestResult }),
      setHistory: (history) => set({ history }),
      prependHistoryItem: (item) =>
        set((state) => ({
          history: [item, ...state.history.filter((existing) => existing.id !== item.id)].slice(0, 50),
        })),

      toggleRawJson: () => set((s) => ({ showRawJson: !s.showRawJson })),
      setStrategyPanelOpen: (strategyPanelOpen) => set({ strategyPanelOpen }),
      setMobileStrategySheetOpen: (mobileStrategySheetOpen) => set({ mobileStrategySheetOpen }),

      addToast: (type, message) =>
        set((state) => ({
          toasts: [...state.toasts, { id: Date.now() + Math.random(), type, message }].slice(-3),
        })),
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      setCompareA: (compareA) => set({ compareA }),
      setCompareB: (compareB) => set({ compareB }),
      setCompareSelection: (selected) =>
        set((state) => ({
          compare: {
            ...state.compare,
            selected,
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
      clearHistory: () => set({ history: [] }),

      resetChat: () =>
        set({
          messages: [...MOCK_CHAT_MESSAGES],
          conversationHistory: [],
          isBacktestRunning: false,
          sessionId: null,
          strategy: null,
          parseStatus: null,
          missingFields: [],
          currentBacktestResult: null,
          showRawJson: false,
        }),

      exampleStrategies: EXAMPLE_STRATEGIES,
    }),
    {
      name: "trivectorai-phase2-store",
      partialize: (state) => ({
        onboardingSeen: state.onboardingSeen,
        history: state.history,
        sessionId: state.sessionId,
        settings: state.settings,
      }),
    },
  ),
)
