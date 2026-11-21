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
  { id: "pm2_5", label: "PM2.5", unit: "µg/m³", color: "#2997ff" }, 
  { id: "pm10", label: "PM10", unit: "µg/m³", color: "#86868b" }, 
  { id: "temperature_2m", label: "Temperature", unit: "°C", color: "#ff9f0a" }, 
  { id: "relative_humidity_2m", label: "Humidity", unit: "%", color: "#32d74b" }, 
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
    // STRICT EDGE-TO-EDGE WRAPPER
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#000000] font-sans text-[#f5f5f7] selection:bg-[#2997ff] selection:text-white">
      
      {/* COMPACT TOP NAVIGATION */}
      <nav className="flex h-14 shrink-0 items-center justify-between border-b border-[#333336] bg-[#1d1d1f] px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-[#f5f5f7]" />
          <span className="text-sm font-semibold tracking-wide text-[#f5f5f7]">PulseETL</span>
        </div>
        <div className="flex items-center gap-4">
          {bannerMsg && (
            <span className={`text-xs font-medium tracking-wide ${bannerMsg.type === "ok" ? "text-[#32d74b]" : "text-[#ff453a]"}`}>
              {bannerMsg.text}
            </span>
          )}
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-[#86868b] transition-colors hover:text-[#f5f5f7] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleRunPipeline}
            disabled={isTriggering}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#f5f5f7] px-4 py-1.5 text-xs font-semibold text-black transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {isTriggering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            {isTriggering ? "Running..." : "Run Pipeline"}
          </button>
        </div>
      </nav>

      {/* FULL VIEWPORT GRID SYSTEM */}
      <main className="flex-1 overflow-y-auto p-3 lg:overflow-hidden">
        <div className="flex flex-col gap-3 lg:grid lg:h-full lg:w-full lg:grid-cols-4 lg:grid-rows-[100px_1fr_220px]">
          
          {/* ROW 1: 4x KPI Cards */}
          <div className="flex flex-col justify-center rounded-[1.5rem] bg-[#1d1d1f] p-5 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold tracking-tighter text-[#f5f5f7]">
                  {overview ? overview.total_rows.toLocaleString() : "—"}
                </p>
                <p className="mt-1 text-xs font-medium text-[#86868b]">Fact Rows</p>
              </div>
              <Database className="h-7 w-7 text-[#333336]" />
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-[1.5rem] bg-[#1d1d1f] p-5 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold tracking-tighter text-[#f5f5f7]">
                  {overview ? overview.critical_anomalies + overview.warning_anomalies : "—"}
                </p>
                <p className="mt-1 text-xs font-medium text-[#86868b]">7-Day Anomalies</p>
              </div>
              <AlertCircle className="h-7 w-7 text-[#333336]" />
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-[1.5rem] bg-[#1d1d1f] p-5 lg:col-span-1">
            <div className="flex items-center justify-between overflow-hidden">
              <div className="truncate pr-4">
                <p className="truncate text-xl font-semibold tracking-tight text-[#f5f5f7]">
                  {overview?.latest_run?.status || "—"}
                </p>
                <p className="mt-1 text-xs font-medium text-[#86868b]">Last Status</p>
              </div>
              <CheckCircle2 className="h-7 w-7 shrink-0 text-[#333336]" />
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-[1.5rem] bg-[#1d1d1f] p-5 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold tracking-tighter text-[#f5f5f7]">
                  {overview?.latest_run ? `${(overview.latest_run.duration_ms / 1000).toFixed(2)}s` : "—"}
                </p>
                <p className="mt-1 text-xs font-medium text-[#86868b]">Latency</p>
              </div>
              <Server className="h-7 w-7 text-[#333336]" />
            </div>
          </div>

          {/* ROW 2: Main Chart (Span 3) + Anomalies (Span 1) */}
          <div className="flex min-h-[350px] flex-col rounded-[1.5rem] bg-[#1d1d1f] p-5 lg:col-span-3 lg:min-h-0">
            <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="inline-flex rounded-full bg-[#000000] p-1">
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`rounded-full px-4 py-1 text-xs font-medium transition-all ${
                      selectedCity === city ? "bg-[#333336] text-white" : "text-[#86868b] hover:text-white"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-full bg-[#000000] p-1">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMetric(m.id)}
                    className={`rounded-full px-4 py-1 text-xs font-medium transition-all ${
                      selectedMetric === m.id ? "bg-[#333336] text-white" : "text-[#86868b] hover:text-white"
                    }`}
                  >
                    {m.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex-1 w-full min-h-0">
              {timeseries && (
                <div className="absolute right-0 top-0 z-10 flex gap-4 text-right">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">Mean</p>
                    <p className="text-lg font-semibold tracking-tight text-[#f5f5f7]">{timeseries.rolling_mean}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">Threshold</p>
                    <p className="text-lg font-semibold tracking-tight text-[#ff9f0a]">{timeseries.upper_threshold}</p>
                  </div>
                </div>
              )}
              
              <div className="h-full w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeMetricMeta.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#333336" vertical={false} />
                    <XAxis dataKey="timeLabel" tick={{ fill: "#86868b", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={40} dy={10} />
                    <YAxis tick={{ fill: "#86868b", fontSize: 11 }} tickLine={false} axisLine={false} dx={-15} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(29, 29, 31, 0.9)", backdropFilter: "blur(10px)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px", color: "#f5f5f7", boxShadow: "0 10px 20px -5px rgba(0,0,0,0.5)" }}
                      itemStyle={{ color: activeMetricMeta.color }}
                    />
                    {timeseries && (
                      <>
                        <ReferenceLine y={timeseries.rolling_mean} stroke="#86868b" strokeDasharray="3 3" />
                        <ReferenceLine y={timeseries.upper_threshold} stroke="#ff9f0a" strokeDasharray="3 3" />
                      </>
                    )}
                    <Area type="monotone" dataKey="value" stroke={activeMetricMeta.color} strokeWidth={2} fill="url(#appleGradient)" activeDot={{ r: 5, fill: "#000", stroke: activeMetricMeta.color, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="flex min-h-[350px] flex-col rounded-[1.5rem] bg-[#1d1d1f] p-5 lg:col-span-1 lg:min-h-0">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#86868b]" />
              <h3 className="text-sm font-semibold tracking-tight text-[#f5f5f7]">Anomaly Log</h3>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
              {anomalies.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[#86868b]">
                  <p className="text-xs font-medium">No alerts today.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((a) => (
                    <div key={a.id} className="border-b border-[#333336] pb-3 last:border-0">
                      <div className="mb-1 flex items-start justify-between">
                        <span className="text-xs font-semibold text-[#f5f5f7]">{a.entity_id}</span>
                        <span className={`text-[11px] font-bold ${a.severity === "CRITICAL" ? "text-[#ff453a]" : "text-[#ff9f0a]"}`}>
                          Z {a.z_score > 0 ? `+${a.z_score}` : a.z_score}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[10px] text-[#86868b]">{a.metric_name}</p>
                          <p className="mt-0.5 text-xs font-medium text-[#f5f5f7]">{a.observed_value} <span className="font-normal text-[#86868b]">(μ: {a.rolling_mean})</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ROW 3: Audit Log (Span 4) */}
          <div className="flex min-h-[220px] flex-col rounded-[1.5rem] bg-[#1d1d1f] p-5 lg:col-span-4 lg:min-h-0">
            <h3 className="mb-3 text-sm font-semibold tracking-tight text-[#f5f5f7]">Execution History</h3>
            <div className="custom-scrollbar flex-1 overflow-x-auto overflow-y-auto pr-2">
              <table className="w-full whitespace-nowrap text-left text-xs">
                <thead className="sticky top-0 bg-[#1d1d1f]">
                  <tr>
                    <th className="border-b border-[#333336] pb-2 font-medium text-[#86868b]">Trigger Source</th>
                    <th className="border-b border-[#333336] pb-2 font-medium text-[#86868b]">Status</th>
                    <th className="border-b border-[#333336] pb-2 font-medium text-[#86868b]">Rows Ingested</th>
                    <th className="border-b border-[#333336] pb-2 font-medium text-[#86868b]">Latency</th>
                    <th className="border-b border-[#333336] pb-2 font-medium text-[#86868b]">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333336]">
                  {runs.map((r) => (
                    <tr key={r.run_id}>
                      <td className="py-3 font-medium text-[#f5f5f7]">{r.trigger_source}</td>
                      <td className="py-3">
                        <span className={r.status === "SUCCESS" ? "text-[#32d74b]" : r.status === "PARTIAL_WARNING" ? "text-[#ff9f0a]" : "text-[#ff453a]"}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 text-[#f5f5f7]">{r.rows_ingested}</td>
                      <td className="py-3 text-[#86868b]">{r.duration_ms}ms</td>
                      <td className="py-3 text-[#86868b]">
                        {new Date(r.executed_at).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333336; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #636366; }
      `}} />
    </div>
  );
}