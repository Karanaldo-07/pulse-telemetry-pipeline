"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  Play,
  RefreshCw,
  Server,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  { id: "pm2_5", label: "PM2.5", unit: "µg/m³", color: "#a1a1aa" },
  { id: "pm10", label: "PM10", unit: "µg/m³", color: "#71717a" },
  { id: "temperature_2m", label: "Temperature", unit: "°C", color: "#e4e4e7" },
  { id: "relative_humidity_2m", label: "Humidity", unit: "%", color: "#d4d4d8" },
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
        text: `Pipeline succeeded in ${res.summary.duration_ms}ms — upserted ${res.summary.rows_ingested} rows.`,
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
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans antialiased selection:bg-zinc-800 pb-12">
      {/* Floating Glassmorphic Top Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[#050505]/70 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-900 border border-white/10 text-zinc-300">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-medium tracking-tight">PulseETL</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleRunPipeline}
            disabled={isTriggering}
            className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-white shadow-sm disabled:opacity-50"
          >
            <Play className="h-3 w-3 fill-current" />
            {isTriggering ? "Running..." : "Run Pipeline"}
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 pt-8 sm:px-6 lg:px-8">
        {bannerMsg && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${
              bannerMsg.type === "ok"
                ? "border-green-500/20 bg-green-500/10 text-green-400"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {bannerMsg.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {bannerMsg.text}
          </div>
        )}

        {/* Header & City Tabs */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Environment Overview</h2>
            <p className="mt-1 text-sm text-zinc-500">Monitor urban telemetry and automated Z-score anomalies.</p>
          </div>
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900/50 p-1 text-zinc-400 border border-white/5">
            {CITIES.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  selectedCity === city
                    ? "bg-[#18181b] text-white shadow-sm border border-white/5"
                    : "hover:text-zinc-200"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Bento Box Layout (3 Columns) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Left Panel: Span 2 Columns (Main Chart & Audit Log) */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            
            {/* Gradient Area Chart */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] shadow-lg flex flex-col overflow-hidden">
              <div className="border-b border-white/5 bg-[#0d0d0d] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex rounded-md border border-white/10 p-0.5 bg-black">
                  {METRICS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMetric(m.id)}
                      className={`rounded-[4px] px-3 py-1 text-xs font-medium transition-all ${
                        selectedMetric === m.id
                          ? "bg-zinc-800 text-zinc-100 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {timeseries && (
                  <div className="flex gap-4 text-xs">
                    <div className="text-zinc-500">Mean (μ): <span className="font-mono text-zinc-300 ml-1">{timeseries.rolling_mean}</span></div>
                    <div className="text-zinc-500">Std Dev (σ): <span className="font-mono text-zinc-300 ml-1">{timeseries.rolling_std}</span></div>
                  </div>
                )}
              </div>
              
              <div className="p-5 h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeMetricMeta.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fill: "#52525b", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={30}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fill: "#52525b", fontSize: 11 }}
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
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.3)",
                      }}
                      itemStyle={{ color: "#f4f4f5" }}
                    />
                    {timeseries && (
                      <>
                        <ReferenceLine y={timeseries.rolling_mean} stroke="#3f3f46" strokeDasharray="4 4" />
                        <ReferenceLine y={timeseries.upper_threshold} stroke="#71717a" strokeDasharray="2 2" />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={activeMetricMeta.color}
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                      activeDot={{ r: 4, fill: activeMetricMeta.color, stroke: "#000", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] shadow-lg flex flex-col flex-1">
              <div className="border-b border-white/5 px-5 py-4">
                <h3 className="text-sm font-medium text-zinc-100">Execution Audit Log</h3>
              </div>
              <div className="overflow-x-auto p-1">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-500">Trigger</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-500">Rows</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-500">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {runs.map((r) => (
                      <tr key={r.run_id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">{r.trigger_source}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
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
                        <td className="px-4 py-3 text-xs text-zinc-300">{r.rows_ingested}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{r.duration_ms}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel: Span 1 Column (KPIs & Anomalies) */}
          <div className="flex flex-col gap-6">
            
            {/* 2x2 KPI Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4 flex flex-col justify-between aspect-square">
                <Database className="h-4 w-4 text-zinc-600 mb-4" />
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-zinc-100">{overview ? overview.total_rows.toLocaleString() : "—"}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Fact Rows</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4 flex flex-col justify-between aspect-square">
                <AlertTriangle className="h-4 w-4 text-zinc-600 mb-4" />
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-zinc-100">
                    {overview ? overview.critical_anomalies + overview.warning_anomalies : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">7D Anomalies</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4 flex flex-col justify-between aspect-square">
                <CheckCircle2 className="h-4 w-4 text-zinc-600 mb-4" />
                <div>
                  <p className="text-sm font-semibold tracking-tight text-zinc-100 truncate">{overview?.latest_run?.status || "—"}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Last Status</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4 flex flex-col justify-between aspect-square">
                <Server className="h-4 w-4 text-zinc-600 mb-4" />
                <div>
                  <p className="text-xl font-semibold tracking-tight text-zinc-100">
                    {overview?.latest_run ? `${(overview.latest_run.duration_ms / 1000).toFixed(2)}s` : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Latency</p>
                </div>
              </div>
            </div>

            {/* Anomalies Sidebar Feed */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] shadow-lg flex flex-col flex-1 h-full min-h-[300px]">
              <div className="border-b border-white/5 px-5 py-4 flex justify-between items-center">
                <h3 className="text-sm font-medium text-zinc-100">Alerts (|Z| ≥ 2.0)</h3>
                <AlertCircle className="h-4 w-4 text-zinc-600" />
              </div>
              <div className="overflow-y-auto p-2">
                {anomalies.length === 0 ? (
                  <p className="p-4 text-xs text-zinc-500 text-center">System nominal. No recent anomalies.</p>
                ) : (
                  <div className="space-y-1">
                    {anomalies.map((a) => (
                      <div key={a.id} className="rounded-lg p-3 hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-200">{a.entity_id}</span>
                            <span className="text-[10px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">{a.metric_name}</span>
                          </div>
                          <span className="font-mono text-xs font-medium text-zinc-300">
                            Z {a.z_score > 0 ? `+${a.z_score}` : a.z_score}
                          </span>
                        </div>
                        <div className="flex items-end justify-between">
                          <p className="text-[11px] text-zinc-500">
                            Obs: <span className="text-zinc-300">{a.observed_value}</span> (μ: {a.rolling_mean})
                          </p>
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${
                              a.severity === "CRITICAL"
                                ? "text-red-400 bg-red-500/10"
                                : "text-yellow-400 bg-yellow-500/10"
                            }`}
                          >
                            {a.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}