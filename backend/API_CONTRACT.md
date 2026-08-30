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
