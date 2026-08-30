# FinPath Production Policy Freeze — 2026-08-30

## 목적

Synthetic `TEST_*` 정책과 실제 공공정책 데이터를 명확히 분리한다. `FINPATH_POLICY_DATASET=production`에서는 `production_policies.json`만 로드한다.

## Production dataset

총 13개 상품/기간 variant, 8개 정책 프로그램을 구조화했다.

- 청년미래적금: 일반형 / 중소기업 기존재직 우대형 / 신규취업 우대형 / 기여금 미대상 비과세형
- 서울 희망두배 청년통장: 2년 / 3년
- 인천 드림For청년통장
- 부산청년 기쁨두배통장: 2년 / 3년
- 전북청년 함께 두배적금
- 전남 청년 희망디딤돌 통장
- 대전 미래두배 청년통장: 2026 세부공고 확인 필요 상태
- 청년예술인 예술활동 적립계좌

## 신뢰성 규칙

1. 공식 공고에서 금리가 수치로 확인되지 않는 매칭통장은 정책상품 자체 이자를 `0%`로 보수적으로 계산한다. 정부/지자체 매칭금은 공식 확인값만 반영한다.
2. 기준중위소득 %, 건강보험료, 부양의무자 재산, 예술활동증명, 동일기업 재직일 등 현재 UserProfile 숫자만으로 안전하게 환산할 수 없는 조건은 `manual_requirements`로 보존한다.
3. 사용자가 해당 조건을 확인하지 않은 정책은 `NEEDS_MORE_INFORMATION`; 거짓으로 확인한 경우 `INELIGIBLE`이다.
4. Eligibility(조건상 대상 여부)와 ApplicationStatus(현재 신청 가능 여부)를 분리한다.
5. `CLOSED` 및 `CHECK_REQUIRED` 정책은 Optimizer에서 제외한다.
6. `UPCOMING`은 계획 시뮬레이션에 사용할 수 있지만 `application_period_text`의 안내를 반드시 함께 표시한다.
7. 청년미래적금은 기본금리 5%만 계산에 반영하며 은행별 우대금리는 반영하지 않는다.

## 주의

청년미래적금은 2026년 1차 모집이 종료되었고, 금융위원회가 2026년 9월 추가 가입기간 운영을 검토 중이라고 2026-08-11 안내했다. 따라서 본 dataset의 `UPCOMING` 표시는 확정 모집기간을 의미하지 않으며 UI의 일정 미확정 문구와 함께 해석해야 한다.
