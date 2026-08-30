from __future__ import annotations

import os
from datetime import date

from app.models.config import BaselineConfig


def get_baseline_config() -> BaselineConfig:
    return BaselineConfig(
        annual_rate=float(os.getenv("FINPATH_BASELINE_RATE", "0.0321")),
        source_name=os.getenv("FINPATH_BASELINE_SOURCE", "한국은행 2026년 7월 금융기관 가중평균금리"),
        source_url=os.getenv("FINPATH_BASELINE_SOURCE_URL", "https://www.bok.or.kr/portal/main/main.do"),
        checked_at=date.fromisoformat(os.getenv("FINPATH_BASELINE_CHECKED_AT", "2026-08-26")),
    )


def get_policy_dataset_name() -> str:
    return os.getenv("FINPATH_POLICY_DATASET", "test").lower()


def get_cors_origins() -> list[str]:
    raw = os.getenv("FINPATH_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [item.strip() for item in raw.split(",") if item.strip()]


def today_kst():
    """Return the current calendar date in Korea Standard Time (Asia/Seoul)."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo("Asia/Seoul")).date()
