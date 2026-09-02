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
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "데모를 불러오지 못했습니다.");
    } finally { setLoading(null); }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-4xl pt-20">
          <p className="text-sm font-bold tracking-[0.28em] text-slate-400">FINPATH · 청년 자산형성 금융 네비게이터</p>
          <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-7xl">그냥 저축할 때보다,<br />얼마나 더 만들 수 있을까요?</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">내 조건과 월 저축 여력을 입력하면 일반저축과 정책 활용 경로를 같은 기준으로 계산하고, <b className="text-white">정책 자격·월 배분·정부지원·세금·만기 재예치·목표 역산</b>까지 한 번에 보여줍니다.</p>
          <div className="mt-10 flex flex-wrap gap-3"><Link href="/profile" className="rounded-xl bg-white px-6 py-3 font-bold text-slate-950">내 정보로 바로 비교하기</Link><button onClick={() => demo("A")} disabled={!!loading} className="rounded-xl border border-slate-600 px-6 py-3 font-bold">{loading === "A" ? "계산 중..." : "목표 달성 데모 보기"}</button></div>
          {error && <p className="mt-4 text-sm text-rose-300">Backend 연결 오류: {error}</p>}
        </div>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[{id:"A" as const,title:"일반저축은 미달, FinPath는 달성",desc:"정책 효과가 목표 달성 여부를 바꾸는 사례"},{id:"B" as const,title:"그래도 목표가 부족하다면",desc:"부족금액과 필요한 월저축·기간을 역산"},{id:"C" as const,title:"가입 가능한 정책이 없어도",desc:"일반저축 기준의 목표경로는 계속 계산"}].map((x) => (
            <button key={x.id} onClick={() => demo(x.id)} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:border-slate-500"><p className="text-xs font-bold tracking-widest text-slate-400">DEMO {x.id}</p><h2 className="mt-2 text-xl font-bold">{x.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{x.desc}</p></button>
          ))}
        </div>
      </div>
    </main>
  );
}
