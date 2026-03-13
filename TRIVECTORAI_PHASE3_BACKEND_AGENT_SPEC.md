# TriVectorAI — Phase 3: Backend + AI Agent Specification
## Complete Implementation Guide — Backend, Agentic Parser, Backtest Engine

> **For the Code Agent — Critical Instructions:**
> - Phase 2 frontend is already built with a stubbed `strategyApi.js` using mock data.
> - Phase 3 replaces those stubs with real FastAPI endpoints.
> - The AI agent uses Google Gemini's **function calling** (tool use) feature — NOT simple prompt→JSON.
> - Read every section fully before writing code. The agent architecture in Section 4 is the most important part.
> - Do NOT use LangChain or any agent framework. Implement the ReAct loop manually — it's only ~150 lines and gives full control.

---

## 1. What "Agentic" Means Here — Read This First

### Regular LLM call (what NOT to build):
```
User message → LLM → JSON output → done
```
This breaks when: ticker is missing, indicator params are ambiguous, user says something like
"use the same strategy as before but for crypto" — a one-shot parser cannot handle context.

### Agentic approach (what TO build):
```
User message → Agent REASONS → calls a TOOL → observes result → REASONS again → loops until done
```

The agent has **5 tools** it can call. It decides which tool to call based on what it knows.
The LLM is the brain. The tools are its hands. The loop is its work ethic.

### The ReAct Pattern (Reason → Act → Observe):
Every agent turn looks like this internally:
```
Thought:     "User described a golden cross. I have ticker=AAPL but no exit rule."
Action:      validate_strategy(parsed={...})
Observation: {"missing_fields": ["exit_rules"], "confidence": 0.7}
Thought:     "I need to ask for exit conditions before proceeding."
Action:      ask_clarification(question="What should trigger a sell?")
```
This continues until the agent either has everything needed to run a backtest, or returns a clarification to the user.

---

## 2. Complete File Structure

```
backend/
├── main.py                          # FastAPI app, CORS, router registration
├── .env.example                     # GEMINI_API_KEY=your_key_here
├── requirements.txt
│
├── routes/
│   ├── strategy.py                  # POST /api/parse-strategy
│   ├── backtest.py                  # POST /api/run-backtest
│   ├── history.py                   # GET/DELETE /api/history
│   └── health.py                    # GET /api/health
│
├── agent/
│   ├── __init__.py
│   ├── strategy_agent.py            # THE CORE — ReAct loop, tool calling, memory
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── parse_tool.py            # Tool 1: parse natural language → structured rules
│   │   ├── validate_tool.py         # Tool 2: validate completeness + correctness
│   │   ├── clarify_tool.py          # Tool 3: generate clarification question
│   │   ├── backtest_tool.py         # Tool 4: run backtest (calls engine)
│   │   └── narrate_tool.py          # Tool 5: explain results in plain English
│   ├── tool_registry.py             # Maps tool names → functions + Gemini schema
│   └── memory.py                    # Conversation history management
│
├── engine/
│   ├── __init__.py
│   ├── data_fetcher.py              # yfinance wrapper with caching
│   ├── indicator_builder.py         # pandas-ta: compute all indicators
│   ├── signal_builder.py            # JSON rules → boolean numpy arrays
│   ├── backtest_runner.py           # vectorbt simulation + metric extraction
│   └── result_formatter.py          # Convert vectorbt output → clean API response
│
├── models/
│   ├── __init__.py
│   ├── strategy_schema.py           # Pydantic: ParsedStrategy, TradingRule, etc.
│   ├── backtest_schema.py           # Pydantic: BacktestResult, Trade, Metrics
│   └── api_schema.py                # Pydantic: all request/response models
│
├── database/
│   ├── __init__.py
│   ├── db.py                        # SQLite connection, table creation
│   └── repository.py                # save/load strategies and results
│
└── prompts/
    ├── strategy_agent_system.txt    # Main agent system prompt
    ├── parse_tool_prompt.txt        # Focused prompt for parse tool
    └── narrate_tool_prompt.txt      # Focused prompt for narration tool
```

---

## 3. Requirements

### `requirements.txt`
```
# Web framework
fastapi==0.110.0
uvicorn[standard]==0.29.0

# Validation
pydantic==2.7.0
python-dotenv==1.0.1

# AI / LLM
google-generativeai==0.5.4

# Market data
yfinance==0.2.40
pandas==2.2.2

# Technical indicators
pandas-ta==0.3.14b0

# Backtest engine
vectorbt==0.26.1
numpy==1.26.4

# Utilities
httpx==0.27.0
```

---

## 4. Pydantic Models (Define First — Everything Uses These)

### `models/strategy_schema.py`
```python
from pydantic import BaseModel, Field
from typing import Optional, Literal, Union
from enum import Enum

class IndicatorType(str, Enum):
    SMA = "SMA"; EMA = "EMA"; RSI = "RSI"; MACD = "MACD"
    BBANDS = "BBANDS"; PRICE = "PRICE"; VOLUME = "VOLUME"
    STOCH = "STOCH"; ATR = "ATR"; VWAP = "VWAP"

class ConditionType(str, Enum):
    CROSSES_ABOVE = "crosses_above"; CROSSES_BELOW = "crosses_below"
    GREATER_THAN = "greater_than";  LESS_THAN = "less_than"
    EQUALS = "equals";              BETWEEN = "between"

class IndicatorParams(BaseModel):
    period:        Optional[int]   = None
    fast_period:   Optional[int]   = None
    slow_period:   Optional[int]   = None
    signal_period: Optional[int]   = None
    std_dev:       Optional[float] = None

class TradingRule(BaseModel):
    indicator:      IndicatorType
    condition:      ConditionType
    value:          Union[float, str, None] = None  # number OR "SMA_200" etc.
    params:         IndicatorParams = Field(default_factory=IndicatorParams)
    logic_operator: Literal["AND", "OR", "NONE"] = "NONE"

class ParsedStrategy(BaseModel):
    ticker:           Optional[str]  = None
    timeframe:        Literal["1m","5m","15m","30m","1h","4h","1d","1w"] = "1d"
    asset_class:      Optional[Literal["equity","crypto","forex","commodity"]] = None
    entry_rules:      list[TradingRule] = []
    exit_rules:       list[TradingRule] = []
    position_size:    float = 1.0
    stop_loss_pct:    Optional[float] = None
    take_profit_pct:  Optional[float] = None
    short_allowed:    bool  = False
    missing_fields:   list[str] = []
    confidence_score: float = 1.0
    raw_input:        str   = ""
```

