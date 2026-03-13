import os

import google.generativeai as genai


NARRATE_SYSTEM = """
You are a quantitative trading analyst explaining backtest results to a non-technical trader.
Be direct, specific, and use the actual numbers from the results.
Structure: (1) Overall verdict in one sentence, (2) What worked and when,
(3) What didn't work and why, (4) One specific, actionable improvement suggestion.
Keep it under 200 words. No bullet points.
"""


def _fallback_narrative(metrics: dict, strategy: dict) -> str:
    total_return = metrics.get("total_return_pct", 0)
    sharpe = metrics.get("sharpe_ratio", 0)
    drawdown = metrics.get("max_drawdown_pct", 0)
    win_rate = metrics.get("win_rate_pct", 0)
    verdict = "performed well" if total_return >= 0 else "struggled"
    return (
        f"This {strategy.get('ticker', 'strategy')} setup {verdict}, returning {total_return}% with a Sharpe ratio of {sharpe}. "
        f"Its win rate was {win_rate}% and the deepest drawdown reached {drawdown}%, which is the main risk to focus on. "
        f"The clearest improvement would be tightening entries with a regime filter or volatility filter so losing stretches are cut earlier."
    )


def execute_narrate_tool(metrics: dict, strategy: dict, trades: list | None = None) -> dict:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"success": True, "narrative": _fallback_narrative(metrics, strategy)}

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
"""

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=NARRATE_SYSTEM,
            generation_config=genai.GenerationConfig(temperature=0.4, max_output_tokens=400),
        )
        response = model.generate_content(prompt)
        return {"success": True, "narrative": response.text.strip()}
    except Exception:
        return {"success": True, "narrative": _fallback_narrative(metrics, strategy)}
