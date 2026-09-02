"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { analyze } from "../../lib/api";
import { applicationLabel, checkFieldLabel, eligibilityLabel, exclusionLabel } from "../../lib/labels";
import { manWon } from "../../lib/format";
import { loadAnalysis, saveAnalysis } from "../../lib/storage";
import type { AnalyzeResponse, EligibilityCheck } from "../../lib/types";

type QuickQuestion = {
  keys: string[];
  label: string;
  description: string;
  policyNames: string[];
};

const isOptimizableStatus = (status: string) => status === "OPEN" || status === "UPCOMING";

function isPreviewAssumable(check: EligibilityCheck): boolean {
  return check.required?.preview_assumable !== false;
}

function collectAllOptimizableMissingKeys(result: AnalyzeResponse): string[] {
  const keys = new Set<string>();
  for (const policy of result.policy_analysis) {
    if (policy.status !== "NEEDS_MORE_INFORMATION" || !isOptimizableStatus(policy.application_status)) continue;
    for (const check of policy.checks) {
      if (check.field !== "manual_requirement" || check.result != null || !isPreviewAssumable(check)) continue;
      const key = String(check.required?.confirmation_key || "");
      if (key) keys.add(key);
    }
  }
  return [...keys];
}

function questionFromCheck(policyName: string, check: EligibilityCheck): QuickQuestion | null {
  const key = String(check.required?.confirmation_key || "");
  if (!key) return null;
  return {
    keys: [key],
    label: String(check.required?.label || "추가 자격요건"),
    description: String(check.required?.description || "공식 공고의 추가 요건을 확인해주세요."),
    policyNames: [policyName],
  };
}

function collectPriorityQuestions(result: AnalyzeResponse, preview: AnalyzeResponse | null): QuickQuestion[] {
  const questions: QuickQuestion[] = [];
  const seenLabels = new Set<string>();

  // Hard screening facts (benefit-recipient status, recognized-income tests, etc.)
  // must never be silently assumed for a flashy preview. Ask only the first
  // unresolved hard fact per currently-open policy; if the answer is "아니오",
  // known-failure precedence removes the policy without asking irrelevant follow-ups.
  for (const policy of result.policy_analysis) {
    if (policy.status !== "NEEDS_MORE_INFORMATION" || policy.application_status !== "OPEN") continue;
    const firstHard = policy.checks.find((check) =>
      check.field === "manual_requirement" && check.result == null && !isPreviewAssumable(check)
    );
    if (!firstHard) continue;
    const q = questionFromCheck(policy.policy_name, firstHard);
    if (q && !seenLabels.has(q.label)) {
      questions.push(q);
      seenLabels.add(q.label);
    }
  }

  // For ordinary policy conditions that are safe to use only as an explicitly
  // labelled conditional preview, ask the requirements belonging to policies
  // that would actually be selected in that preview path.
  const selectedIds = new Set((preview?.policy_analysis || []).filter((p) => p.selected_in_optimal_path).map((p) => p.policy_id));
  const targetPolicies = result.policy_analysis.filter((p) =>
    p.status === "NEEDS_MORE_INFORMATION" &&
    isOptimizableStatus(p.application_status) &&
    (selectedIds.size === 0 || selectedIds.has(p.policy_id))
  );

  const semanticLabels = new Set<string>();
  for (const policy of targetPolicies) {
    for (const check of policy.checks) {
      if (
        check.field === "manual_requirement" &&
        check.result == null &&
        isPreviewAssumable(check)
      ) semanticLabels.add(String(check.required?.label || "추가 자격요건"));
    }
  }

  const map = new Map<string, QuickQuestion>();
  for (const policy of result.policy_analysis) {
    if (policy.status !== "NEEDS_MORE_INFORMATION" || !isOptimizableStatus(policy.application_status)) continue;
    for (const check of policy.checks) {
      if (check.field !== "manual_requirement" || check.result != null || !isPreviewAssumable(check)) continue;
      const label = String(check.required?.label || "추가 자격요건");
      if (!semanticLabels.has(label) || seenLabels.has(label)) continue;
      const key = String(check.required?.confirmation_key || "");
      if (!key) continue;
      const description = String(check.required?.description || "공식 공고의 추가 요건을 확인해주세요.");
      const existing = map.get(label);
      if (existing) {
        if (!existing.keys.includes(key)) existing.keys.push(key);
        if (!existing.policyNames.includes(policy.policy_name)) existing.policyNames.push(policy.policy_name);
      } else {
        map.set(label, { keys: [key], label, description, policyNames: [policy.policy_name] });
      }
    }
  }
  questions.push(...map.values());
  return questions;
}