### `models/backtest_schema.py`
```python
from pydantic import BaseModel
from typing import Optional

class Trade(BaseModel):
    id:           int
    date_in:      str
    date_out:     str
    entry_price:  float
    exit_price:   float
    pnl_usd:      float
    return_pct:   float
    hold_days:    int
    side:         str = "long"  # long or short

class BacktestMetrics(BaseModel):
    total_return_pct:  float
    cagr_pct:          float
    sharpe_ratio:      float
    max_drawdown_pct:  float
    win_rate_pct:      float
    total_trades:      int
    avg_win_pct:       float
    avg_loss_pct:      float
    largest_win_pct:   float
    largest_loss_pct:  float
    profit_factor:     float
    expectancy_usd:    float

class EquityPoint(BaseModel):
    date:       str
    value:      float
    benchmark:  float

class BacktestResult(BaseModel):
    strategy_id:   str
    strategy:      "ParsedStrategy"  # forward ref
    metrics:       BacktestMetrics
    equity_curve:  list[EquityPoint]
    monthly_returns: dict            # {year: [jan..dec]}
    trades:        list[Trade]
    ai_narrative:  Optional[str] = None
    data_period:   str               # e.g. "2019-01-02 to 2024-12-31"
    ticker_used:   str
```

### `models/api_schema.py`
```python
from pydantic import BaseModel
from typing import Optional, Literal

class ParseRequest(BaseModel):
    message:              str
    conversation_history: list[dict] = []  # [{role, content}, ...]
    session_id:           Optional[str] = None

class ParseResponse(BaseModel):
    status:         Literal["ok", "needs_clarification", "running", "error"]
    strategy:       Optional[dict] = None
    agent_message:  str = ""
    missing_fields: list[str] = []
    session_id:     Optional[str] = None

class BacktestRequest(BaseModel):
    strategy:    dict          # ParsedStrategy as dict
    session_id:  Optional[str] = None

class BacktestResponse(BaseModel):
    status:   Literal["ok", "error"]
    result:   Optional[dict] = None
    message:  str = ""
```

---

## 5. The AI Agent — Core Implementation

### 5.1 Tool Registry — `agent/tool_registry.py`

This defines the 5 tools in Gemini's function calling format.
Gemini reads these schemas and decides which function to call.

```python
# Tool definitions in Gemini function calling format.
# The LLM reads the name + description + parameters to decide when and how to call each tool.

TOOL_DEFINITIONS = [
    {
        "name": "parse_strategy",
        "description": (
            "Parse a plain English trading strategy description into structured JSON rules. "
            "Call this first when the user describes any trading strategy. "
            "Handles: moving averages, RSI, MACD, Bollinger Bands, crossovers, breakouts, "
            "common shorthands like 'golden cross', 'death cross', 'RSI oversold'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The raw user message or strategy description to parse"
                },
                "context": {
                    "type": "string",
                    "description": "Any prior context from the conversation that helps resolve ambiguities"
                }
            },
            "required": ["text"]
        }
    },
    {
        "name": "validate_strategy",
        "description": (
            "Validate a parsed strategy for completeness and correctness. "
            "Checks: ticker present, entry_rules non-empty, indicator params valid, "
            "no conflicting rules. Returns list of missing or invalid fields. "
            "Call this AFTER parse_strategy, BEFORE asking the user anything."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "strategy": {
                    "type": "object",
                    "description": "The parsed strategy dict from parse_strategy"
                }
            },
            "required": ["strategy"]
        }
    },
    {
        "name": "ask_clarification",
        "description": (
            "Generate a clear, friendly clarification question to ask the user "
            "when required fields are missing. Only call this when validate_strategy "
            "returns missing fields that cannot be inferred. "
            "NEVER ask for exit_rules — they are optional. "
            "ALWAYS ask for: ticker (if missing), timeframe (if missing and cannot default)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "missing_fields": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of field names that are missing"
                },
                "partial_strategy": {
                    "type": "object",
                    "description": "What was successfully parsed so far"
                }
            },
            "required": ["missing_fields", "partial_strategy"]
        }
    },
    {
        "name": "run_backtest",
        "description": (
            "Execute a full historical backtest for a complete, validated strategy. "
            "Only call this when validate_strategy confirms no critical fields are missing. "
            "Critical fields = ticker + entry_rules. Everything else has defaults. "
            "Returns full performance metrics, equity curve, and trade log."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "strategy": {
                    "type": "object",
                    "description": "The complete validated strategy dict"
                }
            },
            "required": ["strategy"]
        }
    },
    {
        "name": "narrate_results",
        "description": (
            "Generate a plain English explanation of backtest results. "
            "Call this AFTER run_backtest succeeds. "
            "Explains: what worked, what didn't, when the strategy struggled, "
            "what the Sharpe ratio and drawdown mean in plain terms, "
            "and one actionable suggestion for improvement."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "metrics":   {"type": "object", "description": "BacktestMetrics dict"},
                "strategy":  {"type": "object", "description": "The strategy that was tested"},
                "trades":    {"type": "array",  "description": "List of individual trades"}
            },
            "required": ["metrics", "strategy"]
        }
    }
]
```

### 5.2 Memory — `agent/memory.py`

```python
from dataclasses import dataclass, field
from typing import Optional
import uuid

@dataclass
class AgentMemory:
    """
    Holds all state for one user session.
    Passed into every agent turn — agent updates it, caller persists it.
    """
    session_id:           str = field(default_factory=lambda: str(uuid.uuid4()))
    conversation_history: list[dict] = field(default_factory=list)
    current_strategy:     Optional[dict] = None   # last successfully parsed strategy
    last_backtest_result: Optional[dict] = None   # last successful backtest
    clarification_count:  int = 0                 # how many times we've asked for clarification
    MAX_CLARIFICATIONS = 3                        # stop asking after this many

    def add_user_message(self, content: str):
        self.conversation_history.append({"role": "user", "content": content})

    def add_agent_message(self, content: str):
        self.conversation_history.append({"role": "model", "content": content})

    def get_gemini_history(self) -> list[dict]:
        """Format history for Gemini API turns."""
        return [
            {"role": h["role"], "parts": [{"text": h["content"]}]}
            for h in self.conversation_history
        ]

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "conversation_history": self.conversation_history,
            "current_strategy": self.current_strategy,
            "clarification_count": self.clarification_count,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "AgentMemory":
        m = cls(session_id=d.get("session_id", str(uuid.uuid4())))
        m.conversation_history = d.get("conversation_history", [])
        m.current_strategy     = d.get("current_strategy")
        m.clarification_count  = d.get("clarification_count", 0)
        return m
```

