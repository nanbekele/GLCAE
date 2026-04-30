$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "[local:up] Repo root: $repoRoot"

# 1) Ensure Supabase local stack is running
Write-Host "[local:up] Starting Supabase local..."
& supabase start

# 2) Serve Edge Functions in a background process (optional)
$functionsEnv = Join-Path $repoRoot "supabase\functions\.env.local"
if (Test-Path $functionsEnv) {
  Write-Host "[local:up] Serving Edge Functions with env file: $functionsEnv"
  Start-Process -FilePath "supabase" -ArgumentList @("functions", "serve", "--env-file", $functionsEnv) -WorkingDirectory $repoRoot | Out-Null
} else {
  Write-Host "[local:up] Serving Edge Functions (no env file found at $functionsEnv)"
  Start-Process -FilePath "supabase" -ArgumentList @("functions", "serve") -WorkingDirectory $repoRoot | Out-Null
}

# 3) Start the frontend dev server (foreground)
Write-Host "[local:up] Starting frontend dev server..."
Set-Location $repoRoot
& npm run dev
