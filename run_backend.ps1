$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"

if ($env:FINPATH_PYTHON) {
  $Python = $env:FINPATH_PYTHON
} elseif (Test-Path "C:\Users\user\miniconda3\envs\ai_bot_py311\Ai\Scripts\python.exe") {
  $Python = "C:\Users\user\miniconda3\envs\ai_bot_py311\Ai\Scripts\python.exe"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $Python = "py"
} else {
  $Python = "python"
}

Set-Location $Backend
Write-Host "[FinPath] Python: $Python"
if ($Python -eq "py") {
  & py -3.11 -m pip install -r requirements.txt
  & py -3.11 -m pytest -q
  & py -3.11 -m uvicorn app.main:app --reload
} else {
  & $Python -m pip install -r requirements.txt
  & $Python -m pytest -q
  & $Python -m uvicorn app.main:app --reload
}
