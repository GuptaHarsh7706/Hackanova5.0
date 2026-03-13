# TriVectorAI — Phase 2: Complete Frontend UI Specification
### Static UI Build — Every Screen, Every State, Every Detail

> **For the Code Agent — Read This First:**
> - This phase is **frontend only**. No backend calls. All data is hardcoded mock/static.
> - Every screen listed here must be built. No placeholders, no "TODO" comments.
> - Backend wiring happens in Phase 3. Use mock data exports for everything.
> - Dark theme only. The design system is defined once in Section 2 — follow it everywhere.
> - Use React + Vite + Tailwind + Zustand (same stack as Phase 1).
> - Every component is responsive: mobile (375px), tablet (768px), desktop (1280px+).

---

## 1. App Shell & Routing

### 1.1 Router Setup
Use `react-router-dom` v6. These are ALL the routes:

```
/                    → redirect to /app
/app                 → MainLayout with ChatPage (default)
/app/results/:id     → MainLayout with ResultsPage
/app/history         → MainLayout with HistoryPage
/app/compare         → MainLayout with ComparePage
/app/settings        → MainLayout with SettingsPage
/onboarding          → OnboardingPage (no sidebar)
*                    → NotFoundPage
```

### 1.2 MainLayout Structure
```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (220px fixed)  │  Main Content Area (flex-1)   │
│                         │                               │
│  [Logo + Name]          │  [Header — 56px]              │
│  [Nav Items]            │  [Page Content — flex-1]      │
│                         │                               │
│  [Bottom: version]      │                               │
└─────────────────────────────────────────────────────────┘

On tablet (768–1024px): Sidebar collapses to 60px icon-only rail
On mobile (<768px): Sidebar hidden, bottom tab bar shown instead
```

---

## 2. Design System (Follow Exactly)

### 2.1 Color Tokens
Define these as Tailwind custom colors AND as CSS variables in `index.css`:

```css
:root {
  /* Backgrounds */
  --bg-base:     #0a0a0f;   /* deepest background */
  --bg-surface:  #111118;   /* card/panel bg */
  --bg-elevated: #1a1a24;   /* hover states, modals */
  --bg-overlay:  #22223080; /* overlay backdrop */

  /* Brand — Purple ramp */
  --brand-50:  #eeedfe;
  --brand-100: #cecbf6;
  --brand-200: #afa9ec;
  --brand-400: #7f77dd;
  --brand-500: #6c63d4;
  --brand-600: #534ab7;
  --brand-700: #3d3689;
  --brand-900: #26215c;

  /* Accent — Teal for success/positive */
  --teal-400: #2dd4bf;
  --teal-600: #0f9e8a;

  /* Semantic */
  --success: #22c55e;
  --warning: #f59e0b;
  --danger:  #ef4444;
  --info:    #3b82f6;

  /* Text */
  --text-primary:   #f0f0f8;
  --text-secondary: #8e8ea8;
  --text-muted:     #4a4a62;

  /* Borders */
  --border-subtle:  #1e1e2e;
  --border-default: #2a2a3d;
  --border-strong:  #3d3d56;
}
```

### 2.2 Typography Scale
```
Font family:   Inter (load from Google Fonts)
Mono font:     JetBrains Mono (for code/JSON)

Display:  36px / weight 700 / tracking -0.02em
Heading1: 28px / weight 600 / tracking -0.01em
Heading2: 22px / weight 600
Heading3: 18px / weight 500
Body:     14px / weight 400 / line-height 1.7
Small:    12px / weight 400
Micro:    11px / weight 500 / tracking 0.06em / UPPERCASE
```

### 2.3 Spacing System
Use Tailwind defaults. Key spacings: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px

### 2.4 Border Radius
```
sm:   4px   (pills, small badges)
md:   8px   (inputs, small cards)
lg:   12px  (cards, panels)
xl:   16px  (modals, large cards)
2xl:  24px  (message bubbles)
full: 9999px (avatar circles, toggle)
```

### 2.5 Shadows
```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.4);
--shadow-md:  0 4px 16px rgba(0,0,0,0.5);
--shadow-lg:  0 8px 32px rgba(0,0,0,0.6);
--shadow-brand: 0 0 20px rgba(107,99,212,0.25);
```

### 2.6 Reusable UI Primitives
Build these in `src/components/ui/` — they are used everywhere:

#### `Badge.jsx`
Props: `variant` (default|brand|success|warning|danger|info), `size` (sm|md), `dot` (bool)
- Small pill with uppercase micro text
- `dot` adds a pulsing circle before the text (for live states)

#### `Button.jsx`
Variants: `primary` (brand gradient bg), `secondary` (border only), `ghost` (no border), `danger`
Sizes: `sm`, `md`, `lg`
States: default, hover (slight lighten), active (slight scale down), disabled (opacity 40%), loading (spinner replaces text)

#### `Card.jsx`
Props: `hoverable` (bool), `active` (bool — brand border glow)
- Base: `bg-[--bg-surface] border border-[--border-default] rounded-xl`
- Hoverable: border brightens on hover, slight translateY(-1px)
- Active: `border-[--brand-500] shadow-[--shadow-brand]`

