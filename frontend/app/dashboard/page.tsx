"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AssetChart } from "../../components/AssetChart";
import { Shell } from "../../components/Shell";
import { getOpportunityRadar } from "../../lib/api";
import { manWon, monthsText } from "../../lib/format";
import { applicationLabel, roadmapTypeLabel } from "../../lib/labels";
import { loadAnalysis, loadSpendingOptimization } from "../../lib/storage";
import type { AnalyzeResponse, OpportunityRadarResponse, PolicyAnalysis, PolicyCliffEvent, SpendingOptimizationResponse } from "../../lib/types";

function signedMoney(value: number) { return `${value >= 0 ? "+" : "-"}${manWon(Math.abs(value))}`; }
function policyLinkLabel(policy: PolicyAnalysis) {
  if (policy.application_status === "OPEN") return "신청 경로";
  if (policy.application_status === "UPCOMING") return "모집 공고";
  if (policy.application_status === "CLOSED") return "지난 공고";
  return "공식 안내";
}
function cliffDistance(x: PolicyCliffEvent) {
  if (x.distance_unit === "KRW") return `${manWon(x.distance_value)} 차이`;
  if (x.distance_unit === "MONTHS") return `${x.distance_value}개월 차이`;
  return `연령 기준 ${x.distance_value}단계 차이`;
}

