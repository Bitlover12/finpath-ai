"use client";

import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { applyScenario,parseScenario } from "../../lib/api";
import { manWon } from "../../lib/format";
import { loadAnalysis,saveAnalysis } from "../../lib/storage";
import type { AnalyzeResponse,ScenarioChange } from "../../lib/types";

export default function ScenarioPage(){
 const router=useRouter(); const [r,setR]=useState<AnalyzeResponse|null>(null); const [text,setText]=useState("대기업으로 이직하고 연봉이 4500만원이 되면?"); const [changes,setChanges]=useState<ScenarioChange[]>([]); const [notice,setNotice]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 useEffect(()=>setR(loadAnalysis()),[]);
 async function parse(input=text){setBusy(true);setError("");try{const p=await parseScenario(input);setChanges(p.changes);setNotice(p.notice||"");}catch(e){setError(e instanceof Error?e.message:"해석 실패");}finally{setBusy(false)}}
 async function apply(){if(!r)return;setBusy(true);try{const next=await applyScenario(r.profile,changes);saveAnalysis(next);router.push("/dashboard");}catch(e){setError(e instanceof Error?e.message:"재계산 실패");}finally{setBusy(false)}}
 const presets=["대기업으로 이직","연봉이 4500만원이 되면?","월 저축액을 +20만원 늘리면?","경기도로 이사하면?"];
 return <Shell><div className="max-w-4xl"><p className="text-sm font-bold text-slate-500">AI WHAT-IF</p><h1 className="mt-2 text-4xl font-black">조건이 바뀐다면?</h1><p className="mt-3 text-slate-600">AI는 문장을 프로필 변경값으로만 구조화합니다. 금융 계산은 다시 deterministic engine이 수행합니다.</p>
 <div className="mt-8 rounded-2xl border bg-white p-6"><textarea value={text} onChange={e=>setText(e.target.value)} className="h-28 w-full resize-none rounded-xl border p-4 text-lg"/><div className="mt-3 flex flex-wrap gap-2">{presets.map(x=><button key={x} onClick={()=>{setText(x);void parse(x)}} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold">{x}</button>)}</div><button disabled={busy} onClick={()=>void parse()} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">{busy?"처리 중...":"AI가 변화 해석"}</button>{error&&<p className="mt-3 text-sm text-rose-600">{error}</p>}</div>
 {changes.length>0&&<div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="text-xl font-black">AI가 다음 변화로 이해했습니다.</h2><div className="mt-4 space-y-2">{changes.map((c,i)=><div key={i} className="flex justify-between rounded-xl bg-white p-3"><span>{c.field}</span><b>{typeof c.value==="number"&&String(c.field).includes("income")?manWon(c.value):JSON.stringify(c.value)}</b></div>)}</div><p className="mt-4 text-sm text-emerald-900">{notice}</p><button onClick={()=>void apply()} disabled={busy||!r} className="mt-5 rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white">적용하고 다시 계산</button></div>}
 {!r&&<p className="mt-5 text-sm text-amber-700">먼저 Profile 또는 Demo 분석을 실행해야 합니다.</p>}
 </div></Shell>;
}
