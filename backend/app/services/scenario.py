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
    elif "중견기업" in text:
        changes.append(ScenarioChange(field=ScenarioField.COMPANY_SIZE, value=CompanySize.MID.value))
    elif "중소기업" in text:
        changes.append(ScenarioChange(field=ScenarioField.COMPANY_SIZE, value=CompanySize.SME.value))
    elif "공공기관" in text or "공기업" in text:
        changes.append(ScenarioChange(field=ScenarioField.COMPANY_SIZE, value=CompanySize.PUBLIC.value))

    salary = re.search(r"(?:연봉|연소득|소득)[^\d]*(\d[\d,]*(?:\.\d+)?)\s*(억|천만|백만|만)?", text)
    if salary:
        number = float(salary.group(1).replace(",", ""))
        unit = salary.group(2)
        multiplier = {"억": 100_000_000, "천만": 10_000_000, "백만": 1_000_000, "만": 10_000, None: 10_000}[unit]
        income_value = int(number * multiplier)
        if re.search(r"(?:초과|넘)", text[salary.end():]):
            income_value += 1
        changes.append(ScenarioChange(field=ScenarioField.ANNUAL_INCOME, value=income_value))

    # "월 저축액을 20만원 늘리면", "저축 20만원 증가" 같이 숫자가 동사 앞에 오는 문장도 처리한다.
    saving_plus = re.search(r"(?:월)?(?:저축|저축액|저축여력)[^\d]*(\d[\d,]*(?:\.\d+)?)\s*(만)?원?[^\n]*(?:늘|증가|추가)", text)
    if not saving_plus:
        saving_plus = re.search(r"(?:저축|저축액|저축여력)[^\n]*(?:\+|늘|증가|추가)[^\d]*(\d[\d,]*(?:\.\d+)?)\s*(만)?원?", text)
    if saving_plus:
        amount = float(saving_plus.group(1).replace(",", ""))
        multiplier = 10_000 if saving_plus.group(2) == "만" else 1
        changes.append(
            ScenarioChange(
                field=ScenarioField.MONTHLY_SAVING_CAPACITY,
                value={"operation": "ADD", "amount": int(amount * multiplier)},
            )
        )

    employment_years = re.search(r"재직(?:기간)?[^\d]*(\d+)\s*년", text)
    employment_months = re.search(r"재직(?:기간)?[^\d]*(\d+)\s*개월", text)
    if employment_years:
        changes.append(ScenarioChange(field=ScenarioField.EMPLOYMENT_MONTHS, value=int(employment_years.group(1)) * 12))
    elif employment_months:
        changes.append(ScenarioChange(field=ScenarioField.EMPLOYMENT_MONTHS, value=int(employment_months.group(1))))

    age_match = re.search(r"(?:나이|만)[^\d]*(\d+)\s*세", text)
    if age_match:
        changes.append(ScenarioChange(field=ScenarioField.AGE, value=int(age_match.group(1))))

    if "경기도" in text or "경기" in lower:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="GYEONGGI"))
    elif "서울" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="SEOUL"))
    elif "부산" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="BUSAN"))
    elif "인천" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="INCHEON"))
    elif "대전" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="DAEJEON"))
    elif "전북" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="JEONBUK"))
    elif "전남" in text:
        changes.append(ScenarioChange(field=ScenarioField.REGION, value="JEONNAM"))

    employment_map = [
        (("프리랜서",), "FREELANCER"),
        (("자영업", "사업자"), "SELF_EMPLOYED"),
        (("퇴사", "무직"), "UNEMPLOYED"),
    ]
    for keywords, value in employment_map:
        if any(k in text for k in keywords):
            changes.append(ScenarioChange(field=ScenarioField.EMPLOYMENT_TYPE, value=value))
            break

    # Keep the first occurrence for each field so a single sentence cannot create
    # conflicting duplicate changes through overlapping fallback patterns.
    deduped: list[ScenarioChange] = []
    seen: set[ScenarioField] = set()
    for change in changes:
        if change.field in seen:
            continue
        seen.add(change.field)
        deduped.append(change)
    return ScenarioParseResponse(changes=deduped, notice=NOTICE)


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
