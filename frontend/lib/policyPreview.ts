import type { EligibilityResult, PolicyCatalogItem } from "./types";

const regionLabels: Record<string, string> = {
  SEOUL: "서울", GYEONGGI: "경기", INCHEON: "인천", BUSAN: "부산", DAEJEON: "대전",
  JEONBUK: "전북", JEONNAM: "전남", JEJU: "제주", ULSAN: "울산", DAEGU: "대구",
  GWANGJU: "광주", SEJONG: "세종", GANGWON: "강원", CHUNGBUK: "충북", CHUNGNAM: "충남",
  GYEONGBUK: "경북", GYEONGNAM: "경남",
};
const employmentLabels: Record<string, string> = {
  EMPLOYEE: "재직자", SELF_EMPLOYED: "자영업", FREELANCER: "프리랜서", UNEMPLOYED: "미취업", OTHER: "기타",
};
const companyLabels: Record<string, string> = {
  SME: "중소기업", MID: "중견기업", LARGE: "대기업", PUBLIC: "공공기관", NONE: "해당 없음", OTHER: "기타",
};

function shortMoney(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
  if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
}

function ageSummary(p: PolicyCatalogItem) {
  if (p.min_age != null && p.max_age != null) return `${p.min_age}~${p.max_age}세`;
  if (p.min_age != null) return `${p.min_age}세 이상`;
  if (p.max_age != null) return `${p.max_age}세 이하`;
  return null;
}

function incomeSummary(p: PolicyCatalogItem) {
  return p.income_conditions.map((c) => {
    const basis = c.basis === "HOUSEHOLD" ? "가구소득" : "개인소득";
    if (c.min_income != null && c.max_income != null) return `${basis} ${shortMoney(c.min_income)}~${shortMoney(c.max_income)}원`;
    if (c.max_income != null) return `${basis} ${shortMoney(c.max_income)}원 이하`;
    if (c.min_income != null) return `${basis} ${shortMoney(c.min_income)}원 이상`;
    return basis;
  });
}

function targetSummary(p: PolicyCatalogItem) {
  const parts: string[] = [];
  const age = ageSummary(p); if (age) parts.push(age);
  parts.push(...incomeSummary(p));
  if (p.allowed_regions?.length) parts.push(`${p.allowed_regions.map((v) => regionLabels[v] || v).join("·")} 거주`);
  if (p.allowed_company_sizes?.length) parts.push(p.allowed_company_sizes.map((v) => companyLabels[v] || v).join("·"));
  if (p.allowed_employment_types?.length) parts.push(p.allowed_employment_types.map((v) => employmentLabels[v] || v).join("·"));
  if (p.min_employment_months != null) parts.push(`재직 ${p.min_employment_months}개월 이상`);
  if (p.max_employment_months != null) parts.push(`재직 ${p.max_employment_months}개월 이하`);
  return parts;
}

function benefitSummary(p: PolicyCatalogItem) {
  const parts: string[] = [];
  if (p.monthly_contribution_min != null) {
    parts.push(`월 ${shortMoney(p.monthly_contribution_min)}~${shortMoney(p.monthly_contribution_limit)}원`);
  } else {
    parts.push(`월 최대 ${shortMoney(p.monthly_contribution_limit)}원`);
  }
  parts.push(p.duration_months % 12 === 0 ? `${p.duration_months / 12}년` : `${p.duration_months}개월`);
  const maxRate = p.government_contribution_tiers?.length
    ? Math.max(...p.government_contribution_tiers.map((t) => t.rate))
    : 0;
  if (maxRate > 0) parts.push(`정부지원 최대 ${(maxRate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`);
  if (p.tax_treatment === "TAX_FREE") parts.push("비과세");
  else if (p.tax_treatment === "REDUCED") parts.push("세율 감면");
  if (p.interest_rate > 0) parts.push(`기본금리 ${(p.interest_rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`);
  return parts;
}

export function policySummary(p: PolicyCatalogItem) {
  return {
    target: targetSummary(p),
    benefit: benefitSummary(p),
    extra: p.manual_requirements.map((r) => r.label),
  };
}

export function applicationLabel(status: PolicyCatalogItem["application_status"]) {
  return status === "OPEN" ? "모집 중" : status === "UPCOMING" ? "모집 예정/검토" : status === "CLOSED" ? "모집 종료" : "일정 확인 필요";
}

export function eligibilityLabel(result: EligibilityResult | undefined, policy: PolicyCatalogItem) {
  if (!result) return "판정 중";
  if (result.status === "INELIGIBLE") return "현재 조건 미충족";
  if (result.status === "NEEDS_MORE_INFORMATION") return "추가 확인 필요";
  if (policy.application_status === "CLOSED") return "조건상 가능 · 모집 종료";
  if (policy.application_status === "UPCOMING") return "조건상 가능 · 모집 예정";
  if (policy.application_status === "CHECK_REQUIRED") return "조건상 가능 · 일정 확인";
  return "현재 조건상 가능";
}

export function eligibilityTone(result: EligibilityResult | undefined, policy: PolicyCatalogItem) {
  if (!result) return "border-slate-200 bg-white";
  if (result.status === "INELIGIBLE") return "border-slate-200 bg-slate-50";
  if (result.status === "NEEDS_MORE_INFORMATION") return "border-amber-200 bg-amber-50/40";
  if (policy.application_status === "OPEN") return "border-emerald-200 bg-emerald-50/50";
  return "border-indigo-200 bg-indigo-50/40";
}

export function policyRank(result: EligibilityResult | undefined, policy: PolicyCatalogItem) {
  if (!result) return 99;
  if (result.status === "ELIGIBLE" && policy.application_status === "OPEN") return 0;
  if (result.status === "ELIGIBLE" && policy.application_status === "UPCOMING") return 1;
  if (result.status === "NEEDS_MORE_INFORMATION" && ["OPEN", "UPCOMING"].includes(policy.application_status)) return 2;
  if (result.status === "ELIGIBLE") return 3;
  if (result.status === "NEEDS_MORE_INFORMATION") return 4;
  return 5;
}
