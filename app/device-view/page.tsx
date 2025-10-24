"use client";

import { useEffect, useState } from "react";
import { Navbar } from "../../src/components/ui/navbar";
import { Footer } from "../../src/components/ui/footer";
import { CardMetric } from "../../src/components/ui/card-metric";
import { fetchMarketingData } from "../../src/lib/api";
import type { MarketingData } from "../../src/types/marketing";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function DeviceView() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchMarketingData();
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-white text-center mt-20">Loading…</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  const deviceData = data?.campaigns?.flatMap((c: any) => c.device_performance) ?? [];
  const summarized = Object.values(
    deviceData.reduce((acc: any, curr: any) => {
      const key = curr.device;
      if (!acc[key])
        acc[key] = {
          device: key,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          revenue: 0,
        };
      acc[key].impressions += curr.impressions || 0;
      acc[key].clicks += curr.clicks || 0;
      acc[key].conversions += curr.conversions || 0;
      acc[key].spend += curr.spend || 0;
      acc[key].revenue += curr.revenue || 0;
      return acc;
    }, {})
  );

  const totalRevenue = summarized.reduce((s: number, d: any) => s + d.revenue, 0);
  const totalSpend = summarized.reduce((s: number, d: any) => s + d.spend, 0);
  const totalImpressions = summarized.reduce((s: number, d: any) => s + d.impressions, 0);
  const totalClicks = summarized.reduce((s: number, d: any) => s + d.clicks, 0);

  return (
    <div className="flex h-screen bg-gray-900">
      <Navbar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <section className="bg-gradient-to-r from-gray-800 to-gray-700 text-white py-8">
          <div className="px-6 lg:px-8 text-center">
            <h1 className="text-3xl md:text-5xl font-bold">Device View</h1>
            <p className="text-gray-300 mt-2">Compare Desktop vs Mobile performance</p>
          </div>
        </section>

        {/* Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto text-white">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <CardMetric title="Total Impressions" value={totalImpressions.toLocaleString()} />
            <CardMetric title="Total Clicks" value={totalClicks.toLocaleString()} />
            <CardMetric title="Total Spend" value={`$${Math.round(totalSpend).toLocaleString()}`} />
            <CardMetric title="Total Revenue" value={`$${Math.round(totalRevenue).toLocaleString()}`} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-4 rounded-2xl shadow-lg">
              <h2 className="text-lg font-bold mb-4">Revenue vs Spend by Device</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={summarized}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="device" stroke="#ccc" />
                  <YAxis stroke="#ccc" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
                  <Bar dataKey="spend" fill="#3b82f6" name="Spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800 p-4 rounded-2xl shadow-lg">
              <h2 className="text-lg font-bold mb-4">Clicks and Conversions by Device</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={summarized}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="device" stroke="#ccc" />
                  <YAxis stroke="#ccc" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="clicks" fill="#facc15" name="Clicks" />
                  <Bar dataKey="conversions" fill="#ef4444" name="Conversions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
