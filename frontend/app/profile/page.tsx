"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { analyze } from "../../lib/api";
import { saveAnalysis } from "../../lib/storage";
import type { UserProfile } from "../../lib/types";

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

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof UserProfile, value: string | number | null) => setProfile((p) => ({ ...p, [key]: value }));

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
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-bold text-slate-500">내 조건 입력</p>
      <h1 className="mt-2 text-4xl font-black">그냥 저축했을 때와<br className="sm:hidden"/> FinPath 경로를 비교해볼게요.</h1>
      <p className="mt-3 max-w-2xl text-slate-600">입력한 조건으로 일반저축과 정책 활용 경로를 같은 월 저축액 기준으로 비교합니다. 정책별 복잡한 요건이 남으면 비교 전에 필요한 항목만 짧게 추가 확인합니다.</p>

      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <label className="text-sm font-semibold">나이<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.age} onChange={(e)=>set("age",Number(e.target.value))}/></label>
        <label className="text-sm font-semibold">지역<select className="mt-2 w-full rounded-xl border p-3" value={profile.region} onChange={(e)=>set("region",e.target.value)}>{regionOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm font-semibold">고용형태<select className="mt-2 w-full rounded-xl border p-3" value={profile.employment_type} onChange={(e)=>set("employment_type",e.target.value)}>{employmentOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm font-semibold">기업규모<select className="mt-2 w-full rounded-xl border p-3" value={profile.company_size} onChange={(e)=>set("company_size",e.target.value)}>{companyOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        {moneyFields.map(([key,label,help]) => <label key={String(key)} className="text-sm font-semibold">{label}<input className="mt-2 w-full rounded-xl border p-3" type="number" value={Number(profile[key] ?? 0)} onChange={(e)=>set(key,Number(e.target.value))}/><span className="mt-1 block text-xs font-normal text-slate-400">{Number(profile[key] ?? 0).toLocaleString("ko-KR")}원 · {help}</span></label>)}
        <label className="text-sm font-semibold">재직기간<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.employment_months} onChange={(e)=>set("employment_months",Number(e.target.value))}/><span className="mt-1 block text-xs font-normal text-slate-400">{profile.employment_months}개월</span></label>
        <label className="text-sm font-semibold">목표기간<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.target_years} onChange={(e)=>set("target_years",Number(e.target.value))}/><span className="mt-1 block text-xs font-normal text-slate-400">{profile.target_years}년 뒤를 비교합니다.</span></label>
        <div className="md:col-span-2 mt-2 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center">
          <button disabled={loading} className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white">{loading?"비교 경로 계산 중...":"일반저축과 FinPath 비교하기"}</button>
          {error&&<span className="text-sm text-rose-600">{error}</span>}
        </div>
      </form>
    </div>
  </Shell>;
}