#### `Input.jsx`
- Base: dark bg, border default, focus → brand-500 border glow
- Error state: danger border
- Label above, optional helper text below

#### `Tooltip.jsx`
- Dark bg elevated, small text, appears on hover after 300ms delay
- Position: top (default), bottom, left, right

#### `Spinner.jsx`
Sizes: sm (16px), md (24px), lg (40px)
- Rotating arc, brand color

#### `Divider.jsx`
- Horizontal line, `border-[--border-default]`, optional center label

#### `EmptyState.jsx`
Props: `icon`, `title`, `description`, `action` (button config)
- Centered layout, muted icon, heading, subtext, optional CTA button

#### `Modal.jsx`
- Backdrop blur, centered card, `max-w-lg`, close button top-right
- Animates: fade in backdrop + scale-up card

#### `Toast.jsx`
- Bottom-right stack, max 3 visible
- Variants: success, error, warning, info
- Auto-dismiss after 4s, manual dismiss X button
- Slide-in from right animation

---

## 3. Screen 1 — Onboarding Page (`/onboarding`)

**Purpose:** First-time user welcome. Shown once, then redirects to `/app`.

### Layout
Full screen, centered, no sidebar. Dark background with subtle animated gradient orbs (CSS only, brand purple and teal, very low opacity ~5%, blur 80px, slow float animation).

### Content Flow (vertical, centered, max-width 480px)

**Step 1 of 3 — Welcome**
```
[TriVectorAI logo — SVG, 48px]
[Heading] "Backtest any strategy.
           Just describe it."
[Subtext] "Type your trading idea in plain English.
           TriVectorAI parses it, runs it against
           real historical data, and shows you
           exactly how it would have performed."
[Button — primary — large] "Get Started →"
[Skip link] "Already know what I'm doing — skip"
```

**Step 2 of 3 — How it works**
Three feature cards in a row (stack on mobile):
```
Card 1: [icon: MessageSquare] "Describe"
         "Type any strategy — moving average crossovers,
          RSI signals, Bollinger Bands — in plain English."

Card 2: [icon: Zap] "Parse"
         "Our AI agent instantly converts your words into
          structured trading rules with exact parameters."

Card 3: [icon: BarChart2] "Backtest"
         "See equity curve, Sharpe ratio, drawdown,
          and win rate — all within seconds."
```
Progress dots (3 dots) at the bottom. `[Back]` `[Next →]` buttons.

**Step 3 of 3 — Try an example**
```
[Heading] "Try one of these to start:"

[Clickable example pill 1] "Golden cross — AAPL daily"
[Clickable example pill 2] "RSI oversold bounce — BTC"
[Clickable example pill 3] "MACD crossover — TSLA hourly"

[Button — primary — large] "Open the app →"
```
Clicking an example pill stores it in Zustand and pre-fills the chat input on arrival at `/app`.

### Mobile: Stack all cards, same content.

---

## 4. Screen 2 — Main Chat Page (`/app`)

This is the core screen. Three-panel layout on desktop.

### 4.1 Sidebar (Left, 220px)

```
┌──────────────────────┐
│ [Logo SVG] TriVector │  ← 56px tall header area
│             AI       │
├──────────────────────┤
│ + New Strategy       │  ← primary action button, brand bg
├──────────────────────┤
│ NAVIGATION           │  ← micro label
│                      │
│ [icon] Chat          │  ← active state: brand-500 bg pill
│ [icon] History       │
│ [icon] Compare       │
│ [icon] Settings      │
├──────────────────────┤
│ RECENT               │  ← micro label
│ AAPL Golden Cross    │  ← history item, truncated
│ BTC RSI Strategy     │
│ TSLA MACD 1h         │
├──────────────────────┤  ← push to bottom
│ [avatar] Phase 1 ·   │
│          v0.1.0      │
└──────────────────────┘
```

**Sidebar collapsed (tablet — icon rail, 60px):**
- Only icons, no text
- Tooltip on hover showing the label
- Logo collapses to just the icon

**Active nav item:** rounded pill background in brand-900, brand-400 text and icon

**Recent history items:**
- Single line, 13px, text-secondary
- Hover: bg-elevated, text-primary
- Delete icon appears on hover (×)

### 4.2 Header (Top, 56px)
```
[Hamburger menu — mobile only]  [Page title]  [right side →]
                                              [Docs icon] [Theme toggle — disabled, dark only] [Avatar]
```
Page title changes per route: "Strategy Parser", "Results", "History", "Compare", "Settings"

### 4.3 Chat Area (Center, flex-1)

**Empty state (no messages yet):**
```
[Centered in panel]

[Large TriVectorAI logo icon — 64px, faint]

"Describe your trading strategy"
[subtext] "I'll parse it into structured rules and run a backtest."

[3 example chips in a row]
"Golden cross on AAPL"    "RSI bounce on BTC"    "MACD on TSLA"

[Full-width strategy tips card at bottom]
"💡 Tips for best results:"
  · Name the asset (e.g. AAPL, BTCUSDT, EURUSD)
  · Specify the timeframe (daily, hourly, 15-minute)
  · Include entry AND exit conditions
  · Add a stop-loss for realistic results
```

