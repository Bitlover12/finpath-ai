import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-black tracking-tight">FinPath</Link>
          <nav className="flex gap-5 text-sm font-semibold text-slate-600">
            <Link href="/profile">내 정보</Link>
            <Link href="/analysis">정책 분석</Link>
            <Link href="/dashboard">대시보드</Link>
            <Link href="/scenario">What-if</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
