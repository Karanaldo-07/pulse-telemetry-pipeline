from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
import psycopg

from app.core.config import settings
from app.core.database import get_db_conn
from etl.run_pipeline import run_etl

router = APIRouter(prefix="/api/v1", tags=["Telemetry & Observability"])


@router.get("/overview")
def get_overview_kpis(conn: psycopg.Connection = Depends(get_db_conn)):
    """Returns high-level warehouse KPIs, latest city readings, and SLA health."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total_rows FROM raw_metrics;")
        total_rows = cur.fetchone()["total_rows"]

        cur.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS critical_count,
                COUNT(*) FILTER (WHERE severity = 'WARNING') AS warning_count
            FROM anomaly_alerts
            WHERE recorded_at >= NOW() - INTERVAL '7 days';
            """
        )
        alerts = cur.fetchone()

        cur.execute(
            """
            SELECT status, rows_ingested, anomalies_found, dq_rejected_rows, duration_ms, executed_at
            FROM pipeline_runs
            ORDER BY executed_at DESC
            LIMIT 1;
            """
        )
        latest_run = cur.fetchone()

        # Latest PM2.5 and Temperature snapshot across all 5 cities
        cur.execute(
            """
            SELECT DISTINCT ON (entity_id, metric_name)
                entity_id, metric_name, metric_value, recorded_at
            FROM raw_metrics
            WHERE metric_name IN ('pm2_5', 'temperature_2m')
            ORDER BY entity_id, metric_name, recorded_at DESC;
            """
        )
        latest_snapshots = cur.fetchall()

    return {
        "total_rows": total_rows,
        "critical_anomalies": alerts["critical_count"],
        "warning_anomalies": alerts["warning_count"],
        "latest_run": latest_run,
        "latest_snapshots": latest_snapshots,
    }


@router.get("/timeseries")
def get_metric_timeseries(
    city: str = Query("Pune", description="City name"),
    metric: str = Query("pm2_5", description="Metric name"),
    hours: int = Query(168, ge=24, le=336, description="Lookback window in hours"),
    conn: psycopg.Connection = Depends(get_db_conn),
):
    """Returns hourly time-series points + 7-day rolling mean/std bands for charting."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                AVG(metric_value) AS rolling_mean,
                COALESCE(STDDEV_SAMP(metric_value), 0) AS rolling_std
            FROM raw_metrics
            WHERE entity_id = %s
              AND metric_name = %s
              AND recorded_at >= NOW() - (%s || ' hours')::INTERVAL;
            """,
            (city, metric, hours),
        )
        stats = cur.fetchone()
        mean_val = round(float(stats["rolling_mean"] or 0), 2)
        std_val = round(float(stats["rolling_std"] or 0), 2)

        cur.execute(
            """
            SELECT recorded_at, metric_value
            FROM raw_metrics
            WHERE entity_id = %s
              AND metric_name = %s
              AND recorded_at >= NOW() - (%s || ' hours')::INTERVAL
            ORDER BY recorded_at ASC;
            """,
            (city, metric, hours),
        )
        points = cur.fetchall()

    return {
        "city": city,
        "metric": metric,
        "rolling_mean": mean_val,
        "rolling_std": std_val,
        "upper_threshold": round(mean_val + 2.0 * std_val, 2),
        "points": points,
    }


@router.get("/anomalies")
def get_recent_anomalies(
    city: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    conn: psycopg.Connection = Depends(get_db_conn),
):
    """Returns statistical Z-score anomaly alerts sorted by severity and recency."""
    with conn.cursor() as cur:
        if city and city != "ALL":
            cur.execute(
                """
                SELECT id, entity_id, metric_name, observed_value, rolling_mean,
                       rolling_std, z_score, severity, recorded_at, detected_at
                FROM anomaly_alerts
                WHERE entity_id = %s
                ORDER BY recorded_at DESC
                LIMIT %s;
                """,
                (city, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, entity_id, metric_name, observed_value, rolling_mean,
                       rolling_std, z_score, severity, recorded_at, detected_at
                FROM anomaly_alerts
                ORDER BY recorded_at DESC
                LIMIT %s;
                """,
                (limit,),
            )
        rows = cur.fetchall()
    return {"anomalies": rows}


@router.get("/runs")
def get_pipeline_runs(
    limit: int = Query(15, ge=1, le=50),
    conn: psycopg.Connection = Depends(get_db_conn),
):
    """Returns pipeline SLA & observability audit logs."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT run_id, trigger_source, status, rows_ingested,
                   anomalies_found, dq_rejected_rows, duration_ms, error_message, executed_at
            FROM pipeline_runs
            ORDER BY executed_at DESC
            LIMIT %s;
            """,
            (limit,),
        )
        runs = cur.fetchall()
    return {"runs": runs}


@router.post("/pipeline/trigger")
def trigger_manual_etl(x_pipeline_token: Optional[str] = Header(None)):
    """Allows authorized manual ETL execution from the dashboard UI."""
    if x_pipeline_token != settings.PIPELINE_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid pipeline trigger token")
    try:
        summary = run_etl(trigger_source="dashboard_manual", past_days=2)
        return {"message": "ETL run completed", "summary": summary}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ETL execution failed: {str(exc)}")