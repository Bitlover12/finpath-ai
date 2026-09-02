# FinPath Current Status — 2026-09-02

## Engine

- Eligibility / NEEDS_MORE_INFORMATION / known-failure precedence
- Monthly simulation / tax / government contribution / maturity / reinvestment
- Baseline / standalone benefit / candidate pruning / optimizer
- Goal ACHIEVED/SHORTFALL / Goal Seeking / Goal Time Saved
- Natural-language What-if parse + confirmation + full recalculation
- DEMO A/B/C

## Production Policy Freeze

- 15 production variants across 10 official 2026 programs.
- Complex conditions are preserved as explicit user confirmations instead of guessed numeric conversions.
- Application status is separated from qualification status.
- CLOSED/CHECK_REQUIRED policies cannot enter the optimized path.
- Local matching products without a verified numerical product interest rate use 0% policy interest conservatively.
- Youth Future Savings uses only the officially published 5% base rate; bank-specific preferential rates are not assumed.

## Regression

Backend suite after practicality/optimizer QA: `33 passed`.


Practicality regression:
- Hope Savings Account I eligible profile, 500,000 KRW/month total budget: optimizer assigns only 100,000 KRW/month to the matched account and leaves 400,000 KRW/month to general savings.
- 9-year baseline 67,616,513 KRW -> optimized 80,176,135 KRW, additional assets +12,559,622 KRW.
- Government support 10,800,000 KRW; policy interest itself is conservatively modeled at 0% because a single verified product rate is not assumed.

Production dataset HTTP/demo regression:
- DEMO_A: Baseline 141,647,723 < Target 144,000,000 <= Optimized 145,122,965 — ACHIEVED
- DEMO_B: Target 200,000,000 — SHORTFALL, Optimized 145,122,965
- DEMO_C: no selected/eligible youth policy path, Baseline == Optimized 43,581,186

## Remaining before submission

1. Re-run frontend `npm install && npm audit && npm run build` on the final QA package locally.
2. Railway deployment with `FINPATH_POLICY_DATASET=production`.
3. Vercel deployment with Railway API base URL.
4. External-network/CORS/mobile/incognito QA.
5. Convert planning/function-spec drafts into official submission PDFs.
6. Recheck Youth Future Savings additional enrollment status immediately before submission and update `application_status/application_period_text` if the FSC publishes a confirmed September schedule.
