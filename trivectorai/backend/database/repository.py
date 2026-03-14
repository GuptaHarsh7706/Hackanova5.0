from __future__ import annotations

import json

import psycopg2.extras

from .db import get_conn


# ─── helpers ─────────────────────────────────────────────────────────────────

def _as_dict(value) -> dict:
    """Normalise JSONB return – psycopg2 may return a dict or a JSON string."""
    if isinstance(value, dict):
        return value
    return json.loads(value)


def _iso(ts) -> str:
    return ts.isoformat() if hasattr(ts, "isoformat") else str(ts)


# ─── strategies ──────────────────────────────────────────────────────────────

def save_strategy(id: str, data: dict) -> None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO strategies (
                id, ticker, timeframe, asset_class, short_allowed,
                stop_loss_pct, take_profit_pct, confidence_score, raw_input,
                data, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                ticker           = EXCLUDED.ticker,
                timeframe        = EXCLUDED.timeframe,
                asset_class      = EXCLUDED.asset_class,
                short_allowed    = EXCLUDED.short_allowed,
                stop_loss_pct    = EXCLUDED.stop_loss_pct,
                take_profit_pct  = EXCLUDED.take_profit_pct,
                confidence_score = EXCLUDED.confidence_score,
                raw_input        = EXCLUDED.raw_input,
                data             = EXCLUDED.data,
                updated_at       = NOW()
            """,
            (
                id,
                data.get("ticker"),
                data.get("timeframe"),
                data.get("asset_class"),
                bool(data.get("short_allowed", False)),
                data.get("stop_loss_pct"),
                data.get("take_profit_pct"),
                data.get("confidence_score"),
                data.get("raw_input"),
                psycopg2.extras.Json(data),
            ),
        )


def get_strategy_by_id(strategy_id: str) -> dict | None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, data, raw_input, created_at, updated_at
            FROM strategies
            WHERE id = %s
            """,
            (strategy_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    payload = _as_dict(row["data"])
    payload["id"] = row["id"]
    payload["raw_input"] = row.get("raw_input")
    payload["created_at"] = _iso(row["created_at"])
    payload["updated_at"] = _iso(row["updated_at"])
    return payload


def list_saved_strategies(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, ticker, timeframe, asset_class, confidence_score,
                   raw_input, data, created_at, updated_at
            FROM strategies
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()

    items = []
    for row in rows:
        payload = _as_dict(row["data"])
        payload["id"] = row["id"]
        payload["ticker"] = row.get("ticker") or payload.get("ticker")
        payload["timeframe"] = row.get("timeframe") or payload.get("timeframe")
        payload["asset_class"] = row.get("asset_class") or payload.get("asset_class")
        payload["confidence_score"] = row.get("confidence_score") if row.get("confidence_score") is not None else payload.get("confidence_score")
        payload["raw_input"] = row.get("raw_input")
        payload["created_at"] = _iso(row["created_at"])
        payload["updated_at"] = _iso(row["updated_at"])
        items.append(payload)
    return items


# ─── results ─────────────────────────────────────────────────────────────────

def save_result(id: str, data: dict) -> None:
    metrics  = data.get("metrics", {})
    strategy = data.get("strategy", {})
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO results (
                id, strategy_id, ticker, timeframe, asset_class,
                total_return_pct, sharpe_ratio, max_drawdown_pct, win_rate,
                total_trades, data_period, data
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                strategy_id      = EXCLUDED.strategy_id,
                ticker           = EXCLUDED.ticker,
                timeframe        = EXCLUDED.timeframe,
                asset_class      = EXCLUDED.asset_class,
                total_return_pct = EXCLUDED.total_return_pct,
                sharpe_ratio     = EXCLUDED.sharpe_ratio,
                max_drawdown_pct = EXCLUDED.max_drawdown_pct,
                win_rate         = EXCLUDED.win_rate,
                total_trades     = EXCLUDED.total_trades,
                data_period      = EXCLUDED.data_period,
                data             = EXCLUDED.data
            """,
            (
                id,
                data.get("strategy_id"),
                strategy.get("ticker") or data.get("ticker"),
                strategy.get("timeframe") or data.get("timeframe"),
                strategy.get("asset_class") or data.get("asset_class"),
                metrics.get("total_return_pct"),
                metrics.get("sharpe_ratio"),
                metrics.get("max_drawdown_pct"),
                metrics.get("win_rate_pct", metrics.get("win_rate")),
                int(metrics.get("total_trades", 0)),
                data.get("data_period"),
                psycopg2.extras.Json(data),
            ),
        )


def get_result_by_id(result_id: str) -> dict | None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, data, created_at FROM results WHERE id = %s",
            (result_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    result = _as_dict(row["data"])
    result["id"] = row["id"]
    result["created_at"] = _iso(row["created_at"])
    return result


def delete_result(result_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM results WHERE id = %s", (result_id,))
        return cur.rowcount > 0


def get_all_results() -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, ticker, timeframe, asset_class,
                   total_return_pct, sharpe_ratio, max_drawdown_pct,
                   win_rate, total_trades, data_period, data, created_at
            FROM   results
            ORDER  BY created_at DESC
            LIMIT  100
            """
        )
        rows = cur.fetchall()

    results = []
    for row in rows:
        item = _as_dict(row["data"])
        item["id"]         = row["id"]
        item["created_at"] = _iso(row["created_at"])
        # surface indexed columns for fast frontend access without JSONB parse
        for col in (
            "ticker", "timeframe", "asset_class",
            "total_return_pct", "sharpe_ratio", "max_drawdown_pct",
            "win_rate", "total_trades", "data_period",
        ):
            if row[col] is not None and col not in item:
                item[col] = row[col]
        results.append(item)
    return results


def clear_all_results() -> None:
    with get_conn() as conn:
        conn.cursor().execute("DELETE FROM results")


# ─── sessions ────────────────────────────────────────────────────────────────

def load_memory(session_id: str) -> dict:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT data FROM sessions WHERE id = %s", (session_id,))
        row = cur.fetchone()
    return _as_dict(row["data"]) if row else {}


def save_memory(session_id: str, data: dict) -> None:
    message_count = len(data.get("messages", []))
    last_ticker   = data.get("strategy", {}).get("ticker") if data.get("strategy") else None
    strategy_id   = data.get("strategy_id")
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO sessions (id, strategy_id, message_count, last_ticker, data, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                strategy_id   = EXCLUDED.strategy_id,
                message_count = EXCLUDED.message_count,
                last_ticker   = EXCLUDED.last_ticker,
                data          = EXCLUDED.data,
                updated_at    = NOW()
            """,
            (session_id, strategy_id, message_count, last_ticker, psycopg2.extras.Json(data)),
        )


def clear_all_sessions() -> None:
    with get_conn() as conn:
        conn.cursor().execute("DELETE FROM sessions")


# ─── audit log ───────────────────────────────────────────────────────────────

def log_audit(
    event_type: str,
    *,
    session_id: str | None = None,
    ticker: str | None = None,
    status: str = "success",
    error_message: str | None = None,
    latency_ms: int | None = None,
    metadata: dict | None = None,
) -> None:
    """Append a structured audit/observability entry."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO audit_log
                (event_type, session_id, ticker, status, error_message, latency_ms, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                event_type,
                session_id,
                ticker,
                status,
                error_message,
                latency_ms,
                psycopg2.extras.Json(metadata) if metadata is not None else None,
            ),
        )


def get_recent_audit_logs(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, event_type, session_id, ticker, status,
                   error_message, latency_ms, metadata, created_at
            FROM   audit_log
            ORDER  BY created_at DESC
            LIMIT  %s
            """,
            (limit,),
        )
        rows = cur.fetchall()
    result = []
    for row in rows:
        entry = dict(row)
        entry["created_at"] = _iso(entry["created_at"])
        result.append(entry)
    return result


# ─── watchlist ───────────────────────────────────────────────────────────────

DEFAULT_WATCHLIST = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "NVDA",
    "META",
    "JPM",
]


def get_watchlist_symbols(asset_type: str = "equity") -> list[str]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT symbol
            FROM watchlist
            WHERE asset_type = %s
            ORDER BY updated_at DESC, symbol ASC
            """,
            (asset_type,),
        )
        rows = cur.fetchall()

    symbols = [str(row["symbol"]).upper() for row in rows]
    if asset_type == "equity" and not symbols:
        for symbol in DEFAULT_WATCHLIST:
            add_watchlist_symbol(symbol, asset_type="equity")
        return DEFAULT_WATCHLIST.copy()
    return symbols


def add_watchlist_symbol(symbol: str, *, asset_type: str = "equity", display_name: str | None = None) -> str:
    clean = symbol.strip().upper()
    if not clean:
        raise ValueError("symbol is required")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO watchlist (symbol, asset_type, display_name, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (symbol) DO UPDATE SET
                asset_type = EXCLUDED.asset_type,
                display_name = COALESCE(EXCLUDED.display_name, watchlist.display_name),
                updated_at = NOW()
            """,
            (clean, asset_type, display_name),
        )
    return clean


def remove_watchlist_symbol(symbol: str) -> bool:
    clean = symbol.strip().upper()
    if not clean:
        return False
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM watchlist WHERE symbol = %s", (clean,))
        return cur.rowcount > 0


# ─── backtest configurations ────────────────────────────────────────────────

def save_backtest_configuration(config_id: str, data: dict) -> None:
    selected_assets = data.get("selected_assets") or []
    risk_params = data.get("risk_parameters") or data.get("risk_params") or {}
    costs = data.get("transaction_costs") or data.get("costs") or {}
    ai_notes = data.get("ai") or {}

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO backtest_configurations (
                id, strategy_id, name, data_source, asset_class, selected_assets,
                start_date, end_date, timeframe, initial_capital,
                position_sizing_method, position_pct, score,
                risk_params, costs, ai_notes, data, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                strategy_id            = EXCLUDED.strategy_id,
                name                   = EXCLUDED.name,
                data_source            = EXCLUDED.data_source,
                asset_class            = EXCLUDED.asset_class,
                selected_assets        = EXCLUDED.selected_assets,
                start_date             = EXCLUDED.start_date,
                end_date               = EXCLUDED.end_date,
                timeframe              = EXCLUDED.timeframe,
                initial_capital        = EXCLUDED.initial_capital,
                position_sizing_method = EXCLUDED.position_sizing_method,
                position_pct           = EXCLUDED.position_pct,
                score                  = EXCLUDED.score,
                risk_params            = EXCLUDED.risk_params,
                costs                  = EXCLUDED.costs,
                ai_notes               = EXCLUDED.ai_notes,
                data                   = EXCLUDED.data,
                updated_at             = NOW()
            """,
            (
                config_id,
                data.get("strategy_id"),
                data.get("name"),
                data.get("data_source"),
                data.get("asset_class"),
                psycopg2.extras.Json(selected_assets),
                data.get("start_date"),
                data.get("end_date"),
                data.get("timeframe"),
                data.get("initial_capital"),
                data.get("position_sizing_method"),
                data.get("position_pct"),
                data.get("score"),
                psycopg2.extras.Json(risk_params),
                psycopg2.extras.Json(costs),
                psycopg2.extras.Json(ai_notes),
                psycopg2.extras.Json(data),
            ),
        )


def get_backtest_configuration(config_id: str) -> dict | None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, strategy_id, data, created_at, updated_at
            FROM backtest_configurations
            WHERE id = %s
            """,
            (config_id,),
        )
        row = cur.fetchone()

    if not row:
        return None

    payload = _as_dict(row["data"])
    payload["id"] = row["id"]
    payload["strategy_id"] = row.get("strategy_id") or payload.get("strategy_id")
    payload["created_at"] = _iso(row["created_at"])
    payload["updated_at"] = _iso(row["updated_at"])
    return payload


def list_backtest_configurations(*, strategy_id: str | None = None, limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        if strategy_id:
            cur.execute(
                """
                SELECT id, strategy_id, data, created_at, updated_at
                FROM backtest_configurations
                WHERE strategy_id = %s
                ORDER BY updated_at DESC
                LIMIT %s
                """,
                (strategy_id, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, strategy_id, data, created_at, updated_at
                FROM backtest_configurations
                ORDER BY updated_at DESC
                LIMIT %s
                """,
                (limit,),
            )
        rows = cur.fetchall()

    items: list[dict] = []
    for row in rows:
        payload = _as_dict(row["data"])
        payload["id"] = row["id"]
        payload["strategy_id"] = row.get("strategy_id") or payload.get("strategy_id")
        payload["created_at"] = _iso(row["created_at"])
        payload["updated_at"] = _iso(row["updated_at"])
        items.append(payload)
    return items


def delete_backtest_configuration(config_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM backtest_configurations WHERE id = %s", (config_id,))
        return cur.rowcount > 0
