"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Play,
  RefreshCw,
  Server,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AnomalyItem,
  OverviewResponse,
  PipelineRunItem,
  TimeseriesResponse,
  fetchAnomalies,
  fetchOverview,
  fetchPipelineRuns,
  fetchTimeseries,
  triggerManualPipeline,
} from "@/lib/api";

const CITIES = ["Pune", "Mumbai", "Bengaluru", "Delhi", "Hyderabad"];

const METRICS = [
  { id: "pm2_5", label: "PM2.5 (µg/m³)", color: "#818cf8" },
  { id: "pm10", label: "PM10 (µg/m³)", color: "#38bdf8" },
  { id: "temperature_2m", label: "Temperature (°C)", color: "#fb923c" },
  { id: "relative_humidity_2m", label: "Humidity (%)", color: "#34d399" },
];

export default function TelemetryDashboardPage() {
  const [selectedCity, setSelectedCity] = useState<string>("Pune");
  const [selectedMetric, setSelectedMetric] = useState<string>("pm2_5");

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [runs, setRuns] = useState<PipelineRunItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ov, ts, an, rn] = await Promise.all([
        fetchOverview(),
        fetchTimeseries(selectedCity, selectedMetric, 168),
        fetchAnomalies("ALL"),
        fetchPipelineRuns(),
      ]);
      setOverview(ov);
      setTimeseries(ts);
      setAnomalies(an);
      setRuns(rn);
    } catch (err: unknown) {
      setBannerMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to connect to backend API",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity, selectedMetric]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRunPipeline = async () => {
    setIsTriggering(true);
    setBannerMsg(null);
    try {
      const res = await triggerManualPipeline();
      setBannerMsg({
        type: "ok",
        text: `Pipeline succeeded in ${res.summary.duration_ms}ms — upserted ${res.summary.rows_ingested} rows (${res.summary.anomalies_found} anomalies evaluated).`,
      });
      await loadAllData();
    } catch (err: unknown) {
      setBannerMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Manual trigger failed",
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const activeMetricMeta = METRICS.find((m) => m.id === selectedMetric) || METRICS[0];

  const chartData = (timeseries?.points || []).map((p) => ({
    timeLabel: new Date(p.recorded_at).toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
    }),
    value: p.metric_value,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                PulseETL <span className="text-cyan-400">• Live Telemetry & Anomaly Warehouse</span>
              </h1>
              <p className="text-xs text-slate-400">
                Idempotent PostgreSQL UPSERT • Rolling 7-Day Z-Score Detector • GitHub Actions Cron
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              onClick={handleRunPipeline}
              disabled={isTriggering}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-950 hover:bg-cyan-500 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {isTriggering ? "Running ETL..." : "Run Live ETL Pipeline"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {bannerMsg && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              bannerMsg.type === "ok"
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
                : "border-rose-500/40 bg-rose-950/40 text-rose-200"
            }`}
          >
            {bannerMsg.text}
          </div>
        )}

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Warehouse Fact Rows</span>
              <Database className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {overview ? overview.total_rows.toLocaleString() : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">5 Cities • 4 Hourly Metrics</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>7-Day Z-Score Anomalies</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {overview ? overview.critical_anomalies + overview.warning_anomalies : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {overview
                ? `${overview.critical_anomalies} Critical (|z|≥3) • ${overview.warning_anomalies} Warning (|z|≥2)`
                : "Loading..."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Last Pipeline Status</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-400">
              {overview?.latest_run?.status || "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {overview?.latest_run
                ? `DQ Rejected: ${overview.latest_run.dq_rejected_rows} rows`
                : "Awaiting run"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>ETL Execution Latency</span>
              <Server className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {overview?.latest_run ? `${(overview.latest_run.duration_ms / 1000).toFixed(2)}s` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Batch Extract + UPSERT + Z-Score</p>
          </div>
        </div>

        {/* City Live Snapshot Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {CITIES.map((city) => {
            const pm25 = overview?.latest_snapshots.find(
              (s) => s.entity_id === city && s.metric_name === "pm2_5"
            );
            const temp = overview?.latest_snapshots.find(
              (s) => s.entity_id === city && s.metric_name === "temperature_2m"
            );
            const active = selectedCity === city;
            return (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-cyan-500 bg-cyan-950/30"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{city}</span>
                  <span className="text-xs text-slate-400">
                    {temp ? `${temp.metric_value}°C` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-cyan-300">
                  PM2.5: <span className="font-mono font-semibold">{pm25 ? pm25.metric_value : "—"}</span>
                </p>
              </button>
            );
          })}
        </div>

        {/* Interactive Time-Series Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                {selectedCity} — {activeMetricMeta.label} (7-Day Rolling Window)
              </h2>
              {timeseries && (
                <p className="mt-0.5 text-xs text-slate-400">
                  Rolling Mean (μ): <span className="text-slate-200 font-mono">{timeseries.rolling_mean}</span> •
                  Std Dev (σ): <span className="text-slate-200 font-mono">{timeseries.rolling_std}</span> •
                  +2σ Alert Threshold:{" "}
                  <span className="text-amber-400 font-mono">{timeseries.upper_threshold}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMetric(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    selectedMetric === m.id
                      ? "bg-cyan-600 text-white"
                      : "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  minTickGap={28}
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                {timeseries && (
                  <>
                    <ReferenceLine
                      y={timeseries.rolling_mean}
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      label={{ value: "Mean (μ)", fill: "#94a3b8", fontSize: 11 }}
                    />
                    <ReferenceLine
                      y={timeseries.upper_threshold}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: "+2σ Alert", fill: "#fbbf24", fontSize: 11 }}
                    />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={activeMetricMeta.color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Grid: Anomaly Alerts + Pipeline Observability Audit Log */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Z-Score Anomaly Feed */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Detected Z-Score Anomalies (|Z| ≥ 2.0)
            </h3>
            {anomalies.length === 0 ? (
              <p className="text-sm text-slate-400">No anomalies breached ±2σ in the last 24h.</p>
            ) : (
              <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {anomalies.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 font-semibold ${
                            a.severity === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {a.severity}
                        </span>
                        <span className="font-semibold text-white">{a.entity_id}</span>
                        <span className="font-mono text-slate-400">{a.metric_name}</span>
                      </div>
                      <p className="mt-1 text-slate-400">
                        Observed: <span className="text-slate-200">{a.observed_value}</span> (Mean:{" "}
                        {a.rolling_mean}, Std: {a.rolling_std})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-amber-300">
                        Z = {a.z_score > 0 ? `+${a.z_score}` : a.z_score}
                      </span>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {new Date(a.recorded_at).toLocaleString([], {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline Observability Audit Log */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Pipeline SLA & Execution Audit Log
            </h3>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="pb-2">Trigger</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Rows</th>
                    <th className="pb-2">Latency</th>
                    <th className="pb-2">Executed (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {runs.map((r) => (
                    <tr key={r.run_id}>
                      <td className="py-2 font-mono text-slate-300">{r.trigger_source}</td>
                      <td className="py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 font-semibold ${
                            r.status === "SUCCESS"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 text-slate-200">{r.rows_ingested}</td>
                      <td className="py-2 text-slate-400">{r.duration_ms}ms</td>
                      <td className="py-2 text-slate-400">
                        {new Date(r.executed_at).toLocaleString([], {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}