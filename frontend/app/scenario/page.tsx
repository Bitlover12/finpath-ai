"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "../../components/Shell";
import { compareScenario, parseScenario } from "../../lib/api";
import { manWon } from "../../lib/format";
import { loadAnalysis, saveAnalysis } from "../../lib/storage";
import type { AnalyzeResponse, ScenarioChange, ScenarioCompareResponse } from "../../lib/types";

const fieldLabel: Record<string,string> = {
  company_size:"기업규모", annual_income:"연소득", monthly_saving_capacity:"월 저축액", region:"거주지역",
  employment_type:"고용형태", employment_months:"재직기간", age:"나이", household_income:"가구소득",
};
const valueLabel: Record<string,string> = {
  LARGE:"대기업", MID:"중견기업", SME:"중소기업", PUBLIC:"공공기관", GYEONGGI:"경기", SEOUL:"서울",
  BUSAN:"부산", INCHEON:"인천", DAEJEON:"대전", JEONBUK:"전북", JEONNAM:"전남", FREELANCER:"프리랜서",
  SELF_EMPLOYED:"자영업", UNEMPLOYED:"무직", EMPLOYEE:"재직자",
};
const statusLabel: Record<string,string> = { ELIGIBLE:"가능", INELIGIBLE:"미충족", NEEDS_MORE_INFORMATION:"추가 확인" };
const changeLabel: Record<string,string> = {
  GAINED_OPPORTUNITY:"새 기회", LOST_OPPORTUNITY:"기회 상실", PATH_CHANGED:"추천 경로 변경",
  ALLOCATION_CHANGED:"월 배분 변경", ELIGIBILITY_CHANGED:"자격 상태 변경",
};

function signedMoney(value:number){ return `${value >= 0 ? "+" : "-"}${manWon(Math.abs(value))}`; }
function displayValue(field:string, value:unknown){
  if (typeof value === "number") {
    if (field.includes("income") || field.includes("saving") || field.includes("assets")) return manWon(value);
    if (field === "employment_months") return `${value}개월`;
    if (field === "age") return `${value}세`;
    return value.toLocaleString("ko-KR");
  }
  if (typeof value === "object" && value && "operation" in (value as Record<string,unknown>)) {
    const v=value as {operation?:unknown;amount?:unknown};
    if (v.operation === "ADD" && typeof v.amount === "number") return `현재보다 +${manWon(v.amount)}`;
  }
  return valueLabel[String(value)] || String(value);
}

