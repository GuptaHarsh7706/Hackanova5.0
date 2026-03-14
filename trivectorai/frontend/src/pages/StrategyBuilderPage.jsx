import { Bell, CircleUser, Cog, Plus, Send } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import {
  clearBuilderSession,
  fetchIndicatorCatalog,
  fetchStrategyTemplates,
  getBacktestJobResult,
  parseStrategyBuilder,
  requestStrategyImprovement,
  runBuilderBacktest,
  saveBuilderStrategy,
  sendChatMessage,
  startBuilderAgenticBacktest,
  resolveApiUrl,
  suggestStrategyImprovements,
} from "../api/strategyBuilderApi"
import { useStrategyStore } from "../store/useStrategyStore"

const seedDraft = "Buy when the 50-day moving average crosses above the 200-day moving average and RSI is below 30. Sell when RSI exceeds 70."

const DEFAULT_TEMPLATES = [
  { name: "Golden Cross", description: "MA crossover strategy with momentum confirmation", natural_language: "Buy when the 50-day moving average crosses above the 200-day moving average and RSI is below 30. Sell when RSI exceeds 70." },
  { name: "RSI Reversal", description: "Oversold/overbought reversal trading setup", natural_language: "Buy SPY when RSI(14) is below 29 and sell when RSI(14) is above 70." },
  { name: "Breakout", description: "Volume-supported breakout entries", natural_language: "Buy TSLA when price breaks above the 20-day high with strong volume. Exit when RSI goes above 72." },
  { name: "Mean Reversion", description: "Statistical mean reversion entries", natural_language: "Buy QQQ when RSI is below 30 and price is near lower Bollinger band, exit at RSI 55." },
  { name: "Momentum", description: "Trend-following momentum strategy", natural_language: "Buy NVDA when EMA 20 crosses above EMA 50 and MACD crosses above signal. Exit on MACD cross below signal." },
  { name: "Grid Trading", description: "Range-bound grid order placement", natural_language: "Trade ETHUSDT on 1h with mean reversion entries and fixed stop loss/take profit per grid level." },
]

const DEFAULT_SUGGESTIONS = [
  "Add stop loss",
  "Include volume filter",
  "Set RSI threshold",
  "Add moving average",
  "Define risk/reward ratio",
]

const DEFAULT_CHAT_MESSAGES = [
  {
    role: "agent",
    content: "Hello! I'm TriVectorAI — your AI trading assistant.\n\nDescribe a strategy in plain English and I'll parse it, validate it, and help you backtest it. You can also ask me about any trading indicator or concept.\n\nTry: \"Buy AAPL when the 50-day MA crosses above the 200-day MA and RSI is below 30.\"",
    type: "greeting",
  },
]

const BUILDER_STATE_STORAGE_KEY = "trivectorai.strategy_lab.state.v1"

