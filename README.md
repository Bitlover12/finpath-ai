# FinPath MVP

2026 금융 AI Challenge용 정책금융·저축형 자산형성 네비게이터 MVP.

## 현재 구현 범위

- FastAPI `/health`
- UserProfile / Policy / Income / Contribution Tier Schema
- `ELIGIBLE / INELIGIBLE / NEEDS_MORE_INFORMATION`
- Known failure > missing info > eligible precedence
- 월 단위 금융 Simulation
- 일반 이자소득세 15.4% 가정 / 정책 TAX_FREE·REDUCED 처리
- 정부기여금 MONTHLY_ACCRUAL / AT_MATURITY
- 정책 만기 후 목돈 재예치
- 정책 만기 후 월 납입액 GENERAL_SAVING 자동 이동
- Baseline vs Optimized
- Standalone incremental benefit / benefit score
- Top 8 / 최대 4개 조합 / incompatibility pruning
- Greedy allocation / 최소납입액 / 0원 정책 제거 / allocation dedupe
- Goal ACHIEVED / SHORTFALL
- Required monthly saving / duration / initial assets
- Goal-time-saved 표시 제한
- DEMO_A / B / C
- `/profile`, `/analysis`, `/dashboard`, `/scenario`
- 자연어 What-if parser: OpenAI API 선택 연동 + deterministic fallback
- Railway/Vercel 배포 파일
- 기획서/기능명세 초안
- 2026 공식 정책 Research Seed 12건

## 중요: 정책 데이터 상태

기본 `FINPATH_POLICY_DATASET=test`는 **엔진 검증용 synthetic TEST 정책**을 사용한다. 테스트 데이터는 실제 금융상품으로 표시하지 않는다.

`backend/app/data/policy_research_2026.json`에는 2026 공식 페이지를 기준으로 조사한 12개 정책/상품 후보를 저장했다. 기준중위소득 %, 건강보험료, 부양의무자 재산, 기업지원금 이원화 등 현재 Frozen Schema가 정확히 표현하지 못하는 조건은 임의 근사하지 않고 `engine_ready=false`로 남겨두었다.

Production Policy Freeze는 2026-08-30 기준 완료되었고, 제출 배포에서는 `FINPATH_POLICY_DATASET=production`을 사용한다. 복잡조건은 `NEEDS_MORE_INFORMATION`/사용자 확인으로 보수적으로 처리한다.

## Baseline

기본값은 한국은행 2026년 7월 예금은행 신규취급액 기준 저축성수신금리 **연 3.21%**를 비교 기준으로 사용한다. 환경변수로 변경 가능하다.

## Backend 실행 — Windows PowerShell

가장 간단한 방법:

```powershell
.\run_backend.ps1
```

또는 직접:

```powershell
cd backend
& "C:\Users\user\miniconda3\envs\ai_bot_py311\Ai\Scripts\python.exe" -m pip install -r requirements.txt
& "C:\Users\user\miniconda3\envs\ai_bot_py311\Ai\Scripts\python.exe" -m pytest -q
& "C:\Users\user\miniconda3\envs\ai_bot_py311\Ai\Scripts\python.exe" -m uvicorn app.main:app --reload
```

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Frontend 실행

새 PowerShell:

```powershell
.\run_frontend.ps1
```

또는:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

접속: `http://localhost:3000`

## Demo

Backend 단독:

- `GET /api/demo/A` — Baseline < Target <= Optimized 자동 생성
- `GET /api/demo/B` — 2억원 / 9년 SHORTFALL
- `GET /api/demo/C` — Eligible Policy 0

Landing에서도 세 Demo를 실행할 수 있다.

## What-if

`OPENAI_API_KEY`와 `OPENAI_MODEL`을 모두 설정하면 `/api/scenario/parse`가 OpenAI Responses API Structured Output을 우선 사용한다. 키/모델이 없거나 호출이 실패하면 deterministic parser로 즉시 fallback한다.

Fallback 예시:

- `대기업으로 이직하고 연봉이 4500만원이 되면?`
- `월 저축액을 +20만원 늘리면?`
- `경기도로 이사하면?`

LLM은 Profile 변경값만 추출하며 금융 계산은 수행하지 않는다.

## 주요 API

- `GET /api/policies`
- `POST /api/eligibility`
- `POST /api/simulate`
- `POST /api/optimize`
- `POST /api/goal-seek`
- `POST /api/analyze`
- `POST /api/scenario/parse`
- `POST /api/scenario/apply`
- `GET /api/demo/{A|B|C}`

## Test

```powershell
cd backend
python -m pytest -q
```

현재 작성된 Backend test suite는 Eligibility, finance, optimizer, Goal Seeking, Demo regression, API, scenario parser를 포함한다.

## 배포

- Frontend: Vercel (`frontend`를 Root Directory로 설정)
- Backend: Railway (`backend/Dockerfile`, root `railway.toml`)
- 자세한 내용: `docs/DEPLOYMENT.md`

## 문서

- `docs/PLANNING_DRAFT.md`
- `docs/FUNCTION_SPEC_DRAFT.md`
- `docs/DEPLOYMENT.md`
- `docs/FINAL_STATUS.md`

## 다음 제출 전 작업

1. 이 QA 패키지 기준 Frontend `npm install && npm audit && npm run build` 재검증
2. Railway에 `FINPATH_POLICY_DATASET=production`으로 Backend 배포
3. Vercel에 Railway API URL을 연결해 Frontend 배포
4. 외부망/CORS/모바일/시크릿모드 최종 QA
5. 기획서·기능명세서 최종 PDF 작성
6. 제출 직전 모집상태 재확인

## Production Policy Freeze (2026-08-30)

`backend/app/data/production_policies.json` contains 13 validated policy/product variants based on official 2026 sources. Set `FINPATH_POLICY_DATASET=production` for submission deployment.

Important: qualification and application availability are separate. Complex criteria such as median-income percentages, insurance-premium tests, family assets, exact employment-history evidence, and art-activity certification are surfaced as explicit `NEEDS_MORE_INFORMATION` confirmations rather than inferred.

See `docs/PRODUCTION_POLICY_FREEZE.md` and `docs/FINAL_STATUS.md`.
