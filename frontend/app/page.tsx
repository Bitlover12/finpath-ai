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
    <main className="min-h-screen bg-white text-[#191f28]">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-7">
        <div className="text-[20px] font-black tracking-[-0.04em]">FinPath<span className="text-[#3182f6]">.</span></div>
        <Link href="/profile" className="rounded-xl px-3 py-2 text-sm font-semibold text-[#6b7684] hover:bg-[#f2f4f6]">내 경로 찾기</Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-20 sm:px-7 sm:pt-28">
        <div className="max-w-[780px]">
          <p className="text-[15px] font-bold text-[#3182f6]">청년 자산형성 AI 금융 네비게이터</p>
          <h1 className="mt-5 text-[44px] font-black leading-[1.12] tracking-[-0.055em] sm:text-[64px]">
            같은 돈을 모아도,<br />가는 길은 달라질 수 있어요.
          </h1>
          <p className="mt-7 max-w-[650px] text-[18px] leading-8 text-[#6b7684]">
            내 조건에서 받을 수 있는 정책을 찾고, 매달 얼마를 어디에 넣을지 계산해서<br className="hidden sm:block" /> 목표까지 가장 현실적인 경로를 보여드려요.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/profile" className="fp-primary min-w-[180px]">내 경로 찾기</Link>
            <button onClick={() => demo("A")} disabled={!!loading} className="fp-secondary min-w-[180px]">{loading === "A" ? "계산 중..." : "30초 데모 보기"}</button>
          </div>
          {error && <p className="mt-4 text-sm font-semibold text-rose-600">연결 오류: {error}</p>}
        </div>

        <div className="mt-24 border-y border-[#edf0f3] py-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div><p className="text-[13px] font-semibold text-[#8b95a1]">먼저</p><p className="mt-2 text-[18px] font-bold">내가 받을 수 있는 정책만 추려요</p></div>
            <div><p className="text-[13px] font-semibold text-[#8b95a1]">그리고</p><p className="mt-2 text-[18px] font-bold">월 저축액을 가장 유리하게 나눠요</p></div>
            <div><p className="text-[13px] font-semibold text-[#8b95a1]">마지막으로</p><p className="mt-2 text-[18px] font-bold">목표까지 부족한 조건을 역산해요</p></div>
          </div>
        </div>

        <section className="mt-24 max-w-[820px]">
          <p className="fp-label">FinPath가 다른 점</p>
          <h2 className="mt-3 text-[32px] font-black tracking-[-0.04em] sm:text-[42px]">정책 목록이 아니라, 실행할 숫자를 드려요.</h2>
          <div className="mt-10 divide-y divide-[#edf0f3] border-y border-[#edf0f3]">
            {[
              ["01", "가입 가능한지", "나이·소득·지역·직장 조건을 룰 엔진으로 확인해요."],
              ["02", "얼마를 넣을지", "정책별 한도와 지원효과를 비교해 월 저축액을 배분해요."],
              ["03", "그래서 얼마나 달라지는지", "일반저축과 같은 조건으로 비교하고 목표 미달 시 필요한 금액·기간까지 계산해요."],
            ].map(([n, title, desc]) => <div key={n} className="grid gap-2 py-6 sm:grid-cols-[52px_210px_1fr] sm:items-center"><span className="text-sm font-bold text-[#b0b8c1]">{n}</span><b className="text-[17px]">{title}</b><p className="text-[14px] leading-6 text-[#6b7684]">{desc}</p></div>)}
          </div>
        </section>

        <section className="mt-20 rounded-[28px] bg-[#f7f9fb] p-7 sm:p-9">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div><p className="fp-label">빠르게 확인하기</p><h2 className="mt-2 text-[24px] font-black tracking-[-0.035em]">서로 다른 세 가지 결과도 준비했어요.</h2><p className="mt-2 text-sm text-[#6b7684]">목표 달성 · 목표 미달 · 적격정책 없음 상황을 실제 계산 결과로 확인할 수 있어요.</p></div>
            <div className="flex flex-wrap gap-2">{(["A","B","C"] as const).map((id) => <button key={id} onClick={() => demo(id)} disabled={!!loading} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#4e5968] shadow-sm hover:text-[#191f28]">DEMO {id}</button>)}</div>
          </div>
        </section>
      </section>
    </main>
  );
}
