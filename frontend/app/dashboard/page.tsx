"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AssetChart } from "../../components/AssetChart";
import { Shell } from "../../components/Shell";
import { manWon, monthsText } from "../../lib/format";
import { applicationLabel, roadmapTypeLabel } from "../../lib/labels";
import { loadAnalysis, loadSpendingOptimization } from "../../lib/storage";
import type { AnalyzeResponse, PolicyAnalysis, SpendingOptimizationResponse } from "../../lib/types";

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}${manWon(Math.abs(value))}`;
}

function policyLinkLabel(policy: PolicyAnalysis) {
  if (policy.application_status === "OPEN") return "공식 안내·신청 경로";
  if (policy.application_status === "UPCOMING") return "모집 공고 확인";
  if (policy.application_status === "CLOSED") return "지난 공고 확인";
  return "공식 안내 확인";
}

export default function DashboardPage() {
  const [r, setR] = useState<AnalyzeResponse | null>(null);
  const [full, setFull] = useState<SpendingOptimizationResponse | null>(null);
  useEffect(() => {
    setR(loadAnalysis());
    setFull(loadSpendingOptimization());
  }, []);

  if (!r) {
    return <Shell><div className="rounded-2xl border bg-white p-7">분석 결과가 없습니다. <Link href="/profile" className="font-bold underline">내 정보 입력하기</Link></div></Shell>;
  }

  const gs = r.goal_seeking;
  const pending = r.policy_analysis.filter((p) => p.status === "NEEDS_MORE_INFORMATION" && (p.application_status === "OPEN" || p.application_status === "UPCOMING"));
  const selected = r.policy_analysis.filter((p) => p.selected_in_optimal_path && p.allocated_monthly_amount > 0);
  const selectedUpcoming = selected.filter((p) => p.application_status === "UPCOMING");
  const policyMonthly = selected.reduce((sum, p) => sum + p.allocated_monthly_amount, 0);
  const generalMonthly = Math.max(0, r.profile.monthly_saving_capacity - policyMonthly);
  const additional = r.policy_effect.additional_assets;
  const otherEffect = additional - r.optimized.government_support - r.optimized.tax_benefit;
  const goalGap = r.goal.status === "SHORTFALL" ? r.goal.shortfall : Math.max(0, r.optimized.final_assets - r.goal.target_assets);

  return <Shell>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-slate-500">내 FinPath</p>
        <h1 className="mt-1 text-3xl font-black md:text-4xl">결론부터 보여드릴게요.</h1>
        <p className="mt-2 text-sm text-slate-600">같은 저축액으로 얼마나 달라지는지, 그리고 이번 달 무엇을 하면 되는지만 먼저 봅니다.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/analysis" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">정책 근거</Link>
        <Link href="/scenario" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">조건 변경</Link>
      </div>
    </header>

    {pending.length > 0 && additional === 0 && <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <b className="text-amber-900">추가 자격요건 확인이 필요합니다.</b>
      <p className="mt-1 text-sm text-amber-800">현재 0원 차이는 정책효과가 없다는 뜻이 아니라, 미확인 정책을 안전하게 제외한 결과입니다.</p>
      <Link href="/analysis#confirm" className="mt-3 inline-block rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">{pending.length}개 정책 조건 확인하기</Link>
    </section>}

    <section className="mt-7 rounded-3xl bg-slate-950 p-6 text-white shadow-lg md:p-8">
      <p className="text-sm font-bold text-slate-400">{r.profile.target_years}년 후 예상자산</p>
      <h2 className="mt-2 text-3xl font-black md:text-4xl">{full ? "세 가지 경로를 한 번에 비교합니다." : additional > 0 ? `같은 저축액으로 ${manWon(additional)} 더 만들 수 있어요.` : "현재 확정 조건에서는 일반저축과 동일해요."}</h2>
      <div className={`mt-6 grid gap-3 ${full ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
        <div className="rounded-2xl bg-white/10 p-5">
          <span className="text-xs text-slate-300">1 · 일반저축</span>
          <b className="mt-2 block text-3xl">{manWon(r.baseline.final_assets)}</b>
          <p className="mt-2 text-xs text-slate-400">현재 월 {manWon(r.profile.monthly_saving_capacity)} 그대로</p>
        </div>
        <div className="rounded-2xl bg-white p-5 text-slate-950">
          <span className="text-xs font-bold text-slate-500">2 · 기본 FinPath</span>
          <b className="mt-2 block text-3xl">{manWon(r.optimized.final_assets)}</b>
          <p className="mt-2 text-sm font-bold text-emerald-700">일반저축 대비 {signedMoney(additional)}</p>
        </div>
        {full && <div className="rounded-2xl bg-emerald-300 p-5 text-slate-950">
          <span className="text-xs font-black text-emerald-950">3 · Full FinPath</span>
          <b className="mt-2 block text-3xl">{manWon(full.enhanced_analysis.optimized.final_assets)}</b>
          <p className="mt-2 text-sm font-black text-emerald-950">일반저축 대비 {signedMoney(full.enhanced_analysis.optimized.final_assets - r.baseline.final_assets)}</p>
          <p className="mt-1 text-xs font-bold text-emerald-900">기본 FinPath보다 {signedMoney(full.enhanced_analysis.optimized.final_assets - r.optimized.final_assets)}</p>
        </div>}
      </div>
    </section>

    {selectedUpcoming.length > 0 && <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-violet-950">
      <b>모집 예정/검토 정책 포함</b> · 실제 모집이 확정되면 공식 공고를 다시 확인해주세요.
    </div>}

    <div className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-500">이번 달 실행</p>
        <h2 className="mt-1 text-2xl font-black">월 {manWon(r.profile.monthly_saving_capacity)}을 이렇게 나눠보세요.</h2>
        <div className="mt-5 space-y-3">
          {selected.map((p) => <div key={p.policy_id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b>{p.policy_name}</b>
                <p className="mt-1 text-xs text-slate-500">{applicationLabel[p.application_status]} · 월 {manWon(p.allocated_monthly_amount)}</p>
              </div>
              <a href={p.source_url} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">{policyLinkLabel(p)} ↗</a>
            </div>
          </div>)}
          {generalMonthly > 0 && <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><div><b>일반저축</b><p className="mt-1 text-xs text-slate-500">남은 저축여력</p></div><b>월 {manWon(generalMonthly)}</b></div>}
          {selected.length === 0 && <div className="rounded-2xl bg-slate-50 p-4"><b>현재는 일반저축 100%</b><p className="mt-1 text-sm text-slate-500">정책 자격이 확정되면 자동으로 다시 배분합니다.</p></div>}
        </div>
      </section>

      <section className={`rounded-3xl border p-6 ${r.goal.status === "ACHIEVED" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
        <p className="text-sm font-bold text-slate-500">내 목표</p>
        <h2 className="mt-1 text-2xl font-black">{r.goal.status === "ACHIEVED" ? "현재 경로로 목표 달성 가능" : `목표까지 ${manWon(goalGap)} 부족`}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white p-4"><span className="text-slate-500">목표</span><b className="mt-1 block text-lg">{manWon(r.goal.target_assets)}</b></div>
          <div className="rounded-2xl bg-white p-4"><span className="text-slate-500">FinPath 예상</span><b className="mt-1 block text-lg">{manWon(r.optimized.final_assets)}</b></div>
        </div>
        {gs && <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white"><span className="text-xs text-slate-300">목표를 꼭 달성하려면</span><p className="mt-1 font-black">월 {manWon(r.profile.monthly_saving_capacity)} → {manWon(gs.required_monthly_saving)}</p><p className="mt-1 text-xs text-slate-300">또는 기간 {r.profile.target_years}년 → {monthsText(gs.required_duration_months)}</p></div>}
      </section>
    </div>

    {full ? <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-bold text-emerald-700">Full FinPath 적용됨</p><h2 className="mt-1 text-2xl font-black">소비·카드에서 월 +{manWon(full.total_extra_monthly_saving)}의 추가 저축여력을 찾았습니다.</h2><p className="mt-2 text-sm text-emerald-900">월 저축여력 {manWon(r.profile.monthly_saving_capacity)} → {manWon(full.enhanced_monthly_saving_capacity)}</p></div>
        <Link href="/spending" className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-bold text-white">소비 분석 다시하기</Link>
      </div>
    </section> : <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
      <p className="text-sm font-bold text-emerald-700">선택 부가서비스</p>
      <h2 className="mt-1 text-2xl font-black">기본 금융경로는 끝났어요. 더 당기고 싶다면 소비·카드까지 볼 수 있어요.</h2>
      <p className="mt-2 text-sm text-emerald-900">기본 결과는 그대로 보존하고, 추가로 만든 저축여력만 더해 Full FinPath를 계산합니다.</p>
      <Link href="/spending" className="mt-4 inline-block rounded-xl bg-emerald-950 px-5 py-3 font-black text-white">소비·카드 최적화 해보기</Link>
    </section>}

    <details className="mt-7 rounded-3xl border border-slate-200 bg-white p-6">
      <summary className="cursor-pointer text-lg font-black">상세 결과 펼쳐보기 <span className="ml-2 text-sm font-medium text-slate-400">혜택 구성 · 그래프 · 로드맵 · 계산가정</span></summary>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-emerald-50 p-4"><span className="text-xs font-semibold text-emerald-800">정부지원</span><b className="mt-1 block text-xl">+{manWon(r.optimized.government_support)}</b></div>
        <div className="rounded-2xl bg-blue-50 p-4"><span className="text-xs font-semibold text-blue-800">절세효과</span><b className="mt-1 block text-xl">+{manWon(r.optimized.tax_benefit)}</b></div>
        <div className="rounded-2xl bg-slate-100 p-4"><span className="text-xs font-semibold text-slate-600">이자·배분·재예치</span><b className="mt-1 block text-xl">{signedMoney(otherEffect)}</b></div>
      </div>
      <div className="mt-7"><h3 className="mb-3 text-lg font-black">자산 변화</h3><AssetChart result={r}/></div>
      <div className="mt-7"><h3 className="text-lg font-black">실행 로드맵</h3><div className="mt-3 space-y-2">{r.roadmap.map((x, i) => <div key={`${x.type}-${i}`} className="flex flex-col justify-between gap-2 rounded-2xl bg-slate-50 p-4 sm:flex-row"><div><b>{x.product_name}</b><p className="text-xs text-slate-500">{roadmapTypeLabel[x.type] || x.type}</p></div><div className="text-sm sm:text-right"><b>{x.start_month} ~ {x.end_month}</b><p className="text-slate-500">{x.monthly_amount ? `월 ${manWon(x.monthly_amount)}` : x.type === "MATURITY_REINVESTMENT" ? `${manWon(x.initial_amount)} 재예치` : ""}</p></div></div>)}</div></div>
      <div className="mt-7 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        <b className="text-slate-800">계산 기준</b><p className="mt-1">일반저축 기준금리 연 {(r.assumptions.baseline_annual_rate * 100).toFixed(2)}% · {r.assumptions.baseline_rate_source} · 확인일 {r.assumptions.baseline_rate_checked_at}</p><p>일반저축 이자소득세 15.4% · 정책별 비과세/감면 조건은 정책 데이터에 따라 반영</p><p>정책은 시뮬레이션 시작 시점 가입을 가정하며 만기 후 신규 정책 재가입은 계산하지 않습니다.</p>
      </div>
    </details>
  </Shell>;
}
