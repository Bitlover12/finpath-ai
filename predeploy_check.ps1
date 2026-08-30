$ErrorActionPreference = "Stop"

Write-Host "=== FinPath Predeploy Check ===" -ForegroundColor Cyan

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $repo "backend"
$frontend = Join-Path $repo "frontend"

# Prefer the user's known Python environment, then fall back to py/python.
$knownPython = "C:\Users\user\miniconda3\envs\ai_bot_py311\Ai\Scripts\python.exe"
if (Test-Path $knownPython) {
    $python = $knownPython
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $python = "py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $python = "python"
} else {
    throw "Python interpreter not found."
}

Write-Host "[1/4] Backend dependencies" -ForegroundColor Yellow
Push-Location $backend
if ($python -eq "py") {
    & py -3.11 -m pip install -r requirements.txt
} else {
    & $python -m pip install -r requirements.txt
}

Write-Host "[2/4] Backend tests (production dataset)" -ForegroundColor Yellow
$env:FINPATH_POLICY_DATASET = "production"
if ($python -eq "py") {
    & py -3.11 -m pytest -q
} else {
    & $python -m pytest -q
}
if ($LASTEXITCODE -ne 0) { throw "Backend tests failed." }
Pop-Location

Write-Host "[3/4] Frontend install + audit" -ForegroundColor Yellow
Push-Location $frontend
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
npm audit
if ($LASTEXITCODE -ne 0) {
    Write-Warning "npm audit reported vulnerabilities. Review before deployment. Do NOT run --force blindly."
}

Write-Host "[4/4] Frontend production build" -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
Pop-Location

Write-Host "=== PREDEPLOY CHECK PASS ===" -ForegroundColor Green
Write-Host "Backend tests and frontend production build completed." -ForegroundColor Green
