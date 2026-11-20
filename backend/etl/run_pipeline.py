import math
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import psycopg
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

CITIES = [
    {"name": "Pune", "lat": 18.5204, "lon": 73.8567},
    {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    {"name": "Bengaluru", "lat": 12.9716, "lon": 77.5946},
    {"name": "Delhi", "lat": 28.6139, "lon": 77.2090},
    {"name": "Hyderabad", "lat": 17.3850, "lon": 78.4867},
]

VALID_RANGES: Dict[str, Tuple[float, float]] = {
    "pm2_5": (0.0, 2000.0),
    "pm10": (0.0, 3000.0),
    "temperature_2m": (-50.0, 65.0),
    "relative_humidity_2m": (0.0, 100.0),
}

HEADERS = {"User-Agent": "PulseTelemetryPipeline/1.0 (DataEngineeringPortfolio)"}


def fetch_with_retry(url: str, params: Dict[str, Any], retries: int = 3) -> Any:
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=25)
            if resp.status_code == 429:
                wait_sec = min(int(resp.headers.get("Retry-After", 3)), 5)
                if attempt < retries - 1:
                    time.sleep(wait_sec)
                    continue
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt == retries - 1:
                raise exc
            time.sleep(2 ** attempt)
    return []


def is_valid_metric(metric_name: str, val: Any) -> bool:
    if val is None or not isinstance(val, (int, float)) or math.isnan(val) or math.isinf(val):
        return False
    low, high = VALID_RANGES[metric_name]
    return low <= float(val) <= high


def parse_batch_payload(
    payload: Any, metrics: Tuple[str, ...]
) -> Tuple[List[Tuple], int]:
    """Parses Open-Meteo multi-location JSON list and enforces Data Quality bounds."""
    valid_rows: List[Tuple] = []
    rejected_count = 0

    # Open-Meteo returns a list of dicts when multiple coordinates are passed
    items = payload if isinstance(payload, list) else [payload]

    for city, city_data in zip(CITIES, items):
        hourly = city_data.get("hourly", {})
        times = hourly.get("time", [])

        for metric in metrics:
            values = hourly.get(metric, [])
            for ts_str, val in zip(times, values):
                if is_valid_metric(metric, val):
                    recorded_at = datetime.fromisoformat(ts_str).replace(tzinfo=timezone.utc)
                    valid_rows.append((city["name"], metric, round(float(val), 2), recorded_at))
                else:
                    rejected_count += 1

    return valid_rows, rejected_count


def extract_and_validate_all(past_days: int = 7) -> Tuple[List[Tuple], int, List[str]]:
    """Batch-extracts air quality and weather telemetry with graceful degradation on upstream 429s."""
    lats = ",".join(str(c["lat"]) for c in CITIES)
    lons = ",".join(str(c["lon"]) for c in CITIES)
    all_rows: List[Tuple] = []
    total_rejected = 0
    warnings: List[str] = []

    # Call 1: Air Quality across all 5 cities
    aq_payload = fetch_with_retry(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        {
            "latitude": lats,
            "longitude": lons,
            "hourly": "pm2_5,pm10",
            "past_days": past_days,
            "forecast_days": 0,
            "timezone": "UTC",
        },
    )
    aq_rows, aq_rejected = parse_batch_payload(aq_payload, ("pm2_5", "pm10"))
    all_rows.extend(aq_rows)
    total_rejected += aq_rejected

    time.sleep(1.0)

    # Call 2: Weather across all 5 cities (degrades gracefully if upstream IP is rate-limited)
    try:
        wx_payload = fetch_with_retry(
            "https://api.open-meteo.com/v1/forecast",
            {
                "latitude": lats,
                "longitude": lons,
                "hourly": "temperature_2m,relative_humidity_2m",
                "past_days": past_days,
                "forecast_days": 0,
                "timezone": "UTC",
            },
        )
        wx_rows, wx_rejected = parse_batch_payload(
            wx_payload, ("temperature_2m", "relative_humidity_2m")
        )
        all_rows.extend(wx_rows)
        total_rejected += wx_rejected
    except requests.HTTPError as exc:
        if exc.response is not None and exc.response.status_code == 429:
            warnings.append("Weather endpoint rate-limited (429) on shared cloud IP; ingested Air Quality batch.")
        else:
            raise exc

    return all_rows, total_rejected, warnings


