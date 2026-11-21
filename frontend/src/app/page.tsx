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

// Muted, professional palette replacing vibrant neons
const METRICS = [
  { id: "pm2_5", label: "PM2.5", unit: "µg/m³", color: "#ffffff" }, // Pure White
  { id: "pm10", label: "PM10", unit: "µg/m³", color: "#a1a1aa" }, // Zinc 400
  { id: "temperature_2m", label: "Temperature", unit: "°C", color: "#fbbf24" }, // Muted Amber
  { id: "relative_humidity_2m", label: "Humidity", unit: "%", color: "#60a5fa" }, // Muted Blue
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
    // FULL SCREEN WRAPPER - Pure Black Foundation
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-black font-sans text-zinc-100 antialiased selection:bg-zinc-800">
      
      {/* HEADER - Clean, structural, minimalist */}
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-black px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-900 border border-zinc-800">
            <Activity className="h-4 w-4 text-zinc-100" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              PulseETL <span className="font-normal text-zinc-500 ml-1">Data Warehouse</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {bannerMsg && (
            <div className={`flex items-center gap-2 rounded px-3 py-1 text-xs font-medium border ${
              bannerMsg.type === "ok" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {bannerMsg.type === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {bannerMsg.text}
            </div>
          )}
          
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          {/* High-contrast Apple/Vercel style primary action button */}
          <button
            onClick={handleRunPipeline}
            disabled={isTriggering}
            className="flex items-center gap-2 rounded-md bg-white px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-50"
          >
            <Play className="h-3 w-3 fill-current" />
            {isTriggering ? "Running..." : "Run Pipeline"}
          </button>
        </div>
      </header>

      {/* MAIN BODY */}
      <main className="relative z-10 flex flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR (Scrollable, fixed width, flat design) */}
        <aside className="flex w-[380px] flex-col gap-8 overflow-y-auto border-r border-zinc-800/80 bg-[#0a0a0a] p-6 custom-scrollbar">
          
          {/* Section: City Selector */}
          <div>
            <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Region</h2>
            <div className="grid grid-cols-2 gap-2">
              {CITIES.map((city) => {
                const isActive = selectedCity === city;
                return (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`flex items-center justify-between rounded-md border p-2.5 transition-all ${
                      isActive
                        ? "border-zinc-500 bg-zinc-800/50"
                        : "border-zinc-800/50 bg-transparent hover:border-zinc-700"
                    }`}
                  >
                    <span className={`text-xs font-medium ${isActive ? "text-zinc-100" : "text-zinc-400"}`}>
                      {city}
                    </span>
                    <MapPin className={`h-3.5 w-3.5 ${isActive ? "text-zinc-300" : "text-zinc-600"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Minimalist KPI Cards */}
          <div>
            <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Metrics</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col justify-between rounded-md border border-zinc-800/80 bg-black p-3.5">
                <Database className="mb-3 h-4 w-4 text-zinc-500" />
                <p className="text-xl font-semibold tracking-tight text-zinc-100">{overview ? overview.total_rows.toLocaleString() : "—"}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Total Fact Rows</p>
              </div>
              <div className="flex flex-col justify-between rounded-md border border-zinc-800/80 bg-black p-3.5">
                <AlertTriangle className="mb-3 h-4 w-4 text-zinc-500" />
                <p className="text-xl font-semibold tracking-tight text-zinc-100">{overview ? overview.critical_anomalies + overview.warning_anomalies : "—"}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">7-Day Anomalies</p>
              </div>
              <div className="flex flex-col justify-between rounded-md border border-zinc-800/80 bg-black p-3.5">
                <CheckCircle2 className="mb-3 h-4 w-4 text-zinc-500" />
                <p className="text-sm font-semibold tracking-tight text-zinc-100 truncate">{overview?.latest_run?.status || "—"}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Last Pipeline Run</p>
              </div>
              <div className="flex flex-col justify-between rounded-md border border-zinc-800/80 bg-black p-3.5">
                <Server className="mb-3 h-4 w-4 text-zinc-500" />
                <p className="text-xl font-semibold tracking-tight text-zinc-100">{overview?.latest_run ? `${(overview.latest_run.duration_ms / 1000).toFixed(2)}s` : "—"}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Execution Latency</p>
              </div>
            </div>
          </div>

          {/* Section: Z-Score Anomaly Feed */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Alerts</h2>
            <div className="flex-1 overflow-y-auto rounded-md border border-zinc-800/80 bg-black p-1 custom-scrollbar">
              {anomalies.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center opacity-60">
                  <CheckCircle2 className="mb-2 h-6 w-6 text-zinc-500" />
                  <p className="text-xs text-zinc-400">System nominal.<br/>No anomalies in 24h.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {anomalies.map((a) => (
                    <div key={a.id} className="rounded p-3 transition hover:bg-zinc-900/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-zinc-200">{a.entity_id}</span>
                        <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
                          a.severity === "CRITICAL" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
                        }`}>
                          {a.severity}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[11px] text-zinc-500">{a.metric_name}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">Obs: <span className="text-zinc-400">{a.observed_value}</span></p>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono text-xs font-medium ${a.z_score >= 3.0 ? "text-red-400" : "text-yellow-400"}`}>
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

        {/* RIGHT MAIN AREA (Flat panels, utilitarian structure) */}
        <section className="flex flex-1 flex-col overflow-hidden p-6 gap-6 bg-black">
          
          {/* Main Chart Area */}
          <div className="flex min-h-[450px] flex-1 flex-col rounded-lg border border-zinc-800/80 bg-[#0a0a0a]">
            
            {/* Chart Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-medium text-zinc-100">
                  {selectedCity} <span className="text-zinc-600 px-1">/</span> {activeMetricMeta.label}
                </h2>
              </div>
              
              <div className="flex items-center gap-5">
                {timeseries && (
                  <div className="hidden items-center gap-4 xl:flex">
                    <p className="text-[11px] text-zinc-500">Mean: <span className="font-mono text-zinc-300">{timeseries.rolling_mean}</span></p>
                    <div className="h-3 w-px bg-zinc-800" />
                    <p className="text-[11px] text-zinc-500">Alert: <span className="font-mono text-zinc-300">{timeseries.upper_threshold}</span></p>
                  </div>
                )}
                <div className="flex rounded border border-zinc-800 bg-black p-0.5">
                  {METRICS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMetric(m.id)}
                      className={`rounded-sm px-3 py-1 text-[11px] font-medium transition-all ${
                        selectedMetric === m.id
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {m.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recharts Area - Stark, minimal visualization */}
            <div className="flex-1 p-6 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeMetricMeta.color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={40}
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
                      backgroundColor: "#000000",
                      borderColor: "#27272a",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "#fafafa",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.5)",
                    }}
                    itemStyle={{ color: activeMetricMeta.color, fontWeight: "500" }}
                  />
                  {timeseries && (
                    <>
                      <ReferenceLine y={timeseries.rolling_mean} stroke="#52525b" strokeDasharray="4 4" />
                      <ReferenceLine y={timeseries.upper_threshold} stroke="#71717a" strokeDasharray="2 2" />
                    </>
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={activeMetricMeta.color}
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorGradient)"
                    activeDot={{ r: 4, fill: "#000", stroke: activeMetricMeta.color, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="flex h-[35%] min-h-[220px] flex-col rounded-lg border border-zinc-800/80 bg-[#0a0a0a]">
            <div className="flex items-center gap-2 border-b border-zinc-800/80 px-6 py-3.5">
              <Clock className="h-4 w-4 text-zinc-500" />
              <h3 className="text-xs font-medium text-zinc-300">Execution Audit Log</h3>
            </div>
            <div className="flex-1 overflow-auto p-1 custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0a0a0a] z-10">
                  <tr>
                    <th className="px-6 py-2.5 font-medium text-zinc-500 border-b border-zinc-800/50">Trigger Source</th>
                    <th className="px-6 py-2.5 font-medium text-zinc-500 border-b border-zinc-800/50">Status</th>
                    <th className="px-6 py-2.5 font-medium text-zinc-500 border-b border-zinc-800/50">Rows Ingested</th>
                    <th className="px-6 py-2.5 font-medium text-zinc-500 border-b border-zinc-800/50">Latency</th>
                    <th className="px-6 py-2.5 font-medium text-zinc-500 border-b border-zinc-800/50">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {runs.map((r) => (
                    <tr key={r.run_id} className="transition-colors hover:bg-zinc-900/50">
                      <td className="px-6 py-3 font-mono text-[11px] text-zinc-400">{r.trigger_source}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-medium border ${
                            r.status === "SUCCESS" ? "bg-green-500/10 text-green-400 border-transparent" : 
                            r.status === "PARTIAL_WARNING" ? "bg-yellow-500/10 text-yellow-400 border-transparent" : 
                            "bg-red-500/10 text-red-400 border-transparent"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-zinc-300">{r.rows_ingested}</td>
                      <td className="px-6 py-3 text-zinc-500">{r.duration_ms}ms</td>
                      <td className="px-6 py-3 text-zinc-500 text-[11px]">
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
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}} />
    </div>
  );
}