**Conversation state (messages present):**

Messages list, scrollable, padding 16px horizontal:

```
User message bubble:
┌────────────────────────────────┐
│                    Your text   │
│              [timestamp 12:34] │
└────────────────────────────────┘
Right-aligned, max-width 75%, brand-900 bg, brand-200 text border

Agent message bubble:
┌────────────────────────────────┐
│ [TV] Agent text here with      │
│      markdown support          │
│      [timestamp 12:34]         │
└────────────────────────────────┘
Left-aligned, max-width 80%, bg-elevated bg, text-primary

Typing indicator bubble (when loading):
┌──────────────────┐
│ [TV] ● ● ●       │  ← three dots, staggered pulse animation
└──────────────────┘
```

**Message types to handle:**
1. Plain text (user or agent)
2. Agent text with markdown (bold, lists, inline code)
3. Agent confirmation card (special styled card inside bubble — see 4.3a)
4. Agent clarification card (see 4.3b)
5. Agent error message (red left border accent)

**4.3a — Confirmation Card (inside agent bubble, after successful parse):**
```
┌─────────────────────────────────────────────────┐
│ ✓ Strategy Parsed                    [100% conf] │
│ ─────────────────────────────────────────────── │
│ AAPL  ·  Daily  ·  Equity                        │
│                                                  │
│ ENTRY                                            │
│  [SMA] (50) crosses above [SMA] (200)            │
│                                                  │
│ EXIT                                             │
│  [RSI] (14) greater than 70                      │
│                                                  │
│ Stop loss: 2% · Position: 100%                   │
│ ─────────────────────────────────────────────── │
│ [Run Backtest →]  [Edit Strategy]                │
└─────────────────────────────────────────────────┘
```
- "Run Backtest" button: brand primary, navigates to `/app/results/mock-1`
- "Edit Strategy" button: ghost, opens inline edit mode in the right panel

**4.3b — Clarification Card (inside agent bubble, when fields missing):**
```
┌─────────────────────────────────────────────────┐
│ ⚠ Need a bit more info                           │
│ ─────────────────────────────────────────────── │
│ I understood your strategy, but I need:          │
│  · Which asset? (e.g. AAPL, BTCUSDT)            │
│  · What timeframe? (daily, hourly, etc.)         │
│                                                  │
│ What I parsed so far:                            │
│  Entry: SMA(50) crosses above SMA(200) ✓         │
│  Exit:  Not specified yet                        │
└─────────────────────────────────────────────────┘
```

### 4.4 Chat Input Bar (Bottom of chat area)

```
┌─────────────────────────────────────────────────────────────┐
│ [text area — auto-grows]                          [Send btn] │
│ Describe your trading strategy...                            │
└─────────────────────────────────────────────────────────────┘
[Attach context — disabled Phase 2]  [Examples ▾]   Cmd+Enter to send
```

- Rounded-2xl border, focus glow (brand-500 0 0 0 2px)
- Send button: brand gradient, circular, arrow icon
- `Examples ▾` dropdown shows 5 example strategies — clicking pre-fills the textarea
- Character count appears at bottom-right when >200 chars
- Disabled state while isLoading (textarea greyed, send button shows spinner)

### 4.5 Strategy Panel (Right, 380px)

**Empty state:**
```
┌──────────────────────────────────┐
│ Parsed Strategy              [×] │
│ ──────────────────────────────── │
│                                  │
│         [icon: FileJson]         │
│   "No strategy parsed yet"       │
│   Start chatting to see your     │
│   strategy appear here.          │
│                                  │
│ ──────────────────────────────── │
│ [Raw JSON toggle] disabled       │
└──────────────────────────────────┘
```

**Populated state (after parse):**
```
┌──────────────────────────────────────┐
│ Parsed Strategy              [×] [⟳] │
│ ──────────────────────────────────── │
│                                      │
│ [AAPL] [1d] [Equity]    [95% conf ●] │
│                                      │
│ ── ENTRY CONDITIONS ────────────────  │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ [SMA] 50-period                  │ │
│ │ crosses above                    │ │
│ │ [SMA] 200-period                 │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ── EXIT CONDITIONS ─────────────────  │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ [RSI] 14-period                  │ │
│ │ greater than                     │ │
│ │ 70                               │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ── RISK PARAMETERS ─────────────────  │
│                                      │
│ Stop Loss      [──────────] 2.00%    │
│ Take Profit    [──────────] 5.00%    │
│ Position Size  [██████████] 100%     │
│                                      │
│ ── MISSING ──────────────────────── │
│ ⚠ Exit conditions not specified      │
│                                      │
│ ── ─────────────────────────────── │
│ [< > Raw JSON]                       │
│                                      │
│ [   Run Backtest →   ]               │
│ [    Edit Strategy   ]               │
└──────────────────────────────────────┘
```

