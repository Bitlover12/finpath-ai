"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { getCards, recommendSpending, uploadSpendingFile } from "../../lib/api";
import { loadAnalysis, loadSpendingOptimization, saveSpendingOptimization } from "../../lib/storage";
import type { CardCatalogItem, CardTypePreference, SpendingCategory, SpendingOptimizationResponse } from "../../lib/types";

const categories: { key: SpendingCategory; label: string; hint: string }[] = [
  { key: "FOOD", label: "외식/식비", hint: "식당·패스트푸드 등" },
  { key: "DELIVERY", label: "배달", hint: "배민·요기요·쿠팡이츠" },
  { key: "CAFE", label: "카페", hint: "커피전문점" },
  { key: "TRANSPORT", label: "교통", hint: "버스·지하철·택시" },
  { key: "CONVENIENCE", label: "편의점", hint: "CU·GS25 등" },
  { key: "SHOPPING", label: "쇼핑", hint: "패션·온라인 구매" },
  { key: "SUBSCRIPTION", label: "구독", hint: "OTT·멤버십·음원" },
  { key: "TELECOM", label: "통신", hint: "휴대폰 요금" },
  { key: "BEAUTY", label: "뷰티", hint: "올리브영·미용실" },
  { key: "CULTURE", label: "문화", hint: "영화·공연" },
  { key: "GROCERIES", label: "마트", hint: "대형마트·장보기" },
  { key: "FUEL", label: "주유", hint: "주유소" },
  { key: "HOUSING", label: "주거/공과금", hint: "관리비·월세 등" },
  { key: "MEDICAL", label: "의료", hint: "병원·약국" },
  { key: "EDUCATION", label: "교육", hint: "학원·강의" },
  { key: "OTHER", label: "기타", hint: "그 외 소비" },
];

const categoryLabel = Object.fromEntries(categories.map((x) => [x.key, x.label])) as Record<string, string>;

function won(n: number | null | undefined) {
  return `${Math.round(n || 0).toLocaleString("ko-KR")}원`;
}

