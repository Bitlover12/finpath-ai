"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { AssetChart } from "../../components/AssetChart";
import { Shell } from "../../components/Shell";
import { StatCard } from "../../components/StatCard";
import { manWon, monthsText } from "../../lib/format";
import { loadAnalysis } from "../../lib/storage";
import type { AnalyzeResponse } from "../../lib/types";

export default function DashboardPage(){
 const [r,setR]=useState<AnalyzeResponse|null>(null); useEffect(()=>setR(loadAnalysis()),[]);
 if(!r)return <Shell><p>분석 결과가 없습니다. <Link href="/profile" className="font-bold underline">분석 시작</Link></p></Shell>;
 const gs=r.goal_seeking;
 const selectedUpcoming=r.policy_analysis.filter(p=>p.selected_in_optimal_path&&p.application_status==="UPCOMING");
 return <Shell><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-slate-500">DASHBOARD</p><h1 className="mt-2 text-4xl font-black">목표까지의 금융경로</h1></div><Link href="/scenario" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">조건 바꿔보기</Link></div>
 {selectedUpcoming.length>0&&<div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-950"><b>모집 예정/검토 정책을 포함한 계획 시뮬레이션입니다.</b><p className="mt-1">{selectedUpcoming.map(p=>p.policy_name).join(", ")}의 실제 추가 모집 일정이 확정되면 다시 계산해야 합니다.</p></div>}
 <div className="mt-8 grid gap-4 md:grid-cols-4"><StatCard label="목표자산" value={manWon(r.goal.target_assets)}/><StatCard label="FinPath 예상" value={manWon(r.optimized.final_assets)} sub={r.goal.status}/><StatCard label="정책 활용 효과" value={`${r.policy_effect.additional_assets>=0?"+":""}${manWon(r.policy_effect.additional_assets)}`} sub={r.policy_effect.goal_time_saved_months!=null?`목표 도달 ${r.policy_effect.goal_time_saved_months}개월 단축`:"금액 효과 중심"}/><StatCard label={r.goal.status==="SHORTFALL"?"부족금액":"달성여유"} value={r.goal.status==="SHORTFALL"?manWon(r.goal.shortfall):"목표 달성"}/></div>
 <div className="mt-8"><AssetChart result={r}/></div>
 <div className="mt-8 grid gap-6 lg:grid-cols-2">
  <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-black">Baseline vs FinPath</h2><div className="mt-5 grid grid-cols-2 gap-4"><StatCard label="일반 저축" value={manWon(r.baseline.final_assets)}/><StatCard label="FinPath" value={manWon(r.optimized.final_assets)}/></div><div className="mt-5 grid grid-cols-3 gap-3 text-sm"><div><span className="text-slate-500">정부지원</span><b className="mt-1 block">{manWon(r.optimized.government_support)}</b></div><div><span className="text-slate-500">절세효과</span><b className="mt-1 block">{manWon(r.optimized.tax_benefit)}</b></div><div><span className="text-slate-500">세후이자</span><b className="mt-1 block">{manWon(r.optimized.net_interest)}</b></div></div></section>
  <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-black">{r.goal.status==="SHORTFALL"?"목표 미달 조건 역산":"목표 달성"}</h2>{gs?<div className="mt-5 space-y-4"><div className="rounded-xl bg-slate-50 p-4"><span className="text-sm text-slate-500">① 필요한 월 저축액</span><b className="mt-1 block text-xl">{manWon(r.profile.monthly_saving_capacity)} → {manWon(gs.required_monthly_saving)}</b></div><div className="rounded-xl bg-slate-50 p-4"><span className="text-sm text-slate-500">② 필요한 기간</span><b className="mt-1 block text-xl">{r.profile.target_years}년 → {monthsText(gs.required_duration_months)}</b></div><details><summary className="cursor-pointer font-bold">기타 조건</summary><p className="mt-2 text-sm">필요 초기자산: <b>{manWon(gs.required_initial_assets)}</b></p></details></div>:<p className="mt-5 text-emerald-700 font-bold">현재 FinPath 경로로 목표를 달성합니다.</p>}</section>
 </div>
 <section className="mt-8 rounded-2xl border bg-white p-6"><h2 className="text-xl font-black">Roadmap</h2><div className="mt-5 space-y-3">{r.roadmap.map((x,i)=><div key={`${x.type}-${i}`} className="flex flex-col justify-between gap-2 rounded-xl bg-slate-50 p-4 sm:flex-row"><div><b>{x.product_name}</b><p className="text-sm text-slate-500">{x.type}{x.source_policy_id?` · ${x.source_policy_id}`:""}</p></div><div className="text-sm sm:text-right"><b>{x.start_month} ~ {x.end_month}</b><p className="text-slate-500">{x.monthly_amount?`월 ${manWon(x.monthly_amount)}`:x.type==="MATURITY_REINVESTMENT"?"만기 목돈 재예치":""}</p></div></div>)}</div></section>
 <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-100 p-5 text-sm text-slate-600"><b>계산 가정</b><p className="mt-2">Baseline 연 {(r.assumptions.baseline_annual_rate*100).toFixed(2)}% · {r.assumptions.baseline_rate_source} · 기준일 {r.assumptions.baseline_rate_checked_at}</p><p className="mt-1">세금 {r.assumptions.tax_basis}, 정책 시작 {r.assumptions.policy_start_timing}, 재예치 {r.assumptions.reinvestment_rate_basis}</p></section>
 </Shell>;
}
