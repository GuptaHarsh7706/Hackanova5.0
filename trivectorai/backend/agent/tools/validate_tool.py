REQUIRED_FIELDS = ["ticker", "entry_rules"]
VALID_INDICATORS = {"SMA", "EMA", "RSI", "MACD", "BBANDS", "PRICE", "VOLUME", "ATR", "STOCH", "VWAP"}
VALID_CONDITIONS = {"crosses_above", "crosses_below", "greater_than", "less_than", "equals", "between"}


def _to_float(value, default=None):
    try:
        return float(value)
    except Exception:
        return default


def execute_validate_tool(strategy: dict) -> dict:
    missing = []
    issues = []

    if not strategy.get("ticker"):
        missing.append("ticker")
    if not strategy.get("entry_rules"):
        missing.append("entry_rules")

    for bucket_name in ("entry_rules", "exit_rules"):
        seen = set()
        for index, rule in enumerate(strategy.get(bucket_name, [])):
            if rule.get("indicator") not in VALID_INDICATORS:
                issues.append(f"{bucket_name}[{index}]: unknown indicator '{rule.get('indicator')}'")
            if rule.get("condition") not in VALID_CONDITIONS:
                issues.append(f"{bucket_name}[{index}]: unknown condition '{rule.get('condition')}'")
            indicator = rule.get("indicator")
            condition = rule.get("condition")
            value = rule.get("value")
            params = rule.get("params", {}) or {}

            if indicator in {"SMA", "EMA"} and not params.get("period"):
                issues.append(f"{bucket_name}[{index}]: {indicator} requires a period")
            if indicator in {"SMA", "EMA"} and params.get("period") and int(params.get("period", 0)) <= 0:
                issues.append(f"{bucket_name}[{index}]: {indicator} period must be > 0")
            if indicator == "RSI":
                rsi_value = _to_float(value)
                if rsi_value is not None and not (0 <= rsi_value <= 100):
                    issues.append(f"{bucket_name}[{index}]: RSI threshold must be between 0 and 100")
            if indicator == "MACD":
                fp = int(params.get("fast_period") or 0)
                sp = int(params.get("slow_period") or 0)
                if fp and sp and fp >= sp:
                    issues.append(f"{bucket_name}[{index}]: MACD fast_period should be lower than slow_period")

            signature = (indicator, condition, str(value), str(params))
            if signature in seen:
                issues.append(f"{bucket_name}[{index}]: duplicate rule detected")
            else:
                seen.add(signature)

        if bucket_name == "entry_rules" and len(strategy.get(bucket_name, [])) >= 2:
            # Detect contradictory thresholds on same indicator for simple conditions.
            by_indicator = {}
            for rule in strategy.get(bucket_name, []):
                by_indicator.setdefault(rule.get("indicator"), []).append(rule)
            for indicator, rules in by_indicator.items():
                gt_vals = [_to_float(r.get("value")) for r in rules if r.get("condition") == "greater_than"]
                lt_vals = [_to_float(r.get("value")) for r in rules if r.get("condition") == "less_than"]
                gt_vals = [v for v in gt_vals if v is not None]
                lt_vals = [v for v in lt_vals if v is not None]
                if gt_vals and lt_vals and max(gt_vals) >= min(lt_vals):
                    issues.append(f"{bucket_name}: contradictory {indicator} thresholds may never trigger")

    position_size = strategy.get("position_size", 1.0)
    if not (0.01 <= float(position_size) <= 1.0):
        issues.append(f"position_size {position_size} must be between 0.01 and 1.0")

    stop_loss = _to_float(strategy.get("stop_loss_pct"))
    take_profit = _to_float(strategy.get("take_profit_pct"))
    if stop_loss is not None and not (0 < stop_loss <= 50):
        issues.append("stop_loss_pct should be between 0 and 50")
    if take_profit is not None and not (0 < take_profit <= 200):
        issues.append("take_profit_pct should be between 0 and 200")
    if stop_loss is not None and take_profit is not None and take_profit <= stop_loss:
        issues.append("take_profit_pct should generally be greater than stop_loss_pct")

    return {
        "valid": len(missing) == 0 and len(issues) == 0,
        "missing_fields": missing,
        "issues": issues,
        "can_run": len(missing) == 0 and len(issues) == 0,
    }