### 5.3 Strategy Agent — `agent/strategy_agent.py`

This is the heart of the system. Read every comment.

```python
import os
import json
from pathlib import Path
import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

from .tool_registry import TOOL_DEFINITIONS
from .memory import AgentMemory
from .tools.parse_tool    import execute_parse_tool
from .tools.validate_tool import execute_validate_tool
from .tools.clarify_tool  import execute_clarify_tool
from .tools.backtest_tool import execute_backtest_tool
from .tools.narrate_tool  import execute_narrate_tool
from models.api_schema import ParseResponse

# Map tool names to their implementation functions
TOOL_EXECUTORS = {
    "parse_strategy":    execute_parse_tool,
    "validate_strategy": execute_validate_tool,
    "ask_clarification": execute_clarify_tool,
    "run_backtest":      execute_backtest_tool,
    "narrate_results":   execute_narrate_tool,
}

SYSTEM_PROMPT = Path(__file__).parent.parent / "prompts" / "strategy_agent_system.txt"

def _build_gemini_tools():
    """Convert our tool definitions into Gemini FunctionDeclaration objects."""
    declarations = []
    for t in TOOL_DEFINITIONS:
        declarations.append(
            FunctionDeclaration(
                name=t["name"],
                description=t["description"],
                parameters=t["parameters"]
            )
        )
    return [Tool(function_declarations=declarations)]

def run_agent(user_message: str, memory: AgentMemory) -> ParseResponse:
    """
    Main agent entry point. Implements the ReAct loop.
    
    The loop:
    1. Send user message + conversation history to Gemini
    2. Gemini either returns text (done) or a tool call (keep looping)
    3. If tool call: execute the tool, feed result back to Gemini
    4. Repeat until Gemini returns plain text (the final response to the user)
    5. Max 8 iterations to prevent infinite loops
    
    Returns ParseResponse for the API layer.
    """
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=SYSTEM_PROMPT.read_text(),
        tools=_build_gemini_tools(),
        generation_config=genai.GenerationConfig(temperature=0.1)
    )
    
    # Add user message to memory
    memory.add_user_message(user_message)
    
    # Start a chat session with full history
    chat = model.start_chat(history=memory.get_gemini_history()[:-1])  # exclude last user msg
    
    # State accumulated during this agent turn
    parsed_strategy = memory.current_strategy  # carry over from prior turns
    backtest_result = None
    final_response  = None
    status          = "ok"
    missing_fields  = []
    
    MAX_ITERATIONS = 8
    
    for iteration in range(MAX_ITERATIONS):
        # Step 1: Send to Gemini
        # First iteration: send user message. Later: send tool result.
        if iteration == 0:
            response = chat.send_message(user_message)
        # (subsequent iterations handled inside the loop after tool execution)
        
        # Step 2: Check what Gemini wants to do
        candidate = response.candidates[0]
        
        # CASE A: Gemini returned plain text → agent is done, this is the user-facing reply
        if candidate.content.parts[0].text if hasattr(candidate.content.parts[0], 'text') else None:
            final_response = candidate.content.parts[0].text
            break
        
        # CASE B: Gemini wants to call a tool
        function_call = None
        for part in candidate.content.parts:
            if hasattr(part, 'function_call') and part.function_call:
                function_call = part.function_call
                break
        
        if not function_call:
            # No tool call AND no text — something went wrong, use fallback
            final_response = "I had trouble processing that. Could you rephrase your strategy?"
            status = "error"
            break
        
        tool_name = function_call.name
        tool_args = dict(function_call.args)
        
        # Step 3: Execute the tool
        try:
            tool_result = TOOL_EXECUTORS[tool_name](**tool_args)
        except Exception as e:
            tool_result = {"error": str(e), "success": False}
        
        # Step 4: Update state based on which tool ran
        if tool_name == "parse_strategy" and tool_result.get("success"):
            parsed_strategy = tool_result.get("strategy")
            memory.current_strategy = parsed_strategy

        elif tool_name == "validate_strategy":
            missing_fields = tool_result.get("missing_fields", [])
        
        elif tool_name == "ask_clarification":
            # Agent wants to ask the user something — return this to the user now
            memory.clarification_count += 1
            memory.add_agent_message(tool_result.get("question", ""))
            return ParseResponse(
                status="needs_clarification",
                strategy=parsed_strategy,
                agent_message=tool_result.get("question", ""),
                missing_fields=missing_fields,
                session_id=memory.session_id
            )
        
        elif tool_name == "run_backtest" and tool_result.get("success"):
            backtest_result = tool_result.get("result")
        
        elif tool_name == "narrate_results" and tool_result.get("success"):
            if backtest_result:
                backtest_result["ai_narrative"] = tool_result.get("narrative")
        
        # Step 5: Feed tool result back to Gemini and loop
        response = chat.send_message(
            genai.protos.Part(
                function_response=genai.protos.FunctionResponse(
                    name=tool_name,
                    response={"result": json.dumps(tool_result, default=str)}
                )
            )
        )
    
    # Agent finished — build the response
    memory.add_agent_message(final_response or "")
    
    if backtest_result:
        return ParseResponse(
            status="ok",
            strategy=parsed_strategy,
            agent_message=final_response or "Backtest complete!",
            missing_fields=[],
            session_id=memory.session_id
        )
    
    if parsed_strategy and not missing_fields:
        return ParseResponse(
            status="ok",
            strategy=parsed_strategy,
            agent_message=final_response or "Strategy parsed successfully.",
            missing_fields=[],
            session_id=memory.session_id
        )
    
    return ParseResponse(
        status="needs_clarification" if missing_fields else status,
        strategy=parsed_strategy,
        agent_message=final_response or "Could you tell me more about your strategy?",
        missing_fields=missing_fields,
        session_id=memory.session_id
    )
```

---

## 6. The 5 Tool Implementations

### Tool 1 — `agent/tools/parse_tool.py` (Strategy Parser)

This is the NLP core. Uses a dedicated Gemini call with strict JSON output.

