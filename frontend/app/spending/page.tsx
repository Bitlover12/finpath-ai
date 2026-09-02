"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { getCards, recommendSpending, uploadSpendingFile } from "../../lib/api";
import { loadAnalysis, loadSpendingOptimization, saveSpendingOptimization } from "../../lib/storage";
import type { CardCatalogItem, CardTypePreference, SpendingCategory, SpendingOptimizationResponse } from "../../lib/types";

const primaryCategories: { key: SpendingCategory; label: string; hint: string }[] = [
  { key: "FOOD", label: "외식/식비", hint: "식당·패스트푸드" },
  { key: "DELIVERY", label: "배달", hint: "배달앱" },
  { key: "CAFE", label: "카페", hint: "커피전문점" },
  { key: "TRANSPORT", label: "교통", hint: "버스·지하철·택시" },
  { key: "SHOPPING", label: "쇼핑", hint: "패션·온라인" },
  { key: "SUBSCRIPTION", label: "구독", hint: "OTT·멤버십" },
  { key: "TELECOM", label: "통신", hint: "휴대폰 요금" },
  { key: "GROCERIES", label: "마트", hint: "장보기" },
];

const extraCategories: { key: SpendingCategory; label: string; hint: string }[] = [
  { key: "CONVENIENCE", label: "편의점", hint: "CU·GS25 등" },
  { key: "BEAUTY", label: "뷰티", hint: "화장품·미용실" },
  { key: "CULTURE", label: "문화", hint: "영화·공연" },
  { key: "FUEL", label: "주유", hint: "주유소" },
  { key: "HOUSING", label: "주거/공과금", hint: "월세·관리비" },
  { key: "MEDICAL", label: "의료", hint: "병원·약국" },
  { key: "EDUCATION", label: "교육", hint: "학원·강의" },
  { key: "OTHER", label: "기타", hint: "그 외 소비" },
];

const allCategories = [...primaryCategories, ...extraCategories];
const categoryLabel = Object.fromEntries(allCategories.map((x) => [x.key, x.label])) as Record<string, string>;

function won(n: number | null | undefined) {
  return `${Math.round(n || 0).toLocaleString("ko-KR")}원`;
}

function SpendingInput({ item, value, onChange }: { item: { key: SpendingCategory; label: string; hint: string }; value: number; onChange: (value: number) => void }) {
  return <label className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold">
    <div className="flex items-center justify-between gap-2"><span>{item.label}</span><span className="text-xs font-normal text-slate-400">{item.hint}</span></div>
    <input type="number" min={0} step={1000} value={value || 0} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 p-2.5" />
  </label>;
}