export default function AnalysisPage() {
  const [result,setResult] = useState<AnalyzeResponse|null>(null);
  const [preview,setPreview] = useState<AnalyzeResponse|null>(null);
  const [updating,setUpdating] = useState(false);
  const [previewLoading,setPreviewLoading] = useState(false);
  const [error,setError] = useState("");

  useEffect(()=>setResult(loadAnalysis()),[]);
  const previewKeys = useMemo(()=>result ? collectAllOptimizableMissingKeys(result) : [],[result]);
  const questions = useMemo(()=>result ? collectPriorityQuestions(result, preview) : [],[result,preview]);

  useEffect(()=>{
    if (!result || previewKeys.length === 0) { setPreview(null); return; }
    let cancelled = false;
    const run = async () => {
      setPreviewLoading(true);
      try {
        const confirmations = { ...(result.profile.manual_confirmations || {}) };
        for (const key of previewKeys) confirmations[key] = true;
        const next = await analyze({ ...result.profile, manual_confirmations: confirmations });
        if (!cancelled) setPreview(next);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    run();
    return ()=>{cancelled=true;};
  },[result,previewKeys]);

  async function confirmByKeys(keys: string[], value: boolean) {
    if (!result) return;
    setUpdating(true); setError("");
    try {
      const profile = {
        ...result.profile,
        manual_confirmations: { ...(result.profile.manual_confirmations || {}), ...Object.fromEntries(keys.map((key) => [key, value])) },
      };
      const next = await analyze(profile);
      saveAnalysis(next);
      setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "재분석에 실패했습니다.");
    } finally { setUpdating(false); }
  }

  async function confirmRequirement(check: EligibilityCheck, value: boolean) {
    const key = String(check.required?.confirmation_key || "");
    if (key) await confirmByKeys([key],value);
  }

  if(!result) return <Shell><div className="rounded-2xl bg-white p-8">분석 결과가 없습니다. <Link className="font-bold underline" href="/profile">먼저 분석하기</Link></div></Shell>;

  const eligible=result.policy_analysis.filter(p=>p.status==="ELIGIBLE");
  const needs=result.policy_analysis.filter(p=>p.status==="NEEDS_MORE_INFORMATION");
  const comparison = questions.length > 0 && preview ? preview : result;
  const diff = comparison.policy_effect.additional_assets;
  const hasConditionalPreview = questions.length > 0 && preview !== null;

  return <Shell>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-slate-500">비교 준비</p>
        <h1 className="mt-2 text-4xl font-black">일반저축보다 얼마나 달라질까요?</h1>
        <p className="mt-3 text-slate-600">정책 이름을 먼저 나열하기보다, 같은 월 저축액으로 만들 수 있는 자산 차이를 먼저 보여드립니다.</p>
      </div>
      {questions.length===0
        ? <Link href="/dashboard" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">최종 비교 결과 보기</Link>
        : <a href="#confirm" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">{questions.length}개만 확인하고 결과 보기</a>}
    </div>

    <section className={`mt-8 overflow-hidden rounded-3xl border p-7 shadow-sm ${hasConditionalPreview?"border-violet-200 bg-gradient-to-br from-violet-50 to-white":"border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-bold text-slate-500">{hasConditionalPreview?"추가요건 충족 가정 Preview":"현재 확인된 조건 기준"}</p>
          {previewLoading
            ? <h2 className="mt-2 text-3xl font-black">가능한 경로를 계산하고 있어요.</h2>
            : <h2 className="mt-2 text-3xl font-black">{diff>0 ? `${result.profile.target_years}년 후, 약 ${manWon(diff)} 더 만들 수 있어요.` : "현재 확정된 조건만으로는 추가효과가 아직 없습니다."}</h2>}
          {hasConditionalPreview&&<p className="mt-2 max-w-2xl text-sm text-violet-900">아래 미확인 요건을 모두 충족한다고 가정한 예상치입니다. 실제 자격을 확정한 결과가 아니며, 예/아니오 확인 후 최종 계산값으로 바뀝니다.</p>}
        </div>
        {diff>0&&<div className="rounded-2xl bg-slate-950 px-5 py-4 text-white"><span className="text-xs text-slate-300">예상 추가자산</span><b className="mt-1 block text-2xl">+{manWon(diff)}</b></div>}
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">그냥 일반저축</p><b className="mt-2 block text-3xl">{manWon(comparison.baseline.final_assets)}</b><p className="mt-2 text-xs text-slate-400">월 {manWon(result.profile.monthly_saving_capacity)}을 일반저축에만 납입</p></div>
        <div className="hidden items-center justify-center text-2xl font-black text-slate-300 md:flex">→</div>
        <div className="rounded-2xl border-2 border-slate-950 bg-white p-5"><p className="text-sm font-bold text-slate-700">FinPath 경로</p><b className="mt-2 block text-3xl">{manWon(comparison.optimized.final_assets)}</b><p className="mt-2 text-xs text-slate-500">정책 활용 가능성·월 배분·만기 재예치까지 반영</p></div>
      </div>
    </section>

    {questions.length>0&&<section id="confirm" className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-bold text-amber-800">정확한 비교를 위해</p><h2 className="mt-1 text-2xl font-black">{questions.length}가지만 더 확인해주세요.</h2><p className="mt-2 text-sm text-amber-900">자동으로 단정하기 어려운 공식 자격요건만 묻습니다. 모르면 해당 정책은 최적경로에서 제외된 채 계산됩니다.</p></div>
        <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-amber-900">남은 확인 {questions.length}개</span>
      </div>
      <div className="mt-5 grid gap-3">{questions.map((q,i)=><div key={q.label} className="rounded-2xl border border-amber-100 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div><p className="text-xs font-bold text-slate-400">확인 {i+1}</p><h3 className="mt-1 text-lg font-bold">{q.label}</h3><p className="mt-1 text-sm text-slate-600">{q.description}</p><p className="mt-2 text-xs text-slate-400">관련 정책: {q.policyNames.slice(0,2).join(", ")}{q.policyNames.length>2?` 외 ${q.policyNames.length-2}개`:""}</p></div>
          <div className="flex shrink-0 gap-2"><button disabled={updating} onClick={()=>confirmByKeys(q.keys,true)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">예, 충족해요</button><button disabled={updating} onClick={()=>confirmByKeys(q.keys,false)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold">아니오</button></div>
        </div>
      </div>)}</div>
      {error&&<p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}
    </section>}

    {questions.length===0&&<section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold text-emerald-800">필요한 확인이 끝났습니다.</p><h2 className="mt-1 text-2xl font-black">이제 확정된 조건으로 비교할 수 있어요.</h2><p className="mt-2 text-sm text-emerald-900">가입 가능 정책 {eligible.length}개를 대상으로 실제 최적경로 계산을 완료했습니다.</p></div><Link href="/dashboard" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">+{manWon(result.policy_effect.additional_assets)} 효과 자세히 보기</Link></div>
    </section>}

    <details className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
      <summary className="cursor-pointer text-xl font-black">정책별 판정 근거 자세히 보기 <span className="ml-2 text-sm font-medium text-slate-400">가입 가능 {eligible.length} · 추가 확인 {needs.length}</span></summary>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{result.policy_analysis.map(p=><article key={p.policy_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{p.policy_name}</h2><a className="mt-1 inline-block text-xs font-semibold text-slate-500 underline" href={p.source_url} target="_blank" rel="noreferrer">공식 출처 확인</a></div><div className="flex flex-col items-end gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${p.status==="ELIGIBLE"?"bg-emerald-100 text-emerald-800":p.status==="NEEDS_MORE_INFORMATION"?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-600"}`}>{eligibilityLabel[p.status]||p.status}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${p.application_status==="OPEN"?"bg-blue-100 text-blue-800":p.application_status==="UPCOMING"?"bg-violet-100 text-violet-800":"bg-slate-100 text-slate-600"}`}>{applicationLabel[p.application_status]||p.application_status}</span></div></div>
        {p.application_period_text&&<p className="mt-3 text-xs text-slate-500">{p.application_period_text}</p>}
        <div className="mt-4 space-y-3 text-sm">{p.checks.map((c,i)=><div key={i} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><span>{c.result===true?"✓":c.result===false?"✕":"△"} {c.field==="manual_requirement"?String(c.required?.label||"추가조건"):(c.basis==="HOUSEHOLD"?"가구 ":c.basis==="PERSONAL"?"개인 ":"")+(checkFieldLabel[c.field]||c.field)}</span><span className="text-right text-slate-500">{c.reason||"충족"}</span></div>{p.status==="NEEDS_MORE_INFORMATION"&&c.field==="manual_requirement"&&c.result==null&&<><p className="mt-2 text-xs text-slate-500">{String(c.required?.description||"")}</p><div className="mt-2 flex gap-2"><button disabled={updating} onClick={()=>confirmRequirement(c,true)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">예, 충족해요</button><button disabled={updating} onClick={()=>confirmRequirement(c,false)} className="rounded-lg border px-3 py-2 text-xs font-bold">아니오</button></div></>}</div>)}</div>
        <div className="mt-5 border-t pt-4 text-sm"><p>정책 단독 예상효과 <b>{p.incremental_benefit==null?"확정 후 계산":manWon(p.incremental_benefit)}</b></p>{p.selected_in_optimal_path&&<p className="mt-2 font-bold text-emerald-700">✓ 추천 경로 포함 · 월 {manWon(p.allocated_monthly_amount)}</p>}{p.optimization_exclusion_reason&&<p className="mt-2 text-slate-500">추천 경로 미포함: {exclusionLabel(p.optimization_exclusion_reason)}</p>}</div>
      </article>)}</div>
    </details>
  </Shell>;
}
