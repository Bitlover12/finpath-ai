# FinPath 기획서 초안

## 문제 정의
청년 금융정책은 기관별로 흩어져 있고 연령·소득·지역·고용형태·재직기간·중복가입 조건이 다르다. 정책을 찾아도 사용자는 어떤 상품에 얼마를 배분해야 하는지, 현재 계획으로 목표자산을 달성할 수 있는지, 미달한다면 월 저축액이나 기간을 얼마나 변경해야 하는지 판단하기 어렵다.

## 차별성
FinPath는 정책을 단순 나열하지 않는다.

`Eligibility → 정책별 효과 → 월 저축액 배분 → 장기 시뮬레이션 → 목표판정 → Goal Seeking → What-if 재계산`

즉 정책 검색이 아니라 금융 의사결정을 제공한다.

## 생성형 AI 활용
생성형 AI는 자연어 What-if를 구조화된 프로필 변화로 변환하고 결과 설명에 활용한다. Eligibility, 기여금, 이자, 세금, Optimizer, Goal Seeking은 deterministic backend가 계산한다. AI API가 실패해도 핵심 계산은 계속 동작한다.

## 신뢰성 원칙
- 투자성 상품은 MVP 범위에서 제외
- Rule-based Eligibility
- 계산 가정과 기준금리 출처 공개
- 정보 부족 시 NEEDS_MORE_INFORMATION
- LLM 금융수치 생성 금지
- 실제 정책은 공식 출처·기준일을 보존
- 공식 조건을 현재 스키마로 정확히 표현하지 못하면 임의 근사하지 않고 Research 상태로 유지

## 현재 정책 데이터 상태
엔진 회귀시험과 데모는 synthetic `TEST_*` 정책을 사용한다. `backend/app/data/policy_research_2026.json`에는 2026년 공식자료로 확인한 정책을 별도 저장했고, 중위소득 %, 건강보험료, 부양의무자 재산 등 추가조건을 정확하게 표현할 수 있는 입력 모델을 확정한 뒤 Production dataset으로 승격한다.
