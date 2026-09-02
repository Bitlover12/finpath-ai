"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { analyze, checkEligibility, getPolicies } from "../../lib/api";
import { applicationLabel, eligibilityLabel, eligibilityTone, policyRank, policySummary } from "../../lib/policyPreview";
import { saveAnalysis } from "../../lib/storage";
import type { EligibilityResult, PolicyCatalogItem, UserProfile } from "../../lib/types";

const initial: UserProfile = {
  age: 26, region: "SEOUL", employment_type: "EMPLOYEE", company_size: "SME",
  annual_income: 34_000_000, employment_months: 12, current_assets: 15_000_000,
  monthly_saving_capacity: 1_000_000, housing_status: "NO_HOME", household_income: 70_000_000,
  marital_status: "SINGLE", target_assets: 200_000_000, target_years: 9, manual_confirmations: {},
};

const regionOptions = [
  ["SEOUL","서울"],["GYEONGGI","경기"],["INCHEON","인천"],["BUSAN","부산"],
  ["DAEJEON","대전"],["JEONBUK","전북"],["JEONNAM","전남"],["JEJU","제주"],
];
const employmentOptions = [
  ["EMPLOYEE","재직자"],["SELF_EMPLOYED","자영업"],["FREELANCER","프리랜서"],
  ["UNEMPLOYED","미취업"],["OTHER","기타"],
];
const companyOptions = [
  ["SME","중소기업"],["MID","중견기업"],["LARGE","대기업"],
  ["PUBLIC","공공기관"],["NONE","해당 없음"],["OTHER","기타"],
];

