# FinPath 기능명세서 초안

## 핵심 기능
1. 사용자 Profile 입력
2. ELIGIBLE / INELIGIBLE / NEEDS_MORE_INFORMATION 판정
3. 목표기간 초과 정책 Optimizer 제외
4. 정책 단독 증분효과 및 benefit score
5. Top 8 / 최대 4개 조합 / 중복가입 pruning
6. Greedy 월 납입 배분 및 최소납입액 검증
7. 일반저축 Baseline 비교
8. 월 단위 금융 Simulation
9. 정부기여금 지급시점 및 이자부착 여부 처리
10. 만기 과세, 만기목돈 재예치
11. 정책 만기 후 월 납입액 GENERAL_SAVING 이동
12. ACHIEVED / SHORTFALL
13. 월 저축액·기간·초기자산 Goal Seeking
14. DEMO_A/B/C
15. 자연어 What-if → Pydantic 검증 → 사용자 확인 → 재계산
16. LLM 실패 시 deterministic fallback

## 계산 가정
- 정책 가입: ALL_AT_MONTH_0
- 납입: END_OF_MONTH
- 일반 이자소득세: 15.4% 가정
- 정책 세금: Policy TaxTreatment 적용, 기본 AT_MATURITY
- 만기목돈: BaselineConfig 금리로 재예치
- 재예치 이자: horizon 종료 시 과세
- 중도해지: MVP 미지원
- 순차 신규 정책 가입: MVP 미지원

## Demo
- DEMO_A: `Baseline < Target <= Optimized`를 런타임 계산으로 생성
- DEMO_B: 26세/서울/SME/연봉 3,400만원/현재자산 1,500만원/월저축 100만원/목표 2억원/9년 → SHORTFALL을 정상 결과로 표시
- DEMO_C: eligible policy 0개에서도 Baseline과 Goal Seeking 유지
