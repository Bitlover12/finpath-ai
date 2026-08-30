"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDemo } from "../lib/api";
import { saveAnalysis } from "../lib/storage";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function demo(id: "A" | "B" | "C") {
    setLoading(id); setError("");
    try {
      const result = await getDemo(id);
      saveAnalysis(result);
      router.push(id === "B" ? "/analysis" : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "데모를 불러오지 못했습니다.");
    } finally { setLoading(null); }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-4xl pt-20">
          <p className="text-sm font-bold tracking-[0.28em] text-slate-400">FINPATH · POLICY-AWARE FINANCIAL NAVIGATION</p>
          <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-7xl">당신의 목표까지,<br />금융경로를 계산합니다.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">정책을 나열하는 대신, 가입 가능성·월 저축 배분·만기 이후 경로·목표 미달 조건까지 하나의 숫자로 연결합니다.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/profile" className="rounded-xl bg-white px-6 py-3 font-bold text-slate-950">내 정보로 분석하기</Link>
            <button onClick={() => demo("B")} disabled={!!loading} className="rounded-xl border border-slate-600 px-6 py-3 font-bold">{loading === "B" ? "분석 중..." : "DEMO_B 목표 미달 체험"}</button>
          </div>
          {error && <p className="mt-4 text-sm text-rose-300">Backend 연결 오류: {error}</p>}
        </div>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[{id:"A" as const,title:"Goal Achieved",desc:"일반저축은 미달, FinPath는 달성"},{id:"B" as const,title:"Goal Shortfall",desc:"부족금액과 월저축·기간 역산"},{id:"C" as const,title:"No Eligible Policy",desc:"정책 0개여도 일반저축 경로 유지"}].map((x) => (
            <button key={x.id} onClick={() => demo(x.id)} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:border-slate-500">
              <p className="text-xs font-bold tracking-widest text-slate-400">DEMO_{x.id}</p>
              <h2 className="mt-2 text-xl font-bold">{x.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{x.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
