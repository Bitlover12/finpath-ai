"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { getCards, recommendSpending, uploadSpendingFile } from "../../lib/api";
import { loadAnalysis, loadSpendingOptimization, saveSpendingOptimization } from "../../lib/storage";
import type { CardCatalogItem, CardTypePreference, SpendingCategory, SpendingOptimizationResponse } from "../../lib/types";

const primaryCategories: { key: SpendingCategory; label: string; hint: string }[] = [
  { key: "FOOD", label: "외식/식비", hint: "식당·패스트푸드" }, { key: "DELIVERY", label: "배달", hint: "배달앱" },
  { key: "CAFE", label: "카페", hint: "커피전문점" }, { key: "TRANSPORT", label: "교통", hint: "버스·지하철·택시" },
  { key: "SHOPPING", label: "쇼핑", hint: "패션·온라인" }, { key: "SUBSCRIPTION", label: "구독", hint: "OTT·멤버십" },
  { key: "TELECOM", label: "통신", hint: "휴대폰 요금" }, { key: "GROCERIES", label: "마트", hint: "장보기" },
];
const extraCategories: { key: SpendingCategory; label: string; hint: string }[] = [
  { key: "CONVENIENCE", label: "편의점", hint: "CU·GS25 등" }, { key: "BEAUTY", label: "뷰티", hint: "화장품·미용실" },
  { key: "CULTURE", label: "문화", hint: "영화·공연" }, { key: "FUEL", label: "주유", hint: "주유소" },
  { key: "HOUSING", label: "주거/공과금", hint: "월세·관리비" }, { key: "MEDICAL", label: "의료", hint: "병원·약국" },
  { key: "EDUCATION", label: "교육", hint: "학원·강의" }, { key: "OTHER", label: "기타", hint: "그 외 소비" },
];
const allCategories = [...primaryCategories, ...extraCategories];
const categoryLabel = Object.fromEntries(allCategories.map((x) => [x.key, x.label])) as Record<string,string>;
const won = (n: number | null | undefined) => `${Math.round(n || 0).toLocaleString("ko-KR")}원`;

function SpendingInput({ item, value, onChange }: { item: { key: SpendingCategory; label: string; hint: string }; value: number; onChange: (value:number)=>void }) {
  return <label className="block border-b border-[#edf0f3] py-4 last:border-0"><div className="flex items-center justify-between gap-3"><div><b className="text-sm">{item.label}</b><span className="ml-2 text-xs text-[#b0b8c1]">{item.hint}</span></div><input type="number" min={0} step={1000} value={value || 0} onChange={(e)=>onChange(Number(e.target.value))} className="w-[140px] rounded-xl border border-[#e5e8eb] px-3 py-2 text-right text-sm font-semibold" /></div></label>;
}