**RuleCard details:**
- Indicator badge: colored pill (`SMA`=blue, `EMA`=blue, `RSI`=orange, `MACD`=purple, `BBANDS`=teal, `PRICE`=gray, `VOLUME`=green, `ATR`=yellow)
- Condition text: `crosses above`, `crosses below`, `greater than`, `less than` — normal text
- Value: bold text or another indicator badge
- If two rules with `AND` between them: show a small `AND` divider chip between cards

**Confidence Score bar:**
- 90–100%: green
- 70–89%: yellow
- <70%: red
- Small horizontal bar + percentage text

**Raw JSON toggle:**
- Sliding panel below the main content
- Monospace font, syntax highlighted (keys in brand-400, strings in teal-400, numbers in orange)
- Copy button top-right of JSON block

**Panel behavior:**
- Slide in from right when strategy first appears (translateX animation)
- On mobile: bottom sheet (slides up from bottom), triggered by a floating "View Strategy" button
- Can be dismissed with × button (hides, shows floating re-open button)

---

## 5. Screen 3 — Results Page (`/app/results/:id`)

This is the most complex screen. Full-width layout (no right panel).

### 5.1 Results Header
```
← Back to Chat

AAPL — Golden Cross Strategy                    [Share] [Export PDF] [Save]
Daily chart · Equity · 2020–2024 · 4 years of data    [Run Again with New Params]
```

### 5.2 Performance Metrics Strip (top, horizontal scroll on mobile)
6 metric cards in a row:

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Total    │ │ Sharpe   │ │ Max      │ │ Win      │ │ Total    │ │ CAGR     │
│ Return   │ │ Ratio    │ │ Drawdown │ │ Rate     │ │ Trades   │ │          │
│          │ │          │ │          │ │          │ │          │ │          │
│ +127.4%  │ │  1.84    │ │ -18.3%  │ │ 62.5%    │ │   48     │ │ 23.1%    │
│ [▲ 12%]  │ │ [good]  │ │ [▼ mod] │ │ [good]   │ │          │ │ [▲ good] │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

Each metric card:
- `bg-surface`, border, rounded-xl
- Metric name: micro uppercase text-secondary
- Value: heading1 size, colored based on good/bad (green for positive returns, red for negative drawdown)
- Sub-label: small comparison or context text
- Hover: Card lifts with shadow-brand glow

### 5.3 Main Chart Area
Two tabs: `Equity Curve` | `Drawdown Chart`

**Equity Curve Tab:**
- Full width chart, height 360px
- Area chart with gradient fill (brand purple → transparent)
- X-axis: dates, Y-axis: portfolio value ($)
- Strategy line (brand-400) vs Benchmark/Buy-and-hold line (gray dashed)
- Tooltip on hover: date, portfolio value, benchmark value, difference
- Legend: two colored lines with labels
- Range selector: `1M | 3M | 6M | 1Y | 2Y | ALL` — pill buttons above chart
- Static mock chart using SVG paths (hardcoded realistic data points for AAPL 2020–2024)

**Drawdown Chart Tab:**
- Red fill area below zero line
- X-axis: dates, Y-axis: drawdown %
- Tooltip showing max drawdown at each point

> For Phase 2: build both charts as **static SVG** with realistic-looking hardcoded paths.
> Phase 3 will replace with real Recharts/Plotly + real data.

### 5.4 Two-column layout below chart

**Left column (60%):**

**Trade Log Table:**
```
Trades (48)                        [Filter ▾] [Export CSV]

# | Date In   | Date Out  | Entry  | Exit   | PnL    | Return | Hold
──────────────────────────────────────────────────────────────────
1 | 2020-03-24 | 2020-08-12 | $58.23 | $124.5 | +$662  | +113.8% | 141d  ← green row
2 | 2020-09-02 | 2020-09-24 | $128.4 | $112.2 | -$162  | -12.6%  | 22d   ← red row
...
```
- Alternating subtle row bg
- PnL column: green for profit, red for loss
- Sortable columns (clicking header sorts — static sort in Phase 2 using JS array sort)
- Pagination: 10 rows per page, `← 1 2 3 →` pagination controls

**Right column (40%):**

**Strategy Summary Card:**
```
┌─────────────────────────────┐
│ Strategy Details            │
│ ─────────────────────────── │
│ Asset:      AAPL            │
│ Timeframe:  Daily           │
│ Period:     Jan 2020–Dec 2024│
│ ─────────────────────────── │
│ ENTRY RULE                  │
│ SMA(50) crosses above       │
│ SMA(200)                    │
│ ─────────────────────────── │
│ EXIT RULE                   │
│ RSI(14) > 70                │
│ ─────────────────────────── │
│ Stop Loss:    2.0%          │
│ Take Profit:  —             │
│ Position:     100%          │
└─────────────────────────────┘
```

