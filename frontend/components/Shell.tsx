"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const routeMeta: Record<string, { label: string; step?: string }> = {
  "/profile": { label: "내 조건", step: "1" },
  "/analysis": { label: "자격 확인", step: "2" },
  "/dashboard": { label: "내 경로", step: "3" },
  "/scenario": { label: "조건 바꿔보기" },
  "/spending": { label: "더 빠르게 가기" },
};

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const meta = routeMeta[pathname] || { label: "FinPath" };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191f28]">
      <header className="sticky top-0 z-30 border-b border-[#edf0f3] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-7">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[20px] font-black tracking-[-0.04em] text-[#191f28]">
              FinPath<span className="text-[#3182f6]">.</span>
            </Link>
            <span className="hidden h-4 w-px bg-[#e5e8eb] sm:block" />
            <span className="hidden text-sm font-semibold text-[#8b95a1] sm:block">{meta.label}</span>
          </div>
          <div className="flex items-center gap-3">
            {meta.step && (
              <div className="hidden items-center gap-1.5 sm:flex" aria-label={`기본 분석 ${meta.step}단계`}>
                {["1", "2", "3"].map((step) => (
                  <span key={step} className={`h-1.5 rounded-full transition-all ${Number(step) <= Number(meta.step) ? "w-6 bg-[#3182f6]" : "w-3 bg-[#e5e8eb]"}`} />
                ))}
              </div>
            )}
            {pathname !== "/profile" && (
              <Link href="/profile" className="rounded-xl px-3 py-2 text-sm font-semibold text-[#6b7684] hover:bg-[#f2f4f6] hover:text-[#333d4b]">
                다시 계산
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-7 sm:py-12">{children}</main>
    </div>
  );
}
