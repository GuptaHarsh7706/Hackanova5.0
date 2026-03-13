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


def get_all_results() -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, data, created_at FROM results ORDER BY created_at DESC LIMIT 50"
        ).fetchall()
    output = []
    for row in rows:
        item = json.loads(row["data"])
        item["id"] = row["id"]
        item["created_at"] = row["created_at"]
        output.append(item)
    return output


def clear_all_results():
    with get_conn() as conn:
        conn.execute("DELETE FROM results")


def clear_all_sessions():
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions")