def detect_zscore_anomalies(cur: psycopg.Cursor) -> int:
    """Computes rolling 7-day Z-scores for recent 24h readings and upserts anomalies."""
    cur.execute(
        """
        WITH stats AS (
            SELECT
                entity_id,
                metric_name,
                AVG(metric_value) AS rolling_mean,
                STDDEV_SAMP(metric_value) AS rolling_std
            FROM raw_metrics
            WHERE recorded_at >= NOW() - INTERVAL '7 days'
            GROUP BY entity_id, metric_name
            HAVING COUNT(*) >= 24 AND STDDEV_SAMP(metric_value) > 0.001
        ),
        scored AS (
            SELECT
                rm.entity_id,
                rm.metric_name,
                rm.metric_value AS observed_value,
                s.rolling_mean,
                s.rolling_std,
                (rm.metric_value - s.rolling_mean) / s.rolling_std AS z_score,
                rm.recorded_at
            FROM raw_metrics rm
            JOIN stats s
              ON rm.entity_id = s.entity_id
             AND rm.metric_name = s.metric_name
            WHERE rm.recorded_at >= NOW() - INTERVAL '24 hours'
        )
        INSERT INTO anomaly_alerts (
            entity_id, metric_name, observed_value, rolling_mean, rolling_std, z_score, severity, recorded_at
        )
        SELECT
            entity_id,
            metric_name,
            ROUND(observed_value::numeric, 2),
            ROUND(rolling_mean::numeric, 2),
            ROUND(rolling_std::numeric, 2),
            ROUND(z_score::numeric, 2),
            CASE WHEN ABS(z_score) >= 3.0 THEN 'CRITICAL' ELSE 'WARNING' END,
            recorded_at
        FROM scored
        WHERE ABS(z_score) >= 2.0
        ON CONFLICT (entity_id, metric_name, recorded_at)
        DO UPDATE SET
            observed_value = EXCLUDED.observed_value,
            rolling_mean = EXCLUDED.rolling_mean,
            rolling_std = EXCLUDED.rolling_std,
            z_score = EXCLUDED.z_score,
            severity = EXCLUDED.severity,
            detected_at = NOW();
        """
    )
    return cur.rowcount or 0


def run_etl(trigger_source: str = "manual_cli", past_days: int = 7) -> Dict[str, Any]:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is missing.")

    t0 = time.perf_counter()
    total_rejected = 0

    try:
        all_rows, total_rejected, warnings = extract_and_validate_all(past_days=past_days)

        with psycopg.connect(database_url, prepare_threshold=None) as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO raw_metrics (entity_id, metric_name, metric_value, recorded_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (entity_id, metric_name, recorded_at)
                    DO UPDATE SET
                        metric_value = EXCLUDED.metric_value,
                        ingested_at = NOW();
                    """,
                    all_rows,
                )
                rows_ingested = len(all_rows)
                anomalies_found = detect_zscore_anomalies(cur)
                duration_ms = int((time.perf_counter() - t0) * 1000)

                status = "PARTIAL_WARNING" if (total_rejected > 0 or warnings) else "SUCCESS"
                warn_msg = "; ".join(warnings)[:500] if warnings else None
                cur.execute(
                    """
                    INSERT INTO pipeline_runs (
                        trigger_source, status, rows_ingested, anomalies_found, dq_rejected_rows, duration_ms, error_message
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """,
                    (trigger_source, status, rows_ingested, anomalies_found, total_rejected, duration_ms, warn_msg),
                )
            conn.commit()

        summary = {
            "status": status,
            "rows_ingested": rows_ingested,
            "anomalies_found": anomalies_found,
            "dq_rejected_rows": total_rejected,
            "duration_ms": duration_ms,
        }
        print(f"[ETL COMPLETE] {summary}")
        return summary

    except Exception as exc:
        duration_ms = int((time.perf_counter() - t0) * 1000)
        try:
            with psycopg.connect(database_url, prepare_threshold=None) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO pipeline_runs (
                            trigger_source, status, rows_ingested, anomalies_found, dq_rejected_rows, duration_ms, error_message
                        )
                        VALUES (%s, 'FAILED', 0, 0, %s, %s, %s);
                        """,
                        (trigger_source, total_rejected, duration_ms, str(exc)[:500]),
                    )
                conn.commit()
        except Exception:
            pass
        raise exc


if __name__ == "__main__":
    source = sys.argv[1] if len(sys.argv) > 1 else "manual_cli"
    run_etl(trigger_source=source, past_days=7)