```python
import os, json, re
from pathlib import Path
import google.generativeai as genai

PARSE_SYSTEM_PROMPT = """
You are a trading strategy parser. Convert natural language into a structured JSON object.
Output ONLY valid JSON — no preamble, no markdown, no explanation.

OUTPUT SCHEMA:
{
  "ticker":          string or null,
  "timeframe":       "1m"|"5m"|"15m"|"30m"|"1h"|"4h"|"1d"|"1w",
  "asset_class":     "equity"|"crypto"|"forex"|"commodity"|null,
  "entry_rules": [{
    "indicator":      "SMA"|"EMA"|"RSI"|"MACD"|"BBANDS"|"PRICE"|"VOLUME"|"ATR"|"STOCH"|"VWAP",
    "condition":      "crosses_above"|"crosses_below"|"greater_than"|"less_than"|"equals"|"between",
    "value":          number or "SMA_200" or null,
    "params":         {"period": int, "fast_period": int, "slow_period": int, "signal_period": int},
    "logic_operator": "AND"|"OR"|"NONE"
  }],
  "exit_rules":      [...same structure as entry_rules...],
  "position_size":   float (0.01-1.0),
  "stop_loss_pct":   float or null,
  "take_profit_pct": float or null,
  "short_allowed":   boolean,
  "missing_fields":  [list of fields that are null or uncertain],
  "confidence_score": float 0.0-1.0
}

INDICATOR DEFAULTS (use when period not specified):
SMA/EMA:     period required — infer from text
RSI:         period=14, overbought=70, oversold=30
MACD:        fast=12, slow=26, signal=9
BBANDS:      period=20, std_dev=2.0
Stochastic:  k=14, d=3
ATR:         period=14

PHRASE MAPPINGS (memorise these):
"golden cross"              → entry: SMA(50) crosses_above SMA(200)
"death cross"               → entry: SMA(50) crosses_below SMA(200)
"RSI overbought"            → RSI(14) greater_than 70
"RSI oversold"              → RSI(14) less_than 30
"MACD crossover"            → MACD line crosses_above signal line
"price breaks above"        → PRICE crosses_above [value]
"Bollinger upper band"      → BBANDS upper band touch
"stop loss X%"              → stop_loss_pct: X
"take profit X%"            → take_profit_pct: X
"daily"/"1D"                → timeframe: "1d"
"hourly"/"1H"               → timeframe: "1h"
"AND both conditions"       → logic_operator: "AND" on second rule
"""

def execute_parse_tool(text: str, context: str = "") -> dict:
    """
    Parse natural language strategy text into structured JSON.
    Returns {"success": True, "strategy": {...}} or {"success": False, "error": "..."}
    """
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=PARSE_SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.05,
            max_output_tokens=1024,
        )
    )
    
    prompt = text
    if context:
        prompt = f"Context from conversation: {context}\n\nStrategy to parse: {text}"
    
    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Strip markdown fences if model adds them
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)
        parsed["raw_input"] = text
        return {"success": True, "strategy": parsed}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"JSON parse failed: {e}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### Tool 2 — `agent/tools/validate_tool.py`

```python
REQUIRED_FIELDS    = ["ticker", "entry_rules"]
OPTIONAL_FIELDS    = ["exit_rules", "stop_loss_pct", "take_profit_pct", "timeframe"]
VALID_INDICATORS   = {"SMA","EMA","RSI","MACD","BBANDS","PRICE","VOLUME","ATR","STOCH","VWAP"}
VALID_CONDITIONS   = {"crosses_above","crosses_below","greater_than","less_than","equals","between"}

def execute_validate_tool(strategy: dict) -> dict:
    """
    Check strategy completeness and field validity.
    Returns {"valid": bool, "missing_fields": [...], "issues": [...]}
    """
    missing = []
    issues  = []
    
    # Check required fields
    if not strategy.get("ticker"):
        missing.append("ticker")
    if not strategy.get("entry_rules"):
        missing.append("entry_rules")
    
    # Validate each rule's indicator and condition names
    for i, rule in enumerate(strategy.get("entry_rules", [])):
        if rule.get("indicator") not in VALID_INDICATORS:
            issues.append(f"entry_rules[{i}]: unknown indicator '{rule.get('indicator')}'")
        if rule.get("condition") not in VALID_CONDITIONS:
            issues.append(f"entry_rules[{i}]: unknown condition '{rule.get('condition')}'")
    
    # Check for indicator params where required
    for i, rule in enumerate(strategy.get("entry_rules", [])):
        ind = rule.get("indicator")
        params = rule.get("params", {})
        if ind in ("SMA", "EMA") and not params.get("period"):
            issues.append(f"entry_rules[{i}]: {ind} requires a period (e.g. SMA(50))")
    
    # Validate position size range
    pos = strategy.get("position_size", 1.0)
    if not (0.01 <= pos <= 1.0):
        issues.append(f"position_size {pos} must be between 0.01 and 1.0")
    
    return {
        "valid":          len(missing) == 0 and len(issues) == 0,
        "missing_fields": missing,
        "issues":         issues,
        "can_run":        len(missing) == 0  # can run backtest if no REQUIRED fields missing
    }
```

### Tool 3 — `agent/tools/clarify_tool.py`

```python
FIELD_QUESTIONS = {
    "ticker":      "Which stock, crypto, or asset would you like to test this on? (e.g. AAPL, BTCUSDT, EURUSD)",
    "entry_rules": "What's your entry condition — when should the strategy BUY? (e.g. when RSI drops below 30)",
    "timeframe":   "What chart timeframe? (e.g. daily, hourly, 15-minute)",
}

def execute_clarify_tool(missing_fields: list, partial_strategy: dict) -> dict:
    """
    Generate a friendly, specific clarification question.
    Asks about the most important missing field only (not all at once).
    """
    # Prioritise: ticker first, then entry_rules, then timeframe
    priority_order = ["ticker", "entry_rules", "timeframe"]
    ask_about = None
    for field in priority_order:
        if field in missing_fields:
            ask_about = field
            break
    if not ask_about and missing_fields:
        ask_about = missing_fields[0]
    
    if not ask_about:
        return {"question": "Could you provide more details about your strategy?"}
    
    # Build context showing what was already understood
    understood = []
    if partial_strategy.get("ticker"):
        understood.append(f"Asset: {partial_strategy['ticker']}")
    if partial_strategy.get("entry_rules"):
        rules = partial_strategy["entry_rules"]
        rule_strs = [f"{r['indicator']}({r.get('params',{}).get('period','')}) {r['condition']} {r.get('value','')}" for r in rules]
        understood.append(f"Entry: {', '.join(rule_strs)}")
    if partial_strategy.get("timeframe"):
        understood.append(f"Timeframe: {partial_strategy['timeframe']}")
    
    understood_text = ""
    if understood:
        understood_text = "\n\nWhat I understood so far:\n" + "\n".join(f"  ✓ {u}" for u in understood)
    
    question = f"{FIELD_QUESTIONS.get(ask_about, f'Could you clarify: {ask_about}?')}{understood_text}"
    
    return {"question": question, "asking_about": ask_about}
