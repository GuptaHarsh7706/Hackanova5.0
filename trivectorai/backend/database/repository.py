import json

from .db import get_conn


def save_strategy(id: str, data: dict):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO strategies(id, data) VALUES (?,?)",
            (id, json.dumps(data, default=str)),
        )


def save_result(id: str, data: dict):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO results(id, data) VALUES (?,?)",
            (id, json.dumps(data, default=str)),
        )


def load_memory(session_id: str) -> dict:
    with get_conn() as conn:
        row = conn.execute("SELECT data FROM sessions WHERE id=?", (session_id,)).fetchone()
    return json.loads(row["data"]) if row else {}


def save_memory(session_id: str, data: dict):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sessions(id, data, updated_at) VALUES (?,?,CURRENT_TIMESTAMP)",
            (session_id, json.dumps(data, default=str)),
        )


def get_result_by_id(result_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, data, created_at FROM results WHERE id=?", (result_id,)
        ).fetchone()
    if not row:
        return None
    result = json.loads(row["data"])
    result["id"] = row["id"]
    result["created_at"] = row["created_at"]
    return result


def delete_result(result_id: str) -> bool:
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM results WHERE id=?", (result_id,))
    return cursor.rowcount > 0


def get_all_results() -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, data, created_at FROM results ORDER BY created_at DESC LIMIT 100"
        ).fetchall()
    results = []
    for row in rows:
        item = json.loads(row["data"])
        item["id"] = row["id"]
        item["created_at"] = row["created_at"]
        results.append(item)
    return results


def clear_all_results():
    with get_conn() as conn:
        conn.execute("DELETE FROM results")


def clear_all_sessions():
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions")
