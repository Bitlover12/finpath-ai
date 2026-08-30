# FinPath Deployment — Production

## 0. Predeploy

로컬에서 먼저:

```powershell
.\predeploy_check.ps1
```

Backend `31 passed`, Frontend `npm run build` PASS 후 배포한다.

## 1. Backend — Railway

Repository 전체를 Railway 프로젝트에 연결한다. Railway는 repository root의 `railway.toml`과 `backend/Dockerfile`을 사용한다.

필수 환경변수:

```text
FINPATH_POLICY_DATASET=production
FINPATH_BASELINE_RATE=0.0321
FINPATH_BASELINE_SOURCE=한국은행 2026년 7월 금융기관 가중평균금리
FINPATH_BASELINE_SOURCE_URL=https://www.bok.or.kr/portal/main/main.do
FINPATH_BASELINE_CHECKED_AT=2026-08-26
FINPATH_CORS_ORIGINS=http://localhost:3000
```

선택:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
```

AI Key가 없어도 deterministic fallback parser로 What-if가 작동한다.

Health check: `/health`

Railway public backend URL이 발급되면 `https://<railway-domain>/health`에서 `{"status":"ok"}` 확인.

## 2. Frontend — Vercel

같은 repository를 Vercel에 Import한다.

```text
Framework Preset: Next.js
Root Directory: frontend
```

Production Environment Variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://<railway-domain>
```

Deploy 후 Vercel production URL을 기록한다.

## 3. Railway CORS 최종 설정

Vercel URL이 나온 뒤 Railway 환경변수를 수정한다.

```text
FINPATH_CORS_ORIGINS=https://<your-vercel-domain>,http://localhost:3000,http://127.0.0.1:3000
```

Railway를 재배포/재시작한다.

## 4. Production Smoke Test

Backend:
- `/health` → 200
- `/api/policies` → production policies
- `/api/demo/A` → ACHIEVED
- `/api/demo/B` → SHORTFALL
- `/api/demo/C` → selected policy 0

Frontend:
- `/`
- `/profile`
- `/analysis`
- `/dashboard`
- `/scenario`

User flow:
1. Demo B
2. Eligibility
3. Baseline VS FinPath
4. Goal Seeking
5. What-if `대기업으로 이직하고 연봉이 4500만원이 되면?`
6. 확인 후 재계산
7. 정책/자산/로드맵 변화 확인

외부 QA:
- Incognito
- Mobile viewport
- 다른 네트워크
- Backend restart
- LLM API unavailable fallback

## 5. Submission Safety

제출용 Railway는 반드시 `FINPATH_POLICY_DATASET=production`. Test dataset을 제출용 서비스에 사용하지 않는다. 모집 예정/검토 정책은 현재 가입 가능 상품처럼 표현하지 않는다.