**Monthly Returns Heatmap:**
```
     Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
2020 [  ] [  ] [🔴] [🟢] [🟢] [  ] [🟢] [  ] [🔴] [  ] [🟢] [🟢]
2021 [🟢] [🟢] [🟢] [🔴] [  ] [🟢] [  ] [🟢] [🔴] [🟢] [  ] [🟢]
2022 [🔴] [🔴] [🔴] [🔴] [🔴] [🔴] [🟢] [🔴] [🔴] [🟢] [🔴] [🟢]
2023 [🟢] [  ] [🔴] [🟢] [🟢] [🟢] [🟢] [  ] [🔴] [🔴] [🟢] [🟢]
2024 [🟢] [🟢] [  ] [🔴] [🟢] [🟢] [  ] [🔴] [  ] [🟢] [  ] [  ]
```
- Each cell is a colored square (green shades for profit, red shades for loss, intensity = magnitude)
- Tooltip on hover: "March 2022: -8.4%"
- Static hardcoded data for Phase 2

**Additional Metrics Card:**
```
Avg Win:           +18.4%
Avg Loss:           -7.2%
Largest Win:       +113.8%
Largest Loss:       -15.1%
Avg Hold (wins):    87 days
Avg Hold (losses):  18 days
Profit Factor:       2.56
Expectancy:         +$342/trade
```

### 5.5 AI Insight Panel (bottom, full width)
```
┌─────────────────────────────────────────────────────────────────┐
│  [sparkle icon] AI Analysis                          [Regenerate]│
│ ──────────────────────────────────────────────────────────────── │
│ "This golden cross strategy on AAPL performed well during the    │
│  2020–2021 bull market, capturing most of the 4× rally. However, │
│  the strategy struggled in 2022's bear market, suffering 6        │
│  consecutive losses averaging -11.2% each.                       │
│                                                                   │
│  The 62.5% win rate is solid, but the real edge comes from the   │
│  asymmetry: wins average 18.4% vs losses at 7.2% — a 2.56×      │
│  profit factor. The strategy benefits from trend-following in     │
│  a trend-friendly asset like AAPL.                               │
│                                                                   │
│  Suggestion: Adding a market regime filter (e.g. SPY above its   │
│  200 SMA) could reduce the 2022 drawdown by ~40%."              │
│                                                                   │
│  [Try suggested improvement →]                                    │
└─────────────────────────────────────────────────────────────────┘
```
Static text in Phase 2. Brand gradient left border accent.

---

## 6. Screen 4 — History Page (`/app/history`)

### Layout
Full width, no right panel.

### Header
```
Strategy History                    [Search...] [Filter ▾] [Sort: Recent ▾]
48 saved strategies
```

### History Grid
Masonry/grid layout, 3 columns desktop, 2 tablet, 1 mobile.

Each HistoryCard:
```
┌──────────────────────────────────┐
│ AAPL · Daily · Equity     [⋯ ▾] │  ← kebab menu: Run, Compare, Delete, Rename
│ Golden Cross Strategy            │
│ ─────────────────────────────── │
│ +127.4%   1.84   -18.3%  62.5%  │
│ Return   Sharpe  Drwdn   WinRt  │
│ ─────────────────────────────── │
│ [mini equity curve — sparkline]  │
│ ─────────────────────────────── │
│ SMA(50) × SMA(200)               │
│ Exit: RSI > 70                   │
│ ─────────────────────────────── │
│ 2 days ago · 48 trades           │
└──────────────────────────────────┘
```

Sparkline: tiny 80×32px SVG line chart. Hardcoded per card.

State variants to show in static mock:
- Normal card (green metrics)
- Losing strategy card (red total return, different metrics)
- "In Progress" card (with loading spinner overlay)
- Favorited card (star icon filled, yellow)

### Filter Panel (side drawer on click of Filter ▾):
```
Asset Class: [All] [Equity] [Crypto] [Forex]
Timeframe:   [All] [1D] [1H] [15M]
Return:      [All] [Profitable] [Loss-making]
Date Range:  [date picker range]
[Apply Filters] [Reset]
```

### Empty state (no history):
```
[icon: Clock]
"No strategies yet"
"Run your first backtest to see it here."
[Go to Chat →]
```

---

## 7. Screen 5 — Compare Page (`/app/compare`)

### Purpose
Side-by-side comparison of two strategies.

### Layout
Two columns, equal width (50/50 on desktop, stacked on mobile).

### Header
```
Compare Strategies

[Select Strategy A ▾]         vs         [Select Strategy B ▾]
AAPL Golden Cross                         BTC RSI Bounce
```

Dropdowns populate from history (static mock list in Phase 2).

### Comparison Metric Table
```
Metric            Strategy A          Strategy B       Winner
──────────────────────────────────────────────────────────────
Total Return      +127.4%             +89.2%           [A ✓]
Sharpe Ratio       1.84                2.12             [B ✓]
Max Drawdown      -18.3%             -24.1%            [A ✓]
Win Rate           62.5%              58.3%             [A ✓]
Total Trades         48                 91              —
CAGR               23.1%              18.4%            [A ✓]
Profit Factor       2.56               1.98             [A ✓]
```
Winner column: green badge for the better strategy. Neutral `—` when tied/irrelevant.

### Overlaid Equity Curves
Single chart, both strategies plotted:
- Strategy A: brand-400 (purple)
- Strategy B: teal-400
- Buy-and-hold benchmark: gray dashed
- Legend below chart

