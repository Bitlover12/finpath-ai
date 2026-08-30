"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyzeResponse } from "../lib/types";

export function AssetChart({ result }: { result: AnalyzeResponse }) {
  const optimized = new Map(result.optimized.trajectory.map((p) => [p.month, p.total_assets]));
  const data = result.baseline.trajectory
    .filter((p) => p.month % 12 === 0 || p.month === result.baseline.trajectory.at(-1)?.month)
    .map((p) => ({
      month: p.month,
      baseline: p.total_assets,
      optimized: optimized.get(p.month) ?? null,
    }));
  return (
    <div className="h-80 w-full rounded-2xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 18, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" tickFormatter={(v) => `${Math.round(Number(v) / 12)}년`} />
          <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 10_000_000)}천만`} width={52} />
          <Tooltip formatter={(v) => `${Number(v).toLocaleString("ko-KR")}원`} />
          <Line type="monotone" dataKey="baseline" name="일반 저축" stroke="#64748b" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="optimized" name="FinPath" stroke="#0f172a" dot={false} strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
