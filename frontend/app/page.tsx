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
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-7">
        <div className="text-heading font-extrabold tracking-[-0.04em]">FinPath<span className="text-[#3182f6]">.</span></div>
        <Link href="/profile" className="rounded-xl px-3 py-2 text-body font-bold text-[#6b7684] hover:bg-[#f2f4f6]">내 경로 찾기</Link>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-20 sm:px-7 sm:pt-28">
        <div className="mx-auto max-w-[780px] text-center">
          <p className="text-body font-bold text-[#3182f6]">AI 금융 디지털 트윈</p>
          <h1 className="mt-5 text-hero font-extrabold leading-[1.12] tracking-[-0.055em]">
            내 조건이 바뀌면,<br />금융기회도 달라져요.
          </h1>
          <p className="mt-7 mx-auto max-w-[650px] text-body leading-8 text-[#6b7684]">
            지금 받을 수 있는 정책만 찾는 게 아니라, 연봉·이직·나이·재직기간이 바뀔 때<br className="hidden sm:block" /> 얻거나 잃는 금융혜택과 장기 자산 변화까지 미리 계산해요.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/profile" className="fp-primary min-w-[180px]">내 경로 찾기</Link>
            <button onClick={() => demo("A")} disabled={!!loading} className="fp-secondary min-w-[180px]">{loading === "A" ? "계산 중..." : "30초 데모 보기"}</button>
          </div>
          {error && <p className="mt-4 text-body font-bold text-rose-600">연결 오류: {error}</p>}
        </div>

        <div className="mt-24 border-y border-[#edf0f3] py-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div><p className="text-caption font-bold text-[#8b95a1]">먼저</p><p className="mt-2 text-body font-bold">현재 금융기회와 놓칠 조건을 찾아요</p></div>
            <div><p className="text-caption font-bold text-[#8b95a1]">그리고</p><p className="mt-2 text-body font-bold">정책 절벽 전후를 다시 계산해요</p></div>
            <div><p className="text-caption font-bold text-[#8b95a1]">마지막으로</p><p className="mt-2 text-body font-bold">지금 해야 할 행동까지 정리해요</p></div>
          </div>
        </div>

        <section className="mt-24 max-w-[820px]">
          <p className="fp-label">FinPath가 다른 점</p>
          <h2 className="mt-3 text-display font-extrabold tracking-[-0.04em]">현재뿐 아니라, 다음 금융결정까지 계산해요.</h2>
          <div className="mt-10 divide-y divide-[#edf0f3] border-y border-[#edf0f3]">
            {[
              ["01", "금융기회 레이더", "지금 가능한 정책과 곧 자격이 생기거나 사라질 조건을 함께 찾아요."],
              ["02", "정책 절벽 시뮬레이터", "연봉·이직·지역 같은 변화 전후의 정책과 장기 자산을 같은 엔진으로 다시 계산해요."],
              ["03", "Action Plan", "월 저축 배분, 신청 확인, 다음 재판정 시점까지 실제 행동으로 정리해요."],
            ].map(([n, title, desc]) => <div key={n} className="grid gap-2 py-6 sm:grid-cols-[52px_210px_1fr] sm:items-center"><span className="text-body font-bold text-[#b0b8c1]">{n}</span><b className="text-body">{title}</b><p className="text-body leading-6 text-[#6b7684]">{desc}</p></div>)}
          </div>
        </section>

        <section className="mt-20 rounded-[28px] bg-[#f7f9fb] p-7 sm:p-9">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div><p className="fp-label">빠르게 확인하기</p><h2 className="mt-2 text-heading font-extrabold tracking-[-0.035em]">서로 다른 세 가지 결과도 준비했어요.</h2><p className="mt-2 text-body text-[#6b7684]">목표 달성 · 목표 미달 · 적격정책 없음 상황을 실제 계산 결과로 확인할 수 있어요.</p></div>
            <div className="flex flex-wrap gap-2">{(["A","B","C"] as const).map((id) => <button key={id} onClick={() => demo(id)} disabled={!!loading} className="rounded-xl bg-white px-4 py-2.5 text-body font-bold text-[#4e5968] shadow-sm hover:text-[#191f28]">DEMO {id}</button>)}</div>
          </div>
        </section>
      </section>
    </main>
  );
}
