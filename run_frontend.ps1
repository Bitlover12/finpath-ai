$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "frontend")
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
}
npm install
npm run dev
