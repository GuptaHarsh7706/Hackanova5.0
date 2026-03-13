TOOL_DEFINITIONS = [
    {
        "name": "parse_strategy",
        "description": (
            "Parse a plain English trading strategy description into structured JSON rules. "
            "Call this first when the user describes any trading strategy. "
            "Handles moving averages, RSI, MACD, Bollinger Bands, crossovers, breakouts, "
            "and common shorthands like golden cross, death cross, and RSI oversold."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The raw user message or strategy description to parse",
                },
                "context": {
                    "type": "string",
                    "description": "Any prior context from the conversation that helps resolve ambiguities",
                },
            },
            "required": ["text"],
        },
    },
    {
        "name": "validate_strategy",
        "description": (
            "Validate a parsed strategy for completeness and correctness. "
            "Checks ticker presence, non-empty entry rules, valid indicator params, and conflicting rules."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "strategy": {
                    "type": "object",
                    "description": "The parsed strategy dict from parse_strategy",
                }
            },
            "required": ["strategy"],
        },
    },
    {
        "name": "ask_clarification",
        "description": (
            "Generate a clear, friendly clarification question to ask the user when required fields are missing. "
            "Never ask for exit rules, which are optional."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "missing_fields": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of field names that are missing",
                },
                "partial_strategy": {
                    "type": "object",
                    "description": "What was successfully parsed so far",
                },
            },
            "required": ["missing_fields", "partial_strategy"],
        },
    },
    {
        "name": "run_backtest",
        "description": (
            "Execute a full historical backtest for a complete validated strategy. "
            "Only call this when ticker and entry rules are present."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "strategy": {
                    "type": "object",
                    "description": "The complete validated strategy dict",
                }
            },
            "required": ["strategy"],
        },
    },
    {
        "name": "narrate_results",
        "description": (
            "Generate a plain English explanation of backtest results. "
            "Use actual performance numbers and give one concrete improvement suggestion."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "metrics": {"type": "object", "description": "Backtest metrics dict"},
                "strategy": {"type": "object", "description": "The strategy that was tested"},
                "trades": {"type": "array", "description": "List of individual trades"},
            },
            "required": ["metrics", "strategy"],
        },
    },
]
