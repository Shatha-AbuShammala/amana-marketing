"use client";

import {
  LineChart as ReLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface LineChartProps {
  title: string;
  data: { label: string; value: number }[];
  color?: string;
  formatValue?: (v: number) => string;
}

export function LineChart({
  title,
  data,
  color = "#3b82f6",
  formatValue = (v) => v.toLocaleString(),
}: LineChartProps) {
  return (
    <div className="rounded-2xl border p-4 bg-gray-800 text-white">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ReLineChart data={data}>
            <CartesianGrid stroke="#444" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#aaa" />
            <YAxis
              stroke="#aaa"
              tickFormatter={formatValue}
            />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "none" }}
              formatter={(v: number) => formatValue(v)}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          </ReLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
