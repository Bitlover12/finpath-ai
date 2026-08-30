import type { ReactNode } from "react";

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {sub ? <div className="mt-2 text-sm text-slate-500">{sub}</div> : null}
    </div>
  );
}
