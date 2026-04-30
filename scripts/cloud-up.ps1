$ErrorActionPreference = "Stop"

Write-Host "[cloud:up] Starting frontend (cloud mode). Supabase is not started locally because .env points to cloud."

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

& npm run dev