```

### Tool 4 — `agent/tools/backtest_tool.py`

```python
from engine.data_fetcher      import fetch_ohlcv
from engine.indicator_builder import compute_indicators
from engine.signal_builder    import build_signals
from engine.backtest_runner   import run_backtest
from engine.result_formatter  import format_result

def execute_backtest_tool(strategy: dict) -> dict:
    """
    Full backtest pipeline:
    1. Fetch historical OHLCV data (yfinance)
    2. Compute all required indicators (pandas-ta)
    3. Convert JSON rules → boolean signal arrays (custom)
    4. Simulate with vectorbt
    5. Format and return results
    """
    try:
        ticker    = strategy.get("ticker", "").upper()
        timeframe = strategy.get("timeframe", "1d")
        
        # Step 1: Fetch data
        df = fetch_ohlcv(ticker=ticker, period="5y", interval=timeframe)
        if df is None or len(df) < 50:
            return {"success": False, "error": f"Insufficient data for {ticker}"}
        
        # Step 2: Compute indicators
        df = compute_indicators(df, strategy)
        
        # Step 3: Build entry/exit signal arrays
        entry_signals, exit_signals = build_signals(df, strategy)
        
        # Step 4: Run backtest
        portfolio = run_backtest(
            df             = df,
            entry_signals  = entry_signals,
            exit_signals   = exit_signals,
            init_cash      = 10_000,
            fees           = 0.001,   # 0.1% commission
            slippage       = 0.0005,  # 0.05% slippage
            size           = strategy.get("position_size", 1.0)
        )
        
        # Step 5: Format results
        result = format_result(portfolio, df, strategy)
        return {"success": True, "result": result}
    
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### Tool 5 — `agent/tools/narrate_tool.py`

```python
import os
import google.generativeai as genai

NARRATE_SYSTEM = """
You are a quantitative trading analyst explaining backtest results to a non-technical trader.
Be direct, specific, and use the actual numbers from the results.
Structure: (1) Overall verdict in one sentence, (2) What worked and when,
(3) What didn't work and why, (4) One specific, actionable improvement suggestion.
Keep it under 200 words. No bullet points — flowing paragraphs only.
"""

def execute_narrate_tool(metrics: dict, strategy: dict, trades: list = None) -> dict:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=NARRATE_SYSTEM,
        generation_config=genai.GenerationConfig(temperature=0.4, max_output_tokens=400)
    )
    
    prompt = f"""
Strategy: {strategy.get('ticker')} on {strategy.get('timeframe')} chart
Entry: {strategy.get('entry_rules')}
Exit: {strategy.get('exit_rules')}

Results:
- Total return: {metrics.get('total_return_pct')}%
- Sharpe ratio: {metrics.get('sharpe_ratio')}
- Max drawdown: {metrics.get('max_drawdown_pct')}%
- Win rate: {metrics.get('win_rate_pct')}%
- Total trades: {metrics.get('total_trades')}
- Profit factor: {metrics.get('profit_factor')}
- Avg win: {metrics.get('avg_win_pct')}% | Avg loss: {metrics.get('avg_loss_pct')}%

Explain these results to a trader in plain English.
"""
    
    try:
        response = model.generate_content(prompt)
        return {"success": True, "narrative": response.text.strip()}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## 7. Backtest Engine

### `engine/data_fetcher.py`

```python
import yfinance as yf
import pandas as pd
from functools import lru_cache

# Map our timeframe strings to yfinance interval strings
TIMEFRAME_MAP = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "60m", "4h": "1h",   # yfinance has no native 4h — use 1h, aggregate later
    "1d": "1d", "1w": "1wk"
}

PERIOD_MAP = {
    "1m": "7d", "5m": "60d", "15m": "60d", "30m": "60d",
    "1h": "2y", "4h": "5y", "1d": "5y", "1w": "10y"
}

@lru_cache(maxsize=50)  # Cache last 50 ticker+interval combinations — avoids re-downloading
def fetch_ohlcv(ticker: str, period: str, interval: str) -> pd.DataFrame:
    """
    Download OHLCV data from Yahoo Finance.
    Cached by (ticker, period, interval) — second call for same inputs is instant.
    Returns DataFrame with columns: Open, High, Low, Close, Volume
    """
    yf_interval = TIMEFRAME_MAP.get(interval, "1d")
    yf_period   = PERIOD_MAP.get(interval, "5y")
    
    try:
        df = yf.download(
            tickers  = ticker,
            period   = yf_period,
            interval = yf_interval,
            auto_adjust = True,    # adjusts for splits and dividends
            progress    = False
        )
        if df.empty:
            return None
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
        df = df.dropna()
        return df
    except Exception:
        return None
```

### `engine/indicator_builder.py`

```python
import pandas as pd
import pandas_ta as ta

