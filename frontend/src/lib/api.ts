const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const PIPELINE_TOKEN = process.env.NEXT_PUBLIC_PIPELINE_TOKEN || "pulse_secret_2026";

export interface LatestRun {
  status: string;
  rows_ingested: number;
  anomalies_found: number;
  dq_rejected_rows: number;
  duration_ms: number;
  executed_at: string;
}

export interface CitySnapshot {
  entity_id: string;
  metric_name: string;
  metric_value: number;
  recorded_at: string;
}

export interface OverviewResponse {
  total_rows: number;
  critical_anomalies: number;
  warning_anomalies: number;
  latest_run: LatestRun | null;
  latest_snapshots: CitySnapshot[];
}

export interface TimeseriesPoint {
  recorded_at: string;
  metric_value: number;
}

export interface TimeseriesResponse {
  city: string;
  metric: string;
  rolling_mean: number;
  rolling_std: number;
  upper_threshold: number;
  points: TimeseriesPoint[];
}

export interface AnomalyItem {
  id: string;
  entity_id: string;
  metric_name: string;
  observed_value: number;
  rolling_mean: number;
  rolling_std: number;
  z_score: number;
  severity: "WARNING" | "CRITICAL";
  recorded_at: string;
  detected_at: string;
}

export interface PipelineRunItem {
  run_id: string;
  trigger_source: string;
  status: string;
  rows_ingested: number;
  anomalies_found: number;
  dq_rejected_rows: number;
  duration_ms: number;
  error_message: string | null;
  executed_at: string;
}

export async function fetchOverview(): Promise<OverviewResponse> {
  const res = await fetch(`${API_BASE}/api/v1/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load overview KPIs");
  return res.json();
}

export async function fetchTimeseries(
  city: string,
  metric: string,
  hours: number = 168
): Promise<TimeseriesResponse> {
  const params = new URLSearchParams({ city, metric, hours: String(hours) });
  const res = await fetch(`${API_BASE}/api/v1/timeseries?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load time-series data");
  return res.json();
}

export async function fetchAnomalies(city: string = "ALL"): Promise<AnomalyItem[]> {
  const params = new URLSearchParams({ city, limit: "20" });
  const res = await fetch(`${API_BASE}/api/v1/anomalies?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load anomalies");
  const data = await res.json();
  return data.anomalies || [];
}

export async function fetchPipelineRuns(): Promise<PipelineRunItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/runs?limit=10`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load pipeline runs");
  const data = await res.json();
  return data.runs || [];
}

export async function triggerManualPipeline() {
  const res = await fetch(`${API_BASE}/api/v1/pipeline/trigger`, {
    method: "POST",
    headers: { "x-pipeline-token": PIPELINE_TOKEN },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Pipeline trigger failed" }));
    throw new Error(err.detail || "Pipeline trigger failed");
  }
  return res.json();
}