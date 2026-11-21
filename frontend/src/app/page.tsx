"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Database,
  Play,
  RefreshCw,
  Server,
  TrendingUp,
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

// Apple Light Mode Vivid Accents
const METRICS = [
  { id: "pm2_5", label: "PM2.5", unit: "µg/m³", color: "#007aff" }, // Apple Blue
  { id: "pm10", label: "PM10", unit: "µg/m³", color: "#8e8e93" }, // Apple Gray
  { id: "temperature_2m", label: "Temperature", unit: "°C", color: "#ff9500" }, // Apple Orange
  { id: "relative_humidity_2m", label: "Humidity", unit: "%", color: "#34c759" }, // Apple Green
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
    // HYBRID WRAPPER: Normal scroll on mobile, locked height on desktop
    <div className="flex min-h-screen flex-col bg-[#f5f5f7] font-sans text-[#1d1d1f] selection:bg-[#007aff] selection:text-white lg:h-screen lg:overflow-hidden">
      
      {/* TOP NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-black/5 bg-white/95 px-4 shadow-sm backdrop-blur-md lg:static lg:bg-white lg:px-6">
        <div className="flex items-center gap-2 lg:gap-3">
          <Activity className="h-4 w-4 shrink-0 text-[#1d1d1f] lg:h-5 lg:w-5" />
          <span className="text-xs font-bold tracking-wide text-[#1d1d1f] lg:text-sm">PulseETL <span className="hidden font-medium text-[#8e8e93] sm:inline">Telemetry Warehouse</span></span>
        </div>
        <div className="flex items-center gap-3 lg:gap-4">
          {bannerMsg && (
            <span className={`hidden text-xs font-bold tracking-wide sm:inline ${bannerMsg.type === "ok" ? "text-[#34c759]" : "text-[#ff3b30]"}`}>
              {bannerMsg.text}
            </span>
          )}
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold text-[#8e8e93] transition-colors hover:text-[#1d1d1f] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleRunPipeline}
            disabled={isTriggering}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1d1d1f] px-4 py-1.5 text-[11px] font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50 lg:text-xs"
          >
            {isTriggering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            {isTriggering ? "Running..." : "Run Pipeline"}
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex flex-1 flex-col gap-4 p-3 lg:overflow-hidden lg:p-5">
        
        {/* ROW 1: KPI CARDS (2x2 on Mobile, 1x4 on Desktop) */}
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:h-[110px] lg:grid-cols-4 lg:gap-4">
          <div className="flex flex-col justify-between rounded-3xl border border-black/5 bg-white p-4 shadow-sm lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tighter text-[#1d1d1f] lg:text-3xl">
                  {overview ? overview.total_rows.toLocaleString() : "—"}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#8e8e93] lg:mt-1 lg:text-xs">Fact Rows</p>
              </div>
              <Database className="h-6 w-6 shrink-0 text-[#f2f2f7] lg:h-8 lg:w-8" />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-black/5 bg-white p-4 shadow-sm lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tighter text-[#1d1d1f] lg:text-3xl">
                  {overview ? overview.critical_anomalies + overview.warning_anomalies : "—"}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#8e8e93] lg:mt-1 lg:text-xs">7-Day Anomalies</p>
              </div>
              <AlertCircle className="h-6 w-6 shrink-0 text-[#f2f2f7] lg:h-8 lg:w-8" />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-black/5 bg-white p-4 shadow-sm lg:p-5">
            <div className="flex items-center justify-between overflow-hidden">
              <div className="truncate pr-2">
                <p className="truncate text-lg font-bold tracking-tight text-[#1d1d1f] lg:text-xl">
                  {overview?.latest_run?.status || "—"}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#8e8e93] lg:mt-1 lg:text-xs">Last Status</p>
              </div>
              <CheckCircle2 className="h-6 w-6 shrink-0 text-[#f2f2f7] lg:h-8 lg:w-8" />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-black/5 bg-white p-4 shadow-sm lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tracking-tighter text-[#1d1d1f] lg:text-3xl">
                  {overview?.latest_run ? `${(overview.latest_run.duration_ms / 1000).toFixed(2)}s` : "—"}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#8e8e93] lg:mt-1 lg:text-xs">Latency</p>
              </div>
              <Server className="h-6 w-6 shrink-0 text-[#f2f2f7] lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>

        {/* ROW 2: CHART & ANOMALY LOG */}
        <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-4">
          
          {/* Main Chart */}
          <div className="flex flex-col rounded-3xl border border-black/5 bg-white p-4 shadow-sm lg:flex-1 lg:p-6">
            <div className="mb-4 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
              
              {/* Responsive Scrollable Segmented Controls */}
              <div className="custom-scrollbar flex overflow-x-auto rounded-full bg-[#e5e5ea] p-1">
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all lg:px-4 lg:text-xs ${
                      selectedCity === city ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#8e8e93] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
              <div className="custom-scrollbar flex overflow-x-auto rounded-full bg-[#e5e5ea] p-1">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMetric(m.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all lg:px-4 lg:text-xs ${
                      selectedMetric === m.id ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#8e8e93] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {m.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* EXPANDED HEIGHT & WIDTH FIX: 320px on mobile, 99% width to stop overflow */}
            <div className="relative h-[320px] w-full shrink-0 lg:min-h-0 lg:flex-1">
              {timeseries && (
                <div className="absolute right-0 top-0 z-10 hidden gap-4 text-right md:flex">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8e8e93]">Mean</p>
                    <p className="text-base font-bold tracking-tight text-[#1d1d1f]">{timeseries.rolling_mean}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8e8e93]">Threshold</p>
                    <p className="text-base font-bold tracking-tight text-[#ff9500]">{timeseries.upper_threshold}</p>
                  </div>
                </div>
              )}
              
              <div className="h-full w-full pt-4">
                <ResponsiveContainer width="99%" height="100%">
                  {/* EXPANDED MARGINS: top: 25 prevents peak clipping, right: 15 prevents last point clipping, bottom: 5 protects x-axis */}
                  <AreaChart data={chartData} margin={{ top: 25, right: 15, left: -15, bottom: 5 }}>
                    <defs>
                      <linearGradient id="appleGradientLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeMetricMeta.color} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e5e5ea" vertical={false} />
                    <XAxis dataKey="timeLabel" tick={{ fill: "#8e8e93", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} minTickGap={40} dy={10} />
                    <YAxis tick={{ fill: "#8e8e93", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} dx={-15} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)", borderColor: "rgba(0,0,0,0.05)", borderRadius: "12px", fontSize: "12px", color: "#1d1d1f", boxShadow: "0 10px 20px -5px rgba(0,0,0,0.15)" }}
                      itemStyle={{ color: activeMetricMeta.color, fontWeight: "700" }}
                    />
                    {timeseries && (
                      <>
                        <ReferenceLine y={timeseries.rolling_mean} stroke="#8e8e93" strokeDasharray="3 3" />
                        <ReferenceLine y={timeseries.upper_threshold} stroke="#ff9500" strokeDasharray="3 3" />
                      </>
                    )}
                    <Area type="monotone" dataKey="value" stroke={activeMetricMeta.color} strokeWidth={2.5} fill="url(#appleGradientLight)" activeDot={{ r: 5, fill: "#fff", stroke: activeMetricMeta.color, strokeWidth: 2.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Anomaly Sidebar */}
          <div className="flex max-h-[350px] flex-col rounded-3xl border border-black/5 bg-white p-4 shadow-sm lg:max-h-none lg:w-[320px] lg:p-6 xl:w-[400px]">
            <div className="mb-3 flex items-center gap-2 lg:mb-4">
              <TrendingUp className="h-4 w-4 text-[#8e8e93] lg:h-5 lg:w-5" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] lg:text-sm">Anomaly Alerts</h3>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
              {anomalies.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[#8e8e93]">
                  <p className="text-xs font-bold">No alerts today.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((a) => (
                    <div key={a.id} className="border-b border-black/5 pb-3 last:border-0">
                      <div className="mb-1 flex items-start justify-between">
                        <span className="text-xs font-bold text-[#1d1d1f] lg:text-sm">{a.entity_id}</span>
                        <span className={`text-[10px] font-bold lg:text-[11px] ${a.severity === "CRITICAL" ? "text-[#ff3b30]" : "text-[#ff9500]"}`}>
                          Z {a.z_score > 0 ? `+${a.z_score}` : a.z_score}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[10px] font-semibold text-[#8e8e93] lg:text-xs">{a.metric_name}</p>
                          <p className="mt-0.5 text-[11px] font-bold text-[#1d1d1f] lg:text-xs">{a.observed_value} <span className="font-medium text-[#8e8e93]">(μ: {a.rolling_mean})</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 3: AUDIT LOG */}
        <div className="flex flex-col rounded-3xl border border-black/5 bg-white p-4 shadow-sm lg:h-[240px] lg:shrink-0 lg:p-6">
          <div className="mb-3 flex items-center gap-2 lg:mb-4">
            <Clock className="h-4 w-4 text-[#8e8e93]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f] lg:text-sm">Execution History</h3>
          </div>
          <div className="custom-scrollbar flex-1 overflow-x-auto overflow-y-auto pr-2">
            <table className="w-full whitespace-nowrap text-left text-xs lg:text-sm">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                <tr>
                  <th className="pb-2 pr-4 font-bold text-[#8e8e93]">Trigger Source</th>
                  <th className="pb-2 pr-4 font-bold text-[#8e8e93]">Status</th>
                  <th className="pb-2 pr-4 font-bold text-[#8e8e93]">Rows</th>
                  <th className="pb-2 pr-4 font-bold text-[#8e8e93]">Latency</th>
                  <th className="pb-2 pr-4 font-bold text-[#8e8e93]">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {runs.map((r) => (
                  <tr key={r.run_id}>
                    <td className="py-3 pr-4 font-bold text-[#1d1d1f]">{r.trigger_source}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-bold ${r.status === "SUCCESS" ? "text-[#34c759]" : r.status === "PARTIAL_WARNING" ? "text-[#ff9500]" : "text-[#ff3b30]"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium text-[#1d1d1f]">{r.rows_ingested}</td>
                    <td className="py-3 pr-4 font-medium text-[#8e8e93]">{r.duration_ms}ms</td>
                    <td className="py-3 pr-4 font-medium text-[#8e8e93]">
                      {new Date(r.executed_at).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d1d6; border-radius: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #c7c7cc; }
      `}} />
    </div>
  );
}