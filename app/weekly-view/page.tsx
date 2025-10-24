"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../../src/components/ui/navbar";
import { Footer } from "../../src/components/ui/footer";
import { CardMetric } from "../../src/components/ui/card-metric";
import { Table } from "../../src/components/ui/table";
import { LineChart } from "../../src/components/ui/line-chart";
import { fetchMarketingData } from "../../src/lib/api";
import type { MarketingData, Campaign } from "../../src/types/marketing";
import { BarChart3, TrendingUp, MousePointerClick, DollarSign } from "lucide-react";

/* ---------- Helpers ---------- */

const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number(b) || 0), 0);
const safePct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

function isoWeekKey(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // 0..6 (Mon..Sun)
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekNo =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  const year = date.getUTCFullYear();
  const w = weekNo.toString().padStart(2, "0");
  return `${year}-W${w}`;
}

function isoWeekKeyFromString(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return isoWeekKey(d);
}

type TimePoint = {
  date?: string;
  week?: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  spend?: number;
  revenue?: number;
};

/** يقرأ weekly_performance (week_start/week_end) ويحوّلها لمفتاح أسبوع ISO */
function pullTimeSeries(c: any): TimePoint[] {
  if (Array.isArray(c.weekly_performance)) {
    return c.weekly_performance.map((r: any) => ({
      week: isoWeekKeyFromString(r.week_start) || r.week || undefined,
      date: r.week_start || r.date || undefined,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      conversions: Number(r.conversions) || 0,
      spend: Number(r.spend) || 0,
      revenue: Number(r.revenue) || 0,
    }));
  }

  // احتياطي لأسماء أخرى محتملة
  const candidates: any[] = [
    c.weekly_breakdown,
    c.performance_over_time,
    c.time_series,
    c.timeseries,
  ].filter(Boolean);

  if (candidates.length === 0) return [];

  const arr = candidates.find(Array.isArray) || [];
  return arr.map((r: any) => ({
    week: r.week || isoWeekKeyFromString(r.date) || undefined,
    date: r.date || undefined,
    impressions: r.impressions ?? r.performance?.impressions ?? 0,
    clicks: r.clicks ?? r.performance?.clicks ?? 0,
    conversions: r.conversions ?? r.performance?.conversions ?? 0,
    spend: Number(r.spend ?? r.cost ?? 0),
    revenue: Number(r.revenue ?? r.rev ?? 0),
  }));
}

/** تجميع أسبوعي عبر كل الحملات */
function aggregateWeekly(campaigns: Campaign[]) {
  const bucket: Record<
    string,
    { impressions: number; clicks: number; conversions: number; spend: number; revenue: number; label: string }
  > = {};

  for (const c of campaigns) {
    const ts = pullTimeSeries(c);
    if (ts.length === 0) continue; 
    for (const p of ts) {
      const weekKey = p.week || (p.date ? isoWeekKey(new Date(p.date)) : "Unknown");
      const label = weekKey || "Unknown";
      if (!bucket[weekKey]) {
        bucket[weekKey] = { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0, label };
      }
      bucket[weekKey].impressions += p.impressions || 0;
      bucket[weekKey].clicks += p.clicks || 0;
      bucket[weekKey].conversions += p.conversions || 0;
      bucket[weekKey].spend += p.spend || 0;
      bucket[weekKey].revenue += p.revenue || 0;
    }
  }

  const rows = Object.entries(bucket).map(([week, v]) => ({
    week,
    label: v.label,
    impressions: v.impressions,
    clicks: v.clicks,
    conversions: v.conversions,
    ctr: safePct(v.clicks, v.impressions),
    convRate: safePct(v.conversions, v.clicks),
    spend: v.spend,
    revenue: v.revenue,
  }));

  const isIso = (w: string) => /^\d{4}-W\d{2}$/.test(w);
  rows.sort((a, b) => (isIso(a.week) && isIso(b.week) ? a.week.localeCompare(b.week) : a.week.localeCompare(b.week)));
  return rows;
}

/* ---------- Page ---------- */

