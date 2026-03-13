from engine.backtest_runner import run_backtest
from engine.data_fetcher import fetch_ohlcv
from engine.indicator_builder import compute_indicators
from engine.result_formatter import format_result
from engine.signal_builder import build_signals


def execute_backtest_tool(strategy: dict) -> dict:
    try:
        ticker = strategy.get("ticker", "").upper()
        timeframe = strategy.get("timeframe", "1d")
        df = fetch_ohlcv(ticker=ticker, period="5y", interval=timeframe)
        if df is None or len(df) < 50:
            return {"success": False, "error": f"Insufficient data for {ticker}"}

        df = compute_indicators(df, strategy)
        entry_signals, exit_signals = build_signals(df, strategy)
        portfolio = run_backtest(
            df=df,
            entry_signals=entry_signals,
            exit_signals=exit_signals,
            init_cash=10_000,
            fees=0.001,
            slippage=0.0005,
            size=strategy.get("position_size", 1.0),
            stop_loss_pct=strategy.get("stop_loss_pct"),
            take_profit_pct=strategy.get("take_profit_pct"),
        )
        result = format_result(portfolio, df, strategy)
        return {"success": True, "result": result}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
