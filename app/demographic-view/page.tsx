"use client";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../../src/components/ui/navbar";
import { Footer } from "../../src/components/ui/footer";
import { CardMetric } from "../../src/components/ui/card-metric";
import { BarChart } from "../../src/components/ui/bar-chart";
import { Table } from "../../src/components/ui/table";
import { fetchMarketingData } from "../../src/lib/api";
import type { MarketingData, Campaign, DemographicBreakdown } from "../../src/types/marketing";
import { Users, UserCheck, TrendingUp, Target, DollarSign } from "lucide-react";


type Totals = {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number(b) || 0), 0);

function safeRatio(part: number, total: number) {
  return total > 0 ? part / total : 0;
}

function computeGenderTotals(campaigns: Campaign[], gender: "Male" | "Female"): Totals {
  let impressions = 0, clicks = 0, conversions = 0, spend = 0, revenue = 0;

  for (const c of campaigns) {
    const d = (c.demographic_breakdown || []) as DemographicBreakdown[];
    const genderRows = d.filter(x => x.gender === gender);

    const gImpr = sum(genderRows.map(x => x.performance.impressions));
    const gClicks = sum(genderRows.map(x => x.performance.clicks));
    const gConv  = sum(genderRows.map(x => x.performance.conversions));

    impressions += gImpr;
    clicks      += gClicks;
    conversions += gConv;
    const clicksAll = sum(d.map(x => x.performance.clicks)) || c.clicks || 0;
    const share = safeRatio(gClicks, clicksAll);
    spend   += c.spend   * share;
    revenue += c.revenue * share;
  }

  return { impressions, clicks, conversions, spend, revenue };
}
function computeAgeSpendRevenue(campaigns: Campaign[]) {

  const ageClicks: Record<string, number> = {};
  const ageSpend:  Record<string, number> = {};
  const ageRev:    Record<string, number> = {};

  for (const c of campaigns) {
    const d = (c.demographic_breakdown || []) as DemographicBreakdown[];
    const totalClicks = sum(d.map(x => x.performance.clicks)) || c.clicks || 0;

    for (const row of d) {
      const age = row.age_group || "Unknown";
      const cks = row.performance.clicks || 0;

      ageClicks[age] = (ageClicks[age] || 0) + cks;
      const share = safeRatio(cks, totalClicks);
      ageSpend[age] = (ageSpend[age] || 0) + c.spend   * share;
      ageRev[age]   = (ageRev[age]   || 0) + c.revenue * share;
    }
  }

  const spendData = Object.keys(ageSpend).map(age => ({
    label: age,
    value: ageSpend[age],
  }));

  const revenueData = Object.keys(ageRev).map(age => ({
    label: age,
    value: ageRev[age],
  }));
  const normalize = (s: string) => parseInt(s.split("-")[0] || "0", 10);
  spendData.sort((a, b) => normalize(a.label) - normalize(b.label));
  revenueData.sort((a, b) => normalize(a.label) - normalize(b.label));

  return { spendData, revenueData };
}

function buildAgeCampaignRows(campaigns: Campaign[], gender: "Male" | "Female") {
  type Row = {
    age: string;
    campaign: string;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    convRate: number;
    spend: number;
    revenue: number;
  };
  const rows: Row[] = [];

  for (const c of campaigns) {
    const d = (c.demographic_breakdown || []) as DemographicBreakdown[];


    const clicksAll = sum(d.map(x => x.performance.clicks)) || c.clicks || 0;
    const byAge = new Map<string, { impr: number; clk: number; conv: number; spend: number; rev: number }>();

    for (const row of d) {
      if (row.gender !== gender) continue;
      const age = row.age_group || "Unknown";
      const impr = row.performance.impressions || 0;
      const clk  = row.performance.clicks || 0;
      const conv = row.performance.conversions || 0;

      const share = safeRatio(clk, clicksAll);
      const s = (byAge.get(age) || { impr: 0, clk: 0, conv: 0, spend: 0, rev: 0 });
      s.impr += impr;
      s.clk  += clk;
      s.conv += conv;
      s.spend += c.spend   * share;
      s.rev   += c.revenue * share;
      byAge.set(age, s);
    }
    for (const [age, agg] of byAge) {
      const ctr = agg.impr > 0 ? (agg.clk / agg.impr) * 100 : 0;
      const convRate = agg.clk > 0 ? (agg.conv / agg.clk) * 100 : 0;
      rows.push({
        age,
        campaign: c.name,
        impressions: agg.impr,
        clicks: agg.clk,
        conversions: agg.conv,
        ctr,
        convRate,
        spend: agg.spend,
        revenue: agg.rev,
      });
    }
  }


  const normalize = (s: string) => parseInt(s.split("-")[0] || "0", 10);
  rows.sort((a, b) => normalize(a.age) - normalize(b.age) || b.revenue - a.revenue);
  return rows;
}

/** ---------- Component ---------- **/

