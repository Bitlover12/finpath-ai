# FinPath Financial Digital Twin MVP

## Problem reframing
FinPath does not stop at finding policies that fit the user's current profile. It models the user's current financial state and recalculates how policy eligibility, government support, monthly allocation and long-term assets change when income, employment, age, tenure or region changes.

## 1. Financial Opportunity Radar
The radar separates:
- available now
- requires verification
- upcoming/monitor
- application deadline alerts
- numeric policy cliffs
- categorical sensitivities

Numeric cliffs are discovered from policy-rule boundaries. Each material boundary is run through the same full analysis engine again so the UI can show both the qualification transition and the resulting long-term asset/support delta.

## 2. Policy Cliff Simulator
Natural language is parsed into structured profile changes. The deterministic analysis engine then runs BEFORE and AFTER. The comparison reports gained/lost opportunities, allocation changes, government-support change, tax-benefit change, final-asset change and goal-status change.

The parser never performs financial arithmetic.

## 3. Action Plan
The action plan is generated only from current grounded results:
- verify/apply to an open selected policy
- monitor an upcoming selected policy
- verify unresolved eligibility
- re-check at a known employment-duration threshold
- simulate before crossing a detected policy cliff
- close a goal shortfall using the existing goal-seeking result

## Safety / truthfulness
- Unknown manual conditions stay unknown.
- Closed policies are not optimized as current recommendations.
- Unknown future recruitment dates are not generated.
- Exact month-to-age-limit is not claimed because the profile stores age, not birth date.
- Policy-cliff money deltas come from full deterministic re-analysis, not an LLM estimate.