### Side-by-side Rule Cards
```
Strategy A                    Strategy B
─────────────────────         ─────────────────────
Entry: SMA(50)>SMA(200)       Entry: RSI(14) < 30
Exit: RSI > 70                Exit: RSI > 70
Stop: 2%                      Stop: 3%
```

### Empty state (no strategies selected):
```
[icon: GitCompare]
"Select two strategies to compare"
[Select Strategy A] [Select Strategy B]
```

---

## 8. Screen 6 — Settings Page (`/app/settings`)

### Layout
Max-width 720px, centered in content area. Sectioned form layout.

### Sections

**Default Backtest Parameters:**
```
Default Timeframe      [Dropdown: Daily ▾]
Default Capital ($)    [Input: 10000]
Default Commission (%) [Input: 0.1]
Default Slippage (%)   [Input: 0.05]
Data Source            [Dropdown: Yahoo Finance ▾]
Lookback Period        [Dropdown: 5 Years ▾]
```

**LLM Preferences:**
```
Model                  [Dropdown: Gemini 1.5 Flash ▾]
Response Detail        [Toggle: Concise / Detailed]
Auto-clarify           [Toggle: ON] — ask follow-ups if strategy is incomplete
Show confidence score  [Toggle: ON]
```

**Notifications (future — all disabled):**
```
Email alerts           [Toggle: OFF] [disabled — coming soon]
Backtest complete      [Toggle: OFF] [disabled]
```

**Appearance:**
```
Theme                  Dark (only option, locked — light mode coming)
Accent Color           [Purple ●] [Blue ○] [Teal ○] (only purple active in Phase 2)
Compact mode           [Toggle: OFF]
```

**Danger Zone (red section):**
```
┌─────────────────────────────────────────────────────┐
│ Danger Zone                                         │
│ ─────────────────────────────────────────────────── │
│ Clear all history    [Clear History] — requires confirm modal
│ Reset all settings   [Reset to Defaults]            │
└─────────────────────────────────────────────────────┘
```

**Save button:** sticky at bottom of page, brand primary, shows success toast on click.

---

## 9. Screen 7 — 404 Not Found Page

Full screen, centered:
```
[Large "404" in brand-900 color, very large — 96px font, blurred in bg]
[Heading] "Page not found"
[Subtext] "The strategy you're looking for doesn't exist."
[Button] "← Back to chat"
```

---

## 10. Mobile-Specific Components

### 10.1 Bottom Tab Bar (replaces sidebar on mobile)
```
┌────────────────────────────────────────────┐
│ [Chat] [History] [Compare] [Settings]      │
└────────────────────────────────────────────┘
```
Fixed bottom, 56px tall, bg-surface, border-top.
Active tab: brand-400 icon + label, inactive: text-muted icon only.

### 10.2 Strategy Panel — Bottom Sheet (mobile)
- Triggered by floating "View Strategy" button (bottom-right, brand bg, pulse animation when strategy updates)
- Slides up from bottom, 80vh height, drag handle at top
- Same content as desktop right panel

### 10.3 Mobile Chat Input
- Full-width at bottom above tab bar
- Send button inside the input field (right side)

---

## 11. Animations & Micro-interactions

Define these in `index.css` and use via Tailwind `animate-*` classes:

```css
/* Message appears */
@keyframes messageIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Strategy panel slides in */
@keyframes panelSlide {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* Metric card count-up (CSS only trick — no JS needed in Phase 2) */
/* Just show final value — Phase 3 will add JS count-up animation */

/* Typing dots */
@keyframes typingDot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%           { transform: scale(1.0); opacity: 1.0; }
}

/* Floating button pulse */
@keyframes floatPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(107,99,212,0.4); }
  50%      { box-shadow: 0 0 0 8px rgba(107,99,212,0); }
}

/* Onboarding orb float */
@keyframes orbFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-20px) scale(1.05); }
}
```

**Micro-interaction rules:**
- Every clickable element: transition duration 150ms ease
- Card hover: translateY(-1px), 200ms ease
- Button active: scale(0.97), 100ms
- New message: `messageIn` 250ms ease-out
- Strategy panel first appearance: `panelSlide` 300ms ease-out
- Tab switch in results: crossfade 200ms

---

## 12. Mock Data — `src/data/mockData.js`

Create this file with all static data used across screens:

