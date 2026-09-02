# FinPath Production Acceptance QA — updated 2026-09-02

## Result

**Backend / financial engine acceptance: PASS**

- Automated tests: **33 passed**
- Randomized invariant profiles: **300 passed**
- Real HTTP smoke: `/health`, `/api/demo/A`, `/api/demo/B`, `/api/demo/C`: PASS
- CORS preflight for `http://localhost:3000`: PASS
- Validation error contract: PASS

## Production Demo Regression

### DEMO_A
- Baseline: 141,647,723 KRW
- Target: 144,000,000 KRW
- Optimized: 145,122,965 KRW
- Goal: ACHIEVED
- Additional assets: 3,475,242 KRW
- Goal time saved: 2 months
- Selected path: YFS preferred-new-hire variant, 500,000 KRW/month

Condition: `Baseline < Target <= Optimized` — PASS.

### DEMO_B
- Baseline: 141,647,723 KRW
- Target: 200,000,000 KRW
- Optimized: 145,122,965 KRW
- Goal: SHORTFALL
- Shortfall: 54,877,035 KRW
- Required monthly saving: 1,449,000 KRW
- Required duration: 148 months
- Required initial assets: 57,780,000 KRW

Boundary verification:
- 1,448,000 KRW/month -> target not reached
- 1,449,000 KRW/month -> target reached
- 147 months -> target not reached
- 148 months -> target reached
- 57,770,000 KRW initial assets -> target not reached
- 57,780,000 KRW initial assets -> target reached

### DEMO_C
- Eligible optimized policies: 0
- Baseline: 43,581,186 KRW
- Optimized: 43,581,186 KRW
- Additional policy effect: 0 KRW
- General-saving roadmap remains available

## Acceptance flows verified

- Known failure takes precedence over missing information.
- Missing manual policy conditions produce `NEEDS_MORE_INFORMATION`.
- Closed policies may be condition-eligible but are excluded from optimization.
- Policies maturing after the target horizon are excluded from optimization.
- Allocation never exceeds the monthly saving budget.
- Zero-allocation policies are not selected.
- Selected policies are ELIGIBLE and application status is OPEN/UPCOMING only.
- Maturity releases the former monthly contribution back to GENERAL_SAVING.
- Maturity lump sum is reinvested and now carries the real calculated `initial_amount` in the roadmap.
- Baseline and optimized trajectory endpoints now equal their after-tax `final_assets` values.
- Scenario fallback parses company size, annual income, monthly-saving increase and region changes.
- Scenario application reruns the deterministic analysis pipeline.
- Invalid scenario value types are rejected before financial calculation.
- API validation errors follow the common `{ "error": ... }` contract.
- Fixed/capped government matching policies are scored at contribution breakpoints instead of blindly filling the account maximum.
- Hard screening facts such as benefit-recipient status are never auto-assumed in the conditional frontend Preview.

## Practicality regression — Hope Savings Account I

For an eligible working livelihood/medical-benefit household that explicitly confirms all official/manual conditions:

- Monthly saving budget: 500,000 KRW
- Optimizer policy allocation: **100,000 KRW** to Hope Savings Account I + **400,000 KRW** to general savings
- Government support: **10,800,000 KRW** over 36 months
- 9-year Baseline: **67,616,513 KRW**
- 9-year FinPath: **80,176,135 KRW**
- Additional assets: **+12,559,622 KRW**

The policy account interest rate is modeled as 0% for this regression; the effect is therefore not inflated by an assumed bank rate. Full government-support payout remains conditional on the official payout requirements.

## Bugs found and fixed during acceptance QA

1. **Baseline chart endpoint mismatch**
   - Previous baseline trajectory ended at a pre-tax balance while `final_assets` was after-tax.
   - Fixed so the final chart point equals the displayed final asset value.

2. **Maturity reinvestment amount placeholder**
   - `MATURITY_REINVESTMENT.initial_amount` was `0`.
   - Replaced with an actual after-tax policy maturity calculation using the same simulation assumptions.

3. **API validation error contract mismatch**
   - FastAPI default 422 response did not match the frozen API contract.
   - Added normalized `VALIDATION_ERROR` responses.

4. **Scenario change type validation**
   - Scenario values were previously `Any` until profile application.
   - Added field-aware validation for numeric/enumerated/string scenario changes.

5. **Redundant manual-confirmation UX after known failure**
   - Analysis UI now offers manual confirmation buttons only while policy status is `NEEDS_MORE_INFORMATION`.

6. **UPCOMING policy plan visibility**
   - Dashboard now explicitly warns when the optimal path contains a policy whose recruitment is upcoming/under review.

## Known MVP scope / non-blocking limitations

- `UPCOMING` policies are allowed in planning simulations. They are not represented as currently open products; the dashboard warns that the result must be recalculated when recruitment is finalized.
- Complex official conditions represented as manual requirements remain user-confirmed simulation inputs and do not replace the administering institution's eligibility review.
- Future dated employment/income events are not simulated on a time axis; What-if changes are applied as current-profile assumptions.
- Some edge eligibility cases such as military-service age deductions and business-sales based income criteria are not fully represented by the current profile schema and should not be claimed as fully automated coverage.

## Frontend verification

The dependency baseline previously passed a production Next.js build on the user's Windows environment. This QA patch changes Analysis/Dashboard JSX only; run the final local command before deployment:

```powershell
cd frontend
npm install
npm audit
npm run build
```

Deployment should not begin if this final patched frontend build fails.
