"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { analyze } from "../../lib/api";
import { applicationLabel, checkFieldLabel, eligibilityLabel, exclusionLabel } from "../../lib/labels";
import { manWon } from "../../lib/format";
import { loadAnalysis, saveAnalysis } from "../../lib/storage";
import type { AnalyzeResponse, EligibilityCheck, PolicyAnalysis } from "../../lib/types";

type QuickQuestion = { keys: string[]; label: string; description: string; policyNames: string[] };
const isOptimizableStatus = (status: string) => status === "OPEN" || status === "UPCOMING";
const isPreviewAssumable = (check: EligibilityCheck) => check.required?.preview_assumable !== false;

function policyLinkLabel(policy: PolicyAnalysis) {
  if (policy.application_status === "OPEN") return "공식 안내·신청 경로";
  if (policy.application_status === "UPCOMING") return "모집 공고 확인";
  if (policy.application_status === "CLOSED") return "지난 공고 확인";
  return "공식 안내 확인";
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
  return { keys: [key], label: String(check.required?.label || "추가 자격요건"), description: String(check.required?.description || "공식 공고의 추가 요건을 확인해주세요."), policyNames: [policyName] };
}

function collectPriorityQuestions(result: AnalyzeResponse, preview: AnalyzeResponse | null): QuickQuestion[] {
  const questions: QuickQuestion[] = [];
  const seenLabels = new Set<string>();
  for (const policy of result.policy_analysis) {
    if (policy.status !== "NEEDS_MORE_INFORMATION" || policy.application_status !== "OPEN") continue;
    const firstHard = policy.checks.find((check) => check.field === "manual_requirement" && check.result == null && !isPreviewAssumable(check));
    if (!firstHard) continue;
    const q = questionFromCheck(policy.policy_name, firstHard);
    if (q && !seenLabels.has(q.label)) { questions.push(q); seenLabels.add(q.label); }
  }
  const selectedIds = new Set((preview?.policy_analysis || []).filter((p) => p.selected_in_optimal_path).map((p) => p.policy_id));
  const targetPolicies = result.policy_analysis.filter((p) => p.status === "NEEDS_MORE_INFORMATION" && isOptimizableStatus(p.application_status) && (selectedIds.size === 0 || selectedIds.has(p.policy_id)));
  for (const policy of targetPolicies) {
    for (const check of policy.checks) {
      if (check.field !== "manual_requirement" || check.result != null || !isPreviewAssumable(check)) continue;
      const q = questionFromCheck(policy.policy_name, check);
      if (!q) continue;
      const existing = questions.find((x) => x.label === q.label);
      if (existing) { if (!existing.policyNames.includes(policy.policy_name)) existing.policyNames.push(policy.policy_name); if (!existing.keys.includes(q.keys[0])) existing.keys.push(q.keys[0]); }
      else questions.push(q);
    }
  }
  return questions.slice(0, 6);
}

