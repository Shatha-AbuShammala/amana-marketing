"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../../src/components/ui/navbar";
import { Footer } from "../../src/components/ui/footer";
import BubbleMapHeat, { BubbleDatum } from "../../src/components/ui/heat-map";
import { fetchMarketingData } from "../../src/lib/api";
import type { MarketingData } from "../../src/types/marketing";
import { CardMetric } from "../../src/components/ui/card-metric";
import { DollarSign, TrendingUp } from "lucide-react";

const CITY_COORDS: Record<string, [number, number]> = {
  Dubai: [55.27, 25.2],
  Sharjah: [55.4, 25.35],
  "Abu Dhabi": [54.37, 24.47],
  Riyadh: [46.71, 24.71],
  Jeddah: [39.17, 21.54],
  Dammam: [50.1, 26.43],
  Cairo: [31.23, 30.04],
  Giza: [31.21, 30.01],
  Amman: [35.93, 31.95],
  Doha: [51.53, 25.29],
  Muscat: [58.41, 23.59],
  Manama: [50.58, 26.23],
  London: [-0.12, 51.51],
  Paris: [2.35, 48.85],
  Berlin: [13.4, 52.52],
  Madrid: [-3.7, 40.42],
  Rome: [12.5, 41.9],
  Istanbul: [28.97, 41.01],
  "New York": [-74.0, 40.71],
  "Los Angeles": [-118.24, 34.05],
  "San Francisco": [-122.42, 37.77],
  Toronto: [-79.38, 43.65],
  "São Paulo": [-46.63, -23.55],
  Sydney: [151.21, -33.87],
  Tokyo: [139.69, 35.68],
  Singapore: [103.82, 1.35],
  Mumbai: [72.88, 19.08],
};

const CENTROID_BY_COUNTRY: Record<string, [number, number]> = {
  UAE: [54.37, 24.47],
  "United Arab Emirates": [54.37, 24.47],
  "Saudi Arabia": [45.08, 23.88],
  KSA: [45.08, 23.88],
  Qatar: [51.18, 25.3],
  Oman: [57.49, 21.51],
  Bahrain: [50.55, 26.07],
  Jordan: [36.24, 31.24],
  Egypt: [30.8, 26.82],
  "United Kingdom": [-1.47, 52.35],
  UK: [-1.47, 52.35],
  France: [2.21, 46.23],
  Germany: [10.45, 51.16],
  Italy: [12.57, 42.88],
  Spain: [-3.65, 40.22],
  Turkey: [35.24, 39.06],
  "United States": [-98.35, 39.5],
  USA: [-98.35, 39.5],
  Canada: [-106.35, 56.13],
  Brazil: [-52.97, -14.24],
  Australia: [134.49, -25.73],
  Japan: [138.25, 36.2],
  India: [78.96, 20.59],
  Singapore: [103.82, 1.35],
};

function regionGroup(country?: string) {
  if (!country) return "Other";
  const c = country.toLowerCase();
  if (["uae","united arab emirates","qatar","saudi","ksa","bahrain","oman","jordan","egypt"].some(x=>c.includes(x))) return "MENA";
  if (["uk","united kingdom","france","germany","italy","spain","netherlands"].some(x=>c.includes(x))) return "Europe";
  if (["usa","united states","canada","brazil","mexico"].some(x=>c.includes(x))) return "Americas";
  if (["china","japan","india","indonesia","singapore","south korea"].some(x=>c.includes(x))) return "Asia";
  if (["australia","new zealand"].some(x=>c.includes(x))) return "APAC";
  if (["nigeria","kenya","south africa","morocco"].some(x=>c.includes(x))) return "Africa";
  return "Other";
}

export default function RegionViewPage() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await fetchMarketingData());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { spendPoints, revenuePoints, totals, globalMax } = useMemo(() => {
    type Agg = { city: string; country?: string; spend: number; revenue: number };
    const agg = new Map<string, Agg>();
    const missingCities = new Set<string>();

    for (const c of (data?.campaigns as any[]) ?? []) {
      const arr = c.regional_performance ?? [];
      for (const r of arr) {
        const city = String(r.region ?? "").trim();
        const country = String(r.country ?? "").trim();
        if (!city && !country) continue;

        const key = `${city}|${country}`;
        const item = agg.get(key) ?? { city, country, spend: 0, revenue: 0 };
        item.spend += Number(r.spend) || 0;
        item.revenue += Number(r.revenue) || 0;
        agg.set(key, item);

        if (!CITY_COORDS[city] && country) missingCities.add(`${city} (${country})`);
      }
    }

    const jitterFromName = (name: string) => {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
      const angle = (h % 360) * (Math.PI / 180);
      const r = 0.6; 
      return [Math.cos(angle) * r, Math.sin(angle) * r] as const;
    };

    const toPoint = (a: Agg, which: "spend" | "revenue") => {
      if (CITY_COORDS[a.city]) {
        const [lng, lat] = CITY_COORDS[a.city];
        return { city: a.city, country: a.country, lng, lat, value: a[which] };
      }
      if (a.country) {
        const hit = Object.keys(CENTROID_BY_COUNTRY).find(k =>
          a.country!.toLowerCase().includes(k.toLowerCase())
        );
        if (hit) {
          let [lng, lat] = CENTROID_BY_COUNTRY[hit];
          const [dx, dy] = jitterFromName(a.city || a.country!);
          lng += dx; lat += dy;
          return { city: a.city, country: a.country, lng, lat, value: a[which] };
        }
      }
      return null;
    };

    const spendPoints: BubbleDatum[] = [];
    const revenuePoints: BubbleDatum[] = [];

    for (const a of agg.values()) {
      if (a.spend > 0) {
        const p = toPoint(a, "spend");
        if (p) spendPoints.push({ ...p, group: regionGroup(a.country) } as BubbleDatum);
      }
      if (a.revenue > 0) {
        const p = toPoint(a, "revenue");
        if (p) revenuePoints.push({ ...p, group: regionGroup(a.country) } as BubbleDatum);
      }
    }

    const totals = {
      spend: spendPoints.reduce((s, x) => s + x.value, 0),
      revenue: revenuePoints.reduce((s, x) => s + x.value, 0),
    };
    const globalMax = Math.max(1, ...spendPoints.map(p => p.value), ...revenuePoints.map(p => p.value));

    if (missingCities.size) {
      console.log("CITY_COORDS:", Array.from(missingCities));
    }

    return { spendPoints, revenuePoints, totals, globalMax };
  }, [data]);

  return (
    <div className="flex h-screen bg-gray-900">
      <Navbar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <section className="bg-gradient-to-r from-gray-800 to-gray-700 text-white py-8">
          <div className="px-6 lg:px-8 text-center">
            <h1 className="text-3xl md:text-5xl font-bold">Region View</h1>
          </div>
        </section>

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {loading ? (
            <div className="text-white text-center mt-20">Loading…</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <CardMetric title="Total Spend" value={`$${Math.round(totals.spend).toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
                <CardMetric title="Total Revenue" value={`$${Math.round(totals.revenue).toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <BubbleMapHeat title="Spend by Region" data={spendPoints} sharedMax={globalMax} />
                <BubbleMapHeat title="Revenue by Region" data={revenuePoints} sharedMax={globalMax} />
              </div>
            </>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}
