from __future__ import annotations

import copy
import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from database.repository import (
    add_watchlist_symbol,
    get_backtest_configuration,
    get_strategy_by_id,
    get_watchlist_symbols,
    list_saved_strategies,
    list_backtest_configurations,
    save_backtest_configuration,
)
from models.backtest_config_schema import (
    AssetsResponse,
    BacktestConfiguration,
    DataRangeRequest,
    DataRangeResponse,
    RunConfigRequest,
    RunConfigResponse,
    SaveConfigRequest,
    SaveConfigResponse,
    ScoreConfigResponse,
    StrategySummaryResponse,
    ValidateConfigResponse,
)
from services.backtest_agentic_service import start_backtest_job
from services.backtest_config_service import (
    estimate_data_range,
    score_configuration,
    supported_data_sources,
    validate_configuration,
)

router = APIRouter(prefix="/api/backtest-config", tags=["backtest-config"])

# Fallback cache for local/dev mode when DB is unavailable.
_CONFIG_CACHE: dict[str, dict] = {}


@router.get("/strategy-summary", response_model=StrategySummaryResponse)
async def strategy_summary(strategy_id: str | None = None):
    strategy = get_strategy_by_id(strategy_id) if strategy_id else None

    # If strategy_id is not provided (or not found), use most recently saved strategy.
    if not strategy:
        try:
            latest = list_saved_strategies(limit=1)
            strategy = latest[0] if latest else None
        except Exception:
            strategy = None

    if not strategy:
        return StrategySummaryResponse(
            strategy_id=None,
            strategy_name="Golden Cross Momentum",
            strategy_type="Momentum Crossover",
            timeframe="1h",
            indicators_active=6,
            confidence_score=82.0,
        )

    indicators = strategy.get("indicators") or []
    if not indicators and isinstance(strategy.get("entry_conditions"), list):
        indicators = strategy["entry_conditions"]
    if not indicators and isinstance(strategy.get("entry_rules"), list):
        indicators = strategy["entry_rules"]

    strategy_name = strategy.get("name") or strategy.get("title")
    if not strategy_name:
        raw_input = str(strategy.get("raw_input") or "").strip()
        strategy_name = raw_input[:60] + ("..." if len(raw_input) > 60 else "") if raw_input else "Parsed Strategy"

    return StrategySummaryResponse(
        strategy_id=strategy.get("id"),
        strategy_name=strategy_name,
        strategy_type=strategy.get("strategy_type") or "Custom Rule Strategy",
        timeframe=strategy.get("timeframe") or "1h",
        indicators_active=max(1, len(indicators) if isinstance(indicators, list) else 1),
        confidence_score=float(strategy.get("confidence_score") or 75.0),
    )


@router.get("/assets", response_model=AssetsResponse)
async def list_assets(asset_class: str = Query("equity")):
    symbols = get_watchlist_symbols(asset_type=asset_class)
    if not symbols:
        symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN", "NVDA"]

    items = [
        {
            "symbol": symbol,
            "display_name": symbol,
            "asset_class": asset_class,
        }
        for symbol in symbols
    ]
    return AssetsResponse(items=items, defaults=symbols[:4])


@router.post("/assets")
async def add_asset(payload: dict):
    symbol = str(payload.get("symbol", "")).strip().upper() if isinstance(payload, dict) else ""
    asset_class = str(payload.get("asset_class", "equity")) if isinstance(payload, dict) else "equity"
    if not symbol:
        raise HTTPException(status_code=422, detail="symbol is required")
    saved = add_watchlist_symbol(symbol, asset_type=asset_class)
    return {"status": "ok", "symbol": saved}


@router.get("/data-sources")
async def get_data_sources():
    return {"items": supported_data_sources()}


@router.post("/data-range", response_model=DataRangeResponse)
async def data_range_meta(req: DataRangeRequest):
    meta = estimate_data_range(
        start_date=req.start_date,
        end_date=req.end_date,
        timeframe=req.timeframe,
        assets_count=max(1, len(req.selected_assets)),
    )
    return DataRangeResponse(**meta)


@router.post("/validate", response_model=ValidateConfigResponse)
async def validate_config(payload: SaveConfigRequest):
    issues, readiness_score, can_run = validate_configuration(payload.config)
    return ValidateConfigResponse(valid=can_run, readiness_score=readiness_score, can_run=can_run, issues=issues)


@router.post("/score", response_model=ScoreConfigResponse)
async def score_config(payload: SaveConfigRequest):
    scored = score_configuration(payload.config)
    return ScoreConfigResponse(
        score=scored["score"],
        score_band=scored["score_band"],
        risk_label=scored["risk_label"],
        estimated_runtime_seconds=scored["estimated_runtime_seconds"],
        estimated_data_points=scored["estimated_data_points"],
        strengths=scored["strengths"],
        warnings=scored["warnings"],
        suggestions=scored["suggestions"],
    )