export default function AnalysisPage() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [preview, setPreview] = useState<AnalyzeResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setResult(loadAnalysis()), []);

  const previewKeys = useMemo(() => result ? collectAllOptimizableMissingKeys(result) : [], [result]);
  const questions = useMemo(() => result ? collectPriorityQuestions(result, preview) : [], [result, preview]);

  useEffect(() => {
    if (!result || previewKeys.length === 0) { setPreview(null); return; }
    let cancelled = false;
    const run = async () => {
      setPreviewLoading(true);
      try {
        const confirmations = { ...(result.profile.manual_confirmations || {}) };
        for (const key of previewKeys) confirmations[key] = true;
        const next = await analyze({ ...result.profile, manual_confirmations: confirmations });
        if (!cancelled) setPreview(next);
      } catch { if (!cancelled) setPreview(null); }
      finally { if (!cancelled) setPreviewLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, [result, previewKeys]);

  async function confirmByKeys(keys: string[], value: boolean) {
    if (!result) return;
    setUpdating(true); setError("");
    try {
      const profile = { ...result.profile, manual_confirmations: { ...(result.profile.manual_confirmations || {}), ...Object.fromEntries(keys.map((key) => [key, value])) } };
      const next = await analyze(profile);
      saveAnalysis(next); setResult(next);
    } catch (e) { setError(e instanceof Error ? e.message : "재분석에 실패했습니다."); }
    finally { setUpdating(false); }
  }

  async function confirmRequirement(check: EligibilityCheck, value: boolean) {
    const key = String(check.required?.confirmation_key || "");
    if (key) await confirmByKeys([key], value);
  }

  if (!result) return <Shell><div className="rounded-2xl border bg-white p-7">분석 결과가 없습니다. <Link className="font-bold underline" href="/profile">먼저 분석하기</Link></div></Shell>;

  const eligible = result.policy_analysis.filter((p) => p.status === "ELIGIBLE");
  const needs = result.policy_analysis.filter((p) => p.status === "NEEDS_MORE_INFORMATION");
  const selected = result.policy_analysis.filter((p) => p.selected_in_optimal_path);
  const comparison = questions.length > 0 && preview ? preview : result;
  const diff = comparison.policy_effect.additional_assets;
  const hasConditionalPreview = questions.length > 0 && preview !== null;

  return <Shell>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-bold text-slate-500">정책 분석</p><h1 className="mt-1 text-3xl font-black md:text-4xl">내가 쓸 정책만 빠르게 확인합니다.</h1><p className="mt-2 text-sm text-slate-600">전체 세부조건은 접어두고, 결과에 영향을 주는 확인사항과 실제 실행 경로를 먼저 보여드립니다.</p></div>
      {questions.length === 0 ? <Link href="/dashboard" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">비교 결과 보기</Link> : <a href="#confirm" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">{questions.length}개만 확인</a>}
    </header>

    <section className={`mt-7 rounded-3xl border p-6 ${hasConditionalPreview ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div><p className="text-sm font-bold text-slate-500">{hasConditionalPreview ? "미확인 조건 충족 가정" : "현재 확정 조건"}</p><h2 className="mt-1 text-2xl font-black">{previewLoading ? "가능한 경로를 계산 중입니다." : diff > 0 ? `일반저축보다 약 ${manWon(diff)} 추가 가능` : "현재 확정된 정책 추가효과는 없습니다."}</h2>{hasConditionalPreview && <p className="mt-2 text-xs text-violet-900">조건부 Preview이며 실제 가입자격 확정값이 아닙니다.</p>}</div>
        <div className="grid min-w-[280px] grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-white p-3"><span className="text-slate-500">일반저축</span><b className="mt-1 block text-lg">{manWon(comparison.baseline.final_assets)}</b></div><div className="rounded-xl bg-slate-950 p-3 text-white"><span className="text-slate-300">FinPath</span><b className="mt-1 block text-lg">{manWon(comparison.optimized.final_assets)}</b></div></div>
      </div>
    </section>

    {questions.length > 0 && <section id="confirm" className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
      <div><p className="text-sm font-bold text-amber-800">정확도를 높이려면</p><h2 className="mt-1 text-2xl font-black">{questions.length}가지만 확인해주세요.</h2></div>
      <div className="mt-4 space-y-3">{questions.map((q, i) => <div key={q.label} className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-4 md:flex-row md:items-center"><div><span className="text-xs font-bold text-slate-400">{i + 1}</span><b className="ml-2">{q.label}</b><p className="mt-1 text-sm text-slate-600">{q.description}</p></div><div className="flex shrink-0 gap-2"><button disabled={updating} onClick={() => confirmByKeys(q.keys, true)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">예</button><button disabled={updating} onClick={() => confirmByKeys(q.keys, false)} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">아니오</button></div></div>)}</div>
      {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
    </section>}

    <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">실행 후보</p><h2 className="mt-1 text-2xl font-black">추천 경로와 공식 확인 링크</h2></div><span className="text-sm text-slate-500">가입 가능 {eligible.length} · 추가 확인 {needs.length}</span></div>
      {selected.length === 0 ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">아직 추천 경로에 확정된 정책이 없습니다. 위 추가조건을 확인해주세요.</p> : <div className="mt-4 space-y-3">{selected.map((p) => <div key={p.policy_id} className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center"><div><b>{p.policy_name}</b><p className="mt-1 text-xs text-slate-500">{applicationLabel[p.application_status]} · 월 {manWon(p.allocated_monthly_amount)} · 예상 단독효과 {p.incremental_benefit == null ? "확인 후 계산" : manWon(p.incremental_benefit)}</p></div><a href={p.source_url} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">{policyLinkLabel(p)} ↗</a></div>)}</div>}
    </section>

    <section className="mt-7">
      <div className="mb-3"><p className="text-sm font-bold text-slate-500">전체 정책</p><h2 className="mt-1 text-2xl font-black">필요할 때만 세부 근거를 펼쳐보세요.</h2></div>
      <div className="space-y-3">{result.policy_analysis.map((p) => <details key={p.policy_id} className="group rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><b className="text-base">{p.policy_name}</b>{p.selected_in_optimal_path && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">추천 경로</span>}<p className="mt-1 text-xs text-slate-500">{applicationLabel[p.application_status]}{p.application_period_text ? ` · ${p.application_period_text}` : ""}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${p.status === "ELIGIBLE" ? "bg-emerald-100 text-emerald-800" : p.status === "NEEDS_MORE_INFORMATION" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{eligibilityLabel[p.status] || p.status}</span><span className="text-slate-400">⌄</span></div></div>
        </summary>
        <div className="mt-4 border-t pt-4">
          <div className="mb-4 flex flex-wrap gap-2"><a href={p.source_url} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">{policyLinkLabel(p)} ↗</a>{p.optimization_exclusion_reason && <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-600">미포함: {exclusionLabel(p.optimization_exclusion_reason)}</span>}</div>
          <div className="space-y-2">{p.checks.map((c, i) => <div key={i} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-3"><span>{c.result === true ? "✓" : c.result === false ? "✕" : "△"} {c.field === "manual_requirement" ? String(c.required?.label || "추가조건") : (c.basis === "HOUSEHOLD" ? "가구 " : c.basis === "PERSONAL" ? "개인 " : "") + (checkFieldLabel[c.field] || c.field)}</span><span className="text-right text-slate-500">{c.reason || "충족"}</span></div>{p.status === "NEEDS_MORE_INFORMATION" && c.field === "manual_requirement" && c.result == null && <div className="mt-2"><p className="text-xs text-slate-500">{String(c.required?.description || "")}</p><div className="mt-2 flex gap-2"><button disabled={updating} onClick={() => confirmRequirement(c, true)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">예</button><button disabled={updating} onClick={() => confirmRequirement(c, false)} className="rounded-lg border px-3 py-2 text-xs font-bold">아니오</button></div></div>}</div>)}</div>
        </div>
      </details>)}</div>
    </section>
  </Shell>;
}
