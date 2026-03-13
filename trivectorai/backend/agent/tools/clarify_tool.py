FIELD_QUESTIONS = {
    "ticker": "Which stock, crypto, or asset would you like to test this on? (e.g. AAPL, BTCUSDT, EURUSD)",
    "entry_rules": "What's your entry condition — when should the strategy buy?",
    "timeframe": "What chart timeframe? (e.g. daily, hourly, 15-minute)",
}


def execute_clarify_tool(missing_fields: list, partial_strategy: dict) -> dict:
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

    understood = []
    if partial_strategy.get("ticker"):
        understood.append(f"Asset: {partial_strategy['ticker']}")
    if partial_strategy.get("entry_rules"):
        summary = []
        for rule in partial_strategy["entry_rules"]:
            params = rule.get("params", {}) or {}
            indicator = rule.get("indicator", "")
            period = params.get("period")
            period_label = f"({period})" if period else ""
            summary.append(f"{indicator}{period_label} {rule.get('condition', '').replace('_', ' ')} {rule.get('value', '')}".strip())
        if summary:
            understood.append(f"Entry: {', '.join(summary)}")
    if partial_strategy.get("timeframe"):
        understood.append(f"Timeframe: {partial_strategy['timeframe']}")

    understood_text = ""
    if understood:
        understood_text = "\n\nWhat I understood so far:\n" + "\n".join(f"  ✓ {item}" for item in understood)

    question = f"{FIELD_QUESTIONS.get(ask_about, f'Could you clarify: {ask_about}?')}{understood_text}"
    return {"question": question, "asking_about": ask_about}
