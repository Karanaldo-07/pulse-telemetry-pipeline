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

// Apple-style vivid accents against dark mode
const METRICS = [
  { id: "pm2_5", label: "PM2.5", unit: "µg/m³", color: "#2997ff" }, // Apple Blue
  { id: "pm10", label: "PM10", unit: "µg/m³", color: "#86868b" }, // Apple Gray
  { id: "temperature_2m", label: "Temperature", unit: "°C", color: "#ff9f0a" }, // Apple Orange
  { id: "relative_humidity_2m", label: "Humidity", unit: "%", color: "#32d74b" }, // Apple Green
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
    <div className="min-h-screen bg-[#000000] font-sans text-[#f5f5f7] selection:bg-[#2997ff] selection:text-white pb-20">
      
      {/* Apple Global Navigation Bar */}
      <nav className="sticky top-0 z-50 flex h-[52px] items-center justify-between bg-[#1d1d1f]/80 px-4 backdrop-blur-xl lg:px-8 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#f5f5f7]" />
          <span className="text-xs font-semibold tracking-wide text-[#f5f5f7]">PulseETL</span>
        </div>
        <div className="flex items-center gap-4">
          {bannerMsg && (
            <span className={`text-[11px] font-medium tracking-wide ${bannerMsg.type === "ok" ? "text-[#32d74b]" : "text-[#ff453a]"}`}>
              {bannerMsg.text}
            </span>
          )}
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="text-[11px] font-medium text-[#86868b] transition-colors hover:text-[#f5f5f7] disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-[1200px] px-4 pt-16 sm:px-6 lg:px-8">
        
        {/* Apple-style Hero Typography */}
        <div className="mb-12 text-center md:text-left flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tighter text-[#f5f5f7]">
              Telemetry. <br className="hidden md:block" />
              <span className="text-[#86868b]">Perfectly timed.</span>
            </h1>
          </div>
          
          <button
            onClick={handleRunPipeline}
            disabled={isTriggering}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f5f5f7] px-6 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {isTriggering ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            {isTriggering ? "Running..." : "Run Pipeline"}
          </button>
        </div>

        {/* Bento Box Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          
          {/* Top Row: KPIs */}
          <div className="flex flex-col justify-between rounded-[2rem] bg-[#1d1d1f] p-8 lg:col-span-1">
            <Database className="h-6 w-6 text-[#86868b]" />
            <div className="mt-8">
              <p className="text-5xl font-semibold tracking-tighter text-[#f5f5f7]">
                {overview ? overview.total_rows.toLocaleString() : "—"}
              </p>
              <p className="mt-2 text-sm font-medium text-[#86868b]">Fact Rows</p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[2rem] bg-[#1d1d1f] p-8 lg:col-span-1">
            <AlertCircle className="h-6 w-6 text-[#86868b]" />
            <div className="mt-8">
              <p className="text-5xl font-semibold tracking-tighter text-[#f5f5f7]">
                {overview ? overview.critical_anomalies + overview.warning_anomalies : "—"}
              </p>
              <p className="mt-2 text-sm font-medium text-[#86868b]">7-Day Anomalies</p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[2rem] bg-[#1d1d1f] p-8 lg:col-span-1">
            <CheckCircle2 className="h-6 w-6 text-[#86868b]" />
            <div className="mt-8">
              <p className="text-2xl font-semibold tracking-tight text-[#f5f5f7] truncate">
                {overview?.latest_run?.status || "—"}
              </p>
              <p className="mt-2 text-sm font-medium text-[#86868b]">Last Status</p>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[2rem] bg-[#1d1d1f] p-8 lg:col-span-1">
            <Server className="h-6 w-6 text-[#86868b]" />
            <div className="mt-8">
              <p className="text-4xl font-semibold tracking-tighter text-[#f5f5f7]">
                {overview?.latest_run ? `${(overview.latest_run.duration_ms / 1000).toFixed(2)}s` : "—"}
              </p>
              <p className="mt-2 text-sm font-medium text-[#86868b]">Latency</p>
            </div>
          </div>

          {/* Main Chart Section: Spans 3 columns on large screens */}
          <div className="flex flex-col rounded-[2rem] bg-[#1d1d1f] p-8 lg:col-span-3 min-h-[500px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              
              {/* Apple-style Pill Segmented Control for Cities */}
              <div className="inline-flex rounded-full bg-[#333336] p-1">
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      selectedCity === city
                        ? "bg-[#636366] text-white shadow-sm"
                        : "text-[#86868b] hover:text-white"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>

              {/* Apple-style Pill Segmented Control for Metrics */}
              <div className="inline-flex rounded-full bg-[#333336] p-1">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMetric(m.id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      selectedMetric === m.id
                        ? "bg-[#636366] text-white shadow-sm"
                        : "text-[#86868b] hover:text-white"
                    }`}
                  >
                    {m.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full relative">
              {timeseries && (
                <div className="absolute top-0 right-0 z-10 flex gap-4 text-right">
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-[#86868b] uppercase">Mean</p>
                    <p className="text-xl font-semibold tracking-tight text-[#f5f5f7]">{timeseries.rolling_mean}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest text-[#86868b] uppercase">Threshold</p>
                    <p className="text-xl font-semibold tracking-tight text-[#ff9f0a]">{timeseries.upper_threshold}</p>
                  </div>
                </div>
              )}
              
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeMetricMeta.color} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#333336" vertical={false} />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fill: "#86868b", fontSize: 12, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={40}
                      dy={15}
                    />
                    <YAxis 
                      tick={{ fill: "#86868b", fontSize: 12, fontWeight: 500 }} 
                      tickLine={false}
                      axisLine={false}
                      dx={-15}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(29, 29, 31, 0.8)",
                        backdropFilter: "blur(10px)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "16px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#f5f5f7",
                        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
                      }}
                      itemStyle={{ color: activeMetricMeta.color }}
                    />
                    {timeseries && (
                      <>
                        <ReferenceLine y={timeseries.rolling_mean} stroke="#86868b" strokeDasharray="3 3" />
                        <ReferenceLine y={timeseries.upper_threshold} stroke="#ff9f0a" strokeDasharray="3 3" />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={activeMetricMeta.color}
                      strokeWidth={3}
                      fill="url(#appleGradient)"
                      activeDot={{ r: 6, fill: "#000", stroke: activeMetricMeta.color, strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Anomalies List: Spans 1 column */}
          <div className="flex flex-col rounded-[2rem] bg-[#1d1d1f] p-8 lg:col-span-1 min-h-[500px]">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-[#86868b]" />
              <h3 className="text-lg font-semibold tracking-tight text-[#f5f5f7]">Anomaly Log</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {anomalies.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[#86868b]">
                  <p className="text-sm font-medium">No alerts today.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {anomalies.map((a) => (
                    <div key={a.id} className="border-b border-[#333336] pb-4 last:border-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-semibold text-[#f5f5f7]">{a.entity_id}</span>
                        <span className={`text-xs font-bold ${a.severity === "CRITICAL" ? "text-[#ff453a]" : "text-[#ff9f0a]"}`}>
                          Z {a.z_score > 0 ? `+${a.z_score}` : a.z_score}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-[#86868b]">{a.metric_name}</p>
                          <p className="text-xs font-medium text-[#f5f5f7] mt-0.5">{a.observed_value} <span className="text-[#86868b] font-normal">(μ: {a.rolling_mean})</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit Log Table: Full Width */}
          <div className="flex flex-col rounded-[2rem] bg-[#1d1d1f] p-8 lg:col-span-4">
            <h3 className="text-lg font-semibold tracking-tight text-[#f5f5f7] mb-6">Execution History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="pb-4 font-medium text-[#86868b] border-b border-[#333336]">Trigger Source</th>
                    <th className="pb-4 font-medium text-[#86868b] border-b border-[#333336]">Status</th>
                    <th className="pb-4 font-medium text-[#86868b] border-b border-[#333336]">Rows Ingested</th>
                    <th className="pb-4 font-medium text-[#86868b] border-b border-[#333336]">Latency</th>
                    <th className="pb-4 font-medium text-[#86868b] border-b border-[#333336]">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333336]">
                  {runs.map((r) => (
                    <tr key={r.run_id}>
                      <td className="py-4 text-[#f5f5f7] font-medium">{r.trigger_source}</td>
                      <td className="py-4">
                        <span className={
                          r.status === "SUCCESS" ? "text-[#32d74b]" : 
                          r.status === "PARTIAL_WARNING" ? "text-[#ff9f0a]" : "text-[#ff453a]"
                        }>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-4 text-[#f5f5f7]">{r.rows_ingested}</td>
                      <td className="py-4 text-[#86868b]">{r.duration_ms}ms</td>
                      <td className="py-4 text-[#86868b]">
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
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333336; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #636366; }
      `}} />
    </div>
  );
}