def compute_indicators(df: pd.DataFrame, strategy: dict) -> pd.DataFrame:
    """
    Look at all rules in the strategy and compute only the required indicators.
    Adds a column to df for each indicator (e.g. SMA_50, SMA_200, RSI_14).
    """
    all_rules = strategy.get("entry_rules", []) + strategy.get("exit_rules", [])
    
    for rule in all_rules:
        ind    = rule.get("indicator", "").upper()
        params = rule.get("params", {})
        
        if ind == "SMA":
            period = params.get("period", 20)
            col    = f"SMA_{period}"
            if col not in df.columns:
                df[col] = ta.sma(df["Close"], length=period)
        
        elif ind == "EMA":
            period = params.get("period", 20)
            col    = f"EMA_{period}"
            if col not in df.columns:
                df[col] = ta.ema(df["Close"], length=period)
        
        elif ind == "RSI":
            period = params.get("period", 14)
            col    = f"RSI_{period}"
            if col not in df.columns:
                df[col] = ta.rsi(df["Close"], length=period)
        
        elif ind == "MACD":
            fast   = params.get("fast_period", 12)
            slow   = params.get("slow_period", 26)
            signal = params.get("signal_period", 9)
            macd_df = ta.macd(df["Close"], fast=fast, slow=slow, signal=signal)
            if macd_df is not None:
                df[f"MACD_{fast}_{slow}_{signal}"]        = macd_df.iloc[:, 0]  # MACD line
                df[f"MACDh_{fast}_{slow}_{signal}"]       = macd_df.iloc[:, 1]  # histogram
                df[f"MACDs_{fast}_{slow}_{signal}"]       = macd_df.iloc[:, 2]  # signal line
        
        elif ind == "BBANDS":
            period = params.get("period", 20)
            std    = params.get("std_dev", 2.0)
            bb_df  = ta.bbands(df["Close"], length=period, std=std)
            if bb_df is not None:
                df[f"BBL_{period}_{std}"] = bb_df.iloc[:, 0]   # lower band
                df[f"BBM_{period}_{std}"] = bb_df.iloc[:, 1]   # middle band
                df[f"BBU_{period}_{std}"] = bb_df.iloc[:, 2]   # upper band
        
        elif ind == "ATR":
            period = params.get("period", 14)
            col    = f"ATR_{period}"
            if col not in df.columns:
                df[col] = ta.atr(df["High"], df["Low"], df["Close"], length=period)
        
        elif ind == "STOCH":
            k = params.get("k_period", 14)
            d = params.get("d_period", 3)
            stoch_df = ta.stoch(df["High"], df["Low"], df["Close"], k=k, d=d)
            if stoch_df is not None:
                df[f"STOCHk_{k}_{d}"] = stoch_df.iloc[:, 0]
                df[f"STOCHd_{k}_{d}"] = stoch_df.iloc[:, 1]
    
    return df.dropna()
```

### `engine/signal_builder.py`

This is the critical translator — JSON rules → numpy boolean arrays.

```python
import numpy as np
import pandas as pd

def _resolve_value(df: pd.DataFrame, value, rule: dict) -> pd.Series:
    """
    Resolve the 'value' field of a rule.
    Could be: a number (70), an indicator reference ("SMA_200"), or None.
    """
    if isinstance(value, (int, float)):
        return pd.Series(value, index=df.index)
    if isinstance(value, str):
        # e.g. "SMA_200" → look up the SMA_200 column
        col = value.replace("_", "_")
        if col in df.columns:
            return df[col]
        # Try direct column lookup
        if value in df.columns:
            return df[value]
    return pd.Series(0, index=df.index)

def _get_indicator_series(df: pd.DataFrame, rule: dict) -> pd.Series:
    """Get the primary indicator series for a rule."""
    ind    = rule.get("indicator", "").upper()
    params = rule.get("params", {})
    
    if ind == "SMA":
        return df.get(f"SMA_{params.get('period', 20)}", df["Close"])
    elif ind == "EMA":
        return df.get(f"EMA_{params.get('period', 20)}", df["Close"])
    elif ind == "RSI":
        return df.get(f"RSI_{params.get('period', 14)}", pd.Series(50, index=df.index))
    elif ind == "MACD":
        f, s, sig = params.get("fast_period",12), params.get("slow_period",26), params.get("signal_period",9)
        return df.get(f"MACD_{f}_{s}_{sig}", pd.Series(0, index=df.index))
    elif ind == "PRICE":
        return df["Close"]
    elif ind == "VOLUME":
        return df["Volume"]
    elif ind == "ATR":
        return df.get(f"ATR_{params.get('period', 14)}", pd.Series(0, index=df.index))
    else:
        return df["Close"]

def _apply_condition(series_a: pd.Series, condition: str, series_b: pd.Series) -> pd.Series:
    """
    Apply a condition between two series. Returns a boolean Series.
    
    crosses_above: True on the EXACT bar where a went from below b to above b
    crosses_below: True on the EXACT bar where a went from above b to below b
    greater_than:  True every bar where a > b
    less_than:     True every bar where a < b
    """
    if condition == "crosses_above":
        return (series_a > series_b) & (series_a.shift(1) <= series_b.shift(1))
    elif condition == "crosses_below":
        return (series_a < series_b) & (series_a.shift(1) >= series_b.shift(1))
    elif condition == "greater_than":
        return series_a > series_b
    elif condition == "less_than":
        return series_a < series_b
    elif condition == "equals":
        return series_a == series_b
    elif condition == "between":
        # "between" needs a second value — use series_b as lower, value+range as upper
        return (series_a >= series_b) & (series_a <= series_b * 1.05)
    else:
        return pd.Series(False, index=series_a.index)

def _build_signal_for_rules(df: pd.DataFrame, rules: list) -> pd.Series:
    """
    Combine multiple rules with AND/OR logic into a single boolean signal.
    First rule always has logic_operator="NONE" (it's the base).
    Subsequent rules use their logic_operator to combine with the accumulated signal.
    """
    if not rules:
        return pd.Series(False, index=df.index)
    
    # Handle MACD crossover — when comparing MACD to its signal line
    def resolve_macd_value(rule):
        params = rule.get("params", {})
        f, s, sig = params.get("fast_period",12), params.get("slow_period",26), params.get("signal_period",9)
        val = rule.get("value")
        if isinstance(val, str) and "SIGNAL" in val.upper():
            return df.get(f"MACDs_{f}_{s}_{sig}", pd.Series(0, index=df.index))
        return _resolve_value(df, val, rule)
    
    accumulated = None
    for rule in rules:
        ind_series  = _get_indicator_series(df, rule)
        
        if rule.get("indicator", "").upper() == "MACD":
            val_series = resolve_macd_value(rule)
        else:
            val_series = _resolve_value(df, rule.get("value"), rule)
        
        condition = rule.get("condition", "greater_than")
        signal    = _apply_condition(ind_series, condition, val_series)
        
        op = rule.get("logic_operator", "NONE")
        
        if accumulated is None or op == "NONE":
            accumulated = signal
        elif op == "AND":
            accumulated = accumulated & signal
        elif op == "OR":
            accumulated = accumulated | signal
    
    return accumulated.fillna(False)

def build_signals(df: pd.DataFrame, strategy: dict):
    """
    Main entry point.
    Returns (entry_signals, exit_signals) as boolean numpy arrays.
    Also handles stop_loss and take_profit by appending synthetic exit rules.
    """
    entry_signals = _build_signal_for_rules(df, strategy.get("entry_rules", []))
    exit_signals  = _build_signal_for_rules(df, strategy.get("exit_rules", []))
    
    # If no exit rules, use end-of-data as exit (vectorbt handles this)
    if not strategy.get("exit_rules"):
        exit_signals = pd.Series(False, index=df.index)
    
    return entry_signals.values, exit_signals.values
