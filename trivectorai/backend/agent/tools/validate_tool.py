REQUIRED_FIELDS = ["ticker", "entry_rules"]
VALID_INDICATORS = {"SMA", "EMA", "RSI", "MACD", "BBANDS", "PRICE", "VOLUME", "ATR", "STOCH", "VWAP"}
VALID_CONDITIONS = {"crosses_above", "crosses_below", "greater_than", "less_than", "equals", "between"}


def execute_validate_tool(strategy: dict) -> dict:
    missing = []
    issues = []

    if not strategy.get("ticker"):
        missing.append("ticker")
    if not strategy.get("entry_rules"):
        missing.append("entry_rules")

    for bucket_name in ("entry_rules", "exit_rules"):
        for index, rule in enumerate(strategy.get(bucket_name, [])):
            if rule.get("indicator") not in VALID_INDICATORS:
                issues.append(f"{bucket_name}[{index}]: unknown indicator '{rule.get('indicator')}'")
            if rule.get("condition") not in VALID_CONDITIONS:
                issues.append(f"{bucket_name}[{index}]: unknown condition '{rule.get('condition')}'")
            indicator = rule.get("indicator")
            params = rule.get("params", {}) or {}
            if indicator in {"SMA", "EMA"} and not params.get("period"):
                issues.append(f"{bucket_name}[{index}]: {indicator} requires a period")

    position_size = strategy.get("position_size", 1.0)
    if not (0.01 <= float(position_size) <= 1.0):
        issues.append(f"position_size {position_size} must be between 0.01 and 1.0")

    return {
        "valid": len(missing) == 0 and len(issues) == 0,
        "missing_fields": missing,
        "issues": issues,
        "can_run": len(missing) == 0,
    }
