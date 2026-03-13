import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import MainLayout from "./components/layout/MainLayout"
import ChatPage from "./pages/ChatPage"
import ComparePage from "./pages/ComparePage"
import HistoryPage from "./pages/HistoryPage"
import NotFoundPage from "./pages/NotFoundPage"
import OnboardingPage from "./pages/OnboardingPage"
import ResultsPage from "./pages/ResultsPage"
import SettingsPage from "./pages/SettingsPage"
import { useStrategyStore } from "./store/useStrategyStore"

export default function App() {
  const onboardingSeen = useStrategyStore((s) => s.onboardingSeen)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={onboardingSeen ? "/app" : "/onboarding"} replace />} />
        <Route path="/onboarding" element={onboardingSeen ? <Navigate to="/app" replace /> : <OnboardingPage />} />

        <Route path="/app" element={<MainLayout />}>
          <Route index element={<ChatPage />} />
          <Route path="results/:id" element={<ResultsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
