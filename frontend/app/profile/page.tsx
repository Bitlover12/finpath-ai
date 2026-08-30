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

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof UserProfile, value: string | number | null) => setProfile((p) => ({ ...p, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try { const result = await analyze(profile); saveAnalysis(result); router.push("/analysis"); }
    catch (e) { setError(e instanceof Error ? e.message : "분석에 실패했습니다."); }
    finally { setLoading(false); }
  }

  const moneyFields: [keyof UserProfile, string][] = [["annual_income","연봉"],["household_income","가구소득"],["current_assets","현재 자산"],["monthly_saving_capacity","월 저축 가능액"],["target_assets","목표자산"]];
  return <Shell>
    <div className="max-w-4xl">
      <p className="text-sm font-bold text-slate-500">PROFILE</p><h1 className="mt-2 text-4xl font-black">내 금융조건 입력</h1>
      <p className="mt-3 text-slate-600">로그인 없이 바로 계산합니다. 가구소득은 일부 정책 판정에 필요할 수 있습니다.</p>
      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 md:grid-cols-2">
        <label className="text-sm font-semibold">나이<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.age} onChange={(e)=>set("age",Number(e.target.value))}/></label>
        <label className="text-sm font-semibold">지역<select className="mt-2 w-full rounded-xl border p-3" value={profile.region} onChange={(e)=>set("region",e.target.value)}><option>SEOUL</option><option>GYEONGGI</option><option>INCHEON</option><option>BUSAN</option><option>DAEJEON</option><option>JEONBUK</option><option>JEONNAM</option><option>JEJU</option></select></label>
        <label className="text-sm font-semibold">고용형태<select className="mt-2 w-full rounded-xl border p-3" value={profile.employment_type} onChange={(e)=>set("employment_type",e.target.value)}><option>EMPLOYEE</option><option>SELF_EMPLOYED</option><option>FREELANCER</option><option>UNEMPLOYED</option><option>OTHER</option></select></label>
        <label className="text-sm font-semibold">기업규모<select className="mt-2 w-full rounded-xl border p-3" value={profile.company_size} onChange={(e)=>set("company_size",e.target.value)}><option>SME</option><option>MID</option><option>LARGE</option><option>PUBLIC</option><option>NONE</option><option>OTHER</option></select></label>
        {moneyFields.map(([key,label]) => <label key={String(key)} className="text-sm font-semibold">{label}<input className="mt-2 w-full rounded-xl border p-3" type="number" value={Number(profile[key] ?? 0)} onChange={(e)=>set(key,Number(e.target.value))}/><span className="mt-1 block text-xs font-normal text-slate-400">{Number(profile[key] ?? 0).toLocaleString("ko-KR")}원</span></label>)}
        <label className="text-sm font-semibold">재직기간(개월)<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.employment_months} onChange={(e)=>set("employment_months",Number(e.target.value))}/></label>
        <label className="text-sm font-semibold">목표기간(년)<input className="mt-2 w-full rounded-xl border p-3" type="number" value={profile.target_years} onChange={(e)=>set("target_years",Number(e.target.value))}/></label>
        <div className="md:col-span-2 flex items-center gap-4"><button disabled={loading} className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white">{loading?"계산 중...":"내 금융경로 분석하기"}</button>{error&&<span className="text-sm text-rose-600">{error}</span>}</div>
      </form>
    </div>
  </Shell>;
}
