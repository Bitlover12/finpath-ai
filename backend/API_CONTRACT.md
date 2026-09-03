# FinPath API Contract — Production Freeze 2026-08-30

## Endpoints

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/health` | - | health JSON |
| GET | `/api/policies` | - | `list[Policy]` |
| POST | `/api/eligibility` | `EligibilityRequest` | `EligibilityResponse` |
| POST | `/api/simulate` | `SimulationRequest` | `SimulationResponse` |
| POST | `/api/optimize` | `AnalyzeRequest` | optimizer JSON + `PolicyAnalysis` |
| POST | `/api/goal-seek` | `GoalSeekRequest` | `GoalSeekingResult` |
| POST | `/api/analyze` | `AnalyzeRequest` | `AnalyzeResponse` |
| POST | `/api/scenario/parse` | `ScenarioParseRequest` | `ScenarioParseResponse` |
| POST | `/api/scenario/apply` | `ScenarioApplyRequest` | `AnalyzeResponse` |
| GET | `/api/demo/{A|B|C}` | - | `AnalyzeResponse` |

## Production semantics

- `income_conditions` use AND semantics.
- Eligibility precedence: known failure → `INELIGIBLE`; otherwise missing field/manual confirmation → `NEEDS_MORE_INFORMATION`; otherwise `ELIGIBLE`.
- Eligibility is qualification-only. Current application availability is separate in `application_status`.
- `CLOSED` and `CHECK_REQUIRED` policies are never selected by Optimizer.
- `UPCOMING` may be included in planning simulation, but `application_period_text` must be shown to the user.
- Complex official criteria that cannot be safely derived from the current numeric profile are represented as `manual_requirements`; they are not guessed.
- `PolicyAnalysis` is the analyze-view model that joins pure eligibility with standalone benefit, selection and allocation metadata.
- Test policies under `test_policies.json` are synthetic and must never be presented as real policy products.
- `FINPATH_POLICY_DATASET=production` loads only `production_policies.json` and never falls back to `TEST_*` data.

## Spending / Card Optimization (MVP extension)

### GET `/api/cards`
Returns the current verified representative card catalog used by the MVP card-benefit simulator.

### POST `/api/spending/recommend`
Request:
```json
{
  "profile": { "...": "UserProfile" },
  "spending": {
    "categories": { "DELIVERY": 150000, "CAFE": 80000 },
    "current_card_id": null,
    "card_type_preference": "BOTH",
    "cut_percent": 10
  }
}
```
Response includes the discretionary-spend adjustment scenario, TOP 3 cards that meet their spending threshold **without increasing current spending**, net monthly card benefit after annual-fee allocation, and a full FinPath re-analysis with the extra monthly savings redirected to `monthly_saving_capacity`.

### POST `/api/spending/upload`
Multipart form field `file`; CSV/XLSX/XLSM up to 5 MB. Returns categorized transactions and monthly category averages. Uploaded bytes are processed in-memory and are not persisted by the API.

## Financial Digital Twin APIs

### POST `/api/opportunity-radar`
Input: `{ "profile": UserProfile }`

Returns a grounded opportunity radar built from the production policy dataset and deterministic eligibility/finance engine:
- `now_available`: currently open + confirmed eligible policies
- `verify_required`: policies blocked on unresolved manual/household conditions
- `upcoming`: condition-eligible/conditional policies whose application status is upcoming
- `deadline_alerts`: open policies with a known end date within the near-term window
- `cliffs`: numeric eligibility boundaries (income/age/employment duration) where policy status changes, including recalculated long-term asset/support delta
- `sensitivities`: categorical dimensions such as company size/region/employment type that can invalidate relevant policies
- `action_plan`: grounded next actions only

The radar never assumes non-assumable manual requirements and never fabricates a recruitment date.

### POST `/api/scenario/compare`
Input: `{ "profile": UserProfile, "changes": ScenarioChange[] }`

Runs the full deterministic engine twice (BEFORE / AFTER) and returns:
- applied structured changes
- gained/lost policy opportunities
- selected-path/allocation changes
- final asset delta
- government-support delta
- tax-benefit delta
- goal-status/shortfall delta

The natural-language parser may produce the `changes`, but the parser/LLM does not calculate money.
