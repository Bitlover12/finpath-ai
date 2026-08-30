from __future__ import annotations

import json
from pathlib import Path

from app.core.settings import get_policy_dataset_name
from app.models.policy import Policy

DATA_DIR = Path(__file__).resolve().parent


def _load(path: Path) -> list[Policy]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [Policy.model_validate(item) for item in raw]


def load_policies(dataset: str | None = None) -> list[Policy]:
    dataset = (dataset or get_policy_dataset_name()).lower()

    if dataset == "test":
        return _load(DATA_DIR / "test_policies.json")

    if dataset == "production":
        path = DATA_DIR / "production_policies.json"
        if not path.exists():
            raise RuntimeError(
                "FINPATH_POLICY_DATASET=production was requested, but "
                "backend/app/data/production_policies.json does not exist. "
                "Complete Production Policy Freeze before enabling production data."
            )
        return _load(path)

    raise ValueError(f"Unknown policy dataset: {dataset!r}. Expected 'test' or 'production'.")
