$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "[local:down] Repo root: $repoRoot"

Write-Host "[local:down] Stopping Supabase local..."
Set-Location $repoRoot
& supabase stop

Write-Host "[local:down] Done."
