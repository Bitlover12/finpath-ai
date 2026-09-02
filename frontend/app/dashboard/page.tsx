"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { AssetChart } from "../../components/AssetChart";
import { Shell } from "../../components/Shell";
import { manWon, monthsText } from "../../lib/format";
import { applicationLabel, roadmapTypeLabel } from "../../lib/labels";
import { loadAnalysis, loadSpendingOptimization } from "../../lib/storage";
import type { AnalyzeResponse, SpendingOptimizationResponse } from "../../lib/types";

function signedMoney(value:number){ return `${value>=0?"+":"-"}${manWon(Math.abs(value))}`; }

export default function DashboardPage(){
 const [r,setR]=useState<AnalyzeResponse|null>(null);
 const [full,setFull]=useState<SpendingOptimizationResponse|null>(null);
 useEffect(()=>{ setR(loadAnalysis()); setFull(loadSpendingOptimization()); },[]);
 if(!r)return <Shell><p>분석 결과가 없습니다. <Link href="/profile" className="font-bold underline">분석 시작</Link></p></Shell>;

 const gs=r.goal_seeking;
 const pending=r.policy_analysis.filter(p=>p.status==="NEEDS_MORE_INFORMATION"&&(p.application_status==="OPEN"||p.application_status==="UPCOMING"));
 const selected=r.policy_analysis.filter(p=>p.selected_in_optimal_path&&p.allocated_monthly_amount>0);
 const selectedUpcoming=selected.filter(p=>p.application_status==="UPCOMING");
 const policyMonthly=selected.reduce((sum,p)=>sum+p.allocated_monthly_amount,0);
 const generalMonthly=Math.max(0,r.profile.monthly_saving_capacity-policyMonthly);
 const additional=r.policy_effect.additional_assets;
 const otherEffect=additional-r.optimized.government_support-r.optimized.tax_benefit;
 const goalGap=r.goal.status==="SHORTFALL"?r.goal.shortfall:Math.max(0,r.optimized.final_assets-r.goal.target_assets);

 return <Shell>
  <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-slate-500">내 금융경로 결과</p><h1 className="mt-2 text-4xl font-black">일반저축과 FinPath, 결과가 이렇게 달라집니다.</h1></div><div className="flex gap-2"><Link href="/analysis" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold">정책 근거 보기</Link><Link href="/scenario" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">조건 바꿔보기</Link></div></div>

  {pending.length>0&&additional===0&&<section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-7"><p className="text-sm font-bold text-amber-800">비교가 아직 완료되지 않았어요.</p><h2 className="mt-1 text-2xl font-black">추가 자격요건 {pending.length}개 정책을 확인해야 FinPath 경로가 열립니다.</h2><p className="mt-2 text-sm text-amber-900">현재 화면의 0원 차이는 “정책 효과가 없다”는 뜻이 아니라, 미확인 정책을 안전하게 제외한 결과입니다.</p><Link href="/analysis#confirm" className="mt-4 inline-block rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">추가조건 확인하고 다시 비교</Link></section>}

  <section className="mt-8 overflow-hidden rounded-3xl bg-slate-950 p-7 text-white shadow-lg md:p-9">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-bold text-slate-400">{r.profile.target_years}년 후 예상</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">{additional>0?`일반저축보다 ${manWon(additional)} 더 만들 수 있어요.`:additional<0?`현재 추천경로는 일반저축보다 ${manWon(Math.abs(additional))} 낮아요.`:"현재 확정 조건에서는 일반저축과 동일해요."}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">같은 월 저축 가능액 {manWon(r.profile.monthly_saving_capacity)}을 기준으로 정책 지원·세금·이자·만기 이후 재예치까지 함께 계산했습니다.</p></div>{additional!==0&&<div className="rounded-2xl bg-white/10 px-5 py-4"><span className="text-xs text-slate-300">FinPath 추가효과</span><b className="mt-1 block text-3xl">{signedMoney(additional)}</b></div>}</div>
    <div className="mt-7 grid gap-3 md:grid-cols-[1fr_auto_1fr]"><div className="rounded-2xl bg-white/10 p-5"><p className="text-sm text-slate-300">그냥 일반저축</p><b className="mt-2 block text-3xl">{manWon(r.baseline.final_assets)}</b></div><div className="hidden items-center justify-center text-2xl font-black text-slate-500 md:flex">→</div><div className="rounded-2xl bg-white p-5 text-slate-950"><p className="text-sm font-bold text-slate-600">FinPath 추천경로</p><b className="mt-2 block text-3xl">{manWon(r.optimized.final_assets)}</b></div></div>
  </section>

  {selectedUpcoming.length>0&&<div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-950"><b>모집 예정/검토 정책을 포함한 계획 시뮬레이션입니다.</b><p className="mt-1">{selectedUpcoming.map(p=>p.policy_name).join(", ")} · 실제 모집 일정이 확정되면 다시 계산해야 합니다.</p></div>}

  <div className="mt-8 grid gap-6 lg:grid-cols-2">
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-bold text-slate-500">추천 월 배분</p><h2 className="mt-1 text-2xl font-black">월 {manWon(r.profile.monthly_saving_capacity)}을 이렇게 나눕니다.</h2>
      {selected.length===0?<div className="mt-5 rounded-2xl bg-slate-50 p-5"><b>현재는 일반저축 100%</b><p className="mt-1 text-sm text-slate-500">가입 가능하고 최적화에 사용할 수 있는 정책이 확정되지 않았습니다.</p></div>:<div className="mt-6 space-y-5">{selected.map(p=>{const pct=Math.min(100,Math.round(p.allocated_monthly_amount/r.profile.monthly_saving_capacity*100));return <div key={p.policy_id}><div className="flex justify-between gap-3 text-sm"><b>{p.policy_name}</b><span>월 {manWon(p.allocated_monthly_amount)}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950" style={{width:`${pct}%`}}/></div><p className="mt-1 text-xs text-slate-400">{applicationLabel[p.application_status]} · 월 저축액의 {pct}%</p></div>})}{generalMonthly>0&&<div><div className="flex justify-between text-sm"><b>일반저축</b><span>월 {manWon(generalMonthly)}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-400" style={{width:`${Math.round(generalMonthly/r.profile.monthly_saving_capacity*100)}%`}}/></div></div>}</div>}
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-bold text-slate-500">왜 차이가 나나요?</p><h2 className="mt-1 text-2xl font-black">추가자산 {signedMoney(additional)}의 구성</h2><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-emerald-50 p-4"><span className="text-xs font-semibold text-emerald-800">정부지원</span><b className="mt-1 block text-xl">+{manWon(r.optimized.government_support)}</b></div><div className="rounded-2xl bg-blue-50 p-4"><span className="text-xs font-semibold text-blue-800">절세효과</span><b className="mt-1 block text-xl">+{manWon(r.optimized.tax_benefit)}</b></div><div className="rounded-2xl bg-slate-100 p-4"><span className="text-xs font-semibold text-slate-600">이자·배분·재예치 효과</span><b className="mt-1 block text-xl">{signedMoney(otherEffect)}</b></div></div><p className="mt-4 text-xs leading-5 text-slate-400">마지막 항목은 전체 추가효과에서 정부지원과 절세효과를 제외한 차이로, 정책별 금리·납입시점·일반저축 기회비용·만기 재예치 효과를 함께 포함합니다.</p></section>
  </div>


  <section className="mt-8"><div className="mb-3 flex items-end justify-between"><div><p className="text-sm font-bold text-slate-500">자산 변화</p><h2 className="mt-1 text-2xl font-black">시간이 지날수록 차이가 어떻게 벌어지는지 확인하세요.</h2></div></div><AssetChart result={r}/></section>

  <div className="mt-8 grid gap-6 lg:grid-cols-2">
    <section className={`rounded-3xl border p-6 ${r.goal.status==="ACHIEVED"?"border-emerald-200 bg-emerald-50":"border-slate-200 bg-white"}`}><p className="text-sm font-bold text-slate-500">내 목표</p><h2 className="mt-1 text-2xl font-black">{r.goal.status==="ACHIEVED"?"현재 FinPath 경로로 목표를 달성해요.":"FinPath를 써도 아직 목표에는 부족해요."}</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white p-4"><span className="text-sm text-slate-500">목표자산</span><b className="mt-1 block text-xl">{manWon(r.goal.target_assets)}</b></div><div className="rounded-2xl bg-white p-4"><span className="text-sm text-slate-500">FinPath 예상</span><b className="mt-1 block text-xl">{manWon(r.optimized.final_assets)}</b></div></div><p className={`mt-4 font-bold ${r.goal.status==="ACHIEVED"?"text-emerald-800":"text-rose-700"}`}>{r.goal.status==="ACHIEVED"?`목표보다 ${manWon(goalGap)} 여유`:`목표까지 ${manWon(goalGap)} 부족`}{r.policy_effect.goal_time_saved_months!=null?` · 일반저축보다 ${r.policy_effect.goal_time_saved_months}개월 빠름`:""}</p></section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6"><p className="text-sm font-bold text-slate-500">목표를 꼭 달성하려면</p><h2 className="mt-1 text-2xl font-black">부족할 때만 필요한 조정폭을 보여드려요.</h2>{gs?<div className="mt-5 space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><span className="text-sm text-slate-500">월 저축액을 조정한다면</span><b className="mt-1 block text-xl">{manWon(r.profile.monthly_saving_capacity)} → {manWon(gs.required_monthly_saving)}</b></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-sm text-slate-500">기간을 늘린다면</span><b className="mt-1 block text-xl">{r.profile.target_years}년 → {monthsText(gs.required_duration_months)}</b></div><details><summary className="cursor-pointer font-bold">초기자산 기준도 보기</summary><p className="mt-2 text-sm">필요 초기자산 <b>{manWon(gs.required_initial_assets)}</b></p></details></div>:<p className="mt-5 font-bold text-emerald-700">추가 조정 없이 현재 경로로 목표 달성이 가능합니다.</p>}</section>
  </div>

  <section className="mt-8 rounded-3xl border bg-white p-6"><p className="text-sm font-bold text-slate-500">실행 로드맵</p><h2 className="mt-1 text-2xl font-black">앞으로 돈이 어디로 이동하는지 한눈에 봅니다.</h2><div className="mt-5 space-y-3">{r.roadmap.map((x,i)=><div key={`${x.type}-${i}`} className="flex flex-col justify-between gap-2 rounded-2xl bg-slate-50 p-4 sm:flex-row"><div><b>{x.product_name}</b><p className="text-sm text-slate-500">{roadmapTypeLabel[x.type]||x.type}</p></div><div className="text-sm sm:text-right"><b>{x.start_month} ~ {x.end_month}</b><p className="text-slate-500">{x.monthly_amount?`월 ${manWon(x.monthly_amount)}`:x.type==="MATURITY_REINVESTMENT"?`${manWon(x.initial_amount)} 재예치`:""}</p></div></div>)}</div></section>

  {full ? <section id="full-finpath" className="mt-10 overflow-hidden rounded-3xl border border-emerald-300 bg-emerald-950 p-7 text-white shadow-lg md:p-9">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-emerald-200">최종 비교 · Full FinPath</p><h2 className="mt-2 text-3xl font-black md:text-4xl">저축경로 최적화에 소비·카드 최적화까지 더하면?</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100">기본 FinPath 분석은 그대로 보존하고, 선택형 부가서비스에서 만든 추가 저축여력만 더해 같은 목표기간으로 다시 계산했습니다.</p></div><Link href="/spending" className="rounded-xl border border-emerald-700 bg-emerald-900 px-4 py-3 text-sm font-bold">소비 분석 다시하기</Link></div>
    <div className="mt-7 grid gap-3 lg:grid-cols-3">
      <div className="rounded-2xl bg-white/10 p-5"><span className="text-xs font-bold text-emerald-200">1 · 일반저축</span><p className="mt-2 text-sm text-emerald-100">현재 월 저축액을 일반저축에만 적립</p><b className="mt-4 block text-3xl">{manWon(r.baseline.final_assets)}</b><p className="mt-2 text-xs text-emerald-200">월 {manWon(r.profile.monthly_saving_capacity)}</p></div>
      <div className="rounded-2xl bg-white/15 p-5"><span className="text-xs font-bold text-emerald-200">2 · 기본 FinPath</span><p className="mt-2 text-sm text-emerald-100">같은 저축액으로 정책·월배분·재예치 최적화</p><b className="mt-4 block text-3xl">{manWon(r.optimized.final_assets)}</b><p className="mt-2 text-sm font-bold text-emerald-200">일반저축 대비 {signedMoney(r.optimized.final_assets-r.baseline.final_assets)}</p></div>
      <div className="rounded-2xl bg-white p-5 text-slate-950"><span className="text-xs font-bold text-emerald-800">3 · Full FinPath</span><p className="mt-2 text-sm text-slate-600">소비·카드로 저축여력까지 늘린 뒤 전체 경로 재계산</p><b className="mt-4 block text-3xl">{manWon(full.enhanced_analysis.optimized.final_assets)}</b><p className="mt-2 text-sm font-black text-emerald-800">일반저축 대비 {signedMoney(full.enhanced_analysis.optimized.final_assets-r.baseline.final_assets)}</p><p className="mt-1 text-xs font-bold text-slate-500">기본 FinPath보다 {signedMoney(full.enhanced_analysis.optimized.final_assets-r.optimized.final_assets)}</p></div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-emerald-200">현재 월 저축여력</span><b className="mt-1 block text-xl">{manWon(r.profile.monthly_saving_capacity)}</b></div><div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-emerald-200">소비·카드 추가여력</span><b className="mt-1 block text-xl">+{manWon(full.total_extra_monthly_saving)}</b><p className="mt-1 text-xs text-emerald-200">소비조정 +{manWon(full.cut_scenario_monthly_saving)} · 카드 +{manWon(full.best_card_incremental_monthly_benefit)}</p></div><div className="rounded-2xl bg-white/10 p-4"><span className="text-xs text-emerald-200">Full FinPath 월 저축여력</span><b className="mt-1 block text-xl">{manWon(full.enhanced_monthly_saving_capacity)}</b></div></div>
    <div className="mt-5 rounded-2xl bg-black/20 p-4 text-sm text-emerald-50"><b>최종 상태</b> · {full.enhanced_analysis.goal.status==="ACHIEVED"?`목표 달성 · 목표자산 ${manWon(full.enhanced_analysis.goal.target_assets)}`:`목표까지 ${manWon(full.enhanced_analysis.goal.shortfall)} 부족`} · 소비 절감은 사용자가 선택한 시나리오이며 카드 혜택은 추가 소비 없이 현재 소비에서 받을 수 있는 순혜택만 반영합니다.</div>
  </section> : <section className="mt-10 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 p-7">
    <p className="text-sm font-bold text-emerald-700">기본 FinPath 분석 완료 · 선택 부가서비스</p><h2 className="mt-1 text-2xl font-black">여기까지가 기본 금융경로입니다. 더 줄일 수 있는 소비가 있다면 마지막으로 한 번 더 당길 수 있어요.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-900">이 단계는 선택사항입니다. 거래내역 CSV/XLSX 또는 월 소비를 입력하면 소비 조정 시나리오와 체크·신용카드 순혜택을 계산하고, 늘어난 월 저축여력으로 기존 FinPath 경로를 다시 계산합니다.</p><div className="mt-5 flex flex-wrap items-center gap-3"><Link href="/spending" className="rounded-xl bg-emerald-950 px-5 py-3 font-black text-white">선택: 소비·카드까지 최적화</Link><span className="text-xs text-emerald-800">완료 후 일반저축 vs 기본 FinPath vs Full FinPath를 한 번에 비교합니다.</span></div>
  </section>}

  <details className="mt-8 rounded-2xl border border-slate-200 bg-slate-100 p-5 text-sm text-slate-600"><summary className="cursor-pointer font-bold text-slate-800">계산 기준과 가정 보기</summary><div className="mt-3 space-y-1"><p>일반저축 기준금리 연 {(r.assumptions.baseline_annual_rate*100).toFixed(2)}% · {r.assumptions.baseline_rate_source} · 확인일 {r.assumptions.baseline_rate_checked_at}</p><p>일반저축 이자소득세 기준: 15.4% · 정책별 비과세/감면 조건은 정책 데이터에 따라 반영</p><p>모든 선택 정책은 시뮬레이션 시작 시점에 가입하는 것으로 가정하며, 만기 후 신규 정책 재가입은 계산하지 않습니다.</p></div></details>
 </Shell>;
}
