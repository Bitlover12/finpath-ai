"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { analyze, checkEligibility, getPolicies } from "../../lib/api";
import { applicationLabel, eligibilityLabel, policyRank, policySummary } from "../../lib/policyPreview";
import { saveAnalysis } from "../../lib/storage";
import type { EligibilityResult, PolicyCatalogItem, UserProfile } from "../../lib/types";

const initial: UserProfile = {
  age: 26,
  region: "SEOUL",
  employment_type: "EMPLOYEE",
  company_size: "SME",
  annual_income: 34_000_000,
  employment_months: 12,
  current_assets: 15_000_000,
  monthly_saving_capacity: 1_000_000,
  housing_status: "NO_HOME",
  household_income: 70_000_000,
  marital_status: "SINGLE",
  target_assets: 200_000_000,
  target_years: 9,
  manual_confirmations: {},
};

const regionOptions = [["SEOUL","서울"],["GYEONGGI","경기"],["INCHEON","인천"],["BUSAN","부산"],["DAEJEON","대전"],["JEONBUK","전북"],["JEONNAM","전남"],["JEJU","제주"]];
const employmentOptions = [["EMPLOYEE","재직자"],["SELF_EMPLOYED","자영업"],["FREELANCER","프리랜서"],["UNEMPLOYED","미취업"],["OTHER","기타"]];
const companyOptions = [["SME","중소기업"],["MID","중견기업"],["LARGE","대기업"],["PUBLIC","공공기관"],["NONE","해당 없음"],["OTHER","기타"]];

function money(n: number | null | undefined) {
  return `${Math.round(n || 0).toLocaleString("ko-KR")}원`;
}

function statusTone(result?: EligibilityResult) {
  if (result?.status === "ELIGIBLE") return "text-[#00a86b] bg-[#e8f8f1]";
  if (result?.status === "NEEDS_MORE_INFORMATION") return "text-[#b7791f] bg-[#fff7e6]";
  return "text-[#8b95a1] bg-[#f2f4f6]";
}

