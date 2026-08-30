# FinPath Backend

## Run

```powershell
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

## Test

```powershell
python -m pytest -q
```

## STEP 2

STEP 2 freezes data/API contracts only. It does **not** implement eligibility decisions or any financial calculation.

Key files:

- `app/models/profile.py`
- `app/models/policy.py`
- `app/models/results.py`
- `app/models/contracts.py`
- `app/models/config.py`
- `app/data/test_policies.json`
- `API_CONTRACT.md`
- `API_SCHEMA_SNAPSHOT.json`
