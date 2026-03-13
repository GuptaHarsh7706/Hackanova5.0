from models.strategy_schema import ParseResponse, ParsedStrategy

REQUIRED_FOR_BACKTEST = ["ticker", "entry_rules"]

FRIENDLY_NAMES = {
    "ticker": "which stock, crypto, or asset to test (e.g. AAPL, BTCUSDT)",
    "entry_rules": "the entry condition (when to BUY)",
    "exit_rules": "the exit condition (when to SELL) — optional but recommended",
    "timeframe": "the chart timeframe (e.g. daily, hourly)",
    "stop_loss_pct": "a stop-loss percentage",
    "take_profit_pct": "a take-profit target percentage",
}


def validate_and_respond(raw_dict: dict) -> ParseResponse:
    """
    Takes raw LLM JSON dict, validates it, returns ParseResponse.
    """
    try:
        strategy = ParsedStrategy(**raw_dict)
    except Exception as e:
        return ParseResponse(
            status="error",
            agent_message=f"I had trouble parsing that strategy. Could you rephrase it? ({e})",
        )

    missing = strategy.missing_fields or []

    # Also check required fields ourselves
    if not strategy.ticker:
        if "ticker" not in missing:
            missing.append("ticker")
    if not strategy.entry_rules:
        if "entry_rules" not in missing:
            missing.append("entry_rules")

    if missing:
        friendly = [FRIENDLY_NAMES.get(f, f) for f in missing]
        msg = "Got it! Just need a couple more details:\n" + "\n".join(
            f"  • {f}" for f in friendly
        )
        return ParseResponse(
            status="needs_clarification",
            strategy=strategy,
            agent_message=msg,
            missing_fields=missing,
        )

    agent_message = build_confirmation_message(strategy)

    return ParseResponse(
        status="ok",
        strategy=strategy,
        agent_message=agent_message,
        missing_fields=[],
    )


def build_confirmation_message(s: ParsedStrategy) -> str:
    entry_summary = []
    for r in s.entry_rules:
        param_str = f"({r.params.period})" if r.params.period else ""
        val_str = f" {r.value}" if r.value is not None else ""
        entry_summary.append(f"{r.indicator}{param_str} {r.condition.replace('_', ' ')}{val_str}")

    exit_summary = []
    for r in s.exit_rules:
        param_str = f"({r.params.period})" if r.params.period else ""
        val_str = f" {r.value}" if r.value is not None else ""
        exit_summary.append(f"{r.indicator}{param_str} {r.condition.replace('_', ' ')}{val_str}")

    lines = [
        f"Strategy parsed successfully for **{s.ticker}** on {s.timeframe} chart.",
        f"Entry: {' AND '.join(entry_summary) if entry_summary else 'None specified'}",
    ]
    if exit_summary:
        lines.append(f"Exit: {' AND '.join(exit_summary)}")
    if s.stop_loss_pct:
        lines.append(f"Stop loss: {s.stop_loss_pct}%")
    if s.take_profit_pct:
        lines.append(f"Take profit: {s.take_profit_pct}%")
    lines.append("Ready to run backtest!")
    return "\n".join(lines)