export default function SpendingPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ReturnType<typeof loadAnalysis>>(null);
  const [cards, setCards] = useState<CardCatalogItem[]>([]);
  const [amounts, setAmounts] = useState<Partial<Record<SpendingCategory, number>>>({
    FOOD: 250000, DELIVERY: 150000, CAFE: 100000, TRANSPORT: 90000,
    CONVENIENCE: 70000, SHOPPING: 180000, SUBSCRIPTION: 45000, TELECOM: 70000,
    GROCERIES: 150000, OTHER: 100000,
  });
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

  function setAmount(key: SpendingCategory, value: number) {
    setAmounts((prev) => ({ ...prev, [key]: Math.max(0, value || 0) }));
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(""); setUploadNotice("");
    try {
      const parsed = await uploadSpendingFile(file);
      setAmounts((prev) => ({ ...prev, ...parsed.monthly_categories }));
      setUploadNotice(`${parsed.total_rows}건을 분석해 ${parsed.months_count}개월 월평균으로 반영했습니다. ${parsed.notice}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "거래내역을 읽지 못했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function run() {
    if (!analysis) return;
    setLoading(true); setError("");
    try {
      const response = await recommendSpending(analysis.profile, amounts, {
        current_card_id: currentCard || null,
        card_type_preference: preference,
        cut_percent: cutPercent,
      });
      setResult(response);
      saveSpendingOptimization(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "소비 최적화 계산에 실패했습니다.");
    } finally { setLoading(false); }
  }

  function applyToFinPath() {
    if (!result) return;
    saveSpendingOptimization(result);
    router.push("/dashboard#full-finpath");
  }

  if (!analysis) {
    return <Shell><div className="mx-auto max-w-3xl rounded-3xl border bg-white p-8"><h1 className="text-3xl font-black">먼저 기본 금융분석이 필요합니다.</h1><p className="mt-3 text-slate-600">소비 절감액을 기존 FinPath 경로에 더하려면 현재 저축여력과 목표가 먼저 있어야 합니다.</p><Link href="/profile" className="mt-5 inline-block rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">내 정보 입력하기</Link></div></Shell>;
  }

  return <Shell>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-bold text-emerald-700">선택 부가서비스 · 기본 FinPath 분석 이후</p><h1 className="mt-2 text-4xl font-black">기본 저축경로는 끝났어요.<br/>원하면 소비·카드까지 한 번 더 최적화합니다.</h1><p className="mt-3 max-w-3xl text-slate-600">이 단계는 선택사항입니다. 기본 FinPath 결과는 바꾸지 않고 그대로 보존합니다. 거래내역 CSV/XLSX 한 번 업로드 또는 월 소비 입력으로 추가 저축여력을 계산한 뒤 마지막에 일반저축·기본 FinPath·Full FinPath를 함께 비교합니다.</p></div>
      <Link href="/dashboard" className="rounded-xl border bg-white px-4 py-3 text-sm font-bold">현재 금융경로 보기</Link>
    </div>

    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6"><p className="text-sm font-bold text-slate-500">기본 FinPath 분석은 이미 완료됐습니다.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-100 p-4"><span className="text-xs text-slate-500">일반저축</span><b className="mt-1 block text-xl">{won(analysis.baseline.final_assets)}</b></div><div className="rounded-2xl bg-slate-950 p-4 text-white"><span className="text-xs text-slate-300">기본 FinPath</span><b className="mt-1 block text-xl">{won(analysis.optimized.final_assets)}</b><p className="mt-1 text-xs text-slate-300">일반저축 대비 +{won(analysis.optimized.final_assets-analysis.baseline.final_assets)}</p></div><div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-4"><span className="text-xs font-bold text-emerald-700">선택 부스터</span><b className="mt-1 block text-lg">소비·카드 최적화</b><p className="mt-1 text-xs text-emerald-800">완료하면 Full FinPath와 3개 경로를 최종 비교합니다.</p></div></div></section>

    <section className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-bold text-slate-500">1. 소비내역 가져오기</p><h2 className="mt-1 text-2xl font-black">파일 한 번 또는 월평균 직접입력</h2></div>
          <label className="cursor-pointer rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"><input type="file" accept=".csv,.xlsx,.xlsm" className="hidden" onChange={handleUpload}/>{uploading ? "분석 중..." : "CSV/XLSX 업로드"}</label>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><b>지원 열 예시</b> · 거래일/이용일자, 가맹점명/적요/내용, 이용금액/거래금액. 카테고리 열이 있으면 그대로 사용하고 없으면 가맹점명으로 자동분류합니다. 업로드 파일은 분석 후 서버에 저장하지 않습니다. <a href="/sample_transactions.csv" className="ml-1 font-bold underline">샘플 CSV 보기</a></div>
        {uploadNotice && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{uploadNotice}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((item) => <label key={item.key} className="rounded-2xl border border-slate-200 p-3 text-sm font-semibold"><span>{item.label}</span><span className="ml-1 text-xs font-normal text-slate-400">{item.hint}</span><input type="number" min={0} step={1000} value={amounts[item.key] || 0} onChange={(e)=>setAmount(item.key, Number(e.target.value))} className="mt-2 w-full rounded-xl border p-2.5"/><span className="mt-1 block text-xs font-normal text-slate-400">{won(amounts[item.key])}/월</span></label>)}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-sm font-bold text-slate-400">입력된 월 소비</p><b className="mt-2 block text-4xl">{won(totalInput)}</b><p className="mt-3 text-sm leading-6 text-slate-300">현재 FinPath 월 저축여력은 <b className="text-white">{won(analysis.profile.monthly_saving_capacity)}</b>입니다.</p></div>
        <div className="rounded-3xl border bg-white p-6"><p className="text-sm font-bold text-slate-500">2. 카드 범위</p><div className="mt-3 grid grid-cols-3 gap-2">{(["BOTH","CHECK","CREDIT"] as CardTypePreference[]).map((x)=><button key={x} onClick={()=>setPreference(x)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${preference===x?"border-slate-950 bg-slate-950 text-white":"bg-white"}`}>{x==="BOTH"?"둘 다":x==="CHECK"?"체크":"신용"}</button>)}</div>
          <label className="mt-5 block text-sm font-semibold">현재 주력카드 (선택)<select value={currentCard} onChange={(e)=>setCurrentCard(e.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="">모름 / 혜택 없음으로 비교</option>{cards.map((c)=><option key={c.id} value={c.id}>{c.issuer} · {c.name}</option>)}</select></label>
        </div>
        <div className="rounded-3xl border bg-white p-6"><p className="text-sm font-bold text-slate-500">3. 소비 절감 시나리오</p><h3 className="mt-1 font-black">선택소비를 몇 % 조정해볼까요?</h3><input type="range" min={0} max={30} step={5} value={cutPercent} onChange={(e)=>setCutPercent(Number(e.target.value))} className="mt-4 w-full"/><div className="mt-1 flex justify-between text-xs text-slate-400"><span>0%</span><b className="text-base text-slate-950">{cutPercent}%</b><span>30%</span></div><p className="mt-3 text-xs leading-5 text-slate-500">배달·카페·쇼핑·구독·여가에만 적용하는 <b>가정</b>입니다. FinPath가 임의로 “낭비”라고 판정하지 않습니다.</p></div>
        <button onClick={run} disabled={loading} className="w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">{loading?"소비·카드·금융경로 재계산 중...":"내 소비로 저축여력 찾기"}</button>
        {error&&<p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </aside>
    </section>

    {result && <>
      <section className="mt-8 overflow-hidden rounded-3xl bg-emerald-950 p-7 text-white md:p-9">
        <p className="text-sm font-bold text-emerald-200">FinPath 소비 최적화 결과</p>
        <h2 className="mt-2 text-3xl font-black md:text-4xl">월 {won(result.total_extra_monthly_saving)}을 추가 저축여력으로 만들 수 있는 시나리오예요.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100">현재 월 저축 {won(analysis.profile.monthly_saving_capacity)} → 소비 조정과 카드 순혜택을 모두 저축으로 돌리면 <b className="text-white">{won(result.enhanced_monthly_saving_capacity)}</b>. 돈을 더 쓰지 않는 조건으로만 카드 후보를 비교했습니다.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-emerald-200">선택소비 조정</span><b className="mt-1 block text-2xl">+{won(result.cut_scenario_monthly_saving)}</b></div><div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-emerald-200">카드 순혜택 개선</span><b className="mt-1 block text-2xl">+{won(result.best_card_incremental_monthly_benefit)}</b></div><div className="rounded-2xl bg-white p-4 text-slate-950"><span className="text-xs text-slate-500">새 월 저축여력</span><b className="mt-1 block text-2xl">{won(result.enhanced_monthly_saving_capacity)}</b></div></div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-6"><p className="text-sm font-bold text-slate-500">소비 조정 시나리오</p><h2 className="mt-1 text-2xl font-black">어디에서 얼마가 생기는지</h2><div className="mt-5 space-y-3">{result.cut_items.length===0?<p className="text-sm text-slate-500">소비 절감 시나리오를 적용하지 않았습니다.</p>:result.cut_items.map((x)=><div key={x.category} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"><div><b>{categoryLabel[x.category] || x.category}</b><p className="text-xs text-slate-500">현재 {won(x.current_monthly_amount)} · {x.assumed_cut_percent}% 조정 가정</p></div><b className="text-emerald-700">+{won(x.monthly_saving)}</b></div>)}</div></section>

        <section className="rounded-3xl border bg-white p-6"><p className="text-sm font-bold text-slate-500">카드 추천 TOP 3</p><h2 className="mt-1 text-2xl font-black">지금 소비 안에서 순혜택이 큰 카드</h2>{result.recommendations.length===0?<p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">현재 소비금액으로 추가소비 없이 실적조건을 만족하는 등록 카드가 없습니다. 카드혜택을 위해 소비를 늘리라고 권하지 않습니다.</p>:<div className="mt-5 space-y-4">{result.recommendations.map((c,i)=><div key={c.card_id} className={`rounded-2xl border p-5 ${i===0?"border-slate-950":"border-slate-200"}`}><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold text-slate-500">{i+1}위 · {c.card_type==="CHECK"?"체크카드":"신용카드"}</span><h3 className="mt-1 text-lg font-black">{c.issuer} · {c.name}</h3><p className="mt-1 text-xs text-slate-500">전월실적 {won(c.minimum_monthly_spend)} 이상 · 연회비 {won(c.annual_fee)}</p></div><div className="text-right"><span className="text-xs text-slate-500">예상 월 순혜택</span><b className="block text-xl">{won(c.estimated_net_monthly_benefit)}</b>{currentCard&&<span className="text-xs font-bold text-emerald-700">현재카드 대비 +{won(c.incremental_monthly_benefit_vs_current)}</span>}</div></div><div className="mt-3 flex flex-wrap gap-2">{c.benefit_breakdown.slice(0,4).map((b)=><span key={b.label} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs">{b.label} {b.amount>=0?"+":""}{won(b.amount)}</span>)}</div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-400">확인일 {c.checked_at}</span><a href={c.source_url} target="_blank" rel="noreferrer" className="text-xs font-bold underline">공식 상품정보 확인</a></div></div>)}</div>}<p className="mt-4 text-xs leading-5 text-slate-400">현재 등록된 공식 검증 대표상품만 비교합니다. 모든 카드사의 전체 상품을 망라하는 추천이 아니며, 실제 가맹점·실적 제외조건은 발급 전 상품설명서를 확인해야 합니다.</p></section>
      </div>

      <section className="mt-10 overflow-hidden rounded-3xl bg-slate-950 p-7 text-white shadow-lg md:p-9"><p className="text-sm font-bold text-slate-400">최종 3개 경로 비교</p><h2 className="mt-1 text-3xl font-black">일반저축 vs 기본 FinPath vs Full FinPath</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">소비 기능은 기본 FinPath 뒤에 붙는 선택형 부가서비스입니다. 기본 결과를 덮어쓰지 않고 세 경로를 같은 목표기간으로 비교합니다.</p><div className="mt-6 grid gap-3 lg:grid-cols-3"><div className="rounded-2xl bg-white/10 p-5"><span className="text-xs text-slate-300">1 · 일반저축</span><b className="mt-2 block text-3xl">{won(analysis.baseline.final_assets)}</b><p className="mt-2 text-xs text-slate-400">현재 저축액 그대로 일반저축</p></div><div className="rounded-2xl bg-white/10 p-5"><span className="text-xs text-slate-300">2 · 기본 FinPath</span><b className="mt-2 block text-3xl">{won(analysis.optimized.final_assets)}</b><p className="mt-2 text-sm font-bold text-slate-200">일반저축 대비 +{won(analysis.optimized.final_assets-analysis.baseline.final_assets)}</p></div><div className="rounded-2xl bg-emerald-50 p-5 text-slate-950"><span className="text-xs font-bold text-emerald-700">3 · Full FinPath</span><b className="mt-2 block text-3xl">{won(result.enhanced_analysis.optimized.final_assets)}</b><p className="mt-2 text-sm font-black text-emerald-800">일반저축 대비 +{won(result.enhanced_analysis.optimized.final_assets-analysis.baseline.final_assets)}</p><p className="mt-1 text-xs font-bold text-slate-500">기본 FinPath보다 +{won(result.enhanced_analysis.optimized.final_assets-analysis.optimized.final_assets)}</p></div></div><div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm text-slate-200">월 저축여력 {won(analysis.profile.monthly_saving_capacity)} → 소비·카드 추가 +{won(result.total_extra_monthly_saving)} → Full FinPath {won(result.enhanced_monthly_saving_capacity)}</div><button onClick={applyToFinPath} className="mt-6 rounded-xl bg-white px-6 py-3 font-black text-slate-950">최종 비교 결과로 돌아가기</button><p className="mt-3 text-xs leading-5 text-slate-400">{result.notice}</p></section>
    </>}
  </Shell>;
}