export default function SpendingPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ReturnType<typeof loadAnalysis>>(null);
  const [cards, setCards] = useState<CardCatalogItem[]>([]);
  const [amounts, setAmounts] = useState<Partial<Record<SpendingCategory, number>>>({ FOOD:250000, DELIVERY:150000, CAFE:100000, TRANSPORT:90000, CONVENIENCE:70000, SHOPPING:180000, SUBSCRIPTION:45000, TELECOM:70000, GROCERIES:150000, OTHER:100000 });
  const [preference, setPreference] = useState<CardTypePreference>("BOTH");
  const [currentCard, setCurrentCard] = useState("");
  const [cutPercent, setCutPercent] = useState(10);
  const [result, setResult] = useState<SpendingOptimizationResponse | null>(null);
  const [loading, setLoading] = useState(false); const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(""); const [uploadNotice, setUploadNotice] = useState("");

  useEffect(() => { setAnalysis(loadAnalysis()); setResult(loadSpendingOptimization()); getCards().then(setCards).catch(()=>setCards([])); }, []);
  const totalInput = useMemo(() => Object.values(amounts).reduce<number>((a,b)=>a+Number(b||0),0), [amounts]);
  const setAmount = (key: SpendingCategory, value:number) => setAmounts((prev)=>({...prev,[key]:Math.max(0,value||0)}));

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file)return; setUploading(true);setError("");setUploadNotice("");
    try{const parsed=await uploadSpendingFile(file);setAmounts((prev)=>({...prev,...parsed.monthly_categories}));setUploadNotice(`${parsed.total_rows}건 · ${parsed.months_count}개월 월평균으로 반영했어요.`);}catch(err){setError(err instanceof Error?err.message:"거래내역을 읽지 못했습니다.");}finally{setUploading(false);e.target.value="";}
  }
  async function run(){if(!analysis)return;setLoading(true);setError("");try{const response=await recommendSpending(analysis.profile,amounts,{current_card_id:currentCard||null,card_type_preference:preference,cut_percent:cutPercent});setResult(response);saveSpendingOptimization(response);}catch(err){setError(err instanceof Error?err.message:"소비 최적화 계산에 실패했습니다.");}finally{setLoading(false);}}
  function applyToFinPath(){if(!result)return;saveSpendingOptimization(result);router.push("/dashboard#full-finpath");}

  if(!analysis)return <Shell><div className="fp-panel p-7"><h1 className="text-2xl font-black">먼저 기본 FinPath 분석이 필요해요.</h1><Link href="/profile" className="fp-primary mt-5">내 경로부터 계산하기</Link></div></Shell>;

  return <Shell>
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="fp-label">선택 · 더 빠르게 가기</p><h1 className="fp-title mt-2">저축할 돈 자체를 조금 더 찾아볼까요?</h1><p className="fp-muted mt-3 max-w-2xl">기본 FinPath 결과는 그대로 둡니다. 소비·카드에서 새로 찾은 금액만 월 저축여력에 더해 마지막으로 한 번 더 계산해요.</p></div><Link href="/dashboard" className="text-sm font-bold text-[#6b7684]">기본 결과로 돌아가기</Link></div>

      <section className="mt-9 rounded-[28px] bg-[#f7f9fb] p-6 sm:p-8"><div className="grid gap-6 sm:grid-cols-2"><div><p className="fp-label">현재 월 저축</p><b className="mt-2 block text-[28px] tracking-[-0.04em]">{won(analysis.profile.monthly_saving_capacity)}</b></div><div><p className="fp-label">기본 FinPath {analysis.profile.target_years}년 후</p><b className="mt-2 block text-[28px] tracking-[-0.04em]">{won(analysis.optimized.final_assets)}</b></div></div></section>

      <section className="mt-10 fp-panel overflow-hidden">
        <div className="p-6 sm:p-8"><p className="fp-label">1 · 소비내역 가져오기</p><h2 className="mt-2 text-[24px] font-black tracking-[-0.04em]">파일 하나면 가장 빨라요.</h2><p className="mt-2 text-sm leading-6 text-[#6b7684]">은행·카드 거래내역 CSV/XLSX를 올리면 월평균 소비로 정리합니다. 파일은 분석 후 서버에 저장하지 않아요.</p><div className="mt-5 flex flex-wrap gap-3"><label className="fp-primary cursor-pointer"><input type="file" accept=".csv,.xlsx,.xlsm" className="hidden" onChange={handleUpload}/>{uploading?"분석 중...":"거래내역 업로드"}</label><a href="/sample_transactions.csv" className="fp-secondary">샘플 파일 보기</a></div>{uploadNotice&&<p className="mt-4 text-sm font-semibold text-[#00a86b]">{uploadNotice}</p>}</div>
        <details className="border-t border-[#edf0f3] p-6 sm:p-8"><summary className="cursor-pointer text-sm font-bold text-[#6b7684]">파일 없이 월 소비 직접 입력하기</summary><div className="mt-5 grid gap-x-8 sm:grid-cols-2">{primaryCategories.map((item)=><SpendingInput key={item.key} item={item} value={amounts[item.key]||0} onChange={(v)=>setAmount(item.key,v)}/>)}</div><details className="mt-3 rounded-2xl bg-[#f7f9fb] px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-[#6b7684]">기타 항목 더 입력하기</summary><div className="mt-2 grid gap-x-8 sm:grid-cols-2">{extraCategories.map((item)=><SpendingInput key={item.key} item={item} value={amounts[item.key]||0} onChange={(v)=>setAmount(item.key,v)}/>)}</div></details></details>
      </section>

      <section className="mt-7 grid gap-5 md:grid-cols-2">
        <div className="fp-panel p-6"><p className="fp-label">2 · 카드 범위</p><div className="mt-4 flex gap-2">{(["BOTH","CHECK","CREDIT"] as CardTypePreference[]).map((x)=><button key={x} onClick={()=>setPreference(x)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${preference===x?"bg-[#191f28] text-white":"bg-[#f2f4f6] text-[#6b7684]"}`}>{x==="BOTH"?"둘 다":x==="CHECK"?"체크":"신용"}</button>)}</div><label className="mt-5 block text-sm font-semibold text-[#4e5968]">현재 주력카드<select value={currentCard} onChange={(e)=>setCurrentCard(e.target.value)} className="fp-input"><option value="">모름 / 비교 안 함</option>{cards.map((c)=><option key={c.id} value={c.id}>{c.issuer} · {c.name}</option>)}</select></label></div>
        <div className="fp-panel p-6"><p className="fp-label">3 · 선택소비 조정</p><div className="mt-4 flex items-end justify-between"><span className="text-sm text-[#6b7684]">배달·카페·쇼핑·구독 등</span><b className="text-[24px]">{cutPercent}%</b></div><input type="range" min={0} max={30} step={5} value={cutPercent} onChange={(e)=>setCutPercent(Number(e.target.value))} className="mt-5 w-full accent-[#3182f6]"/><p className="mt-3 text-xs leading-5 text-[#8b95a1]">FinPath가 낭비를 단정하지 않습니다. 사용자가 선택한 조정 비율만 시뮬레이션해요.</p></div>
      </section>

      <div className="mt-7 flex flex-col items-end gap-3"><p className="text-sm text-[#8b95a1]">입력된 월 소비 {won(totalInput)}</p><button onClick={run} disabled={loading} className="fp-primary min-w-[210px]">{loading?"계산 중...":"Full FinPath 계산"}</button>{error&&<p className="text-sm font-semibold text-rose-600">{error}</p>}</div>

      {result&&<>
        <section className="mt-12 rounded-[30px] bg-[#e8f8f1] p-7 sm:p-9"><p className="text-[13px] font-bold text-[#00a86b]">찾은 추가 저축여력</p><h2 className="mt-2 text-[34px] font-black tracking-[-0.05em] sm:text-[42px]">월 +{won(result.total_extra_monthly_saving)}</h2><p className="mt-3 text-sm text-[#4e5968]">현재 {won(analysis.profile.monthly_saving_capacity)} → Full FinPath {won(result.enhanced_monthly_saving_capacity)}</p><div className="mt-8 grid border-y border-[#cfeee0] sm:grid-cols-3"><div className="py-5 sm:pr-5"><p className="text-xs text-[#8b95a1]">그냥 저축</p><b className="mt-1 block text-xl">{won(analysis.baseline.final_assets)}</b></div><div className="border-t border-[#cfeee0] py-5 sm:border-l sm:border-t-0 sm:px-5"><p className="text-xs font-bold text-[#3182f6]">FinPath</p><b className="mt-1 block text-xl">{won(analysis.optimized.final_assets)}</b></div><div className="border-t border-[#cfeee0] py-5 sm:border-l sm:border-t-0 sm:pl-5"><p className="text-xs font-bold text-[#00a86b]">Full FinPath</p><b className="mt-1 block text-xl text-[#00a86b]">{won(result.enhanced_analysis.optimized.final_assets)}</b><p className="mt-1 text-xs font-bold text-[#00a86b]">일반 대비 +{won(result.enhanced_analysis.optimized.final_assets-analysis.baseline.final_assets)}</p></div></div><button onClick={applyToFinPath} className="fp-primary mt-6">최종 결과에 반영하기</button></section>

        <section className="mt-10"><p className="fp-label">카드 추천</p><h2 className="mt-2 text-[24px] font-black tracking-[-0.04em]">현재 소비를 늘리지 않고 얻는 순혜택</h2>{result.recommendations.length===0?<p className="mt-5 text-sm text-[#6b7684]">추가소비 없이 실적을 만족하는 등록 카드가 없습니다.</p>:<div className="mt-5 divide-y divide-[#edf0f3] rounded-[24px] border border-[#edf0f3] bg-white px-5 sm:px-7">{result.recommendations.map((c,i)=><div key={c.card_id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-[#8b95a1]">{i+1}위 · {c.card_type==="CHECK"?"체크":"신용"}</p><h3 className="mt-1 font-bold">{c.issuer} · {c.name}</h3><p className="mt-1 text-xs text-[#8b95a1]">연회비 반영 · 추가소비 없음</p></div><div className="sm:text-right"><b className="text-lg">월 {won(c.estimated_net_monthly_benefit)}</b><a href={c.source_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-bold text-[#3182f6]">공식 상품정보 →</a></div></div>)}</div>}<p className="mt-3 text-xs leading-5 text-[#8b95a1]">현재 등록된 공식 검증 대표상품만 비교합니다. 실제 발급 전 상품설명서의 실적 제외조건을 확인해야 합니다.</p></section>

        <details className="mt-7 border-t border-[#edf0f3] py-6"><summary className="cursor-pointer text-sm font-bold text-[#6b7684]">소비 조정 상세 보기</summary><div className="mt-4 divide-y divide-[#edf0f3]">{result.cut_items.length===0?<p className="py-3 text-sm text-[#8b95a1]">소비 조정 시나리오 없음</p>:result.cut_items.map((x)=><div key={x.category} className="flex items-center justify-between py-3 text-sm"><span>{categoryLabel[x.category]||x.category} · {x.assumed_cut_percent}%</span><b className="text-[#00a86b]">+{won(x.monthly_saving)}</b></div>)}</div></details>
      </>}
    </div>
  </Shell>;
}
