"use client";

import React, { useEffect, useMemo, useState } from "react";
import { geoEquirectangular, geoPath, geoGraticule10 } from "d3-geo";
import { scaleSqrt, scaleOrdinal } from "d3-scale";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";

export type BubbleDatum = {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  value: number;   
  group?: string;  
};

type Props = {
  title: string;
  data: BubbleDatum[];
  width?: number;
  height?: number;
  minR?: number;
  maxR?: number;
  sharedMax?: number;
};

const WORLD_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";

const COLOR = scaleOrdinal<string, string>()
  .domain(["MENA", "Europe", "Americas", "Asia", "APAC", "Africa", "Other"])
  .range(["#06b6d4", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#22c55e", "#94a3b8"]);

export default function BubbleMapHeat({
  title,
  data,
  width = 950,
  height = 480,
  minR = 6,
  maxR = 34,
  sharedMax,
}: Props) {
  const projection = useMemo(
    () => geoEquirectangular().fitExtent([[12, 12], [width - 12, height - 12]], { type: "Sphere" } as any),
    [width, height]
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const graticule = useMemo(() => geoGraticule10(), []);

  const [countries, setCountries] = useState<FeatureCollection<Geometry> | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(WORLD_URL, { cache: "force-cache" });
        if (!res.ok) throw new Error(String(res.status));
        const topo = await res.json();
        const obj: any = topo.objects || {};
        const candidate = obj.countries ?? obj.land ?? Object.values(obj)[0];
        const fc = feature(topo as unknown as any, candidate as unknown as any) as unknown as FeatureCollection<Geometry>;
        if (alive) setCountries(fc);
      } catch {
      }
    })();
    return () => { alive = false; };
  }, []);

  const localMax = Math.max(1, ...data.map(d => d.value || 0));
  const maxVal = sharedMax ?? localMax;
  const r = useMemo(() => scaleSqrt<number, number>().domain([0, maxVal]).range([minR, maxR]), [maxVal, minR, maxR]);

  const points = useMemo(() => {
    return data
      .filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng) && d.value > 0)
      .map(d => {
        const [x, y] = projection([d.lng, d.lat]) as [number, number];
        return { ...d, x, y, radius: r(d.value), fill: COLOR(d.group || "Other") };
      });
  }, [data, projection, r]);

  const groups = Array.from(new Set(points.map(p => p.group || "Other")));
  const sizeTicks = [maxVal * 0.2, maxVal * 0.5, maxVal];

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <div className="hidden md:flex items-center gap-3">
          {groups.map(g => (
            <div key={g} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: COLOR(g) }} />
              <span className="text-xs text-gray-600">{g}</span>
            </div>
          ))}
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <rect width={width} height={height} fill="#f7fafc" />
        <path d={path({ type: "Sphere" } as any)!} fill="#eef2f7" stroke="#cbd5e1" />
        {countries && countries.features.map((f, i) => (
          <path key={i} d={path(f)!} fill="#dee3ea" stroke="#c7d0db" strokeWidth={0.5} />
        ))}
        <path d={path(graticule)!} fill="none" stroke="#cfd8e3" strokeOpacity={0.5} strokeDasharray="2 3" />

        {points.map((p, i) => (
          <g key={i} transform={`translate(${p.x}, ${p.y})`}>
            <circle r={p.radius} fill={p.fill} fillOpacity={0.5} stroke={p.fill} strokeWidth={1}>
              <title>{`${p.city}${p.country ? `, ${p.country}` : ""} — $${Math.round(p.value).toLocaleString()}`}</title>
            </circle>
          </g>
        ))}

        <g transform={`translate(70, ${height - 90})`}>
          {sizeTicks.map((v, i) => {
            const rr = r(v);
            const y = 60 - rr;
            return (
              <g key={i}>
                <circle cx={0} cy={y} r={rr} fill="none" stroke="#94a3b8" />
                <text x={rr + 8} y={y} alignmentBaseline="middle" className="text-xs" fill="#64748b">
                  ${Math.round(v).toLocaleString()}
                </text>
              </g>
            );
          })}
          <text x={-10} y={75} className="text-xs" fill="#64748b">Size ~ Value</text>
        </g>
      </svg>
    </div>
  );
}
