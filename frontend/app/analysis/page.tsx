"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { manWon } from "../../lib/format";
import { analyze } from "../../lib/api";
import { loadAnalysis, saveAnalysis } from "../../lib/storage";
import type { AnalyzeResponse, EligibilityCheck } from "../../lib/types";

const applicationLabel: Record<string,string> = { OPEN:"신청 가능", UPCOMING:"모집 예정/검토", CLOSED:"신청 마감", CHECK_REQUIRED:"일정 확인 필요" };

export default function AnalysisPage() {
  const [result,setResult] = useState<AnalyzeResponse|null>(null);
  const [updating,setUpdating] = useState(false);
  useEffect(()=>setResult(loadAnalysis()),[]);

  async function confirmRequirement(check: EligibilityCheck, value: boolean) {
    if (!result) return;
    const key = String(check.required?.confirmation_key || "");
    if (!key) return;
    setUpdating(true);
    try {
      const profile = {
        ...result.profile,
        manual_confirmations: { ...(result.profile.manual_confirmations || {}), [key]: value },
      };
      const next = await analyze(profile);
      saveAnalysis(next);
      setResult(next);
    } finally { setUpdating(false); }
  }

  if(!result) return <Shell><div className="rounded-2xl bg-white p-8">분석 결과가 없습니다. <Link className="font-bold underline" href="/profile">먼저 분석하기</Link></div></Shell>;
  const eligible=result.policy_analysis.filter(p=>p.status==="ELIGIBLE");
  const needs=result.policy_analysis.filter(p=>p.status==="NEEDS_MORE_INFORMATION");
  return <Shell>
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-slate-500">POLICY ANALYSIS</p><h1 className="mt-2 text-4xl font-black">조건상 가입 가능 정책 {eligible.length}개</h1><p className="mt-3 text-slate-600">가입자격과 현재 모집상태, 최적경로 선택을 분리해서 보여줍니다.</p></div><Link href="/dashboard" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">대시보드 보기</Link></div>
    {needs.length>0&&<div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5"><b>△ 추가 확인이 필요한 정책 {needs.length}개</b><p className="mt-1 text-sm text-amber-900">복잡한 건보료·중위소득·가족재산·증빙조건은 추측하지 않습니다. 아래 카드에서 공식 조건을 확인한 뒤 예/아니오로 확정할 수 있습니다. 이 확인은 FinPath 시뮬레이션용 자가확인이며 실제 정책 가입자격은 운영기관 심사에서 최종 결정됩니다.</p></div>}
    <div className="mt-8 grid gap-4 md:grid-cols-2">{result.policy_analysis.map(p=><article key={p.policy_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wider text-slate-400">{p.policy_id}</p><h2 className="mt-1 text-xl font-bold">{p.policy_name}</h2><a className="mt-1 inline-block text-xs font-semibold text-slate-500 underline" href={p.source_url} target="_blank" rel="noreferrer">공식 출처</a></div><div className="flex flex-col items-end gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${p.status==="ELIGIBLE"?"bg-emerald-100 text-emerald-800":p.status==="NEEDS_MORE_INFORMATION"?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-600"}`}>{p.status}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${p.application_status==="OPEN"?"bg-blue-100 text-blue-800":p.application_status==="UPCOMING"?"bg-violet-100 text-violet-800":"bg-slate-100 text-slate-600"}`}>{applicationLabel[p.application_status]||p.application_status}</span></div></div>
      {p.application_period_text&&<p className="mt-3 text-xs text-slate-500">{p.application_period_text}</p>}
      <div className="mt-4 space-y-3 text-sm">{p.checks.map((c,i)=><div key={i} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><span>{c.result===true?"✓":c.result===false?"✕":"△"} {c.field==="manual_requirement"?String(c.required?.label||"추가조건"):(c.basis?`${c.basis} `:"")+c.field}</span><span className="text-right text-slate-500">{c.reason||"충족"}</span></div>{p.status==="NEEDS_MORE_INFORMATION"&&c.field==="manual_requirement"&&c.result==null&&<><p className="mt-2 text-xs text-slate-500">{String(c.required?.description||"")}</p><div className="mt-2 flex gap-2"><button disabled={updating} onClick={()=>confirmRequirement(c,true)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">예, 충족합니다</button><button disabled={updating} onClick={()=>confirmRequirement(c,false)} className="rounded-lg border px-3 py-2 text-xs font-bold">아니오</button></div></>}</div>)}</div>
      <div className="mt-5 border-t pt-4 text-sm"><p>예상 단독 효과 <b>{p.incremental_benefit==null?"계산 대상 아님":manWon(p.incremental_benefit)}</b></p>{p.selected_in_optimal_path&&<p className="mt-2 font-bold text-emerald-700">✓ 최적 경로 포함 · 월 {manWon(p.allocated_monthly_amount)}</p>}{p.optimization_exclusion_reason&&<p className="mt-2 text-slate-500">최적화 제외: {p.optimization_exclusion_reason}</p>}</div>
    </article>)}</div>
  </Shell>;
}