export default function DashboardPage() {
  const [r, setR] = useState<AnalyzeResponse | null>(null);
  const [full, setFull] = useState<SpendingOptimizationResponse | null>(null);
  const [radar, setRadar] = useState<OpportunityRadarResponse | null>(null);
  const [radarError, setRadarError] = useState("");

  useEffect(() => {
    const base = loadAnalysis();
    setR(base);
    setFull(loadSpendingOptimization());
    if (base) {
      getOpportunityRadar(base.profile).then(setRadar).catch((e) => setRadarError(e instanceof Error ? e.message : "금융기회 레이더를 불러오지 못했습니다."));
    }
  }, []);

  if (!r) return <Shell><div className="fp-panel p-7">분석 결과가 없습니다. <Link href="/profile" className="font-bold text-[#3182f6]">내 조건부터 입력하기 →</Link></div></Shell>;

  const gs = r.goal_seeking;
  const pending = r.policy_analysis.filter((p) => p.status === "NEEDS_MORE_INFORMATION" && ["OPEN", "UPCOMING"].includes(p.application_status));
  const selected = r.policy_analysis.filter((p) => p.selected_in_optimal_path && p.allocated_monthly_amount > 0);
  const selectedUpcoming = selected.filter((p) => p.application_status === "UPCOMING");
  const policyMonthly = selected.reduce((sum, p) => sum + p.allocated_monthly_amount, 0);
  const generalMonthly = Math.max(0, r.profile.monthly_saving_capacity - policyMonthly);
  const additional = r.policy_effect.additional_assets;
  const fullAdditional = full ? full.enhanced_analysis.optimized.final_assets - r.baseline.final_assets : null;
  const otherEffect = additional - r.optimized.government_support - r.optimized.tax_benefit;
  const radarCount = radar ? radar.now_available.length + radar.verify_required.length + radar.upcoming.length : 0;
  const topCliffs = radar?.cliffs.slice(0, 3) || [];

  return <Shell>
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="fp-label">MY FINANCIAL TWIN</p><h1 className="fp-title mt-2">내 금융상태에서 기회와 위험을 같이 볼게요.</h1></div>
        <Link href="/scenario" className="fp-secondary py-2.5 text-sm">미래 조건 시뮬레이션</Link>
      </div>

      <section className="mt-8 rounded-[30px] bg-[#191f28] p-7 text-white sm:p-9">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[13px] font-bold text-[#8bbcff]">FINANCIAL OPPORTUNITY RADAR</p>
            <h2 className="mt-3 text-[30px] font-black leading-[1.18] tracking-[-0.045em] sm:text-[40px]">
              {radar ? `현재 조건에서 확인할 금융기회 ${radarCount}개를 찾았어요.` : "내 조건 주변의 금융기회를 계산하고 있어요."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#b0b8c1]">지금 가능한 정책뿐 아니라, 소득·나이·재직기간 경계에서 정책경로가 바뀌는 지점도 같이 계산합니다.</p>
          </div>
          {radar && <div className="grid min-w-[300px] grid-cols-2 gap-x-7 gap-y-4 border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div><p className="text-[11px] text-[#8b95a1]">지금 확인</p><b className="mt-1 block text-[24px]">{radar.now_available.length}</b></div>
            <div><p className="text-[11px] text-[#8b95a1]">추가 확인</p><b className="mt-1 block text-[24px]">{radar.verify_required.length}</b></div>
            <div><p className="text-[11px] text-[#8b95a1]">모집 예정</p><b className="mt-1 block text-[24px]">{radar.upcoming.length}</b></div>
            <div><p className="text-[11px] text-[#8b95a1]">정책 경계</p><b className="mt-1 block text-[24px] text-[#ffb4a8]">{radar.cliffs.length}</b></div>
          </div>}
        </div>
      </section>

      {radarError && <p className="mt-3 text-sm font-semibold text-rose-600">레이더 연결 오류: {radarError}</p>}

      {radar && (radar.deadline_alerts.length > 0 || topCliffs.length > 0) && <section className="mt-6 divide-y divide-[#edf0f3] rounded-[24px] border border-[#edf0f3] bg-white px-5 sm:px-7">
        {radar.deadline_alerts.slice(0, 1).map((x) => <div key={`deadline-${x.policy_id}`} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><p className="text-[12px] font-bold text-[#f04452]">신청 마감 주의 · {x.deadline_days}일 남음</p><h3 className="mt-1 text-[16px] font-bold">{x.policy_name}</h3><p className="mt-1 text-[12px] leading-5 text-[#8b95a1]">{x.detail}</p></div>
          <a href={x.source_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#3182f6]">공식 확인 →</a>
        </div>)}
        {topCliffs.map((x) => <div key={x.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><p className="text-[12px] font-bold text-[#8b95a1]">POLICY CLIFF · {cliffDistance(x)}</p>{x.confidence === "CONDITIONAL" && <span className="rounded-full bg-[#fff7e6] px-2 py-0.5 text-[10px] font-bold text-[#b7791f]">추가조건 확인 필요</span>}</div><h3 className="mt-1 text-[16px] font-bold">{x.headline}</h3><p className="mt-1 text-[12px] leading-5 text-[#8b95a1]">경계 통과 시 장기 예상자산 {signedMoney(x.final_assets_delta)} · 정부지원 {signedMoney(x.government_support_delta)}</p></div>
          <Link href="/scenario" className="text-sm font-bold text-[#3182f6]">직접 시뮬레이션 →</Link>
        </div>)}
      </section>}

      {pending.length > 0 && additional === 0 ? <section className="mt-10 rounded-[28px] bg-[#fff7e6] p-7 sm:p-9">
        <p className="text-[13px] font-bold text-[#b7791f]">아직 확정 전</p>
        <h2 className="mt-2 max-w-2xl text-[30px] font-black tracking-[-0.045em] sm:text-[40px]">정책 조건 {pending.length}개만 확인하면 정확한 차이를 보여드릴 수 있어요.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b7684]">현재 0원 차이는 정책이 쓸모없다는 뜻이 아니라, 확인되지 않은 자격을 안전하게 제외한 결과예요.</p>
        <Link href="/analysis#confirm" className="fp-primary mt-6">조건 확인하고 결과 보기</Link>
      </section> : <section className="mt-10 overflow-hidden rounded-[30px] bg-[#eef6ff] p-7 sm:p-10">
        <p className="text-[13px] font-bold text-[#3182f6]">현재 최적 자산경로 · {r.profile.target_years}년 뒤</p>
        <h2 className="mt-3 max-w-3xl text-[34px] font-black leading-[1.18] tracking-[-0.05em] sm:text-[48px]">
          {full && fullAdditional !== null ? `Full FinPath까지 적용하면 ${manWon(fullAdditional)} 더 만들 수 있어요.` : additional > 0 ? `같은 저축액으로 ${manWon(additional)} 더 만들 수 있어요.` : "현재 확정 조건에서는 일반저축과 같아요."}
        </h2>
        <p className="mt-4 text-[15px] text-[#6b7684]">{full ? `월 저축여력 ${manWon(r.profile.monthly_saving_capacity)} → ${manWon(full.enhanced_monthly_saving_capacity)}` : `월 저축액 ${manWon(r.profile.monthly_saving_capacity)}은 그대로예요.`}</p>

        <div className={`mt-9 grid border-y border-[#dbeafe] ${full ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div className="py-5 sm:pr-7"><p className="text-xs font-semibold text-[#8b95a1]">그냥 저축</p><b className="mt-1 block text-[25px] tracking-[-0.03em]">{manWon(r.baseline.final_assets)}</b></div>
          <div className="border-t border-[#dbeafe] py-5 sm:border-l sm:border-t-0 sm:px-7"><p className="text-xs font-bold text-[#3182f6]">FinPath</p><b className="mt-1 block text-[25px] tracking-[-0.03em] text-[#3182f6]">{manWon(r.optimized.final_assets)}</b><p className="mt-1 text-xs font-bold text-[#3182f6]">{signedMoney(additional)}</p></div>
          {full && <div className="border-t border-[#dbeafe] py-5 sm:border-l sm:border-t-0 sm:pl-7"><p className="text-xs font-bold text-[#00a86b]">Full FinPath</p><b className="mt-1 block text-[25px] tracking-[-0.03em] text-[#00a86b]">{manWon(full.enhanced_analysis.optimized.final_assets)}</b><p className="mt-1 text-xs font-bold text-[#00a86b]">일반저축 대비 {signedMoney(fullAdditional || 0)}</p></div>}
        </div>
      </section>}

      {selectedUpcoming.length > 0 && <p className="mt-3 px-1 text-[12px] leading-5 text-[#8b95a1]">※ 추천 경로에 모집 예정/검토 정책이 포함되어 있습니다. 실제 가입 전 공식 공고를 다시 확인해주세요.</p>}

      <section className="mt-12">
        <p className="fp-label">이번 달 저축 배분</p>
        <h2 className="mt-2 text-[26px] font-black tracking-[-0.04em]">오늘 실행할 숫자만 정리했어요.</h2>
        <div className="mt-5 divide-y divide-[#edf0f3] rounded-[24px] border border-[#edf0f3] bg-white px-5 sm:px-7">
          {selected.map((p, idx) => <div key={p.policy_id} className="grid gap-3 py-6 sm:grid-cols-[42px_1fr_auto] sm:items-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef6ff] text-xs font-black text-[#3182f6]">{idx + 1}</span>
            <div><h3 className="text-[16px] font-bold">{p.policy_name}에 월 {manWon(p.allocated_monthly_amount)}</h3><p className="mt-1 text-[12px] text-[#8b95a1]">{applicationLabel[p.application_status]}{p.application_period_text ? ` · ${p.application_period_text}` : ""}</p></div>
            <a href={p.source_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#3182f6]">{policyLinkLabel(p)} →</a>
          </div>)}
          {generalMonthly > 0 && <div className="grid gap-3 py-6 sm:grid-cols-[42px_1fr_auto] sm:items-center"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2f4f6] text-xs font-black text-[#8b95a1]">{selected.length + 1}</span><div><h3 className="text-[16px] font-bold">남은 월 {manWon(generalMonthly)}은 일반저축</h3><p className="mt-1 text-[12px] text-[#8b95a1]">정책 한도 밖의 저축여력은 비교 기준금리로 계속 적립해요.</p></div><span className="text-sm font-semibold text-[#8b95a1]">자동 배분</span></div>}
          {selected.length === 0 && <div className="py-6"><h3 className="font-bold">현재는 일반저축 100%</h3><p className="mt-1 text-sm text-[#8b95a1]">정책 자격이 확정되면 월 배분을 자동으로 다시 계산합니다.</p></div>}
        </div>
      </section>

      {radar && radar.action_plan.length > 0 && <section className="mt-12">
        <p className="fp-label">AI ACTION PLAN</p>
        <h2 className="mt-2 text-[26px] font-black tracking-[-0.04em]">앞으로는 이 순서로 확인하세요.</h2>
        <div className="mt-5 divide-y divide-[#edf0f3] border-y border-[#edf0f3]">
          {radar.action_plan.map((x, i) => <div key={`${x.action_type}-${i}`} className="grid gap-3 py-5 sm:grid-cols-[70px_1fr_auto] sm:items-center">
            <span className={`text-[11px] font-black ${x.priority === "NOW" ? "text-[#f04452]" : x.priority === "SOON" ? "text-[#3182f6]" : "text-[#8b95a1]"}`}>{x.priority === "NOW" ? "지금" : x.priority === "SOON" ? "곧" : x.priority === "GOAL" ? "목표" : "주의"}</span>
            <div><h3 className="text-[15px] font-bold">{x.title}</h3><p className="mt-1 text-[12px] leading-5 text-[#8b95a1]">{x.detail}</p></div>
            {x.source_url ? <a href={x.source_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#3182f6]">공식 확인 →</a> : x.action_type === "SIMULATE_BEFORE_CHANGE" ? <Link href="/scenario" className="text-sm font-bold text-[#3182f6]">시뮬레이션 →</Link> : null}
          </div>)}
        </div>
      </section>}

      <section className="mt-12 grid gap-8 border-t border-[#edf0f3] pt-10 md:grid-cols-[1fr_1fr]">
        <div><p className="fp-label">내 목표</p><h2 className="mt-2 text-[26px] font-black tracking-[-0.04em]">{r.goal.status === "ACHIEVED" ? "현재 경로로 목표에 닿을 수 있어요." : `목표까지 ${manWon(r.goal.shortfall)} 부족해요.`}</h2><p className="mt-3 text-sm leading-6 text-[#6b7684]">목표 {manWon(r.goal.target_assets)} · FinPath 예상 {manWon(r.optimized.final_assets)}</p></div>
        <div>{r.goal.status === "SHORTFALL" && gs ? <div className="rounded-[24px] bg-[#f7f9fb] p-6"><p className="text-[13px] font-semibold text-[#8b95a1]">목표를 꼭 맞추려면</p><p className="mt-2 text-[20px] font-black">월 {manWon(r.profile.monthly_saving_capacity)} → {manWon(gs.required_monthly_saving)}</p><p className="mt-2 text-sm text-[#6b7684]">또는 목표기간을 {r.profile.target_years}년 → {monthsText(gs.required_duration_months)}로 조정</p></div> : <div className="rounded-[24px] bg-[#e8f8f1] p-6"><p className="text-[13px] font-bold text-[#00a86b]">목표 달성 가능</p><p className="mt-2 text-[20px] font-black">지금 계획을 유지하면 돼요.</p></div>}</div>
      </section>

      {full ? <section id="full-finpath" className="mt-12 rounded-[28px] bg-[#e8f8f1] p-7 sm:p-8"><p className="text-[13px] font-bold text-[#00a86b]">더 빠르게 가기 적용됨</p><h2 className="mt-2 text-[26px] font-black tracking-[-0.04em]">소비·카드에서 월 +{manWon(full.total_extra_monthly_saving)}을 더 찾았어요.</h2><p className="mt-2 text-sm text-[#4e5968]">기본 FinPath 결과는 보존하고, 추가 저축여력만 더해 Full FinPath를 계산했습니다.</p><Link href="/spending" className="mt-5 inline-flex text-sm font-bold text-[#00a86b]">다시 분석하기 →</Link></section> : <section className="mt-12 rounded-[28px] bg-[#f7f9fb] p-7 sm:p-8"><p className="text-[13px] font-semibold text-[#8b95a1]">선택 기능</p><h2 className="mt-2 max-w-2xl text-[26px] font-black tracking-[-0.04em]">금융경로는 끝났어요. 목표를 더 당기고 싶다면 소비에서 돈을 더 찾아볼 수 있어요.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b7684]">거래내역 또는 월 소비를 바탕으로 카드 순혜택과 조정 가능한 소비를 계산하고, 늘어난 저축여력으로 경로를 한 번 더 돌려요.</p><Link href="/spending" className="fp-secondary mt-5">더 빠르게 가기</Link></section>}

      <details className="mt-8 border-t border-[#edf0f3] py-7">
        <summary className="cursor-pointer text-sm font-bold text-[#6b7684]">계산 근거와 상세 결과 보기</summary>
        <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-[#e8f8f1] p-4"><span className="text-xs font-semibold text-[#00a86b]">정부지원</span><b className="mt-1 block text-xl">+{manWon(r.optimized.government_support)}</b></div><div className="rounded-2xl bg-[#eef6ff] p-4"><span className="text-xs font-semibold text-[#3182f6]">절세효과</span><b className="mt-1 block text-xl">+{manWon(r.optimized.tax_benefit)}</b></div><div className="rounded-2xl bg-[#f2f4f6] p-4"><span className="text-xs font-semibold text-[#6b7684]">이자·배분·재예치</span><b className="mt-1 block text-xl">{signedMoney(otherEffect)}</b></div></div>
        <div className="mt-8"><h3 className="mb-4 text-lg font-black">자산 변화</h3><AssetChart result={r}/></div>
        <div className="mt-8"><h3 className="text-lg font-black">전체 로드맵</h3><div className="mt-3 divide-y divide-[#edf0f3] rounded-2xl border border-[#edf0f3] bg-white px-5">{r.roadmap.map((x,i)=><div key={`${x.type}-${i}`} className="flex flex-col justify-between gap-2 py-4 sm:flex-row"><div><b className="text-sm">{x.product_name}</b><p className="mt-1 text-xs text-[#8b95a1]">{roadmapTypeLabel[x.type] || x.type}</p></div><div className="text-sm sm:text-right"><b>{x.start_month} ~ {x.end_month}</b><p className="mt-1 text-xs text-[#8b95a1]">{x.monthly_amount ? `월 ${manWon(x.monthly_amount)}` : x.type === "MATURITY_REINVESTMENT" ? `${manWon(x.initial_amount)} 재예치` : ""}</p></div></div>)}</div></div>
        <div className="mt-7 rounded-2xl bg-[#f7f9fb] p-5 text-[12px] leading-5 text-[#6b7684]"><b className="text-[#333d4b]">계산 기준</b><p className="mt-1">일반저축 기준금리 연 {(r.assumptions.baseline_annual_rate*100).toFixed(2)}% · {r.assumptions.baseline_rate_source} · 확인일 {r.assumptions.baseline_rate_checked_at}</p><p>일반저축 이자소득세 15.4% · 정책별 비과세/감면 조건은 데이터에 따라 반영합니다.</p><p>정책은 시뮬레이션 시작 시점 가입을 가정하며, 만기 후 신규 정책 재가입은 계산하지 않습니다.</p></div>
      </details>
    </div>
  </Shell>;
}
