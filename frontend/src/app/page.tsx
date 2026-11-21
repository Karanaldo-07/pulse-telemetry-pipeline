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
  { id: "pm2_5", label: "PM2.5 (µg/m³)", color: "#a1a1aa" },
  { id: "pm10", label: "PM10 (µg/m³)", color: "#71717a" },
  { id: "temperature_2m", label: "Temperature (°C)", color: "#e4e4e7" },
  { id: "relative_humidity_2m", label: "Humidity (%)", color: "#d4d4d8" },
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
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans antialiased selection:bg-zinc-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-zinc-300 shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
                PulseETL <span className="font-normal text-zinc-500 ml-1">Telemetry Warehouse</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              onClick={handleRunPipeline}
              disabled={isTriggering}
              className="flex items-center gap-2 rounded-md bg-white px-4 py-1.5 text-xs font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {isTriggering ? "Running..." : "Run Pipeline"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-6 pt-8">
        {bannerMsg && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${
              bannerMsg.type === "ok"
                ? "border-green-500/20 bg-green-500/10 text-green-400"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {bannerMsg.type === "ok" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {bannerMsg.text}
          </div>
        )}

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Warehouse Fact Rows</span>
              <Database className="h-4 w-4 text-zinc-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
              {overview ? overview.total_rows.toLocaleString() : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">5 Cities • 4 Hourly Metrics</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">7-Day Z-Score Anomalies</span>
              <AlertTriangle className="h-4 w-4 text-zinc-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
              {overview ? overview.critical_anomalies + overview.warning_anomalies : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {overview
                ? `${overview.critical_anomalies} Critical • ${overview.warning_anomalies} Warning`
                : "Loading..."}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Last Pipeline Status</span>
              <CheckCircle2 className="h-4 w-4 text-zinc-600" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">
              {overview?.latest_run?.status || "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {overview?.latest_run
                ? `Rejected: ${overview.latest_run.dq_rejected_rows} rows`
                : "Awaiting run"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">ETL Execution Latency</span>
              <Server className="h-4 w-4 text-zinc-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
              {overview?.latest_run ? `${(overview.latest_run.duration_ms / 1000).toFixed(2)}s` : "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Batch Extract + UPSERT + Z-Score</p>
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
                className={`rounded-lg border p-4 text-left transition-all ${
                  active
                    ? "border-zinc-500 bg-zinc-900 shadow-sm"
                    : "border-white/5 bg-transparent hover:bg-zinc-900/50 hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-100">{city}</span>
                  <span className="text-xs text-zinc-400">
                    {temp ? `${temp.metric_value}°C` : ""}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500 flex justify-between items-center">
                  PM2.5 <span className="font-mono text-zinc-300">{pm25 ? pm25.metric_value : "—"}</span>
                </p>
              </button>
            );
          })}
        </div>

        {/* Interactive Time-Series Chart */}
        <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <TrendingUp className="h-4 w-4 text-zinc-500" />
                {selectedCity} — {activeMetricMeta.label}
              </h2>
              {timeseries && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  Mean (μ): <span className="text-zinc-300 font-mono ml-1 mr-3">{timeseries.rolling_mean}</span>
                  Std Dev (σ): <span className="text-zinc-300 font-mono ml-1 mr-3">{timeseries.rolling_std}</span>
                  Alert Threshold: <span className="text-zinc-300 font-mono ml-1">{timeseries.upper_threshold}</span>
                </p>
              )}
            </div>

            <div className="flex rounded-md border border-white/10 p-0.5 bg-black">
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMetric(m.id)}
                  className={`rounded-[4px] px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedMetric === m.id
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {m.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                  dy={10}
                />
                <YAxis 
                  tick={{ fill: "#71717a", fontSize: 11 }} 
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#09090b",
                    borderColor: "#27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f4f4f5",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  itemStyle={{ color: "#f4f4f5" }}
                />
                {timeseries && (
                  <>
                    <ReferenceLine
                      y={timeseries.rolling_mean}
                      stroke="#52525b"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={timeseries.upper_threshold}
                      stroke="#71717a"
                      strokeDasharray="2 2"
                    />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={activeMetricMeta.color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, fill: activeMetricMeta.color, stroke: "#000", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Z-Score Anomaly Feed */}
          <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-medium text-zinc-100">Detected Anomalies (|Z| ≥ 2.0)</h3>
            {anomalies.length === 0 ? (
              <p className="text-sm text-zinc-500">No anomalies breached ±2σ in the last 24h.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto pr-2">
                <div className="divide-y divide-white/5">
                  {anomalies.map((a) => (
                    <div key={a.id} className="py-3 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                              a.severity === "CRITICAL"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                            }`}
                          >
                            {a.severity}
                          </span>
                          <span className="text-sm font-medium text-zinc-200">{a.entity_id}</span>
                          <span className="text-xs font-mono text-zinc-500">{a.metric_name}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-zinc-500">
                          Observed: <span className="text-zinc-300">{a.observed_value}</span> (μ: {a.rolling_mean})
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-medium text-zinc-300">
                          Z = {a.z_score > 0 ? `+${a.z_score}` : a.z_score}
                        </span>
                        <p className="mt-1 text-[10px] text-zinc-600">
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
              </div>
            )}
          </div>

          {/* Pipeline Observability Audit Log */}
          <div className="rounded-xl border border-white/10 bg-[#0f0f0f] p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-medium text-zinc-100">Execution Audit Log</h3>
            <div className="max-h-[300px] overflow-y-auto pr-2">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#0f0f0f]">
                  <tr>
                    <th className="pb-3 font-medium text-zinc-500 border-b border-white/10">Trigger</th>
                    <th className="pb-3 font-medium text-zinc-500 border-b border-white/10">Status</th>
                    <th className="pb-3 font-medium text-zinc-500 border-b border-white/10">Rows</th>
                    <th className="pb-3 font-medium text-zinc-500 border-b border-white/10">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {runs.map((r) => (
                    <tr key={r.run_id}>
                      <td className="py-3 font-mono text-xs text-zinc-400">{r.trigger_source.replace('_', ' ')}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            r.status === "SUCCESS"
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : r.status === "PARTIAL_WARNING"
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-zinc-300">{r.rows_ingested}</td>
                      <td className="py-3 text-xs text-zinc-500">{r.duration_ms}ms</td>
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