```

### `engine/backtest_runner.py`

```python
import vectorbt as vbt
import pandas as pd
import numpy as np

def run_backtest(df, entry_signals, exit_signals,
                 init_cash=10_000, fees=0.001, slippage=0.0005, size=1.0):
    """
    Run vectorbt portfolio simulation.
    
    vectorbt works by:
    1. Taking price array + boolean entry/exit arrays
    2. Simulating: on each True entry → buy, on each True exit → sell
    3. Tracking the portfolio value at every bar
    4. Computing all statistics from that equity curve
    """
    portfolio = vbt.Portfolio.from_signals(
        close          = df["Close"],
        entries        = entry_signals,
        exits          = exit_signals,
        init_cash      = init_cash,
        fees           = fees,
        slippage       = slippage,
        size           = size,
        size_type      = "percent",     # size=1.0 means 100% of available cash
        sl_stop        = None,          # stop loss handled in signal_builder
        tp_stop        = None,          # take profit handled in signal_builder
        freq           = "D",
    )
    return portfolio
```

### `engine/result_formatter.py`

```python
import pandas as pd
import numpy as np

def format_result(portfolio, df: pd.DataFrame, strategy: dict) -> dict:
    """
    Convert vectorbt Portfolio object into a clean dict for the API.
    All numbers rounded to 2 decimal places.
    """
    stats    = portfolio.stats()
    trades   = portfolio.trades.records_readable
    eq_curve = portfolio.value()
    
    # Benchmark: buy and hold from start to end
    benchmark_val = (df["Close"] / df["Close"].iloc[0]) * portfolio.init_cash
    
    # ---- Metrics ----
    total_return = float(stats.get("Total Return [%]", 0))
    sharpe       = float(stats.get("Sharpe Ratio", 0))
    max_dd       = float(stats.get("Max Drawdown [%]", 0))
    win_rate     = float(stats.get("Win Rate [%]", 0))
    n_trades     = int(stats.get("Total Trades", 0))
    
    # Compute CAGR manually
    n_years = (df.index[-1] - df.index[0]).days / 365.25
    end_val  = float(eq_curve.iloc[-1])
    start_val = float(portfolio.init_cash)
    cagr = ((end_val / start_val) ** (1 / max(n_years, 0.01)) - 1) * 100
    
    # ---- Equity curve ----
    equity_points = []
    for date, val in eq_curve.items():
        bm_val = float(benchmark_val.get(date, start_val))
        equity_points.append({
            "date":      str(date.date()),
            "value":     round(float(val), 2),
            "benchmark": round(bm_val, 2)
        })
    
    # ---- Monthly returns ----
    monthly = {}
    eq_monthly = eq_curve.resample("ME").last().pct_change() * 100
    for date, ret in eq_monthly.items():
        yr = date.year
        mn = date.month - 1   # 0-indexed to match JS array
        if yr not in monthly:
            monthly[yr] = [None] * 12
        monthly[yr][mn] = round(float(ret), 2) if not np.isnan(ret) else None
    
    # ---- Trade log ----
    trade_list = []
    if trades is not None and len(trades) > 0:
        for i, row in trades.iterrows():
            trade_list.append({
                "id":          int(i),
                "date_in":     str(row.get("Entry Timestamp", ""))[: 10],
                "date_out":    str(row.get("Exit Timestamp", ""))[: 10],
                "entry_price": round(float(row.get("Avg Entry Price", 0)), 2),
                "exit_price":  round(float(row.get("Avg Exit Price", 0)),  2),
                "pnl_usd":     round(float(row.get("PnL", 0)),             2),
                "return_pct":  round(float(row.get("Return [%]", 0)),      2),
                "hold_days":   int(row.get("Duration", pd.Timedelta(0)).days),
                "side":        "long"
            })
    
    # ---- Win/loss stats ----
    winning_trades = [t for t in trade_list if t["return_pct"] > 0]
    losing_trades  = [t for t in trade_list if t["return_pct"] <= 0]
    
    avg_win     = np.mean([t["return_pct"] for t in winning_trades]) if winning_trades else 0
    avg_loss    = np.mean([t["return_pct"] for t in losing_trades])  if losing_trades  else 0
    largest_win = max([t["return_pct"] for t in winning_trades], default=0)
    largest_loss= min([t["return_pct"] for t in losing_trades],  default=0)
    gross_profit = sum(t["pnl_usd"] for t in winning_trades)
    gross_loss   = abs(sum(t["pnl_usd"] for t in losing_trades))
    profit_factor= round(gross_profit / max(gross_loss, 0.01), 2)
    expectancy   = round((gross_profit - gross_loss) / max(n_trades, 1), 2)
    
    return {
        "strategy":      strategy,
        "ticker_used":   strategy.get("ticker", ""),
        "data_period":   f"{str(df.index[0].date())} to {str(df.index[-1].date())}",
        "metrics": {
            "total_return_pct":  round(total_return, 2),
            "cagr_pct":          round(cagr, 2),
            "sharpe_ratio":      round(sharpe, 2),
            "max_drawdown_pct":  round(max_dd, 2),
            "win_rate_pct":      round(win_rate, 2),
            "total_trades":      n_trades,
            "avg_win_pct":       round(avg_win, 2),
            "avg_loss_pct":      round(avg_loss, 2),
            "largest_win_pct":   round(largest_win, 2),
            "largest_loss_pct":  round(largest_loss, 2),
            "profit_factor":     profit_factor,
            "expectancy_usd":    expectancy,
        },
        "equity_curve":     equity_points,
        "monthly_returns":  monthly,
        "trades":           trade_list,
        "ai_narrative":     None   # filled in by narrate_tool after this
    }
```

---

## 8. API Routes

### `routes/strategy.py`
```python
from fastapi import APIRouter, HTTPException
from models.api_schema import ParseRequest, ParseResponse
from agent.strategy_agent import run_agent
from agent.memory import AgentMemory
from database.repository import save_strategy, load_memory, save_memory

router = APIRouter(prefix="/api", tags=["strategy"])

