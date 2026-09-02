import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="text-xl font-black tracking-tight">FinPath</Link>
          <nav className="flex gap-2 text-sm font-semibold text-slate-600 sm:gap-4">
            <Link className="rounded-lg px-2 py-2 hover:bg-slate-100" href="/profile">내 정보</Link>
            <Link className="rounded-lg px-2 py-2 hover:bg-slate-100" href="/analysis">정책</Link>
            <Link className="rounded-lg px-2 py-2 hover:bg-slate-100" href="/dashboard">결과</Link>
            <Link className="rounded-lg px-2 py-2 hover:bg-slate-100" href="/scenario">조건 변경</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 md:py-10">{children}</main>
    </div>
  );
}