```js
export const MOCK_STRATEGIES = [
  {
    id: "mock-1",
    name: "AAPL Golden Cross",
    ticker: "AAPL",
    timeframe: "1d",
    asset_class: "equity",
    entry_rules: [
      { indicator: "SMA", condition: "crosses_above", value: "SMA_200",
        params: { period: 50 }, logic_operator: "NONE" }
    ],
    exit_rules: [
      { indicator: "RSI", condition: "greater_than", value: 70,
        params: { period: 14 }, logic_operator: "NONE" }
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
      { indicator: "RSI", condition: "less_than", value: 30,
        params: { period: 14 }, logic_operator: "NONE" }
    ],
    exit_rules: [
      { indicator: "RSI", condition: "greater_than", value: 70,
        params: { period: 14 }, logic_operator: "NONE" }
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
      { indicator: "MACD", condition: "crosses_above", value: "SIGNAL",
        params: { fast_period: 12, slow_period: 26, signal_period: 9 }, logic_operator: "NONE" }
    ],
    exit_rules: [
      { indicator: "MACD", condition: "crosses_below", value: "SIGNAL",
        params: { fast_period: 12, slow_period: 26, signal_period: 9 }, logic_operator: "NONE" }
    ],
    stop_loss_pct: 3.0,
    take_profit_pct: 9.0,
    position_size: 1.0,
    confidence_score: 0.91,
  },
]

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
    // Equity curve: [{ date: "2020-01-02", value: 10000 }, ...]
    equity_curve: generateMockEquityCurve(10000, 127.4, "2020-01-02", "2024-12-31"),
    // Monthly returns matrix — hardcode a realistic 5×12 grid
    monthly_returns: {
      2020: [-2.1, 0.4, -12.3, 15.2, 8.1, 1.2, 7.3, 4.8, -3.2, 0.1, 11.2, 6.4],
      2021: [3.2, 5.1, 4.8, -2.1, 0.8, 4.3, 1.2, 5.8, -4.1, 7.2, 0.3, 5.8],
      2022: [-7.2, -3.4, -4.1, -8.3, -6.2, -2.8, 8.1, -4.5, -9.1, 11.2, -3.1, 2.8],
      2023: [7.1, 0.3, -2.1, 5.2, 8.8, 6.7, 3.2, 0.5, -3.8, -2.1, 9.1, 4.8],
      2024: [3.8, 5.2, 0.4, -3.1, 7.8, 4.1, 0.8, -2.3, 1.4, 4.5, 0.0, 0.0],
    },
    trades: generateMockTrades(48),
  }
}

export const MOCK_CHAT_MESSAGES = [
  {
    id: 1, role: "agent",
    content: "Hi! I'm **TriVectorAI**. Describe any trading strategy in plain English and I'll parse it into structured rules ready for backtesting.\n\nTry: *\"Buy AAPL when the 50-day SMA crosses above the 200-day SMA\"*",
    timestamp: new Date().toISOString(),
  }
]

export const EXAMPLE_STRATEGIES = [
  "Buy AAPL when 50 SMA crosses above 200 SMA, sell when RSI exceeds 70",
  "RSI oversold bounce on BTC — buy below 30, sell above 70 with 5% stop loss",
  "MACD crossover on TSLA hourly chart with 3% stop loss and 9% target",
  "Golden cross strategy on SPY with 2% trailing stop",
  "Bollinger Band breakout on ETH — buy when price closes above upper band",
]

// Helper to generate realistic-looking equity curve data points
function generateMockEquityCurve(startVal, totalReturnPct, startDate, endDate) {
  // Return array of { date, value, benchmark } objects
  // Hardcode ~60 monthly data points with a realistic upward trend + drawdowns
  // ... (implement as simple array, no need for perfect math)
}

function generateMockTrades(count) {
  // Return array of hardcoded trade objects
  // Mix of winning and losing trades
  // Each: { id, date_in, date_out, entry_price, exit_price, pnl_usd, return_pct, hold_days }
}
```

---

## 13. File Structure for Phase 2

```
frontend/src/
├── main.jsx
├── App.jsx                        # Router setup
├── data/
│   └── mockData.js                # All mock data (Section 12)
├── store/
│   └── useStrategyStore.js        # Zustand (chat, strategy, ui state)
├── api/
│   └── strategyApi.js             # Stubbed — returns mock data, not real API
├── hooks/
│   ├── useLocalStorage.js         # For persisting history mock
│   └── useMediaQuery.js           # For responsive breakpoints
├── components/
│   ├── ui/                        # All primitives (Section 2.6)
│   │   ├── Badge.jsx
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Input.jsx
│   │   ├── Tooltip.jsx
│   │   ├── Spinner.jsx
│   │   ├── Divider.jsx
│   │   ├── EmptyState.jsx
│   │   ├── Modal.jsx
│   │   └── Toast.jsx
│   ├── layout/
│   │   ├── MainLayout.jsx         # Sidebar + Header + content wrapper
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   └── BottomTabBar.jsx       # Mobile only
│   ├── chat/
│   │   ├── ChatWindow.jsx
│   │   ├── ChatMessage.jsx
│   │   ├── ChatInput.jsx
│   │   ├── TypingIndicator.jsx
│   │   ├── ConfirmationCard.jsx   # 4.3a
│   │   └── ClarificationCard.jsx  # 4.3b
│   ├── strategy/
│   │   ├── StrategyPanel.jsx      # Right panel
│   │   ├── RuleCard.jsx
│   │   ├── MissingFieldAlert.jsx
│   │   ├── StrategyBadge.jsx
│   │   ├── ConfidenceBar.jsx
│   │   └── JsonViewer.jsx         # Raw JSON expandable view
│   ├── results/
│   │   ├── MetricCard.jsx
│   │   ├── MetricsStrip.jsx
│   │   ├── EquityCurveChart.jsx   # Static SVG chart
│   │   ├── DrawdownChart.jsx      # Static SVG chart
│   │   ├── TradeLogTable.jsx
│   │   ├── MonthlyHeatmap.jsx
│   │   ├── AdditionalMetrics.jsx
│   │   └── AIInsightPanel.jsx
│   ├── history/
│   │   ├── HistoryCard.jsx
│   │   ├── HistoryGrid.jsx
│   │   └── FilterDrawer.jsx
│   └── compare/
│       ├── CompareMetricTable.jsx
│       └── OverlaidChart.jsx
└── pages/
    ├── OnboardingPage.jsx
    ├── ChatPage.jsx
    ├── ResultsPage.jsx
    ├── HistoryPage.jsx
    ├── ComparePage.jsx
    ├── SettingsPage.jsx
    └── NotFoundPage.jsx
```

