import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-black tracking-tight">FinPath</Link>
          <nav className="flex gap-4 text-sm font-semibold text-slate-600 sm:gap-5">
            <Link href="/profile">내 정보</Link>
            <Link href="/analysis">정책 근거</Link>
            <Link href="/dashboard">비교 결과</Link>
            <Link href="/scenario">조건 변경</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