function CompactPolicy({ policy, result }: { policy: PolicyCatalogItem; result?: EligibilityResult }) {
  const summary = policySummary(policy);
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-bold text-[#333d4b]">{policy.name}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(result)}`}>{eligibilityLabel(result, policy)}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#6b7684]">{summary.target.slice(0, 3).join(" · ") || "공식 공고 요건 확인"}</p>
          <p className="mt-1 text-[13px] font-semibold text-[#3182f6]">{summary.benefit.slice(0, 3).join(" · ")}</p>
        </div>
        <a href={policy.source_url} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] font-bold text-[#8b95a1] hover:text-[#3182f6]">공식 정보 ↗</a>
      </div>
      {result?.status === "NEEDS_MORE_INFORMATION" && summary.extra.length > 0 && (
        <p className="mt-2 text-[12px] leading-5 text-[#8b95a1]">추가 확인 · {summary.extra.slice(0, 2).join(" · ")}{summary.extra.length > 2 ? ` 외 ${summary.extra.length - 2}개` : ""}</p>
      )}
      <p className="mt-1 text-[11px] text-[#b0b8c1]">{applicationLabel(policy.application_status)}</p>
    </div>
  );
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
    getPolicies().then((items) => { if (active) setPolicies(items); }).catch(() => { if (active) setPreviewError("정책 정보를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true); setPreviewError("");
      try {
        const response = await checkEligibility(profile);
        if (!cancelled) setEligibility(response.results);
      } catch {
        if (!cancelled) setPreviewError("정책 후보를 계산하지 못했습니다.");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 320);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [profile]);

  const byId = useMemo(() => new Map(eligibility.map((r) => [r.policy_id, r])), [eligibility]);
  const sortedPolicies = useMemo(() => [...policies].sort((a, b) => policyRank(byId.get(a.id), a) - policyRank(byId.get(b.id), b)), [policies, byId]);
  const activeCandidates = sortedPolicies.filter((p) => {
    const r = byId.get(p.id);
    return r && r.status !== "INELIGIBLE" && ["OPEN", "UPCOMING"].includes(p.application_status);
  });
  const confirmed = activeCandidates.filter((p) => byId.get(p.id)?.status === "ELIGIBLE").length;
  const needs = activeCandidates.filter((p) => byId.get(p.id)?.status === "NEEDS_MORE_INFORMATION").length;

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const result = await analyze(profile);
      saveAnalysis(result);
      const needsConfirmation = result.policy_analysis.some((p) => p.status === "NEEDS_MORE_INFORMATION" && ["OPEN", "UPCOMING"].includes(p.application_status));
      router.push(needsConfirmation ? "/analysis" : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했습니다.");
    } finally { setLoading(false); }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="fp-label">1 · 내 금융 트윈</p>
          <h1 className="fp-title mt-2">몇 가지만 알려주시면, 볼 필요 없는 정책부터 지울게요.</h1>
          <p className="fp-muted mt-3">입력하는 동안 오른쪽에서 정책 후보가 바로 좁혀집니다. 확실하지 않은 조건은 억지로 통과시키지 않아요.</p>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <form onSubmit={submit} className="fp-panel overflow-hidden">
            <section className="p-6 sm:p-8">
              <p className="text-[17px] font-black">기본 조건</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#4e5968]">나이<input className="fp-input" type="number" min={15} max={80} value={profile.age} onChange={(e)=>set("age",Number(e.target.value))}/></label>
                <label className="text-sm font-semibold text-[#4e5968]">거주지역<select className="fp-input" value={profile.region} onChange={(e)=>set("region",e.target.value)}>{regionOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
              </div>
            </section>

            <section className="border-t border-[#edf0f3] p-6 sm:p-8">
              <p className="text-[17px] font-black">일과 소득</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#4e5968]">고용형태<select className="fp-input" value={profile.employment_type} onChange={(e)=>set("employment_type",e.target.value)}>{employmentOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <label className="text-sm font-semibold text-[#4e5968]">기업규모<select className="fp-input" value={profile.company_size} onChange={(e)=>set("company_size",e.target.value)}>{companyOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                <label className="text-sm font-semibold text-[#4e5968]">연소득<input className="fp-input" type="number" step={100000} min={0} value={profile.annual_income} onChange={(e)=>set("annual_income",Number(e.target.value))}/><span className="mt-1.5 block text-xs font-normal text-[#8b95a1]">{money(profile.annual_income)}</span></label>
                <label className="text-sm font-semibold text-[#4e5968]">재직기간<input className="fp-input" type="number" min={0} value={profile.employment_months} onChange={(e)=>set("employment_months",Number(e.target.value))}/><span className="mt-1.5 block text-xs font-normal text-[#8b95a1]">{profile.employment_months}개월</span></label>
                <label className="text-sm font-semibold text-[#4e5968] sm:col-span-2">가구소득 <span className="font-normal text-[#8b95a1]">(선택)</span><input className="fp-input" type="number" step={100000} min={0} value={profile.household_income ?? ""} onChange={(e)=>set("household_income",e.target.value === "" ? null : Number(e.target.value))}/></label>
              </div>
            </section>

            <section className="border-t border-[#edf0f3] p-6 sm:p-8">
              <p className="text-[17px] font-black">내 자산 목표</p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#4e5968]">현재 자산<input className="fp-input" type="number" step={100000} min={0} value={profile.current_assets} onChange={(e)=>set("current_assets",Number(e.target.value))}/><span className="mt-1.5 block text-xs font-normal text-[#8b95a1]">{money(profile.current_assets)}</span></label>
                <label className="text-sm font-semibold text-[#4e5968]">월 저축 가능액<input className="fp-input" type="number" step={10000} min={0} value={profile.monthly_saving_capacity} onChange={(e)=>set("monthly_saving_capacity",Number(e.target.value))}/><span className="mt-1.5 block text-xs font-normal text-[#8b95a1]">{money(profile.monthly_saving_capacity)}</span></label>
                <label className="text-sm font-semibold text-[#4e5968]">목표자산<input className="fp-input" type="number" step={100000} min={0} value={profile.target_assets} onChange={(e)=>set("target_assets",Number(e.target.value))}/><span className="mt-1.5 block text-xs font-normal text-[#8b95a1]">{money(profile.target_assets)}</span></label>
                <label className="text-sm font-semibold text-[#4e5968]">목표기간<input className="fp-input" type="number" min={1} max={40} value={profile.target_years} onChange={(e)=>set("target_years",Number(e.target.value))}/><span className="mt-1.5 block text-xs font-normal text-[#8b95a1]">{profile.target_years}년</span></label>
              </div>
            </section>

            <div className="border-t border-[#edf0f3] bg-[#fbfcfd] p-6 sm:flex sm:items-center sm:justify-between sm:px-8">
              <p className="text-[13px] leading-5 text-[#8b95a1]">입력값은 계산에만 사용하고 서버에 영구 저장하지 않습니다.</p>
              <button type="submit" disabled={loading} className="fp-primary mt-4 w-full sm:mt-0 sm:w-auto sm:min-w-[180px]">{loading ? "경로 계산 중..." : "내 경로 계산하기"}</button>
              {error && <p className="mt-3 text-sm font-semibold text-rose-600 sm:absolute">{error}</p>}
            </div>
          </form>

          <aside className="lg:sticky lg:top-24">
            <div className="fp-panel p-6">
              <div className="flex items-start justify-between gap-3">
                <div><p className="fp-label">정책 미리보기</p><h2 className="mt-1 text-[22px] font-black tracking-[-0.035em]">지금 볼 정책 {activeCandidates.length}개</h2></div>
                {previewLoading && <span className="text-xs font-semibold text-[#8b95a1]">확인 중</span>}
              </div>
              <div className="mt-4 flex gap-5 border-b border-[#edf0f3] pb-4 text-sm">
                <span><b className="text-[#00a86b]">{confirmed}</b><span className="ml-1 text-[#8b95a1]">조건상 가능</span></span>
                <span><b className="text-[#b7791f]">{needs}</b><span className="ml-1 text-[#8b95a1]">추가 확인</span></span>
              </div>
              {previewError ? <p className="mt-5 text-sm text-rose-600">{previewError}</p> : activeCandidates.length === 0 ? <div className="py-8 text-center"><p className="font-bold">현재 모집 기준 후보가 없어요.</p><p className="mt-2 text-sm leading-6 text-[#8b95a1]">그래도 일반저축 기준 목표 계산은 계속할 수 있습니다.</p></div> : <div className="divide-y divide-[#edf0f3]">{activeCandidates.slice(0,4).map((policy)=><CompactPolicy key={policy.id} policy={policy} result={byId.get(policy.id)}/>)}</div>}

              <details className="mt-5 border-t border-[#edf0f3] pt-4">
                <summary className="cursor-pointer text-sm font-bold text-[#6b7684]">전체 정책 {policies.length}개 조건 보기</summary>
                <div className="mt-3 max-h-[360px] divide-y divide-[#edf0f3] overflow-y-auto pr-1">{sortedPolicies.map((policy)=><CompactPolicy key={policy.id} policy={policy} result={byId.get(policy.id)}/>)}</div>
              </details>
            </div>
            <p className="mt-4 px-1 text-[12px] leading-5 text-[#8b95a1]">여기서는 1차 필터만 보여드립니다. 중위소득·건보료·증빙처럼 자동 확인이 어려운 조건은 다음 단계에서 따로 확인해요.</p>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
