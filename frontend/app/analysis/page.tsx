"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { analyze } from "../../lib/api";
import { applicationLabel, checkFieldLabel, exclusionLabel } from "../../lib/labels";
import { Badge } from "../../components/Badge";
import { Notice } from "../../components/Notice";
import { policyBadgeStatus, policySortRank } from "../../lib/policyPreview";
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

function policySummaryLine(p: PolicyAnalysis): string {
  // 마감·일정 미확정: 그룹 헤더가 맥락을 주므로 개별 문구 생략
  if (p.application_status === "CLOSED" || p.application_status === "CHECK_REQUIRED") return "";
  const upcoming = p.application_status === "UPCOMING";
  if (p.status === "INELIGIBLE") {
    const failed = p.checks.find((c) => c.result === false);
    const label = failed ? (failed.field === "manual_requirement" ? String(failed.required?.label || "추가조건") : (checkFieldLabel[failed.field] || failed.field)) : null;
    return label ? `${label} 조건이 맞지 않아요.` : "현재 조건에서는 가입 대상이 아니에요.";
  }
  if (p.status === "NEEDS_MORE_INFORMATION") return upcoming ? "확인 필요 · 모집 시작 대기 중" : "몇 가지만 확인하면 신청 가능해요";
  if (p.selected_in_optimal_path && p.allocated_monthly_amount > 0) return "추천 경로에 포함된 정책이에요.";
  return upcoming ? "조건은 충족 · 모집 시작 대기 중" : "지금 신청할 수 있어요";
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

  if (!result) return <Shell><div className="fp-panel p-7">분석 결과가 없습니다. <Link className="font-bold text-[#3182f6]" href="/profile">내 조건부터 입력하기 →</Link></div></Shell>;

  const eligible = result.policy_analysis.filter((p) => p.status === "ELIGIBLE");
  const needs = result.policy_analysis.filter((p) => p.status === "NEEDS_MORE_INFORMATION");
  const selected = result.policy_analysis.filter((p) => p.selected_in_optimal_path && p.allocated_monthly_amount > 0);
  const comparison = questions.length > 0 && preview ? preview : result;
  const diff = comparison.policy_effect.additional_assets;
  const hasConditionalPreview = questions.length > 0 && preview !== null;

  const ranked = [...result.policy_analysis].sort((a, b) => policySortRank(a.status, a.application_status) - policySortRank(b.status, b.application_status));
  const isDeferred = (p: PolicyAnalysis) => p.application_status === "CLOSED" || p.application_status === "CHECK_REQUIRED";
  const mainPolicies = ranked.filter((p) => !isDeferred(p));
  const deferredPolicies = ranked.filter(isDeferred);

  const renderPolicy = (p: PolicyAnalysis) => {
    const deferred = isDeferred(p);
    const summary = policySummaryLine(p);
    return <details key={p.policy_id} className="group py-4">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={policyBadgeStatus(p.status, p.application_status)} />
            <b className="text-heading">{p.policy_name}</b>
            {p.selected_in_optimal_path && p.allocated_monthly_amount > 0 && <span className="text-caption font-bold text-accent">월 {manWon(p.allocated_monthly_amount)} 배정</span>}
          </div>
          {summary && <p className="mt-1 text-body text-muted">{summary}</p>}
        </div>
        <svg className="mt-1 h-5 w-5 shrink-0 text-subtle transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </summary>
      <div className="mt-4 rounded-2xl bg-canvas p-4">
        <div className="space-y-2">{p.checks.map((c, i) => <div key={i} className="text-body leading-5 text-[#6b7684]"><span className="font-bold text-[#333d4b]">{c.result === true ? "충족" : c.result === false ? "미충족" : "확인 필요"}</span> · {c.field === "manual_requirement" ? String(c.required?.label || "추가조건") : (checkFieldLabel[c.field] || c.field)}{c.reason ? ` · ${c.reason}` : ""}{p.status === "NEEDS_MORE_INFORMATION" && c.field === "manual_requirement" && c.result == null && <span className="ml-2 inline-flex gap-1"><button disabled={updating || deferred} onClick={() => confirmRequirement(c, true)} className="font-bold text-[#3182f6] disabled:text-[#b0b8c1]">예</button><span>/</span><button disabled={updating || deferred} onClick={() => confirmRequirement(c, false)} className="font-bold text-[#6b7684] disabled:text-[#b0b8c1]">아니오</button></span>}</div>)}</div>
        {deferred && <p className="mt-3 text-caption text-subtle">{p.application_status === "CLOSED" ? "이미 종료된 모집이에요." : "모집 일정이 아직 확정되지 않았어요."}</p>}
        <div className="mt-4 flex flex-wrap gap-3"><a href={p.source_url} target="_blank" rel="noreferrer" className="text-caption font-bold text-[#3182f6]">공식 정보 보기 →</a>{p.optimization_exclusion_reason && <span className="text-caption text-[#8b95a1]">추천 제외 · {exclusionLabel(p.optimization_exclusion_reason)}</span>}</div>
      </div>
    </details>;
  };

  return <Shell>
    <div className="mx-auto max-w-6xl">
      <div className="max-w-2xl">
        <p className="fp-label">2 · 자격 확인</p>
        <h1 className="fp-title mt-2">정확한 추천에 필요한 것만 확인할게요.</h1>
        <p className="fp-muted mt-3">이미 확인된 조건은 다시 묻지 않습니다. 자동 판정하기 어려운 요건만 직접 확인해주세요.</p>
      </div>

      <section className="mt-9 rounded-[28px] bg-[#eef6ff] p-6 sm:p-8">
        <p className="text-caption font-bold text-[#3182f6]">{hasConditionalPreview ? "확인 전 예상" : "현재 계산"}</p>
        <h2 className="mt-2 text-display font-extrabold tracking-[-0.04em] sm:text-display">
          {previewLoading ? "가능한 경로를 확인하고 있어요." : diff > 0 ? `조건이 맞으면 ${manWon(diff)} 더 만들 수 있어요.` : "현재 확정 조건에서는 정책 추가효과가 없어요."}
        </h2>
        <div className="mt-6 flex flex-col gap-4 border-t border-[#dbeafe] pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-8">
            <div><p className="text-caption font-bold text-[#8b95a1]">그냥 모으면</p><b className="mt-1 block text-heading">{manWon(comparison.baseline.final_assets)}</b></div>
            <div><p className="text-caption font-bold text-[#3182f6]">FinPath 예상</p><b className="mt-1 block text-heading text-[#3182f6]">{manWon(comparison.optimized.final_assets)}</b></div>
          </div>
          {hasConditionalPreview && <p className="max-w-sm text-caption leading-5 text-[#6b7684]">아직 확인하지 않은 요건을 충족한다고 가정한 미리보기예요. 실제 추천은 아래 답변 후 확정됩니다.</p>}
        </div>
      </section>

      {questions.length > 0 ? <section id="confirm" className="mt-10">
        <div className="flex items-end justify-between gap-3"><div><p className="fp-label">확인할 내용</p><h2 className="mt-1 text-heading font-extrabold tracking-[-0.035em]">{questions.length}가지만 답해주세요.</h2></div><span className="text-body font-bold text-[#8b95a1]">예 / 아니오</span></div>
        <div className="mt-4 divide-y divide-[#edf0f3] rounded-[24px] border border-[#edf0f3] bg-white px-5 sm:px-7">
          {questions.map((q, i) => <div key={q.label} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-[580px]"><p className="text-caption font-bold text-[#b0b8c1]">{String(i+1).padStart(2,"0")}</p><h3 className="mt-1 text-body font-bold">{q.label}</h3><p className="mt-1.5 text-body leading-5 text-[#6b7684]">{q.description}</p>{q.policyNames.length > 0 && <p className="mt-2 text-caption text-[#8b95a1]">관련 정책 · {q.policyNames.slice(0,2).join(" · ")}</p>}</div>
            <div className="flex shrink-0 gap-2"><button disabled={updating} onClick={() => confirmByKeys(q.keys, true)} className="fp-primary min-w-[74px] py-2.5">예</button><button disabled={updating} onClick={() => confirmByKeys(q.keys, false)} className="fp-secondary min-w-[74px] py-2.5">아니오</button></div>
          </div>)}
        </div>
        {error && <p className="mt-3 text-body font-bold text-rose-600">{error}</p>}
      </section> : <Notice tone="success" label="확인 완료" className="mt-10">
        <h2 className="text-heading font-extrabold">필요한 자격 확인이 끝났어요.</h2>
        <p className="mt-2 text-body text-muted">이제 일반저축과 FinPath 경로를 같은 조건으로 비교할 수 있습니다.</p>
        <Link href="/dashboard" className="fp-primary mt-5">결과 보기</Link>
      </Notice>}

      <section className="mt-12">
        <div className="flex items-end justify-between gap-3"><div><p className="fp-label">정책 상태</p><h2 className="mt-1 text-heading font-extrabold">지금 중요한 정책만 먼저</h2></div><span className="text-body text-[#8b95a1]">조건 충족 {eligible.length} · 추가 확인 {needs.length}</span></div>
        <div className="mt-4 fp-panel px-5 sm:px-7">
          {selected.length > 0 ? <div className="divide-y divide-[#edf0f3]">{selected.map((p) => <div key={p.policy_id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">{p.policy_name}</h3><p className="mt-1 text-caption text-[#8b95a1]">{applicationLabel[p.application_status]} · 월 {manWon(p.allocated_monthly_amount)}</p></div><a href={p.source_url} target="_blank" rel="noreferrer" className="text-body font-bold text-[#3182f6]">{policyLinkLabel(p)} →</a></div>)}</div> : <div className="py-6"><Notice tone="info" label="추천 대기">확정된 추천 정책이 아직 없습니다. 위 질문을 확인하면 자동으로 다시 계산됩니다.</Notice></div>}
        </div>
      </section>

      <details className="mt-6 fp-panel p-5 sm:p-6">
        <summary className="cursor-pointer text-body font-bold text-[#6b7684]">전체 정책 판정 근거 보기</summary>
        <div className="mt-5 divide-y divide-line">{mainPolicies.map(renderPolicy)}</div>
        {deferredPolicies.length > 0 && <details className="group/deferred mt-4 overflow-hidden rounded-2xl border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-canvas px-4 py-3 text-body font-bold text-muted">
            신청 마감·일정 미확정 {deferredPolicies.length}건
            <svg className="h-5 w-5 shrink-0 text-subtle transition-transform group-open/deferred:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </summary>
          <div className="divide-y divide-line px-4 opacity-60">{deferredPolicies.map(renderPolicy)}</div>
        </details>}
      </details>

      {questions.length === 0 && <div className="mt-8 flex justify-end"><Link href="/dashboard" className="fp-primary min-w-[180px]">비교 결과 보기</Link></div>}
    </div>
  </Shell>;
}