export default function DemographicView() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      try {
        const d = await fetchMarketingData();
        setData(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);


  const {
    maleTotals, femaleTotals, spendByAge, revenueByAge, maleRows, femaleRows,
  } = useMemo(() => {
    if (!data?.campaigns) {
      return {
        maleTotals: null,
        femaleTotals: null,
        spendByAge: [],
        revenueByAge: [],
        maleRows: [],
        femaleRows: [],
      };
    }
    const campaigns = data.campaigns;

    const maleTotals = computeGenderTotals(campaigns, "Male");
    const femaleTotals = computeGenderTotals(campaigns, "Female");

    const { spendData, revenueData } = computeAgeSpendRevenue(campaigns);

    const maleRows = buildAgeCampaignRows(campaigns, "Male");
    const femaleRows = buildAgeCampaignRows(campaigns, "Female");

    return {
      maleTotals,
      femaleTotals,
      spendByAge: spendData,
      revenueByAge: revenueData,
      maleRows,
      femaleRows,
    };
  }, [data]);

  return (
    <div className="flex h-screen bg-gray-900">
      <Navbar />
      <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out overflow-hidden">
        {/* Hero */}
        <section className="bg-gradient-to-r from-gray-800 to-gray-700 text-white py-8">
          <div className="px-6 lg:px-8">
            <div className="text-center">
              {error ? (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-2 max-w-2xl mx-auto">
                  Error: {error}
                </div>
              ) : (
                <h1 className="text-3xl md:text-5xl font-bold">Demographic View</h1>
              )}
            </div>
          </div>
        </section>

        {/* Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-white">Loading…</div>
          ) : data ? (
            <>
              {/* 1) KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                <CardMetric title="Total Clicks (Male)"   value={maleTotals?.clicks ?? 0}   icon={<Users className="h-5 w-5" />} />
                <CardMetric title="Total Spend (Male)"    value={`$${Math.round(maleTotals?.spend ?? 0).toLocaleString()}`}   icon={<DollarSign className="h-5 w-5" />} />
                <CardMetric title="Total Revenue (Male)"  value={`$${Math.round(maleTotals?.revenue ?? 0).toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} />

                <CardMetric title="Total Clicks (Female)" value={femaleTotals?.clicks ?? 0} icon={<UserCheck className="h-5 w-5" />} />
                <CardMetric title="Total Spend (Female)"  value={`$${Math.round(femaleTotals?.spend ?? 0).toLocaleString()}`}   icon={<DollarSign className="h-5 w-5" />} />
                <CardMetric title="Total Revenue (Female)"value={`$${Math.round(femaleTotals?.revenue ?? 0).toLocaleString()}`} icon={<Target className="h-5 w-5" />} />
              </div>

              {/* 2) Bars */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                <BarChart
                  title="Total Spend by Age Group"
                  data={spendByAge.map(d => ({ label: d.label, value: Math.round(d.value) }))}
                  formatValue={(v) => `$${v.toLocaleString()}`}
                />
                <BarChart
                  title="Total Revenue by Age Group"
                  data={revenueByAge.map(d => ({ label: d.label, value: Math.round(d.value) }))}
                  formatValue={(v) => `$${v.toLocaleString()}`}
                />
              </div>

              {/* 3) Tables */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Table
                  title="Campaign Performance by Male Age Groups"
                  maxHeight="420px"
                  columns={[
                    { key: "age", header: "Age Group", width: "12%", sortable: true, sortType: "string" },
                    { key: "campaign", header: "Campaign", width: "30%", sortable: true, sortType: "string",
                      render: (val) => <span className="text-white">{val}</span>
                    },
                    { key: "impressions", header: "Impressions", align: "right", sortable: true, sortType: "number",
                      render: (v) => v.toLocaleString()
                    },
                    { key: "clicks", header: "Clicks", align: "right", sortable: true, sortType: "number",
                      render: (v) => v.toLocaleString()
                    },
                    { key: "conversions", header: "Conversions", align: "right", sortable: true, sortType: "number",
                      render: (v) => v.toLocaleString()
                    },
                    { key: "ctr", header: "CTR", align: "right", sortable: true, sortType: "number",
                      render: (v) => `${v.toFixed(2)}%`
                    },
                    { key: "convRate", header: "Conversion Rate", align: "right", sortable: true, sortType: "number",
                      render: (v) => `${v.toFixed(2)}%`
                    },
                    { key: "spend", header: "Spend", align: "right", sortable: true, sortType: "number",
                      render: (v) => `$${Math.round(v).toLocaleString()}`
                    },
                    { key: "revenue", header: "Revenue", align: "right", sortable: true, sortType: "number",
                      render: (v) => `$${Math.round(v).toLocaleString()}`
                    },
                  ]}
                  data={maleRows}
                  defaultSort={{ key: "revenue", direction: "desc" }}
                />

                <Table
                  title="Campaign Performance by Female Age Groups"
                  maxHeight="420px"
                  columns={[
                    { key: "age", header: "Age Group", width: "12%", sortable: true, sortType: "string" },
                    { key: "campaign", header: "Campaign", width: "30%", sortable: true, sortType: "string",
                      render: (val) => <span className="text-white">{val}</span>
                    },
                    { key: "impressions", header: "Impressions", align: "right", sortable: true, sortType: "number",
                      render: (v) => v.toLocaleString()
                    },
                    { key: "clicks", header: "Clicks", align: "right", sortable: true, sortType: "number",
                      render: (v) => v.toLocaleString()
                    },
                    { key: "conversions", header: "Conversions", align: "right", sortable: true, sortType: "number",
                      render: (v) => v.toLocaleString()
                    },
                    { key: "ctr", header: "CTR", align: "right", sortable: true, sortType: "number",
                      render: (v) => `${v.toFixed(2)}%`
                    },
                    { key: "convRate", header: "Conversion Rate", align: "right", sortable: true, sortType: "number",
                      render: (v) => `${v.toFixed(2)}%`
                    },
                    { key: "spend", header: "Spend", align: "right", sortable: true, sortType: "number",
                      render: (v) => `$${Math.round(v).toLocaleString()}`
                    },
                    { key: "revenue", header: "Revenue", align: "right", sortable: true, sortType: "number",
                      render: (v) => `$${Math.round(v).toLocaleString()}`
                    },
                  ]}
                  data={femaleRows}
                  defaultSort={{ key: "revenue", direction: "desc" }}
                />
              </div>
            </>
          ) : (
            <div className="text-white">No data.</div>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}
