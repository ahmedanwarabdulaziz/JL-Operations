# One-time setup: set Firebase secrets and deploy functions.
# Run from repo root: .\scripts\set-firebase-secrets.ps1
# Requires: Firebase CLI and being logged in (firebase login).

$ErrorActionPreference = "Stop"
# Script lives in JL-Operations/scripts; project root is JL-Operations
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "firebase.json"))) { $root = "D:\Res\JL\JL-Operations" }
Set-Location $root

# Use project from firebase config (jl-operation)
$project = "jl-operation"
Write-Host "Using Firebase project: $project"
& firebase use $project
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$files = @{
  GMAIL_USER = "functions\.secrets-gmail-user.txt"
  GMAIL_APP_PASSWORD = "functions\.secrets-gmail-pass.txt"
  PIN_HASH = "functions\.secrets-pin-hash.txt"
  JWT_SECRET = "functions\.secrets-jwt.txt"
}

foreach ($name in $files.Keys) {
  $path = Join-Path $root $files[$name]
  if (-not (Test-Path $path)) { Write-Error "Missing $path" }
  Write-Host "Setting $name..."
  & firebase functions:secrets:set $name --data-file $path --project $project
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Deploying functions..."
& firebase deploy --only functions --project $project
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Removing local secret files..."
foreach ($path in $files.Values) {
  $full = Join-Path $root $path
  if (Test-Path $full) { Remove-Item $full -Force }
}
Write-Host "Done."
