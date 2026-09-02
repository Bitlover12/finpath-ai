"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { applyScenario, parseScenario } from "../../lib/api";
import { manWon } from "../../lib/format";
import { loadAnalysis, saveAnalysis } from "../../lib/storage";
import type { AnalyzeResponse, ScenarioChange } from "../../lib/types";

const fieldLabel: Record<string,string> = { company_size:"기업규모", annual_income:"연소득", monthly_saving_capacity:"월 저축액", region:"거주지역", employment_type:"고용형태" };
const valueLabel: Record<string,string> = { LARGE:"대기업", SME:"중소기업", GYEONGGI:"경기", SEOUL:"서울", BUSAN:"부산", INCHEON:"인천" };

export default function ScenarioPage(){
  const router=useRouter();
  const [r,setR]=useState<AnalyzeResponse|null>(null);
  const [text,setText]=useState("대기업으로 이직하고 연봉이 4500만원이 되면?");
  const [changes,setChanges]=useState<ScenarioChange[]>([]);
  const [notice,setNotice]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  useEffect(()=>setR(loadAnalysis()),[]);
  async function parse(input=text){setBusy(true);setError("");try{const p=await parseScenario(input);setChanges(p.changes);setNotice(p.notice||"");}catch(e){setError(e instanceof Error?e.message:"해석 실패");}finally{setBusy(false)}}
  async function apply(){if(!r)return;setBusy(true);try{const next=await applyScenario(r.profile,changes);saveAnalysis(next);router.push("/dashboard");}catch(e){setError(e instanceof Error?e.message:"재계산 실패");}finally{setBusy(false)}}
  const presets=["대기업으로 이직하면?","연봉이 4500만원이 되면?","월 저축액을 20만원 늘리면?","경기도로 이사하면?"];
  return <Shell><div className="mx-auto max-w-3xl">
    <div><p className="fp-label">조건 바꿔보기</p><h1 className="fp-title mt-2">상황이 달라지면, 경로도 다시 계산해요.</h1><p className="fp-muted mt-3">문장을 조건 변경값으로만 해석합니다. 자격 판정과 금융 계산은 기존 엔진이 다시 수행해요.</p></div>

    <section className="mt-9 fp-panel p-6 sm:p-8"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="예: 대기업으로 이직하고 연봉이 4500만원이 되면?" className="h-32 w-full resize-none rounded-[16px] border border-[#e5e8eb] p-4 text-[17px] leading-7"/><div className="mt-4 flex flex-wrap gap-2">{presets.map(x=><button key={x} onClick={()=>{setText(x);void parse(x)}} className="rounded-full bg-[#f2f4f6] px-3.5 py-2 text-[13px] font-semibold text-[#6b7684] hover:bg-[#e9ecef]">{x}</button>)}</div><div className="mt-6 flex justify-end"><button disabled={busy} onClick={()=>void parse()} className="fp-primary min-w-[170px]">{busy?"해석 중...":"변화 해석하기"}</button></div>{error&&<p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}</section>

    {changes.length>0&&<section className="mt-7 rounded-[28px] bg-[#eef6ff] p-6 sm:p-8"><p className="text-[13px] font-bold text-[#3182f6]">이렇게 이해했어요</p><div className="mt-5 divide-y divide-[#dbeafe]">{changes.map((c,i)=><div key={i} className="flex items-center justify-between gap-4 py-4"><span className="text-sm font-semibold text-[#6b7684]">{fieldLabel[c.field]||c.field}</span><b className="text-[16px]">{typeof c.value==="number" ? (String(c.field).includes("income")||String(c.field).includes("saving") ? manWon(c.value) : c.value.toLocaleString("ko-KR")) : valueLabel[String(c.value)]||String(c.value)}</b></div>)}</div>{notice&&<p className="mt-4 text-[12px] leading-5 text-[#6b7684]">{notice}</p>}<div className="mt-6 flex flex-wrap gap-3"><button onClick={()=>void apply()} disabled={busy||!r} className="fp-primary">이 조건으로 다시 계산</button><button onClick={()=>setChanges([])} className="fp-secondary">다시 입력</button></div></section>}

    {!r&&<div className="mt-7 rounded-[20px] bg-[#fff7e6] p-5"><p className="text-sm text-[#6b7684]">먼저 기본 분석을 실행해야 해요.</p><Link href="/profile" className="mt-2 inline-block text-sm font-bold text-[#3182f6]">내 조건 입력하기 →</Link></div>}
  </div></Shell>;
}