---

## 14. `strategyApi.js` — Stubbed for Phase 2

```js
// In Phase 2, this returns mock data with a simulated delay.
// In Phase 3, replace the implementations with real axios calls.

import { MOCK_STRATEGIES, MOCK_RESULTS, MOCK_CHAT_MESSAGES } from "../data/mockData"

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const parseStrategy = async (message, history = []) => {
  await delay(1800)  // simulate LLM latency
  
  // Simple keyword matching to return different mock responses
  const lower = message.toLowerCase()
  
  if (lower.includes("golden cross") || (lower.includes("50") && lower.includes("200"))) {
    return {
      status: "ok",
      strategy: MOCK_STRATEGIES[0],
      agent_message: "Strategy parsed successfully for **AAPL** on daily chart.\n\nEntry: SMA(50) crosses above SMA(200)\nExit: RSI(14) > 70\nStop loss: 2%\n\nReady to run backtest!",
      missing_fields: [],
    }
  }
  
  if (lower.includes("rsi") && lower.includes("btc")) {
    return {
      status: "ok",
      strategy: MOCK_STRATEGIES[1],
      agent_message: "Parsed RSI bounce strategy for **BTCUSDT**.\n\nEntry: RSI(14) < 30 (oversold)\nExit: RSI(14) > 70 (overbought)\nStop: 5%, Target: 15%\n\nReady to backtest!",
      missing_fields: [],
    }
  }
  
  if (lower.includes("macd")) {
    return {
      status: "ok",
      strategy: MOCK_STRATEGIES[2],
      agent_message: "MACD crossover strategy parsed for **TSLA** on 1h chart.\n\nEntry: MACD crosses above signal line\nExit: MACD crosses below signal line\nStop: 3%, Target: 9%",
      missing_fields: [],
    }
  }
  
  // Default: clarification needed (no ticker)
  return {
    status: "needs_clarification",
    strategy: { ...MOCK_STRATEGIES[0], ticker: null },
    agent_message: "Got it! Just need a couple more details:\n\n  · **Which asset?** (e.g. AAPL, BTCUSDT, EURUSD)\n  · **What timeframe?** (daily, hourly, etc.)\n\nWhat I parsed so far:\n  ✓ Entry condition understood\n  · Exit condition: not specified yet",
    missing_fields: ["ticker", "timeframe"],
  }
}

export const getResults = async (strategyId) => {
  await delay(2200)
  return MOCK_RESULTS[strategyId] || MOCK_RESULTS["mock-1"]
}

export const getHistory = async () => {
  await delay(400)
  return MOCK_STRATEGIES.map((s, i) => ({
    ...s,
    results: MOCK_RESULTS["mock-1"],  // same results for all in mock
    created_at: new Date(Date.now() - i * 86400000 * 2).toISOString(),
    favorited: i === 0,
  }))
}
```

---

## 15. Definition of Done — Phase 2

All of these must be true before Phase 2 is complete:

- [ ] All 7 routes render without console errors
- [ ] Onboarding flow works (3 steps, example click pre-fills chat)
- [ ] Chat page: empty state, conversation state, all message types render
- [ ] Typing indicator appears during the 1.8s mock delay
- [ ] Strategy panel populates after parse (all 3 mock strategies work)
- [ ] Raw JSON toggle works (expands/collapses, copy button copies)
- [ ] "Run Backtest" navigates to `/app/results/mock-1`
- [ ] Results page: all 6 metric cards, equity curve SVG, trade log with pagination, monthly heatmap, AI insight panel
- [ ] History page: 3 history cards, filter drawer opens/closes, sort works
- [ ] Compare page: both dropdowns work with mock list, metric table renders
- [ ] Settings page: all toggles toggle, save shows success toast, danger zone confirm modal
- [ ] 404 page renders on unknown routes
- [ ] Mobile layout tested at 375px: bottom tabs, bottom sheet strategy panel, stacked layouts
- [ ] Tablet layout tested at 768px: collapsed sidebar icon rail
- [ ] All animations play (message slide-in, panel slide, typing dots)
- [ ] No hardcoded pixel values in JSX — use Tailwind classes only
- [ ] No `console.log` left in code
- [ ] All `TODO` and `placeholder` comments removed