export default function StrategyBuilderPage() {
  const navigate = useNavigate()
  const addToast = useStrategyStore((s) => s.addToast)

  const nowTag = () => new Date().toLocaleTimeString([], { hour12: false })
  const stepAgent = (step = "") => {
    const key = String(step).toLowerCase()
    if (key.includes("validate")) return "ValidationAgent"
    if (key.includes("data")) return "DataAgent"
    if (key.includes("indicator")) return "IndicatorAgent"
    if (key.includes("signal")) return "SignalAgent"
    if (key.includes("simulation")) return "BacktestAgent"
    if (key.includes("metric")) return "MetricsAgent"
    if (key.includes("analysis")) return "NarrativeAgent"
    if (key.includes("final")) return "PersistenceAgent"
    if (key.includes("queue")) return "Orchestrator"
    if (key.includes("initialize")) return "ExecutionAgent"
    return "Orchestrator"
  }

  const [isParsing, setIsParsing] = useState(false)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [sessionId, setSessionId] = useState("")
  const [currentStrategy, setCurrentStrategy] = useState(null)
  const [parseCanRun, setParseCanRun] = useState(false)
  const [parseDetails, setParseDetails] = useState({})
  const [parseStatus, setParseStatus] = useState("draft")
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES)
  const [availableIndicators, setAvailableIndicators] = useState({
    "Trend Indicators": ["MA", "EMA", "SMA", "MACD", "ADX"],
    "Momentum Indicators": ["RSI", "Stochastic", "CCI", "ROC"],
  })
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS)

  const [draft, setDraft] = useState(seedDraft)
  const [backtestProgress, setBacktestProgress] = useState(0)
  const [backtestStepMessage, setBacktestStepMessage] = useState("")
  const [consoleLines, setConsoleLines] = useState([
    `[${nowTag()}] [System] Strategy Lab console initialized`,
    `[${nowTag()}] [System] Waiting for strategy input...`,
  ])
  const lastAutoParsed = useRef("")
  const streamRef = useRef(null)
  const consoleEndRef = useRef(null)

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState(DEFAULT_CHAT_MESSAGES)
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [improveLoading, setImproveLoading] = useState(false)
  const [lastBacktestMetrics, setLastBacktestMetrics] = useState(null)
  const [stateHydrated, setStateHydrated] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [chatMessages])

  const pushConsole = (agent, message) => {
    setConsoleLines((prev) => {
      const line = `[${nowTag()}] [${agent}] ${message}`
      const next = [...prev, line]
      return next.length > 220 ? next.slice(next.length - 220) : next
    })
  }

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [consoleLines])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BUILDER_STATE_STORAGE_KEY)
      if (!raw) {
        setStateHydrated(true)
        return
      }

      const saved = JSON.parse(raw)
      if (typeof saved?.sessionId === "string") setSessionId(saved.sessionId)
      if (saved?.currentStrategy && typeof saved.currentStrategy === "object") setCurrentStrategy(saved.currentStrategy)
      if (typeof saved?.parseCanRun === "boolean") setParseCanRun(saved.parseCanRun)
      if (saved?.parseDetails && typeof saved.parseDetails === "object") setParseDetails(saved.parseDetails)
      if (typeof saved?.parseStatus === "string") setParseStatus(saved.parseStatus)
      if (Array.isArray(saved?.suggestions) && saved.suggestions.length) setSuggestions(saved.suggestions)
      if (typeof saved?.draft === "string") setDraft(saved.draft)
      if (typeof saved?.backtestProgress === "number") setBacktestProgress(saved.backtestProgress)
      if (typeof saved?.backtestStepMessage === "string") setBacktestStepMessage(saved.backtestStepMessage)
      if (Array.isArray(saved?.consoleLines) && saved.consoleLines.length) setConsoleLines(saved.consoleLines)
      if (Array.isArray(saved?.chatMessages) && saved.chatMessages.length) setChatMessages(saved.chatMessages)
      if (typeof saved?.chatInput === "string") setChatInput(saved.chatInput)
      if (saved?.lastBacktestMetrics && typeof saved.lastBacktestMetrics === "object") {
        setLastBacktestMetrics(saved.lastBacktestMetrics)
      }

      lastAutoParsed.current = typeof saved?.lastAutoParsed === "string"
        ? saved.lastAutoParsed
        : (typeof saved?.draft === "string" ? saved.draft.trim() : "")
    } catch {
      // Ignore malformed persisted state and continue with defaults.
    } finally {
      setStateHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!stateHydrated) return

    const snapshot = {
      sessionId,
      currentStrategy,
      parseCanRun,
      parseDetails,
      parseStatus,
      suggestions,
      draft,
      backtestProgress,
      backtestStepMessage,
      consoleLines,
      chatMessages,
      chatInput,
      lastBacktestMetrics,
      lastAutoParsed: lastAutoParsed.current,
    }

    try {
      sessionStorage.setItem(BUILDER_STATE_STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // If browser storage is unavailable/full, continue without persistence.
    }
  }, [
    stateHydrated,
    sessionId,
    currentStrategy,
    parseCanRun,
    parseDetails,
    parseStatus,
    suggestions,
    draft,
    backtestProgress,
    backtestStepMessage,
    consoleLines,
    chatMessages,
    chatInput,
    lastBacktestMetrics,
  ])

  const parseDraft = async (text) => {
    const trimmed = text?.trim()
    if (!trimmed || trimmed.length < 24) return null

    setIsParsing(true)
    pushConsole("ParserAgent", "Received natural language strategy draft")
    pushConsole("IntentAgent", "Interpreting intent, asset, timeframe, and rule constraints")
    try {
      const response = await parseStrategyBuilder({
        text: trimmed,
        session_id: sessionId || undefined,
        conversation_history: [],
      })

      const assignments = response?.parse_details?.agent_assignments || []
      if (assignments.length > 0) {
        assignments.forEach((item) => {
          const who = item.agent || item.role || "StrategyAgent"
          const out = item.output || item.status || "step complete"
          pushConsole(who, out)
        })
      } else {
        pushConsole("ParserAgent", `Structured strategy generated (${response?.status || "ok"})`)
      }

      if (response?.parse_details?.dsl_preview) {
        pushConsole("DSLCompiler", "DSL preview ready and synced to parser panel")
      }
      if (Array.isArray(response?.detected_indicators) && response.detected_indicators.length) {
        pushConsole("IndicatorAgent", `Detected indicators: ${response.detected_indicators.join(", ")}`)
      }
      if (response?.validation?.can_run) {
        pushConsole("ValidationAgent", "Validation passed: strategy is ready to backtest")
      } else {
        pushConsole("ValidationAgent", "Validation requires user attention before backtest")
      }

      setSessionId(response.session_id || sessionId)
      setCurrentStrategy(response.strategy || null)
      setParseStatus(response.status || "draft")
      setParseCanRun(!!response.validation?.can_run)
      setParseDetails(response.parse_details || {})
      if (Array.isArray(response.suggestions) && response.suggestions.length) {
        setSuggestions(response.suggestions)
      }

      // ── Feed agent reply into chat ──────────────────────────────────────
      if (response?.agent_message) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content: response.agent_message,
            type: response.status === "needs_clarification" ? "clarification" : "strategy",
          },
        ])
      }

      return response
    } catch (err) {
      pushConsole("ParserAgent", `Parsing failed: ${err.message || "request error"}`)
      addToast("error", err.message || "Failed to parse strategy")
      return null
    } finally {
      setIsParsing(false)
    }
  }

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const [tpl, indicatorGroups] = await Promise.all([
          fetchStrategyTemplates(),
          fetchIndicatorCatalog(),
        ])
        if (!active) return

        setTemplates(tpl?.length ? tpl : DEFAULT_TEMPLATES)
        if (indicatorGroups && Object.keys(indicatorGroups).length) {
          const normalized = Object.entries(indicatorGroups).reduce((acc, [group, items]) => {
            acc[group] = (items || []).map((it) => it.code || it.name)
            return acc
          }, {})
          setAvailableIndicators(normalized)
        }
      } catch (err) {
        if (!active) return
        setTemplates(DEFAULT_TEMPLATES)
        addToast("error", err.message || "Failed to load strategy builder configuration")
      }
    }

    bootstrap()
    return () => {
      active = false
    }
  }, [addToast])

  useEffect(() => {
    if (!stateHydrated) return

    const trimmed = draft.trim()
    if (!trimmed || trimmed.length < 24) return
    if (trimmed === lastAutoParsed.current) return

    const id = setTimeout(async () => {
      const res = await parseDraft(trimmed)
      if (res) lastAutoParsed.current = trimmed
    }, 700)
    return () => clearTimeout(id)
  }, [draft, sessionId, stateHydrated])

  // ── Chat: send a message (general conversation or strategy follow-up) ────────
  const onSendChat = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return

    setChatMessages((prev) => [...prev, { role: "user", content: text, type: "user" }])
    setChatInput("")
    setChatLoading(true)

    try {
      const response = await sendChatMessage({ text, session_id: sessionId || undefined })

      // If the backend parsed a strategy, sync it to local state
      if (response?.strategy && Object.keys(response.strategy).length > 0) {
        setCurrentStrategy(response.strategy)
        setSessionId(response.session_id || sessionId)
        setParseCanRun(!!response.can_run)
        setParseDetails(response.parse_details || {})
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: response?.agent_message || "Got it! Let me know if you have more details.",
          type: response?.status === "needs_clarification" ? "clarification" : "chat",
        },
      ])
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "agent", content: `Sorry, I ran into an error: ${err.message}`, type: "error" },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const onChatKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSendChat()
    }
  }

  const onOpenLatestResults = (resultId) => {
    if (!resultId) return
    navigate(`/app/results/${resultId}`)
  }

  const handleBacktestSuccess = (result, resultId, successMessage = "Backtest completed") => {
    useStrategyStore.setState({
      backtestResult: result,
      currentResultId: resultId,
    })

    const metrics = result?.metrics || {}
    setLastBacktestMetrics(metrics)
    setBacktestProgress(100)
    setBacktestStepMessage("Backtest completed")
    pushConsole("PersistenceAgent", `Backtest result ready: ${resultId}`)
    pushConsole("NarrativeAgent", "AI report and analytics generated")
    addToast("success", successMessage)

    const wr = metrics.win_rate_pct != null ? `${metrics.win_rate_pct}%` : "N/A"
    const tr = metrics.total_return_pct != null ? `${metrics.total_return_pct}%` : "N/A"
    const sh = metrics.sharpe_ratio != null ? metrics.sharpe_ratio : "N/A"

    setChatMessages((prev) => [
      ...prev,
      {
        role: "agent",
        content: `Backtest complete! Return: ${tr} | Win Rate: ${wr} | Sharpe: ${sh}\n\nWould you like me to analyse these results and suggest an improved strategy?`,
        type: "backtest_done",
        resultId,
      },
    ])
  }

  // ── Improve: request AI strategy improvement after backtest ─────────────────
  const onRequestImprovement = async () => {
    if (!currentStrategy || !lastBacktestMetrics) return
    setImproveLoading(true)
    setChatMessages((prev) => [
      ...prev,
      { role: "agent", content: "Analysing your backtest results and generating an improved strategy...", type: "thinking" },
    ])

    try {
      const result = await requestStrategyImprovement({
        strategy: currentStrategy,
        backtest_metrics: lastBacktestMetrics,
        session_id: sessionId || undefined,
      })

      setChatMessages((prev) => [
        ...prev.filter((m) => m.type !== "thinking"),
        {
          role: "agent",
          content: result.summary,
          type: "improvement",
          improvedStrategy: result.improved_strategy,
          naturalLanguage: result.natural_language,
          issues: result.issues || [],
          generalTips: result.general_tips || [],
        },
      ])
    } catch (err) {
      setChatMessages((prev) => [
        ...prev.filter((m) => m.type !== "thinking"),
        { role: "agent", content: `Improvement analysis failed: ${err.message}`, type: "error" },
      ])
    } finally {
      setImproveLoading(false)
    }
  }

  // Apply an improved strategy to the textarea and re-parse
  const applyImprovedStrategy = async (nl, strategyDict) => {
    const nextDraft = (nl || "").trim()
    if (nextDraft) {
      setDraft(nextDraft)
      lastAutoParsed.current = ""
    }
    if (strategyDict) {
      setCurrentStrategy(strategyDict)
      setParseCanRun(false)
    }

    if (nextDraft) {
      const parsed = await parseDraft(nextDraft)
      if (parsed) {
        lastAutoParsed.current = nextDraft
      }
    }

    setChatMessages((prev) => [
      ...prev,
      {
        role: "agent",
        content: "Improved strategy applied to the editor and re-parsed. Review it above, then run the backtest to compare results.",
        type: "chat",
      },
    ])
  }

  const detectedIndicators = useMemo(() => {
    if (!currentStrategy?.entry_rules?.length) return ["50-day Moving Average", "200-day Moving Average", "RSI(14)", "MACD (12, 26, 9)"]
    return currentStrategy.entry_rules.map((rule) => {
      const p = rule?.params?.period
      return p ? `${p}-day ${rule.indicator}` : `${rule.indicator}`
    })
  }, [currentStrategy])

  const parsedViewText = useMemo(() => {
    if (parseDetails?.dsl_preview) return parseDetails.dsl_preview
    if (currentStrategy) return JSON.stringify(currentStrategy, null, 2)
    return "Parsed DSL appears here after strategy is interpreted."
  }, [parseDetails, currentStrategy])

  const detectedRules = useMemo(() => {
    if (!currentStrategy?.entry_rules?.length) {
      return ["Buy Condition: MA crossover + RSI < 30", "Sell Condition: RSI > 70"]
    }
    return [
      ...currentStrategy.entry_rules.map((rule) => `Buy Condition: ${rule.indicator} ${String(rule.condition).replaceAll("_", " ")} ${rule.value ?? ""}`.trim()),
      ...currentStrategy.exit_rules.map((rule) => `Sell Condition: ${rule.indicator} ${String(rule.condition).replaceAll("_", " ")} ${rule.value ?? ""}`.trim()),
    ]
  }, [currentStrategy])

  const onGenerateDsl = async () => {
    pushConsole("ParserAgent", "Manual DSL generation requested")
    const res = await parseDraft(draft.trim())
    if (res) {
      lastAutoParsed.current = draft.trim()
      try {
        const extra = await suggestStrategyImprovements({ text: draft.trim(), strategy: res.strategy || {} })
        if (extra.length) setSuggestions(extra)
        if (extra.length) pushConsole("SuggestionAgent", `Suggested improvements: ${extra.join(" | ")}`)
      } catch {
        // best-effort enhancement call
      }
    }
  }

  const onRunBacktest = async () => {
    if (!currentStrategy) {
      pushConsole("ExecutionAgent", "Run requested but no parsed strategy is available")
      addToast("warn", "Generate a strategy first")
      return
    }

    setBacktestLoading(true)
    setBacktestProgress(0)
    setBacktestStepMessage("Initializing strategy engine")
    pushConsole("ExecutionAgent", "Backtest run requested from Strategy Lab")
    pushConsole("Orchestrator", "Launching agentic pipeline and opening progress stream")
    try {
      const start = await startBuilderAgenticBacktest({
        strategy: currentStrategy,
        session_id: sessionId || undefined,
        natural_language: draft.trim() || undefined,
      })

      const jobId = start?.job_id
      if (!jobId) {
        throw new Error("Backtest job did not return a job_id")
      }
      pushConsole("Orchestrator", `Job accepted: ${jobId}`)

      const streamUrl = resolveApiUrl(start?.stream_url || `/api/backtests/${jobId}/stream`)
      pushConsole("Orchestrator", `Streaming progress from ${streamUrl}`)

      await new Promise((resolve, reject) => {
        let settled = false

        const fail = (error) => {
          if (settled) return
          settled = true
          if (streamRef.current) {
            streamRef.current.close()
            streamRef.current = null
          }
          reject(error)
        }

        const source = new EventSource(streamUrl)
        streamRef.current = source

        source.addEventListener("queued", (evt) => {
          try {
            const payload = JSON.parse(evt.data)
            setBacktestProgress(Number(payload.progress || 0))
            setBacktestStepMessage(payload.message || "Queued")
            const agent = stepAgent(payload.current_step || "queued")
            pushConsole(agent, `${payload.message || "Queued"} (${Number(payload.progress || 0)}%)`)
          } catch {
            // ignore malformed event payload
          }
        })

        source.addEventListener("progress", (evt) => {
          try {
            const payload = JSON.parse(evt.data)
            setBacktestProgress(Number(payload.progress || 0))
            setBacktestStepMessage(payload.message || payload.current_step || "Running backtest")
            const agent = stepAgent(payload.current_step || "progress")
            const label = payload.message || payload.current_step || "Running backtest"
            pushConsole(agent, `${label} (${Number(payload.progress || 0)}%)`)
          } catch {
            // ignore malformed event payload
          }
        })

        source.addEventListener("result_ready", async (evt) => {
          if (settled) return
          settled = true
          source.close()
          streamRef.current = null

          try {
            const payload = JSON.parse(evt.data)
            const resolvedJobId = payload?.job_id || jobId
            const finalData = await getBacktestJobResult(resolvedJobId)
            const result = finalData?.result
            const resultId = result?.id

            if (!resultId || !result) {
              throw new Error("Backtest completed but result payload is missing")
            }

            handleBacktestSuccess(result, resultId)
            resolve()
          } catch (error) {
            reject(error)
          }
        })

        source.addEventListener("error", (evt) => {
          try {
            const payload = evt?.data ? JSON.parse(evt.data) : null
            if (payload?.error) {
              pushConsole("Orchestrator", `Stream error: ${payload.error}`)
              fail(new Error(payload.error))
              return
            }
          } catch {
            // ignore parse failure
          }
          pushConsole("Orchestrator", "Stream disconnected unexpectedly")
          fail(new Error("Backtest stream disconnected"))
        })
      })
    } catch (err) {
      pushConsole("ExecutionAgent", `Agentic run failed: ${err.message || "unknown"}`)
      try {
        const fallback = await runBuilderBacktest(currentStrategy)
        const fallbackResult = fallback?.result
        const fallbackId = fallbackResult?.id
        if (fallbackId && fallbackResult) {
          pushConsole("ExecutionAgent", `Fallback synchronous backtest succeeded: ${fallbackId}`)
          handleBacktestSuccess(fallbackResult, fallbackId, "Backtest completed in fallback mode")
          addToast("warn", "Live stream unavailable, used fallback backtest mode")
          return
        }
      } catch {
        // ignore fallback failure, original error will be surfaced
      }

      setBacktestStepMessage("")
      setBacktestProgress(0)
      pushConsole("ExecutionAgent", "Backtest failed in both agentic and fallback modes")
      addToast("error", err.message || "Backtest failed")
    } finally {
      setBacktestLoading(false)
    }
  }

  const onSaveStrategy = async () => {
    if (!currentStrategy) {
      addToast("warn", "No parsed strategy to save")
      return
    }
    try {
      const response = await saveBuilderStrategy({ natural_language: draft.trim(), strategy: currentStrategy })
      addToast("success", response?.message || "Strategy saved")
    } catch (err) {
      addToast("error", err.message || "Save failed")
    }
  }

  const onClearStrategy = async () => {
    setDraft("")
    setSessionId("")
    setCurrentStrategy(null)
    setParseCanRun(false)
    setParseDetails({})
    setParseStatus("draft")
    setSuggestions(DEFAULT_SUGGESTIONS)
    lastAutoParsed.current = ""
    setLastBacktestMetrics(null)
    setChatInput("")
    setChatMessages([
      {
        role: "agent",
        content: "Session cleared. Describe a new strategy or ask me anything!",
        type: "greeting",
      },
    ])
    pushConsole("System", "Strategy draft and parser state cleared")

    try {
      sessionStorage.removeItem(BUILDER_STATE_STORAGE_KEY)
    } catch {
      // Ignore storage cleanup errors.
    }

    if (sessionId) {
      try {
        await clearBuilderSession(sessionId)
      } catch {
        // local clear should still work even if backend clear fails
      }
    }
  }

  const validityClass = parseCanRun ? "ok" : "warn"
  const validityText = parseCanRun ? "VALID" : parseStatus === "needs_clarification" ? "NEEDS INPUT" : isParsing ? "PARSING" : "DRAFT"
  const issues = parseDetails?.issues || []
  const applyTemplate = (name) => {
    const picked = templates.find((t) => t.name === name)
    if (picked?.natural_language) {
      setDraft(picked.natural_language)
    }
  }

  return (
    <div className="lab-page">
      <header className="lab-topbar">
        <div className="lab-brand">FINTECH</div>
        <nav className="lab-nav">
          <Link to="/app/dashboard">Dashboard</Link>
          <Link className="active" to="/app/strategy-lab">Strategy Lab</Link>
          <Link to="/app/sandbox">Sandbox</Link>
          <Link to="/app/backtests">Backtests</Link>
          <Link to="/app/live-signals">Live Signals</Link>
          <Link to="/app/market-data">Market Data</Link>
          <a href="#">Analytics</a>
        </nav>
        <div className="lab-tools">
          <Bell className="h-3.5 w-3.5" />
          <Cog className="h-3.5 w-3.5" />
          <CircleUser className="h-3.5 w-3.5" />
        </div>
      </header>

      <div className="lab-grid">
        <aside className="lab-left">
          <section className="lab-panel">
            <p className="lab-title">Strategy Templates</p>
            <div className="lab-templates">
              {(templates.length ? templates : DEFAULT_TEMPLATES).map(({ name, description }) => (
                <button key={name} className="lab-template" onClick={() => applyTemplate(name)}>
                  <div className="lab-template-icon">↗</div>
                  <p>{name}</p>
                  <span>{description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="lab-panel">
            <p className="lab-title">Suggestions</p>
            <div className="lab-suggestions">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setDraft((d) => `${d}${d.endsWith(".") ? " " : ". "}${s}.`)}>{s}</button>
              ))}
            </div>
          </section>
        </aside>

        <main className="lab-center">
          <section className="lab-panel lab3-workbench">
            <div className="lab3-pane input">
              <div className="lab-editor-head">
                <p className="lab-title">Strategy Input</p>
                <span>Natural Language</span>
              </div>
              <div className="lab-editor-wrap">
                <div className="lab-lines">
                  {Array.from({ length: 10 }).map((_, idx) => <span key={idx}>{idx + 1}</span>)}
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="lab-editor"
                  placeholder="Buy when 50 MA crosses above 200 MA and RSI < 30..."
                />
              </div>
              <div className="lab-char-count">{draft.length} / 5000</div>
            </div>

            <div className="lab3-pane parsed">
              <div className="lab-editor-head">
                <p className="lab-title">Parsed Strategy / DSL</p>
                <span>{isParsing ? "Updating..." : "Auto-compiled"}</span>
              </div>
              <div className="lab3-dsl-wrap">
                <pre className="lab3-dsl">{parsedViewText}</pre>
              </div>

              <div className="lab3-detected-mini">
                <p className="lab-sub">Detected Indicators</p>
                <div className="chips">
                  {detectedIndicators.slice(0, 6).map((x) => <span key={x}>{x}</span>)}
                </div>
              </div>

              <div className="lab3-validation">
                <span className={`lab-chip ${validityClass}`}>● {validityText}</span>
                {!parseCanRun && issues.length > 0 ? <p>{issues[0]}</p> : <p>Parser interpretation looks consistent with current strategy text.</p>}
              </div>
            </div>
          </section>

          <section className="lab-panel">
            <div className="lab-detected-head">
              <p className="lab-title">Detected Rules & Indicators</p>
              <span className={`lab-chip ${validityClass}`}>● {validityText}</span>
            </div>

            <div className="lab-detected-grid">
              <div>
                <p className="lab-sub">Detected Indicators</p>
                <ul>
                  {detectedIndicators.map((x) => <li key={x}>◉ {x}</li>)}
                </ul>
              </div>
              <div>
                <p className="lab-sub">Detected Rules</p>
                <ul>
                  {detectedRules.map((x) => <li key={x}>⚡ {x}</li>)}
                </ul>
              </div>
            </div>

            <div className="lab-actions">
              <button className="btn-green" onClick={onGenerateDsl} disabled={isParsing || !draft.trim()}>
                {isParsing ? "Parsing..." : "Generate Strategy DSL"}
              </button>
              <button className="btn-yellow" onClick={onRunBacktest} disabled={!parseCanRun || backtestLoading}>
                {backtestLoading ? "Running..." : "Run Backtest"}
              </button>
              <button className="btn-ghost" onClick={onClearStrategy}>Clear</button>
              <button className="btn-ghost" onClick={onSaveStrategy}>Save Strategy</button>
            </div>

            {backtestLoading ? (
              <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2 text-[11px] text-[var(--text-secondary)]">
                <p>{backtestStepMessage || "Running backtest"}</p>
                <p className="font-mono text-[10px] text-[var(--brand-200)]">Progress: {Math.max(0, Math.min(100, backtestProgress))}%</p>
              </div>
            ) : null}

            <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/40 p-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="lab-title">AI Processing Console</p>
                <button className="btn-ghost" onClick={() => setConsoleLines((prev) => prev.slice(-2))}>Clear Console</button>
              </div>
              <div className="max-h-44 overflow-auto rounded-sm border border-[var(--terminal-line)] bg-black/55 p-2 font-mono text-[10px] text-[var(--brand-200)]">
                {consoleLines.map((line, idx) => (
                  <p key={`${line}-${idx}`} className="mb-1 last:mb-0">{line}</p>
                ))}
                <div ref={consoleEndRef} />
              </div>
            </div>
          </section>

          {/* ── Conversational AI Chat Panel ───────────────────────────────── */}
          <section className="lab-panel" style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            <div className="mb-2 flex items-center justify-between border-b border-[var(--border-default)] pb-2">
              <p className="lab-title">AI Strategy Assistant</p>
              <span className="text-[10px] text-[var(--text-muted)]">
                {chatLoading ? "Thinking..." : improveLoading ? "Analysing..." : "Online"}
              </span>
            </div>

            {/* Message thread */}
            <div
              className="flex flex-col gap-2 overflow-auto rounded-sm bg-black/30 p-2"
              style={{ maxHeight: "320px", minHeight: "120px" }}
            >
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    style={{
                      maxWidth: "88%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      lineHeight: "1.55",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background:
                        msg.role === "user"
                          ? "rgba(0,255,102,0.12)"
                          : msg.type === "clarification"
                          ? "rgba(255,200,0,0.08)"
                          : msg.type === "error"
                          ? "rgba(255,60,60,0.10)"
                          : msg.type === "improvement"
                          ? "rgba(0,180,255,0.08)"
                          : "rgba(255,255,255,0.04)",
                      border:
                        msg.type === "clarification"
                          ? "1px solid rgba(255,200,0,0.25)"
                          : msg.type === "improvement"
                          ? "1px solid rgba(0,180,255,0.25)"
                          : msg.type === "error"
                          ? "1px solid rgba(255,60,60,0.25)"
                          : "1px solid rgba(255,255,255,0.06)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {msg.role === "agent" && (
                      <p style={{ fontSize: "9px", color: "var(--brand-200)", marginBottom: "4px", fontWeight: 600 }}>
                        {msg.type === "clarification" ? "⚡ FOLLOW-UP" : msg.type === "improvement" ? "✦ STRATEGY IMPROVEMENT" : msg.type === "backtest_done" ? "✔ BACKTEST RESULT" : "◆ TriVectorAI"}
                      </p>
                    )}
                    <span>{msg.content}</span>

                    {/* Improvement card */}
                    {msg.type === "improvement" && msg.improvedStrategy && (
                      <div style={{ marginTop: "10px", borderTop: "1px solid rgba(0,180,255,0.2)", paddingTop: "8px" }}>
                        {msg.issues?.slice(0, 3).map((issue, i) => (
                          <p key={i} style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "3px" }}>
                            • {issue.suggestion}
                          </p>
                        ))}
                        {msg.generalTips?.map((tip, i) => (
                          <p key={`tip-${i}`} style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "3px" }}>
                            💡 {tip}
                          </p>
                        ))}
                        <div style={{ marginTop: "8px", background: "rgba(0,180,255,0.06)", borderRadius: "4px", padding: "6px 8px" }}>
                          <p style={{ fontSize: "10px", color: "var(--brand-200)", marginBottom: "4px", fontWeight: 600 }}>Improved Strategy</p>
                          <p style={{ fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic" }}>{msg.naturalLanguage}</p>
                        </div>
                        <button
                          className="btn-green"
                          style={{ marginTop: "8px", fontSize: "10px", padding: "4px 10px" }}
                          onClick={() => applyImprovedStrategy(msg.naturalLanguage, msg.improvedStrategy)}
                        >
                          Apply Improved Strategy
                        </button>
                      </div>
                    )}

                    {/* Backtest done — show Improve button */}
                    {msg.type === "backtest_done" && lastBacktestMetrics && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                        <button
                          className="btn-yellow"
                          style={{ fontSize: "10px", padding: "4px 10px" }}
                          onClick={onRequestImprovement}
                          disabled={improveLoading}
                        >
                          {improveLoading ? "Analysing..." : "Analyse & Improve Strategy"}
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: "10px", padding: "4px 10px" }}
                          onClick={() => onOpenLatestResults(msg.resultId)}
                        >
                          View Full Results
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(chatLoading || improveLoading) && (
                <div className="flex justify-start">
                  <div style={{ padding: "8px 10px", borderRadius: "6px", fontSize: "11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ color: "var(--text-muted)" }}>● ● ●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={onChatKeyDown}
                placeholder="Ask a question or respond to follow-up..."
                disabled={chatLoading || improveLoading}
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "4px",
                  padding: "6px 8px",
                  fontSize: "11px",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                className="btn-green"
                style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px" }}
                onClick={onSendChat}
                disabled={!chatInput.trim() || chatLoading || improveLoading}
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
          </section>
        </main>

        <aside className="lab-right">
          <section className="lab-panel">
            <div className="lab-right-head">
              <p className="lab-title">Available Indicators</p>
              <Plus className="h-3 w-3 text-[var(--text-muted)]" />
            </div>
            <div className="lab-indicator-scroll">
              {Object.entries(availableIndicators).map(([group, items]) => (
                <div key={group} className="lab-indicator-group">
                  <p>{group}</p>
                  {items.map((name) => (
                    <div key={name} className="lab-indicator-item">
                      <span>{name}</span>
                      <Plus className="h-3 w-3" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="lab-panel">
            <p className="lab-title">Strategy Parameters</p>
            <div className="lab-params">
              <div><span>Timeframe</span><strong>{currentStrategy?.timeframe || "1 Hour"}</strong></div>
              <div><span>Asset Class</span><strong>{currentStrategy?.asset_class || "Equities"}</strong></div>
              <div><span>Risk Level</span><strong>{parseCanRun ? "Medium" : "Review"}</strong></div>
            </div>
          </section>
        </aside>
      </div>

      <footer className="lab-footer">
        <span>Last saved: 2 minutes ago</span>
        <span>Strategy validation: <b className={parseCanRun ? "up" : "down"}>{parseCanRun ? "READY" : "PENDING"}</b></span>
        <span>Connected</span>
      </footer>
    </div>
  )
}