export default function SpendingPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ReturnType<typeof loadAnalysis>>(null);
  const [cards, setCards] = useState<CardCatalogItem[]>([]);
  const [amounts, setAmounts] = useState<Partial<Record<SpendingCategory, number>>>({ FOOD: 250000, DELIVERY: 150000, CAFE: 100000, TRANSPORT: 90000, CONVENIENCE: 70000, SHOPPING: 180000, SUBSCRIPTION: 45000, TELECOM: 70000, GROCERIES: 150000, OTHER: 100000 });
  const [preference, setPreference] = useState<CardTypePreference>("BOTH");
  const [currentCard, setCurrentCard] = useState<string>("");
  const [cutPercent, setCutPercent] = useState(10);
  const [result, setResult] = useState<SpendingOptimizationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");

  useEffect(() => {
    const saved = loadAnalysis();
    setAnalysis(saved);
    setResult(loadSpendingOptimization());
    getCards().then(setCards).catch(() => setCards([]));
  }, []);

  const totalInput = useMemo(() => Object.values(amounts).reduce<number>((a, b) => a + Number(b || 0), 0), [amounts]);
  const setAmount = (key: SpendingCategory, value: number) => setAmounts((prev) => ({ ...prev, [key]: Math.max(0, value || 0) }));

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(""); setUploadNotice("");
    try {
      const parsed = await uploadSpendingFile(file);
      setAmounts((prev) => ({ ...prev, ...parsed.monthly_categories }));
      setUploadNotice(`${parsed.total_rows}건 · ${parsed.months_count}개월 월평균으로 반영했습니다.`);
    } catch (err) { setError(err instanceof Error ? err.message : "거래내역을 읽지 못했습니다."); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function run() {
    if (!analysis) return;
    setLoading(true); setError("");
    try {
      const response = await recommendSpending(analysis.profile, amounts, { current_card_id: currentCard || null, card_type_preference: preference, cut_percent: cutPercent });
      setResult(response); saveSpendingOptimization(response);
    } catch (err) { setError(err instanceof Error ? err.message : "소비 최적화 계산에 실패했습니다."); }
    finally { setLoading(false); }
  }

  function applyToFinPath() {
    if (!result) return;
    saveSpendingOptimization(result);
    router.push("/dashboard#full-finpath");
  }

  if (!analysis) return <Shell><div className="rounded-3xl border bg-white p-7"><h1 className="text-2xl font-black">먼저 기본 FinPath 분석이 필요합니다.</h1><Link href="/profile" className="mt-4 inline-block rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">내 정보 입력하기</Link></div></Shell>;

  return <Shell>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-bold text-emerald-700">선택 부가서비스</p><h1 className="mt-1 text-3xl font-black md:text-4xl">소비에서 더 모을 돈이 있는지만 확인해볼게요.</h1><p className="mt-2 text-sm text-slate-600">기본 FinPath 결과는 그대로 두고, 소비·카드에서 추가 저축여력을 찾은 뒤 마지막에 세 경로를 비교합니다.</p></div>
      <Link href="/dashboard" className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">기본 결과로 돌아가기</Link>
    </header>

    <section className="mt-7 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4"><span className="text-xs text-slate-500">일반저축</span><b className="mt-1 block text-xl">{won(analysis.baseline.final_assets)}</b></div>
      <div className="rounded-2xl bg-slate-950 p-4 text-white"><span className="text-xs text-slate-300">기본 FinPath</span><b className="mt-1 block text-xl">{won(analysis.optimized.final_assets)}</b></div>
      <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-4"><span className="text-xs font-bold text-emerald-700">이제 확인할 것</span><b className="mt-1 block text-lg">Full FinPath 가능성</b></div>
    </section>

    <section className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-bold text-slate-500">1 · 소비내역</p><h2 className="mt-1 text-2xl font-black">파일 한 번이면 가장 빠릅니다.</h2></div><label className="cursor-pointer rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"><input type="file" accept=".csv,.xlsx,.xlsm" className="hidden" onChange={handleUpload}/>{uploading ? "분석 중..." : "CSV/XLSX 업로드"}</label></div>
        <p className="mt-3 text-xs leading-5 text-slate-500">파일이 없으면 아래 월평균만 수정하세요. 업로드 파일은 분석 후 서버에 저장하지 않습니다. <a href="/sample_transactions.csv" className="font-bold underline">샘플 CSV</a></p>
        {uploadNotice && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{uploadNotice}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{primaryCategories.map((item) => <SpendingInput key={item.key} item={item} value={amounts[item.key] || 0} onChange={(value) => setAmount(item.key, value)} />)}</div>
        <details className="mt-4 rounded-2xl bg-slate-50 p-4"><summary className="cursor-pointer font-bold">기타 소비 항목 8개 더 입력하기</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{extraCategories.map((item) => <SpendingInput key={item.key} item={item} value={amounts[item.key] || 0} onChange={(value) => setAmount(item.key, value)} />)}</div></details>
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl bg-slate-950 p-6 text-white"><span className="text-sm text-slate-400">입력된 월 소비</span><b className="mt-1 block text-3xl">{won(totalInput)}</b><p className="mt-2 text-xs text-slate-300">현재 월 저축여력 {won(analysis.profile.monthly_saving_capacity)}</p></div>
        <div className="rounded-3xl border bg-white p-5"><p className="text-sm font-bold text-slate-500">2 · 카드 추천 범위</p><div className="mt-3 grid grid-cols-3 gap-2">{(["BOTH", "CHECK", "CREDIT"] as CardTypePreference[]).map((x) => <button key={x} onClick={() => setPreference(x)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${preference === x ? "border-slate-950 bg-slate-950 text-white" : "bg-white"}`}>{x === "BOTH" ? "둘 다" : x === "CHECK" ? "체크" : "신용"}</button>)}</div><label className="mt-4 block text-xs font-semibold text-slate-600">현재 주력카드<select value={currentCard} onChange={(e) => setCurrentCard(e.target.value)} className="mt-2 w-full rounded-xl border p-3 text-sm"><option value="">모름 / 혜택 없음</option>{cards.map((c) => <option key={c.id} value={c.id}>{c.issuer} · {c.name}</option>)}</select></label></div>
        <div className="rounded-3xl border bg-white p-5"><p className="text-sm font-bold text-slate-500">3 · 선택소비 조정</p><div className="mt-2 flex items-center justify-between"><span className="text-sm">가정 비율</span><b>{cutPercent}%</b></div><input type="range" min={0} max={30} step={5} value={cutPercent} onChange={(e) => setCutPercent(Number(e.target.value))} className="mt-3 w-full"/><p className="mt-2 text-xs leading-5 text-slate-500">배달·카페·쇼핑·구독·여가에만 적용합니다.</p></div>
        <button onClick={run} disabled={loading} className="w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">{loading ? "계산 중..." : "Full FinPath 계산"}</button>
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </aside>
    </section>

    {result && <>
      <section className="mt-7 rounded-3xl bg-emerald-950 p-6 text-white md:p-8">
        <p className="text-sm font-bold text-emerald-200">결과</p><h2 className="mt-1 text-3xl font-black">월 +{won(result.total_extra_monthly_saving)}의 추가 저축여력</h2><p className="mt-2 text-sm text-emerald-100">현재 {won(analysis.profile.monthly_saving_capacity)} → Full FinPath {won(result.enhanced_monthly_saving_capacity)}</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3"><div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-emerald-200">1 · 일반저축</span><b className="mt-1 block text-2xl">{won(analysis.baseline.final_assets)}</b></div><div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-emerald-200">2 · 기본 FinPath</span><b className="mt-1 block text-2xl">{won(analysis.optimized.final_assets)}</b><p className="mt-1 text-xs">+{won(analysis.optimized.final_assets - analysis.baseline.final_assets)}</p></div><div className="rounded-2xl bg-white p-4 text-slate-950"><span className="text-xs font-bold text-emerald-700">3 · Full FinPath</span><b className="mt-1 block text-2xl">{won(result.enhanced_analysis.optimized.final_assets)}</b><p className="mt-1 text-xs font-bold text-emerald-800">일반 대비 +{won(result.enhanced_analysis.optimized.final_assets - analysis.baseline.final_assets)}</p></div></div>
        <button onClick={applyToFinPath} className="mt-5 rounded-xl bg-white px-5 py-3 font-black text-slate-950">최종 결과 화면에서 보기</button>
      </section>

      <section className="mt-7 rounded-3xl border bg-white p-6"><p className="text-sm font-bold text-slate-500">카드 추천</p><h2 className="mt-1 text-2xl font-black">현재 소비 안에서 순혜택 TOP 3</h2>{result.recommendations.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">추가소비 없이 실적을 만족하는 등록 카드가 없습니다.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-3">{result.recommendations.map((c, i) => <div key={c.card_id} className={`rounded-2xl border p-4 ${i === 0 ? "border-slate-950" : "border-slate-200"}`}><span className="text-xs font-bold text-slate-500">{i + 1}위 · {c.card_type === "CHECK" ? "체크" : "신용"}</span><h3 className="mt-1 font-black">{c.issuer} · {c.name}</h3><b className="mt-3 block text-xl">월 {won(c.estimated_net_monthly_benefit)}</b><p className="mt-1 text-xs text-slate-500">순혜택 예상 · 연회비 반영</p><a href={c.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-bold underline">공식 카드 페이지 ↗</a></div>)}</div>}<p className="mt-4 text-xs text-slate-400">현재 등록된 공식 검증 대표상품만 비교하며, 발급 전 실제 상품설명서의 실적 제외조건을 확인해야 합니다.</p></section>

      <details className="mt-5 rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-bold">소비 절감 상세 보기</summary><div className="mt-4 space-y-2">{result.cut_items.length === 0 ? <p className="text-sm text-slate-500">소비 조정 시나리오 없음</p> : result.cut_items.map((x) => <div key={x.category} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{categoryLabel[x.category] || x.category} · {x.assumed_cut_percent}% 가정</span><b className="text-emerald-700">+{won(x.monthly_saving)}</b></div>)}</div></details>
    </>}
  </Shell>;
}
