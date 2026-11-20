# PulseETL — Automated Data Pipeline & Live Anomaly Warehouse

An end-to-end automated data engineering pipeline and real-time observability dashboard tracking urban air quality (`PM2.5`, `PM10`) and meteorological telemetry (`Temperature`, `Humidity`) across 5 Indian metropolitan hubs (`Pune`, `Mumbai`, `Bengaluru`, `Delhi`, `Hyderabad`).

## System Architecture

```text
[GitHub Actions Cron (Every 6h)] ──┐
[Dashboard Manual Trigger] ────────┼──► [Batch Python ETL + DQ Gatekeeper]
                                              │
                                              ▼  Idempotent UPSERT (ON CONFLICT)
                                   [Supabase PostgreSQL Warehouse]
                                     ├─ raw_metrics (Composite Index)
                                     ├─ anomaly_alerts (Rolling 7d Z-Score)
                                     └─ pipeline_runs (SLA Audit Log)
                                              │
                                              ▼  REST / JSON
[Next.js + Recharts (Vercel)] ◄──── [FastAPI Serving Layer (Render)]