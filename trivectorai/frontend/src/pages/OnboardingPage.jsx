import { BarChart2, MessageSquare, Zap } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useStrategyStore } from "../store/useStrategyStore"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"

export default function OnboardingPage() {
  const navigate = useNavigate()
  const step = useStrategyStore((s) => s.onboardingStep)
  const setStep = useStrategyStore((s) => s.setOnboardingStep)
  const completeOnboarding = useStrategyStore((s) => s.completeOnboarding)
  const setPrefillMessage = useStrategyStore((s) => s.setPrefillMessage)

  const goApp = () => {
    completeOnboarding()
    navigate("/app")
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-base)] px-4 py-12">
      <div className="absolute -left-24 top-14 h-64 w-64 animate-orb-float rounded-full bg-[var(--brand-400)]/10 blur-3xl" />
      <div className="absolute -right-24 bottom-12 h-72 w-72 animate-orb-float rounded-full bg-[var(--teal-400)]/10 blur-3xl [animation-delay:800ms]" />

      <div className="relative mx-auto max-w-xl text-center">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-700)] font-semibold">TV</div>
            <h1 className="text-4xl font-bold tracking-[-0.02em]">Backtest any strategy. Just describe it.</h1>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              Type your trading idea in plain English. TriVectorAI parses it and shows how it would have performed.
            </p>
            <div className="space-y-2 pt-3">
              <Button size="lg" className="w-full" onClick={() => setStep(2)}>
                Get Started
              </Button>
              <button className="text-sm text-[var(--text-secondary)]" onClick={goApp}>
                Already know what I am doing - skip
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                [MessageSquare, "Describe", "Type any strategy in plain English"],
                [Zap, "Parse", "AI converts to exact structured rules"],
                [BarChart2, "Backtest", "See equity, sharpe, drawdown and win rate"],
              ].map(([Icon, title, desc]) => (
                <Card key={title} className="p-3 text-left">
                  <Icon className="mb-2 h-4 w-4 text-[var(--brand-400)]" />
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{desc}</p>
                </Card>
              ))}
            </div>
            <div className="flex justify-center gap-1">
              {[1, 2, 3].map((d) => (
                <span key={d} className={`h-2 w-2 rounded-full ${d === step ? "bg-[var(--brand-400)]" : "bg-[var(--border-default)]"}`} />
              ))}
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Try one of these to start</h2>
            <div className="space-y-2">
              {[
                "Golden cross - AAPL daily",
                "RSI oversold bounce - BTC",
                "MACD crossover - TSLA hourly",
              ].map((example) => (
                <button
                  key={example}
                  className="w-full rounded-full border border-[var(--border-default)] px-4 py-2 text-sm hover:bg-[var(--bg-elevated)]"
                  onClick={() => setPrefillMessage(example)}
                >
                  {example}
                </button>
              ))}
            </div>
            <Button size="lg" className="w-full" onClick={goApp}>Open the app</Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