@router.post("/save", response_model=SaveConfigResponse)
async def save_config(payload: SaveConfigRequest):
    config = payload.config
    config_id = config.id or f"cfg-{uuid.uuid4().hex[:12]}"
    score_data = score_configuration(config)

    full_payload = config.model_dump()
    full_payload["id"] = config_id
    full_payload["score"] = score_data["score"]
    full_payload["ai"] = {
        "score_band": score_data["score_band"],
        "risk_label": score_data["risk_label"],
        "warnings": score_data["warnings"],
        "suggestions": score_data["suggestions"],
    }

    try:
        save_backtest_configuration(config_id, full_payload)
        _CONFIG_CACHE[config_id] = copy.deepcopy(full_payload)
        return SaveConfigResponse(status="ok", configuration_id=config_id, message="Configuration saved")
    except Exception:
        _CONFIG_CACHE[config_id] = copy.deepcopy(full_payload)
        return SaveConfigResponse(
            status="ok",
            configuration_id=config_id,
            message="Configuration saved (fallback cache mode: DB unavailable)",
        )


@router.get("/saved")
async def list_saved_configs(strategy_id: str | None = None, limit: int = Query(50, ge=1, le=200)):
    try:
        items = list_backtest_configurations(strategy_id=strategy_id, limit=limit)
        if items:
            for item in items:
                item_id = item.get("id")
                if item_id:
                    _CONFIG_CACHE[item_id] = copy.deepcopy(item)
            return {"items": items}
    except Exception:
        pass

    cached = list(_CONFIG_CACHE.values())
    if strategy_id:
        cached = [item for item in cached if item.get("strategy_id") == strategy_id]
    return {"items": cached[:limit]}


@router.get("/saved/{configuration_id}")
async def get_saved_config(configuration_id: str):
    try:
        item = get_backtest_configuration(configuration_id)
        if item:
            _CONFIG_CACHE[configuration_id] = copy.deepcopy(item)
            return item
    except Exception:
        pass

    cached = _CONFIG_CACHE.get(configuration_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return copy.deepcopy(cached)


@router.post("/run", response_model=RunConfigResponse)
async def run_from_configuration(req: RunConfigRequest):
    config_payload = None

    if req.configuration_id:
        try:
            config_payload = get_backtest_configuration(req.configuration_id)
        except Exception:
            config_payload = None
        if not config_payload:
            config_payload = _CONFIG_CACHE.get(req.configuration_id)
        if not config_payload:
            raise HTTPException(status_code=404, detail="Configuration not found")
    elif req.config:
        config_payload = req.config.model_dump()
    else:
        raise HTTPException(status_code=422, detail="configuration_id or config is required")

    strategy = dict(req.strategy or {})
    if not strategy:
        strategy = {
            "ticker": (config_payload.get("selected_assets") or ["AAPL"])[0],
            "timeframe": config_payload.get("timeframe", "1h"),
            "asset_class": config_payload.get("asset_class", "equity"),
            "stop_loss_pct": (config_payload.get("risk_parameters") or {}).get("stop_loss_pct", 2.0),
            "take_profit_pct": (config_payload.get("risk_parameters") or {}).get("take_profit_pct", 5.0),
            "position_size": max(0.01, min(1.0, float(config_payload.get("position_pct", 5.0)) / 100.0)),
        }

    strategy["ticker"] = strategy.get("ticker") or (config_payload.get("selected_assets") or ["AAPL"])[0]
    strategy["timeframe"] = strategy.get("timeframe") or config_payload.get("timeframe", "1h")
    strategy["asset_class"] = strategy.get("asset_class") or config_payload.get("asset_class", "equity")

    meta = estimate_data_range(
        start_date=date.fromisoformat(str(config_payload.get("start_date"))),
        end_date=date.fromisoformat(str(config_payload.get("end_date"))),
        timeframe=strategy["timeframe"],
        assets_count=max(1, len(config_payload.get("selected_assets") or [])),
    )

    strategy["configuration"] = {
        "id": config_payload.get("id"),
        "selected_assets": config_payload.get("selected_assets") or [],
        "data_source": config_payload.get("data_source"),
        "date_range": {
            "start_date": config_payload.get("start_date"),
            "end_date": config_payload.get("end_date"),
        },
        "initial_capital": config_payload.get("initial_capital"),
        "position_sizing_method": config_payload.get("position_sizing_method"),
        "position_pct": config_payload.get("position_pct"),
        "risk_parameters": config_payload.get("risk_parameters") or {},
        "transaction_costs": config_payload.get("transaction_costs") or {},
        "estimated_runtime_seconds": meta["estimated_runtime_seconds"],
    }

    job = start_backtest_job(
        strategy=strategy,
        session_id=req.session_id,
        natural_language=req.natural_language or "Backtest run from Backtest Configuration screen",
    )

    return RunConfigResponse(
        status="accepted",
        job_id=job.id,
        stream_url=f"/api/backtests/{job.id}/stream",
        status_url=f"/api/backtests/{job.id}",
        result_url=f"/api/backtests/{job.id}/result",
    )
