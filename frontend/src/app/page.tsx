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
  MapPin,
  Clock,
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
  { id: "pm2_5", label: "PM2.5", unit: "µg/m³", color: "#6366f1" }, // Indigo
  { id: "pm10", label: "PM10", unit: "µg/m³", color: "#0ea5e9" }, // Sky Blue
  { id: "temperature_2m", label: "Temperature", unit: "°C", color: "#f59e0b" }, // Amber
  { id: "relative_humidity_2m", label: "Humidity", unit: "%", color: "#10b981" }, // Emerald
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
      
      // Auto-hide success banner after 5s
      setTimeout(() => setBannerMsg(null), 5000);
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
    // FULL SCREEN WRAPPER (h-screen overflow-hidden)
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-slate-950 font-sans text-slate-50 antialiased selection:bg-indigo-500/30">
      
      {/* VIBRANT AMBIENT BACKGROUND MESH */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[20%] h-[50%] w-[50%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[50%] w-[50%] rounded-full bg-emerald-600/10 blur-[120px]" />
      </div>

      {/* FLOATING HEADER */}
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/60 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Pulse<span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">ETL</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {bannerMsg && (
            <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium border ${
              bannerMsg.type === "ok" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}>
              {bannerMsg.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {bannerMsg.text}
            </div>
          )}
          
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={handleRunPipeline}
            disabled={isTriggering}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 hover:from-indigo-500 hover:to-blue-400 disabled:pointer-events-none disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            {isTriggering ? "Running Pipeline..." : "Run Live ETL"}
          </button>
        </div>
      </header>

      {/* FULL SCREEN MAIN BODY */}
      <main className="relative z-10 flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR (Scrollable, 400px fixed width) */}
        <aside className="flex w-[400px] flex-col gap-6 overflow-y-auto border-r border-white/10 bg-slate-900/40 p-6 custom-scrollbar backdrop-blur-md">
          
          {/* Section: City Selector */}
          <div>
            <h2 className="mb-3 text-sm font-bold tracking-wider text-slate-400 uppercase">Region Selector</h2>
            <div className="grid grid-cols-2 gap-2">
              {CITIES.map((city) => {
                const isActive = selectedCity === city;
                return (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                      isActive
                        ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <span className={`text-sm font-semibold ${isActive ? "text-indigo-400" : "text-slate-300"}`}>
                      {city}
                    </span>
                    <MapPin className={`h-4 w-4 ${isActive ? "text-indigo-500" : "text-slate-600"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Vibrant KPI Cards */}
          <div>
            <h2 className="mb-3 text-sm font-bold tracking-wider text-slate-400 uppercase">System Status</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col justify-between rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 shadow-inner">
                <Database className="mb-2 h-5 w-5 text-blue-400" />
                <p className="text-2xl font-bold text-white">{overview ? overview.total_rows.toLocaleString() : "—"}</p>
                <p className="text-xs text-blue-300/70">Total Fact Rows</p>
              </div>
              <div className="flex flex-col justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 shadow-inner">
                <AlertTriangle className="mb-2 h-5 w-5 text-amber-400" />
                <p className="text-2xl font-bold text-white">{overview ? overview.critical_anomalies + overview.warning_anomalies : "—"}</p>
                <p className="text-xs text-amber-300/70">7-Day Anomalies</p>
              </div>
              <div className="flex flex-col justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 shadow-inner">
                <CheckCircle2 className="mb-2 h-5 w-5 text-emerald-400" />
                <p className="text-lg font-bold text-white truncate">{overview?.latest_run?.status || "—"}</p>
                <p className="text-xs text-emerald-300/70">Last Pipeline Run</p>
              </div>
              <div className="flex flex-col justify-between rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 shadow-inner">
                <Server className="mb-2 h-5 w-5 text-purple-400" />
                <p className="text-xl font-bold text-white">{overview?.latest_run ? `${(overview.latest_run.duration_ms / 1000).toFixed(2)}s` : "—"}</p>
                <p className="text-xs text-purple-300/70">Execution Latency</p>
              </div>
            </div>
          </div>

          {/* Section: Z-Score Anomaly Feed */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <h2 className="mb-3 text-sm font-bold tracking-wider text-slate-400 uppercase">Anomaly Alerts</h2>
            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 p-2 custom-scrollbar">
              {anomalies.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center opacity-50">
                  <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
                  <p className="text-sm text-emerald-400">System nominal.<br/>No anomalies in 24h.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {anomalies.map((a) => (
                    <div key={a.id} className="rounded-lg bg-slate-950 p-3 border border-slate-800 transition hover:border-slate-600">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-200">{a.entity_id}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${
                          a.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                        }`}>
                          {a.severity}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs text-slate-400">{a.metric_name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Observed: <span className="text-slate-300">{a.observed_value}</span></p>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono text-sm font-bold ${a.z_score >= 3.0 ? "text-rose-400" : "text-amber-400"}`}>
                            Z = {a.z_score > 0 ? `+${a.z_score}` : a.z_score}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN AREA (Flex 1, contains Chart + Audit Log) */}
        <section className="flex flex-1 flex-col overflow-hidden p-6 gap-6">
          
          {/* Main Chart Area (Takes up top portion) */}
          <div className="flex min-h-[450px] flex-1 flex-col rounded-2xl border border-white/10 bg-slate-900/60 shadow-2xl backdrop-blur-md">
            
            {/* Chart Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5" style={{ color: activeMetricMeta.color }} />
                <h2 className="text-lg font-bold text-white">
                  {selectedCity} <span className="font-light text-slate-400">/</span> {activeMetricMeta.label}
                </h2>
              </div>
              
              <div className="flex items-center gap-4">
                {timeseries && (
                  <div className="hidden items-center gap-4 rounded-lg bg-slate-950 px-4 py-1.5 border border-slate-800 xl:flex">
                    <p className="text-xs text-slate-400">Mean: <span className="font-mono text-slate-200">{timeseries.rolling_mean}</span></p>
                    <div className="h-3 w-px bg-slate-700" />
                    <p className="text-xs text-slate-400">Alert Threshold: <span className="font-mono text-rose-400">{timeseries.upper_threshold}</span></p>
                  </div>
                )}
                <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1">
                  {METRICS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMetric(m.id)}
                      className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
                        selectedMetric === m.id
                          ? "bg-slate-800 text-white shadow"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                      style={{ color: selectedMetric === m.id ? m.color : undefined }}
                    >
                      {m.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recharts Area */}
            <div className="flex-1 p-6 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeMetricMeta.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={40}
                    dy={10}
                  />
                  <YAxis 
                    tick={{ fill: "#64748b", fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "12px",
                      fontSize: "13px",
                      color: "#f8fafc",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
                    }}
                    itemStyle={{ color: activeMetricMeta.color, fontWeight: "bold" }}
                  />
                  {timeseries && (
                    <>
                      <ReferenceLine y={timeseries.rolling_mean} stroke="#475569" strokeDasharray="4 4" />
                      <ReferenceLine y={timeseries.upper_threshold} stroke="#ef4444" strokeDasharray="4 4" />
                    </>
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={activeMetricMeta.color}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorGradient)"
                    activeDot={{ r: 6, fill: activeMetricMeta.color, stroke: "#020617", strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audit Log Table (Fixed Height at Bottom) */}
          <div className="flex h-[35%] min-h-[200px] flex-col rounded-2xl border border-white/10 bg-slate-900/60 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
              <Clock className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-bold tracking-wider text-slate-300 uppercase">Pipeline Execution Audit Log</h3>
            </div>
            <div className="flex-1 overflow-auto p-1 custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-400">Trigger Source</th>
                    <th className="px-6 py-3 font-semibold text-slate-400">Status</th>
                    <th className="px-6 py-3 font-semibold text-slate-400">Rows Ingested</th>
                    <th className="px-6 py-3 font-semibold text-slate-400">Latency</th>
                    <th className="px-6 py-3 font-semibold text-slate-400">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {runs.map((r) => (
                    <tr key={r.run_id} className="transition-colors hover:bg-slate-800/50">
                      <td className="px-6 py-3 font-mono text-xs text-slate-300">{r.trigger_source}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold border ${
                            r.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                            r.status === "PARTIAL_WARNING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : 
                            "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-200 font-medium">{r.rows_ingested}</td>
                      <td className="px-6 py-3 text-slate-400">{r.duration_ms}ms</td>
                      <td className="px-6 py-3 text-slate-500 text-xs">
                        {new Date(r.executed_at).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </section>
      </main>
      
      {/* Global styles for custom scrollbar embedded for convenience */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}