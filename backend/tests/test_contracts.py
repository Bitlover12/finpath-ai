import json
from pathlib import Path

from app.models.contracts import ErrorResponse, ScenarioParseResponse


FRONTEND_MOCK_DIR = Path(__file__).resolve().parents[2] / "frontend" / "mock"


def test_backend_error_mock_matches_contract() -> None:
    payload = json.loads((FRONTEND_MOCK_DIR / "backend_error.json").read_text(encoding="utf-8"))
    ErrorResponse.model_validate(payload)


def test_scenario_parse_contract_accepts_frozen_what_if_shape() -> None:
    payload = {
        "changes": [
            {"field": "company_size", "value": "LARGE"},
            {"field": "annual_income", "value": 45_000_000},
        ],
        "notice": "현재 시점에서 변경된 조건으로 계산합니다.",
    }
    result = ScenarioParseResponse.model_validate(payload)
    assert len(result.changes) == 2
