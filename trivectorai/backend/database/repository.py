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
                metrics.get("win_rate"),
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