export default function ScenarioPage(){
  const router=useRouter();
  const [r,setR]=useState<AnalyzeResponse|null>(null);
  const [text,setText]=useState("대기업으로 이직하고 연봉이 4500만원이 되면?");
  const [changes,setChanges]=useState<ScenarioChange[]>([]);
  const [comparison,setComparison]=useState<ScenarioCompareResponse|null>(null);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>setR(loadAnalysis()),[]);

  async function parse(input=text){
    setBusy(true); setError(""); setComparison(null);
    try{
      const p=await parseScenario(input);
      setChanges(p.changes); setNotice(p.notice||"");
      if(p.changes.length===0) setError("변경할 조건을 찾지 못했어요. 연봉·이직·지역·재직기간·월 저축액처럼 구체적으로 입력해주세요.");
    }catch(e){setError(e instanceof Error?e.message:"해석 실패");}finally{setBusy(false)}
  }

  async function compare(){
    if(!r || changes.length===0)return;
    setBusy(true); setError("");
    try{setComparison(await compareScenario(r.profile,changes));}
    catch(e){setError(e instanceof Error?e.message:"영향 계산 실패");}
    finally{setBusy(false)}
  }

  function applyComparison(){
    if(!comparison)return;
    saveAnalysis(comparison.after);
    router.push("/dashboard");
  }

  const presets=["대기업으로 이직하고 연봉이 4500만원이면?","연봉이 6000만원을 넘으면?","재직 2년이 되면?","월 저축액을 20만원 늘리면?","경기도로 이사하면?"];
  const changedPolicies=comparison?.policy_changes.slice(0,8) || [];

  return <Shell><div className="mx-auto max-w-4xl">
    <div><p className="fp-label">POLICY CLIFF SIMULATOR</p><h1 className="fp-title mt-2">내 조건이 바뀌면, 잃고 얻는 금융기회까지 계산해요.</h1><p className="fp-muted mt-3">AI/Parser는 문장에서 변화만 구조화하고, 정책 자격·정부지원·세금·장기 자산은 기존 결정론적 엔진이 BEFORE / AFTER로 다시 계산합니다.</p></div>

    <section className="mt-9 fp-panel p-6 sm:p-8">
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="예: 대기업으로 이직하고 연봉이 4500만원이 되면?" className="h-32 w-full resize-none rounded-[16px] border border-[#e5e8eb] p-4 text-[17px] leading-7"/>
      <div className="mt-4 flex flex-wrap gap-2">{presets.map(x=><button key={x} onClick={()=>{setText(x);void parse(x)}} className="rounded-full bg-[#f2f4f6] px-3.5 py-2 text-[13px] font-semibold text-[#6b7684] hover:bg-[#e9ecef]">{x}</button>)}</div>
      <div className="mt-6 flex justify-end"><button disabled={busy} onClick={()=>void parse()} className="fp-primary min-w-[170px]">{busy?"해석 중...":"변화 해석하기"}</button></div>
      {error&&<p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
    </section>

    {changes.length>0&&<section className="mt-7 rounded-[28px] bg-[#eef6ff] p-6 sm:p-8">
      <p className="text-[13px] font-bold text-[#3182f6]">이렇게 이해했어요</p>
      <div className="mt-5 divide-y divide-[#dbeafe]">{changes.map((c,i)=><div key={i} className="flex items-center justify-between gap-4 py-4"><span className="text-sm font-semibold text-[#6b7684]">{fieldLabel[c.field]||c.field}</span><b className="text-[16px]">{displayValue(c.field,c.value)}</b></div>)}</div>
      {notice&&<p className="mt-4 text-[12px] leading-5 text-[#6b7684]">{notice}</p>}
      <div className="mt-6 flex flex-wrap gap-3"><button onClick={()=>void compare()} disabled={busy||!r} className="fp-primary">{busy?"계산 중...":"BEFORE / AFTER 영향 계산"}</button><button onClick={()=>{setChanges([]);setComparison(null)}} className="fp-secondary">다시 입력</button></div>
    </section>}

    {comparison&&<>
      <section className={`mt-8 rounded-[30px] p-7 sm:p-9 ${comparison.final_assets_delta < 0 ? "bg-[#fff1f0]" : comparison.final_assets_delta > 0 ? "bg-[#e8f8f1]" : "bg-[#f7f9fb]"}`}>
        <p className={`text-[13px] font-bold ${comparison.final_assets_delta < 0 ? "text-[#f04452]" : comparison.final_assets_delta > 0 ? "text-[#00a86b]" : "text-[#6b7684]"}`}>금융 디지털 트윈 재계산 결과</p>
        <h2 className="mt-3 max-w-3xl text-[32px] font-black leading-[1.2] tracking-[-0.045em] sm:text-[42px]">{comparison.headline}</h2>
        <p className="mt-3 text-sm leading-6 text-[#6b7684]">{comparison.explanation}</p>
        <div className="mt-8 grid border-y border-black/5 sm:grid-cols-3">
          <div className="py-5 sm:pr-6"><p className="text-xs font-semibold text-[#8b95a1]">현재 경로</p><b className="mt-1 block text-[23px]">{manWon(comparison.before.optimized.final_assets)}</b></div>
          <div className="border-t border-black/5 py-5 sm:border-l sm:border-t-0 sm:px-6"><p className="text-xs font-semibold text-[#8b95a1]">변경 후</p><b className="mt-1 block text-[23px]">{manWon(comparison.after.optimized.final_assets)}</b></div>
          <div className="border-t border-black/5 py-5 sm:border-l sm:border-t-0 sm:pl-6"><p className="text-xs font-semibold text-[#8b95a1]">정부지원 변화</p><b className={`mt-1 block text-[23px] ${comparison.government_support_delta < 0 ? "text-[#f04452]" : "text-[#00a86b]"}`}>{signedMoney(comparison.government_support_delta)}</b></div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4"><div><p className="fp-label">금융기회 변화</p><h2 className="mt-1 text-[24px] font-black">정책 자격과 월 배분이 이렇게 바뀌어요.</h2></div><span className="text-sm text-[#8b95a1]">{comparison.policy_changes.length}개 변화</span></div>
        <div className="mt-4 divide-y divide-[#edf0f3] rounded-[24px] border border-[#edf0f3] bg-white px-5 sm:px-7">
          {changedPolicies.length>0?changedPolicies.map(x=><div key={x.policy_id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[15px] font-bold">{x.policy_name}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${x.change_type==="LOST_OPPORTUNITY"?"bg-[#fff1f0] text-[#f04452]":x.change_type==="GAINED_OPPORTUNITY"?"bg-[#e8f8f1] text-[#00a86b]":"bg-[#eef6ff] text-[#3182f6]"}`}>{changeLabel[x.change_type]||x.change_type}</span></div><p className="mt-1 text-[12px] text-[#8b95a1]">자격 {statusLabel[x.before_status]} → {statusLabel[x.after_status]} · 월 배분 {manWon(x.before_monthly_amount)} → {manWon(x.after_monthly_amount)}</p></div>
            <a href={x.source_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#3182f6]">공식 근거 →</a>
          </div>):<p className="py-6 text-sm text-[#6b7684]">정책 자격이나 월 배분에서 의미 있는 변화가 없습니다.</p>}
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] bg-[#f7f9fb] p-6"><p className="text-xs font-semibold text-[#8b95a1]">목표 상태</p><h3 className="mt-2 text-[20px] font-black">{comparison.goal_before === "ACHIEVED" ? "달성 가능" : "미달"} → {comparison.goal_after === "ACHIEVED" ? "달성 가능" : "미달"}</h3><p className="mt-2 text-sm text-[#6b7684]">목표 부족액 변화 {signedMoney(comparison.shortfall_delta)}</p></div>
        <div className="rounded-[24px] bg-[#f7f9fb] p-6"><p className="text-xs font-semibold text-[#8b95a1]">절세효과 변화</p><h3 className="mt-2 text-[20px] font-black">{signedMoney(comparison.tax_benefit_delta)}</h3><p className="mt-2 text-sm text-[#6b7684]">정책별 과세·비과세 조건도 변경 후 경로에서 다시 계산했습니다.</p></div>
      </section>

      <div className="mt-8 flex flex-wrap justify-end gap-3"><Link href="/dashboard" className="fp-secondary">현재 경로 유지</Link><button onClick={applyComparison} className="fp-primary">이 조건을 내 새 기준으로 적용</button></div>
    </>}

    {!r&&<div className="mt-7 rounded-[20px] bg-[#fff7e6] p-5"><p className="text-sm text-[#6b7684]">먼저 기본 분석을 실행해야 해요.</p><Link href="/profile" className="mt-2 inline-block text-sm font-bold text-[#3182f6]">내 조건 입력하기 →</Link></div>}
  </div></Shell>;
}