export default function WeeklyView() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchMarketingData();
        setData(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { weeklyRows, kpis, spendSeries, revenueSeries } = useMemo(() => {
    if (!data?.campaigns) {
      return { weeklyRows: [], kpis: null, spendSeries: [], revenueSeries: [] };
    }
    const rows = aggregateWeekly(data.campaigns);

    const totals = {
      impressions: sum(rows.map((r) => r.impressions)),
      clicks: sum(rows.map((r) => r.clicks)),
      conversions: sum(rows.map((r) => r.conversions)),
      spend: sum(rows.map((r) => r.spend)),
      revenue: sum(rows.map((r) => r.revenue)),
    };

    const spendSeries = rows.map((r) => ({ label: r.label, value: Math.round(r.spend) }));
    const revenueSeries = rows.map((r) => ({ label: r.label, value: Math.round(r.revenue) }));

    return { weeklyRows: rows, kpis: totals, spendSeries, revenueSeries };
  }, [data]);

  return (
    <div className="flex h-screen bg-gray-900">
      <Navbar />
      <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out overflow-hidden">
        <section className="bg-gradient-to-r from-gray-800 to-gray-700 text-white py-8">
          <div className="px-6 lg:px-8 text-center">
            {error ? (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-2 max-w-2xl mx-auto">
                Error: {error}
              </div>
            ) : (
              <h1 className="text-3xl md:text-5xl font-bold">Weekly View</h1>
            )}
          </div>
        </section>

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-white">Loading…</div>
          ) : !data ? (
            <div className="text-white">No data.</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <CardMetric title="Total Impressions" value={kpis?.impressions?.toLocaleString() ?? "0"} icon={<BarChart3 className="h-5 w-5" />} />
                <CardMetric title="Total Clicks" value={kpis?.clicks?.toLocaleString() ?? "0"} icon={<MousePointerClick className="h-5 w-5" />} />
                <CardMetric title="Total Spend" value={`$${(kpis?.spend ? Math.round(kpis.spend).toLocaleString() : "0")}`} icon={<DollarSign className="h-5 w-5" />} />
                <CardMetric title="Total Revenue" value={`$${(kpis?.revenue ? Math.round(kpis.revenue).toLocaleString() : "0")}`} icon={<TrendingUp className="h-5 w-5" />} />
              </div>

              {/* Line Charts */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                <LineChart
                  title="Revenue by Week"
                  data={revenueSeries}
                  color="#22c55e"
                  formatValue={(v) => `$${v.toLocaleString()}`}
                />
                <LineChart
                  title="Spend by Week"
                  data={spendSeries}
                  color="#3b82f6"
                  formatValue={(v) => `$${v.toLocaleString()}`}
                />
              </div>

              {/* Table */}
              <Table
                title="Weekly Performance"
                maxHeight="520px"
                columns={[
                  { key: "week", header: "Week", width: "14%", sortable: true, sortType: "string" },
                  { key: "impressions", header: "Impressions", align: "right", sortable: true, sortType: "number", render: (v) => v.toLocaleString() },
                  { key: "clicks", header: "Clicks", align: "right", sortable: true, sortType: "number", render: (v) => v.toLocaleString() },
                  { key: "conversions", header: "Conversions", align: "right", sortable: true, sortType: "number", render: (v) => v.toLocaleString() },
                  { key: "ctr", header: "CTR", align: "right", sortable: true, sortType: "number", render: (v) => `${v.toFixed(2)}%` },
                  { key: "convRate", header: "Conversion Rate", align: "right", sortable: true, sortType: "number", render: (v) => `${v.toFixed(2)}%` },
                  { key: "spend", header: "Spend", align: "right", sortable: true, sortType: "number", render: (v) => `$${Math.round(v).toLocaleString()}` },
                  { key: "revenue", header: "Revenue", align: "right", sortable: true, sortType: "number", render: (v) => `$${Math.round(v).toLocaleString()}` },
                ]}
                data={weeklyRows}
                defaultSort={{ key: "week", direction: "asc" }}
              />
            </>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}
