"""
Strategy improvement tool – analyses backtest metrics and produces actionable
suggestions plus a modified strategy dict ready to re-run.
"""
from __future__ import annotations

import copy

# ---------------------------------------------------------------------------
# Rule table – each entry fires when the lambda returns True
# ---------------------------------------------------------------------------
IMPROVEMENT_RULES = [
    {
        "id": "low_win_rate",
        "condition": lambda m: float(m.get("win_rate_pct") or 50) < 40,
        "suggestion": (
            "Win rate is below 40%. Add a confirmation filter – require RSI(14) > 45 on "
            "entry to avoid false breakout signals."
        ),
        "patch": {"rsi_confirmation": True},
    },
    {
        "id": "high_drawdown",
        "condition": lambda m: abs(float(m.get("max_drawdown_pct") or 0)) > 20,
        "suggestion": (
            "Max drawdown exceeds 20%. Adding a 6% trailing stop loss will cap individual "
            "losses and significantly reduce portfolio drawdown."
        ),
        "patch": {"stop_loss_pct": 6.0},
    },
    {
        "id": "low_sharpe",
        "condition": lambda m: float(m.get("sharpe_ratio") or 1.0) < 0.8,
        "suggestion": (
            "Sharpe ratio below 0.8 signals poor risk-adjusted returns. Add a volatility "
            "filter: skip entries when the 14-day ATR is more than 1.5× its 30-day average."
        ),
        "patch": {"volatility_filter": True},
    },
    {
        "id": "low_return",
        "condition": lambda m: float(m.get("total_return_pct") or 0) < 5,
        "suggestion": (
            "Total return is below 5%. Adding MACD momentum confirmation (MACD line above "
            "signal line at entry) can significantly improve signal quality."
        ),
        "patch": {"macd_confirmation": True},
    },
    {
        "id": "too_few_trades",
        "condition": lambda m: 0 < int(m.get("total_trades") or 999) < 5,
        "suggestion": (
            "Only a handful of trades were generated – the strategy is too restrictive. "
            "Relax the RSI threshold by 3-5 points or widen the lookback window."
        ),
        "patch": {"relax_entry": True},
    },
]

GENERAL_TIPS = [
    "Set take-profit at 1.5× your stop-loss distance to ensure a positive risk/reward ratio.",
    "Confirm entries with above-average volume (≥ 1.2× 20-day average) to filter noise.",
    "Validate on a second out-of-sample period (e.g. 2020–2022) to confirm robustness.",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _apply_patches(original: dict, triggered: list[dict]) -> dict:
    improved = copy.deepcopy(original)

    for rule in triggered:
        patch = rule.get("patch", {})

        # Inject stop loss
        if patch.get("stop_loss_pct") and not improved.get("stop_loss_pct"):
            improved["stop_loss_pct"] = patch["stop_loss_pct"]

        # Inject RSI confirmation rule if missing
        if patch.get("rsi_confirmation"):
            has_rsi = any(r.get("indicator") == "RSI" for r in improved.get("entry_rules", []))
            if not has_rsi:
                improved.setdefault("entry_rules", []).append({
                    "indicator": "RSI",
                    "condition": "greater_than",
                    "value": 45,
                    "params": {"period": 14},
                })

    # Auto-add take-profit at 1.5x stop loss if stop loss is present
    if improved.get("stop_loss_pct") and not improved.get("take_profit_pct"):
        improved["take_profit_pct"] = round(float(improved["stop_loss_pct"]) * 1.5, 1)

    return improved


def _build_natural_language(strategy: dict) -> str:
    parts = []

    entry_rules = strategy.get("entry_rules", [])
    exit_rules = strategy.get("exit_rules", [])

    if entry_rules:
        descs = []
        for rule in entry_rules:
            params = rule.get("params", {}) or {}
            period = params.get("period")
            indicator = rule.get("indicator", "")
            label = f"{indicator}({period})" if period else indicator
            cond = str(rule.get("condition", "")).replace("_", " ")
            val = rule.get("value", "")
            descs.append(f"{label} {cond} {val}".strip())
        parts.append(f"Buy when {' AND '.join(descs)}")

    if exit_rules:
        descs = []
        for rule in exit_rules:
            params = rule.get("params", {}) or {}
            period = params.get("period")
            indicator = rule.get("indicator", "")
            label = f"{indicator}({period})" if period else indicator
            cond = str(rule.get("condition", "")).replace("_", " ")
            val = rule.get("value", "")
            descs.append(f"{label} {cond} {val}".strip())
        parts.append(f"Sell when {' AND '.join(descs)}")

    if strategy.get("stop_loss_pct"):
        parts.append(f"with a {strategy['stop_loss_pct']}% stop loss")
    if strategy.get("take_profit_pct"):
        parts.append(f"and {strategy['take_profit_pct']}% take profit")
    if strategy.get("ticker"):
        parts.append(f"on {strategy['ticker']}")

    return ". ".join(parts) + "." if parts else "Improved strategy with enhanced risk controls."


# ---------------------------------------------------------------------------
# Public entry-point
# ---------------------------------------------------------------------------

def execute_improve_tool(strategy: dict, backtest_metrics: dict) -> dict:
    """
    Analyse ``backtest_metrics``, identify weak areas, apply rule-based patches,
    and return an improved strategy dict with human-readable commentary.

    Returns
    -------
    dict
        success           – bool
        issues            – list[{id, suggestion}]
        general_tips      – list[str]
        improved_strategy – dict  (patched copy of original)
        natural_language  – NL description of improved strategy
        summary           – one-paragraph analysis
    """
    triggered = [r for r in IMPROVEMENT_RULES if r["condition"](backtest_metrics)]

    if not triggered:
        triggered = [{
            "id": "general_enhancement",
            "suggestion": (
                "Your strategy already performs well! Consider dynamic position sizing "
                "based on ATR, or running the same logic on correlated assets for diversification."
            ),
            "patch": {},
        }]

    improved = _apply_patches(strategy, triggered)
    nl = _build_natural_language(improved)

    wr = backtest_metrics.get("win_rate_pct", "N/A")
    tr = backtest_metrics.get("total_return_pct", "N/A")
    sh = backtest_metrics.get("sharpe_ratio", "N/A")
    dd = backtest_metrics.get("max_drawdown_pct", "N/A")

    summary = (
        f"Backtest recorded {tr}% total return, {wr}% win rate, "
        f"Sharpe {sh}, and {dd}% max drawdown. "
        f"I found {len(triggered)} improvement area(s): "
        + " | ".join(t["suggestion"] for t in triggered[:3])
    )

    return {
        "success": True,
        "issues": [{"id": t["id"], "suggestion": t["suggestion"]} for t in triggered],
        "general_tips": GENERAL_TIPS[:2],
        "improved_strategy": improved,
        "natural_language": nl,
        "summary": summary,
    }
