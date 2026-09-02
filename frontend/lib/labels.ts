export const eligibilityLabel: Record<string, string> = {
  ELIGIBLE: "가입 가능",
  NEEDS_MORE_INFORMATION: "추가 확인 필요",
  INELIGIBLE: "조건 미충족",
};

export const applicationLabel: Record<string, string> = {
  OPEN: "신청 가능",
  UPCOMING: "모집 예정/검토",
  CLOSED: "신청 마감",
  CHECK_REQUIRED: "일정 확인 필요",
};

export const checkFieldLabel: Record<string, string> = {
  age: "나이",
  income: "소득",
  region: "거주지역",
  company_size: "기업규모",
  employment_type: "고용형태",
  employment_months: "재직기간",
  housing_status: "주택보유",
  marital_status: "혼인여부",
  manual_requirement: "추가 자격요건",
};

export const roadmapTypeLabel: Record<string, string> = {
  POLICY_SAVING: "정책형 저축",
  GENERAL_SAVING: "일반 저축",
  MATURITY_REINVESTMENT: "만기자금 재예치",
};

export const exclusionLabel = (value?: string | null) => {
  if (!value) return null;
  const labels: Record<string, string> = {
    NOT_ELIGIBLE: "가입조건 미충족",
    NEEDS_MORE_INFORMATION: "추가 확인 필요",
    APPLICATION_CLOSED: "현재 신청 마감",
    APPLICATION_CHECK_REQUIRED: "모집일정 확인 필요",
    MATURITY_AFTER_TARGET_HORIZON: "목표기간 이후 만기",
    BELOW_MINIMUM_CONTRIBUTION: "최소 납입액 미만",
    NOT_SELECTED: "다른 조합의 예상자산이 더 높음",
  };
  return labels[value] || value.replaceAll("_", " ").toLowerCase();
};