@router.post("/parse-strategy", response_model=ParseResponse)
async def parse_strategy(req: ParseRequest):
    # Load or create memory for this session
    memory = AgentMemory.from_dict(
        load_memory(req.session_id) if req.session_id else {}
    )
    # Add prior conversation if frontend is providing it
    if req.conversation_history and not memory.conversation_history:
        memory.conversation_history = req.conversation_history
    
    try:
        response = run_agent(req.message, memory)
        save_memory(memory.session_id, memory.to_dict())
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### `routes/backtest.py`
```python
from fastapi import APIRouter, HTTPException, BackgroundTasks
from models.api_schema import BacktestRequest, BacktestResponse
from agent.tools.backtest_tool import execute_backtest_tool
from agent.tools.narrate_tool  import execute_narrate_tool
from database.repository import save_result
import uuid

router = APIRouter(prefix="/api", tags=["backtest"])

@router.post("/run-backtest", response_model=BacktestResponse)
async def run_backtest_endpoint(req: BacktestRequest, background_tasks: BackgroundTasks):
    result = execute_backtest_tool(req.strategy)
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error"))
    
    backtest_result = result["result"]
    
    # Get AI narration (synchronous — fast enough for hackathon)
    narration = execute_narrate_tool(
        metrics  = backtest_result["metrics"],
        strategy = req.strategy,
        trades   = backtest_result["trades"]
    )
    if narration.get("success"):
        backtest_result["ai_narrative"] = narration["narrative"]
    
    # Save to database in background
    result_id = str(uuid.uuid4())
    background_tasks.add_task(save_result, result_id, backtest_result)
    
    return BacktestResponse(status="ok", result=backtest_result)
```

---

## 9. System Prompt — `prompts/strategy_agent_system.txt`

```
You are TriVectorAI — an expert quantitative trading assistant with an agentic workflow.

## YOUR ROLE
You help traders backtest strategies by understanding their plain English descriptions
and converting them into precise, executable trading rules.

## YOUR TOOLS
You have 5 tools. Use them in this order for a new strategy:
1. parse_strategy    — ALWAYS call first when user describes a new strategy
2. validate_strategy — ALWAYS call after parsing to check completeness
3. ask_clarification — ONLY call if validate_strategy finds missing REQUIRED fields
                       (ticker or entry_rules). NEVER ask for optional fields unprompted.
4. run_backtest      — Call when strategy is complete (ticker + entry_rules present)
5. narrate_results   — Call after run_backtest succeeds

## DECISION RULES
- If the user gives a complete strategy → parse → validate → run_backtest → narrate
- If ticker is missing → parse → validate → ask_clarification (ask for ticker only)
- If entry_rules unclear → parse → validate → ask_clarification (ask for entry condition)
- If the user is answering a clarification → merge with prior strategy context, parse again
- NEVER ask for exit rules — they are optional, default to end-of-data
- NEVER ask for timeframe if it can be defaulted to "1d"
- After getting clarification, call run_backtest immediately — do not ask again

## TONE
- Concise and confident. You are the expert, not a chatbot.
- When parsing succeeds, confirm what you understood before running.
- When backtest finishes, lead with the most important number (total return).
- Keep all responses under 100 words unless explaining results.
```

---

## 10. Database — `database/db.py` and `database/repository.py`

```python
# db.py
import sqlite3, json
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "trivectorai.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS strategies (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS results (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
```

```python
# repository.py
from .db import get_conn
import json

def save_strategy(id: str, data: dict):
    with get_conn() as conn:
        conn.execute("INSERT OR REPLACE INTO strategies(id, data) VALUES (?,?)",
                     (id, json.dumps(data)))

def save_result(id: str, data: dict):
    with get_conn() as conn:
        conn.execute("INSERT OR REPLACE INTO results(id, data) VALUES (?,?)",
                     (id, json.dumps(data, default=str)))

def load_memory(session_id: str) -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT data FROM sessions WHERE id=?", (session_id,)).fetchone()
    return json.loads(row["data"]) if row else {}

def save_memory(session_id: str, data: dict):
    with get_conn() as conn:
        conn.execute("INSERT OR REPLACE INTO sessions(id, data, updated_at) VALUES (?,?,CURRENT_TIMESTAMP)",
                     (session_id, json.dumps(data)))

def get_all_results() -> list:
    with get_conn() as conn:
        rows = conn.execute("SELECT id, data FROM results ORDER BY created_at DESC LIMIT 50").fetchall()
    return [{"id": r["id"], **json.loads(r["data"])} for r in rows]
```

---

## 11. `main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.strategy import router as strategy_router
from routes.backtest import router as backtest_router
from routes.history  import router as history_router
from routes.health   import router as health_router
from database.db import init_db
from dotenv import load_dotenv

load_dotenv()
init_db()  # create tables on startup

app = FastAPI(title="TriVectorAI", version="0.3.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strategy_router)
app.include_router(backtest_router)
app.include_router(history_router)
app.include_router(health_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
```

---

## 12. Frontend Wiring — Replace Mock in `strategyApi.js`

```js
// BEFORE (Phase 2 mock):
export const parseStrategy = async (message, history) => {
  await delay(1800)
  return MOCK_STRATEGIES[0]
}

// AFTER (Phase 3 real):
export const parseStrategy = async (message, history = [], sessionId = null) => {
  const { data } = await api.post("/parse-strategy", {
    message,
    conversation_history: history,
    session_id: sessionId,
  })
  return data  // ParseResponse from backend
}

export const runBacktest = async (strategy, sessionId = null) => {
  const { data } = await api.post("/run-backtest", {
    strategy,
    session_id: sessionId,
  })
  return data  // BacktestResponse from backend
}

export const getHistory = async () => {
  const { data } = await api.get("/history")
  return data
}
```

---

## 13. Definition of Done — Phase 3 Complete When:

- [ ] `uvicorn main:app --reload` starts without import errors
- [ ] `/docs` shows all 6 endpoints with correct schemas
- [ ] `POST /api/parse-strategy` with "golden cross on AAPL" returns parsed strategy JSON
- [ ] `POST /api/parse-strategy` with "golden cross" (no ticker) returns needs_clarification
- [ ] Clarification follow-up "AAPL daily" correctly merges with prior parse
- [ ] `POST /api/run-backtest` returns real metrics (total_return, sharpe, trades list)
- [ ] Equity curve has 250+ data points (1 year of daily data)
- [ ] AI narrative is populated (non-empty string from Gemini)
- [ ] All 7 test strategies from Phase 1 spec parse correctly
- [ ] SQLite db file is created on startup, results saved after each backtest
- [ ] Frontend strategyApi.js uses real endpoints — mock delay removed
- [ ] Full end-to-end: type "RSI bounce on BTC" in UI → real backtest result appears
