import os
from contextlib import contextmanager
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Load backend/.env regardless of current working directory.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _dsn() -> str:
    dsn = os.getenv("DATABASE_URL", "").strip()
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Example: postgresql://postgres:password@localhost:5432/trivectorai"
        )
    return dsn


@contextmanager
def get_conn():
    """Yield a committed-on-exit, always-closed psycopg2 connection."""
    connect_timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))
    conn = psycopg2.connect(
        _dsn(),
        connect_timeout=connect_timeout,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Schema
# ─────────────────────────────────────────────────────────────────────────────
_SCHEMA = """
-- ── strategies ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strategies (
    id               TEXT            PRIMARY KEY,
    ticker           VARCHAR(20),
    timeframe        VARCHAR(10),
    asset_class      VARCHAR(30),
    short_allowed    BOOLEAN         DEFAULT FALSE,
    stop_loss_pct    NUMERIC(10,4),
    take_profit_pct  NUMERIC(10,4),
    confidence_score NUMERIC(5,4)    DEFAULT 0,
    raw_input        TEXT,
    data             JSONB           NOT NULL,
    created_at       TIMESTAMPTZ     DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     DEFAULT NOW()
);

-- ── results ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
    id               TEXT            PRIMARY KEY,
    strategy_id      TEXT            REFERENCES strategies(id) ON DELETE SET NULL,
    ticker           VARCHAR(20),
    timeframe        VARCHAR(10),
    asset_class      VARCHAR(30),
    total_return_pct NUMERIC(12,4),
    sharpe_ratio     NUMERIC(10,4),
    max_drawdown_pct NUMERIC(10,4),
    win_rate         NUMERIC(7,4),
    total_trades     INT             DEFAULT 0,
    data_period      TEXT,
    data             JSONB           NOT NULL,
    created_at       TIMESTAMPTZ     DEFAULT NOW()
);

-- ── sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT        PRIMARY KEY,
    strategy_id   TEXT        REFERENCES strategies(id) ON DELETE SET NULL,
    message_count INT         DEFAULT 0,
    last_ticker   VARCHAR(20),
    data          JSONB       NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── audit_log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id            BIGSERIAL   PRIMARY KEY,
    event_type    VARCHAR(50) NOT NULL,
    session_id    TEXT,
    ticker        VARCHAR(20),
    status        VARCHAR(20),
    error_message TEXT,
    latency_ms    INT,
    metadata      JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── watchlist ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
    symbol        VARCHAR(20) PRIMARY KEY,
    asset_type    VARCHAR(20) NOT NULL DEFAULT 'equity',
    display_name  VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── backtest_configurations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backtest_configurations (
    id                     TEXT            PRIMARY KEY,
    strategy_id            TEXT            REFERENCES strategies(id) ON DELETE SET NULL,
    name                   VARCHAR(120),
    data_source            VARCHAR(40),
    asset_class            VARCHAR(30),
    selected_assets        JSONB           NOT NULL DEFAULT '[]',
    start_date             DATE,
    end_date               DATE,
    timeframe              VARCHAR(10),
    initial_capital        NUMERIC(14,2),
    position_sizing_method VARCHAR(40),
    position_pct           NUMERIC(8,4),
    score                  INT,
    risk_params            JSONB           NOT NULL DEFAULT '{}',
    costs                  JSONB           NOT NULL DEFAULT '{}',
    ai_notes               JSONB           NOT NULL DEFAULT '{}',
    data                   JSONB           NOT NULL,
    created_at             TIMESTAMPTZ     DEFAULT NOW(),
    updated_at             TIMESTAMPTZ     DEFAULT NOW()
);

-- ── indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_results_ticker      ON results(ticker);
CREATE INDEX IF NOT EXISTS idx_results_created_at  ON results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategies_ticker   ON strategies(ticker);
CREATE INDEX IF NOT EXISTS idx_audit_session       ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type    ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at    ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_type      ON watchlist(asset_type);
CREATE INDEX IF NOT EXISTS idx_watchlist_updated   ON watchlist(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bt_config_strategy  ON backtest_configurations(strategy_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bt_config_updated   ON backtest_configurations(updated_at DESC);
"""


def init_db():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(_SCHEMA)
