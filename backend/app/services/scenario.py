from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

from app.models.contracts import ScenarioChange, ScenarioParseResponse
from app.models.enums import CompanySize, ScenarioField

NOTICE = "FinPath MVP는 현재 시점에서 해당 조건으로 변경되었다고 가정하여 계산합니다."


def _korean_money_to_int(text: str) -> int | None:
    compact = text.replace(",", "").replace(" ", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*(억|천만|백만|만)?원?", compact)
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2)
    multiplier = {"억": 100_000_000, "천만": 10_000_000, "백만": 1_000_000, "만": 10_000, None: 1}[unit]
    return int(value * multiplier)


def fallback_parse(text: str) -> ScenarioParseResponse:
    changes: list[ScenarioChange] = []
    lower = text.lower().replace(" ", "")

    if "대기업" in text:
        changes.append(ScenarioChange(field=ScenarioField.COMPANY_SIZE, value=CompanySize.LARGE.value))
    elif "중소기업" in text:
        changes.append(ScenarioChange(field=ScenarioField.COMPANY_SIZE, value=CompanySize.SME.value))

    salary = re.search(r"(?:연봉|소득)[^\d]*(\d[\d,]*(?:\.\d+)?)\s*(억|천만|백만|만)?", text)
    if salary:
        number = float(salary.group(1).replace(",", ""))
        unit = salary.group(2)
        multiplier = {"억": 100_000_000, "천만": 10_000_000, "백만": 1_000_000, "만": 10_000, None: 10_000}[unit]
        changes.append(ScenarioChange(field=ScenarioField.ANNUAL_INCOME, value=int(number * multiplier)))

    saving_plus = re.search(r"(?:저축|저축액)[^\d]*(?:\+|늘|증가)[^\d]*(\d[\d,]*)\s*만", text)
    if saving_plus:
        changes.append(
            ScenarioChange(
                field=ScenarioField.MONTHLY_SAVING_CAPACITY,
                value={"operation": "ADD", "amount": int(saving_plus.group(1).replace(",", "")) * 10_000},
            )
        )

    if "경기도" in text or "경기" in lower:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="GYEONGGI"))
    elif "서울" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="SEOUL"))
    elif "부산" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="BUSAN"))
    elif "인천" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="INCHEON"))

    return ScenarioParseResponse(changes=changes, notice=NOTICE)


def _extract_output_text(payload: dict[str, Any]) -> str | None:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    for item in payload.get("output", []):
        for content in item.get("content", []) if isinstance(item, dict) else []:
            if isinstance(content, dict) and content.get("type") == "output_text":
                return content.get("text")
    return None


def llm_parse(text: str) -> ScenarioParseResponse | None:
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL")
    if not api_key or not model:
        return None
    schema = {
        "type": "object",
        "properties": {
            "changes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "field": {"type": "string", "enum": [v.value for v in ScenarioField]},
                        "value": {},
                    },
                    "required": ["field", "value"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["changes"],
        "additionalProperties": False,
    }
    body = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "Extract only current-profile changes for FinPath. Do not calculate finance. "
                            "Ignore future timing such as next year; only return changed fields. "
                            "Use KRW integers for money and enum-like uppercase values where obvious."
                        ),
                    }
                ],
            },
            {"role": "user", "content": [{"type": "input_text", "text": text}]},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "finpath_scenario_changes",
                "strict": True,
                "schema": schema,
            }
        },
    }
    try:
        response = httpx.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
            timeout=15.0,
        )
        response.raise_for_status()
        output_text = _extract_output_text(response.json())
        if not output_text:
            return None
        parsed = json.loads(output_text)
        return ScenarioParseResponse(
            changes=[ScenarioChange.model_validate(item) for item in parsed.get("changes", [])],
            notice=NOTICE,
        )
    except Exception:
        return None


def parse_scenario(text: str) -> ScenarioParseResponse:
    return llm_parse(text) or fallback_parse(text)