function PolicyPreviewCard({ policy, result, compact = false }: { policy: PolicyCatalogItem; result?: EligibilityResult; compact?: boolean }) {
  const summary = policySummary(policy);
  return <article className={`rounded-2xl border p-4 ${eligibilityTone(result, policy)}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500">{applicationLabel(policy.application_status)}</p>
        <h3 className="mt-1 text-base font-black leading-snug text-slate-950">{policy.name}</h3>
      </div>
      <span className="shrink-0 rounded-full border border-current/10 bg-white/70 px-2.5 py-1 text-xs font-bold text-slate-700">
        {eligibilityLabel(result, policy)}
      </span>
    </div>

    <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-700">
      <p><span className="font-bold text-slate-900">대상</span> · {summary.target.length ? summary.target.join(" · ") : "공식 공고 요건 확인"}</p>
      <p><span className="font-bold text-slate-900">혜택</span> · {summary.benefit.join(" · ")}</p>
      {summary.extra.length > 0 && <p className="text-slate-600"><span className="font-bold text-slate-900">추가 확인</span> · {compact && summary.extra.length > 3 ? `${summary.extra.slice(0,3).join(" · ")} 외 ${summary.extra.length - 3}개` : summary.extra.join(" · ")}</p>}
    </div>

    {!compact && policy.application_period_text && <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs leading-relaxed text-slate-500">{policy.application_period_text}</p>}
    <a href={policy.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold text-slate-700 underline underline-offset-4 hover:text-slate-950">공식 조건 확인 ↗</a>
  </article>;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [policies, setPolicies] = useState<PolicyCatalogItem[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityResult[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const set = (key: keyof UserProfile, value: string | number | null) => setProfile((p) => ({ ...p, [key]: value }));

  useEffect(() => {
    let active = true;
    getPolicies().then((items) => { if (active) setPolicies(items); }).catch(() => { if (active) setPreviewError("정책 목록을 불러오지 못했습니다."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let active = true;
      setPreviewLoading(true);
      setPreviewError("");
      checkEligibility(profile)
        .then((response) => { if (active) setEligibility(response.results); })
        .catch(() => { if (active) setPreviewError("현재 조건의 정책 미리보기를 계산하지 못했습니다."); })
        .finally(() => { if (active) setPreviewLoading(false); });
      return () => { active = false; };
    }, 320);
    return () => window.clearTimeout(timer);
  }, [profile]);

  const byId = useMemo(() => new Map(eligibility.map((r) => [r.policy_id, r])), [eligibility]);
  const sortedPolicies = useMemo(() => [...policies].sort((a, b) => policyRank(byId.get(a.id), a) - policyRank(byId.get(b.id), b)), [policies, byId]);
  const candidates = sortedPolicies.filter((p) => {
    const result = byId.get(p.id);
    return result && result.status !== "INELIGIBLE" && ["OPEN", "UPCOMING"].includes(p.application_status);
  });
  const confirmed = candidates.filter((p) => byId.get(p.id)?.status === "ELIGIBLE").length;
  const needs = candidates.filter((p) => byId.get(p.id)?.status === "NEEDS_MORE_INFORMATION").length;
  const ineligible = eligibility.filter((r) => r.status === "INELIGIBLE").length;

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const result = await analyze(profile);
      saveAnalysis(result);
      const needsConfirmation = result.policy_analysis.some((p) => p.status === "NEEDS_MORE_INFORMATION");
      router.push(needsConfirmation ? "/analysis" : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했습니다.");
    } finally { setLoading(false); }
  }

  const moneyFields: [keyof UserProfile, string, string][] = [
    ["annual_income","연소득","정책의 개인소득 기준 판정에 사용"],
    ["household_income","가구소득","일부 정책의 가구소득 기준 판정에 사용"],
    ["current_assets","현재 자산","오늘 기준 보유한 금융자산"],
    ["monthly_saving_capacity","월 저축 가능액","매달 꾸준히 저축할 수 있는 금액"],
    ["target_assets","목표자산","목표기간 종료 시 만들고 싶은 자산"],
  ];

  return <Shell>
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-bold text-slate-500">내 조건 입력</p>
      <h1 className="mt-2 text-4xl font-black">입력하면서, 받을 수 있는 정책부터 걸러볼게요.</h1>
      <p className="mt-3 max-w-3xl text-slate-600">나이·지역·소득·직장 조건을 입력하면 정책 후보를 먼저 좁혀 보여드립니다. 복잡한 가구요건·증빙요건은 임의로 통과시키지 않고 ‘추가 확인 필요’로 구분합니다.</p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)]">
        <form onSubmit={submit} className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
          <label className="text-sm font-semibold">나이<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.age} onChange={(e)=>set("age",Number(e.target.value))}/></label>
          <label className="text-sm font-semibold">지역<select className="mt-2 w-full rounded-xl border p-3" value={profile.region} onChange={(e)=>set("region",e.target.value)}>{regionOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label className="text-sm font-semibold">고용형태<select className="mt-2 w-full rounded-xl border p-3" value={profile.employment_type} onChange={(e)=>set("employment_type",e.target.value)}>{employmentOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label className="text-sm font-semibold">기업규모<select className="mt-2 w-full rounded-xl border p-3" value={profile.company_size} onChange={(e)=>set("company_size",e.target.value)}>{companyOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          {moneyFields.map(([key,label,help]) => <label key={String(key)} className="text-sm font-semibold">{label}<input className="mt-2 w-full rounded-xl border p-3" type="number" value={Number(profile[key] ?? 0)} onChange={(e)=>set(key,Number(e.target.value))}/><span className="mt-1 block text-xs font-normal text-slate-400">{Number(profile[key] ?? 0).toLocaleString("ko-KR")}원 · {help}</span></label>)}
          <label className="text-sm font-semibold">재직기간<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.employment_months} onChange={(e)=>set("employment_months",Number(e.target.value))}/><span className="mt-1 block text-xs font-normal text-slate-400">{profile.employment_months}개월</span></label>
          <label className="text-sm font-semibold">목표기간<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.target_years} onChange={(e)=>set("target_years",Number(e.target.value))}/><span className="mt-1 block text-xs font-normal text-slate-400">{profile.target_years}년 뒤를 비교합니다.</span></label>
          <div className="md:col-span-2 mt-2 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center">
            <button disabled={loading} className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white">{loading?"최종 경로 계산 중...":"이 조건으로 FinPath 계산하기"}</button>
            {error&&<span className="text-sm text-rose-600">{error}</span>}
          </div>
        </form>

        <aside className="lg:sticky lg:top-24">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">정책 미리보기</p>
                <h2 className="mt-1 text-2xl font-black">지금 입력 기준 후보</h2>
              </div>
              {previewLoading && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">재판정 중…</span>}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-emerald-50 px-2 py-3"><p className="text-xl font-black text-emerald-700">{confirmed}</p><p className="mt-1 text-[11px] font-bold text-emerald-700">조건상 가능</p></div>
              <div className="rounded-2xl bg-amber-50 px-2 py-3"><p className="text-xl font-black text-amber-700">{needs}</p><p className="mt-1 text-[11px] font-bold text-amber-700">추가 확인</p></div>
              <div className="rounded-2xl bg-slate-100 px-2 py-3"><p className="text-xl font-black text-slate-600">{ineligible}</p><p className="mt-1 text-[11px] font-bold text-slate-600">현재 미충족</p></div>
            </div>

            {previewError && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{previewError}</p>}

            <div className="mt-4 space-y-3">
              {!previewLoading && candidates.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">현재 입력만으로 모집 중·예정 정책 후보가 잡히지 않았습니다. 조건을 바꾸면 이 영역이 즉시 다시 필터링됩니다.</div>}
              {candidates.slice(0, 4).map((policy) => <PolicyPreviewCard key={policy.id} policy={policy} result={byId.get(policy.id)} compact />)}
              {candidates.length > 4 && <p className="text-center text-xs font-semibold text-slate-400">후보 {candidates.length - 4}개는 아래 전체 정책 요약에서 확인할 수 있어요.</p>}
            </div>
          </section>
        </aside>
      </div>

      <details className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer list-none font-black text-slate-900">전체 정책 {policies.length || 0}개 가입조건 요약 보기 <span className="ml-2 text-sm font-semibold text-slate-400">나한테 안 맞는 정책까지 한 번에 확인</span></summary>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {sortedPolicies.map((policy) => <PolicyPreviewCard key={policy.id} policy={policy} result={byId.get(policy.id)} />)}
        </div>
      </details>
    </div>
  </Shell>;
}
