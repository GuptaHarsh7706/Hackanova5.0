export const MOCK_STRATEGIES = [
  {
    id: "mock-1",
    name: "AAPL Golden Cross",
    ticker: "AAPL",
    timeframe: "1d",
    asset_class: "equity",
    entry_rules: [
      {
        indicator: "SMA",
        condition: "crosses_above",
        value: "SMA_200",
        params: { period: 50 },
        logic_operator: "NONE",
      },
    ],
    exit_rules: [
      {
        indicator: "RSI",
        condition: "greater_than",
        value: 70,
        params: { period: 14 },
        logic_operator: "NONE",
      },
    ],
    stop_loss_pct: 2.0,
    take_profit_pct: null,
    position_size: 1.0,
    confidence_score: 0.95,
  },
  {
    id: "mock-2",
    name: "BTC RSI Bounce",
    ticker: "BTCUSDT",
    timeframe: "1d",
    asset_class: "crypto",
    entry_rules: [
      {
        indicator: "RSI",
        condition: "less_than",
        value: 30,
        params: { period: 14 },
        logic_operator: "NONE",
      },
    ],
    exit_rules: [
      {
        indicator: "RSI",
        condition: "greater_than",
        value: 70,
        params: { period: 14 },
        logic_operator: "NONE",
      },
    ],
    stop_loss_pct: 5.0,
    take_profit_pct: 15.0,
    position_size: 0.5,
    confidence_score: 0.98,
  },
  {
    id: "mock-3",
    name: "TSLA MACD Crossover",
    ticker: "TSLA",
    timeframe: "1h",
    asset_class: "equity",
    entry_rules: [
      {
        indicator: "MACD",
        condition: "crosses_above",
        value: "SIGNAL",
        params: { fast_period: 12, slow_period: 26, signal_period: 9 },
        logic_operator: "NONE",
      },
    ],
    exit_rules: [
      {
        indicator: "MACD",
        condition: "crosses_below",
        value: "SIGNAL",
        params: { fast_period: 12, slow_period: 26, signal_period: 9 },
        logic_operator: "NONE",
      },
    ],
    stop_loss_pct: 3.0,
    take_profit_pct: 9.0,
    position_size: 1.0,
    confidence_score: 0.91,
  },
]

export const EXAMPLE_STRATEGIES = [
  "Buy AAPL when 50 SMA crosses above 200 SMA, sell when RSI exceeds 70",
  "RSI oversold bounce on BTC - buy below 30, sell above 70 with 5% stop loss",
  "MACD crossover on TSLA hourly chart with 3% stop loss and 9% target",
  "Golden cross strategy on SPY with 2% trailing stop",
  "Bollinger Band breakout on ETH - buy when price closes above upper band",
]

export const MOCK_CHAT_MESSAGES = [
  {
    id: 1,
    role: "agent",
    type: "text",
    content:
      "Hi! I'm **TriVectorAI**. Describe any trading strategy in plain English and I'll parse it into structured rules ready for backtesting.\n\nTry: *\"Buy AAPL when the 50-day SMA crosses above the 200-day SMA\"*",
    timestamp: new Date().toISOString(),
  },
]

function monthlyPoints(start, end) {
  const points = []
  let d = new Date(`${start}T00:00:00Z`)
  const max = new Date(`${end}T00:00:00Z`)
  while (d <= max) {
    points.push(new Date(d).toISOString().slice(0, 10))
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return points
}

function generateMockEquityCurve(startVal, totalReturnPct, startDate, endDate) {
  const dates = monthlyPoints(startDate, endDate)
  const target = startVal * (1 + totalReturnPct / 100)
  const baseStep = (target - startVal) / Math.max(1, dates.length - 1)
  let value = startVal
  let benchmark = startVal
  return dates.map((date, i) => {
    const wave = Math.sin(i / 3) * 180 + Math.cos(i / 4) * 90
    const drawdown = i > 25 && i < 35 ? -220 : 0
    value = Math.max(6000, value + baseStep + wave + drawdown)
    benchmark = benchmark + baseStep * 0.72 + Math.sin(i / 5) * 75
    return {
      date,
      value: Number(value.toFixed(2)),
      benchmark: Number(benchmark.toFixed(2)),
      drawdown_pct: Number((((value - Math.max(startVal, value)) / Math.max(startVal, value)) * 100).toFixed(2)),
    }
  })
}

function generateMockTrades(count) {
  const rows = []
  const baseDate = new Date("2020-02-10T00:00:00Z")
  for (let i = 0; i < count; i += 1) {
    const dIn = new Date(baseDate)
    dIn.setUTCDate(baseDate.getUTCDate() + i * 28)
    const hold = i % 3 === 0 ? 62 : i % 2 === 0 ? 19 : 34
    const dOut = new Date(dIn)
    dOut.setUTCDate(dOut.getUTCDate() + hold)
    const entry = 45 + i * 2.2
    const returnPct = i % 4 === 0 ? 11.8 : i % 5 === 0 ? -8.2 : 4.9
    const exit = entry * (1 + returnPct / 100)
    const pnl = (exit - entry) * 10
    rows.push({
      id: i + 1,
      date_in: dIn.toISOString().slice(0, 10),
      date_out: dOut.toISOString().slice(0, 10),
      entry_price: Number(entry.toFixed(2)),
      exit_price: Number(exit.toFixed(2)),
      pnl_usd: Number(pnl.toFixed(2)),
      return_pct: Number(returnPct.toFixed(2)),
      hold_days: hold,
    })
  }
  return rows
}

export const MOCK_RESULTS = {
  "mock-1": {
    strategy_id: "mock-1",
    total_return_pct: 127.4,
    sharpe_ratio: 1.84,
    max_drawdown_pct: -18.3,
    win_rate_pct: 62.5,
    total_trades: 48,
    cagr_pct: 23.1,
    avg_win_pct: 18.4,
    avg_loss_pct: -7.2,
    largest_win_pct: 113.8,
    largest_loss_pct: -15.1,
    profit_factor: 2.56,
    expectancy_usd: 342,
    equity_curve: generateMockEquityCurve(10000, 127.4, "2020-01-02", "2024-12-31"),
    monthly_returns: {
      2020: [-2.1, 0.4, -12.3, 15.2, 8.1, 1.2, 7.3, 4.8, -3.2, 0.1, 11.2, 6.4],
      2021: [3.2, 5.1, 4.8, -2.1, 0.8, 4.3, 1.2, 5.8, -4.1, 7.2, 0.3, 5.8],
      2022: [-7.2, -3.4, -4.1, -8.3, -6.2, -2.8, 8.1, -4.5, -9.1, 11.2, -3.1, 2.8],
      2023: [7.1, 0.3, -2.1, 5.2, 8.8, 6.7, 3.2, 0.5, -3.8, -2.1, 9.1, 4.8],
      2024: [3.8, 5.2, 0.4, -3.1, 7.8, 4.1, 0.8, -2.3, 1.4, 4.5, 0.0, 0.0],
    },
    trades: generateMockTrades(48),
  },
}
