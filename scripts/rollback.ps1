<#
.SYNOPSIS
  Rollback Afia Worker to previous deployment version
.DESCRIPTION
  Lists recent deployments, rolls back to specified or previous version.
  Dry-run mode with --dry-run flag.
.PARAMETER Environment
  Target environment: staging or production (default: staging)
.PARAMETER DryRun
  If set, only lists versions without rolling back
#>

param(
  [string]$Environment = "staging",
  [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$workerName = if ($Environment -eq "production") { "afia" } else { "afia-stage1" }

Write-Host "=== Afia Worker Rollback ===" -ForegroundColor Cyan
Write-Host "Environment: $Environment"
Write-Host "Worker: $workerName"

# Step 1: List recent deployments
Write-Host "`nFetching recent deployments..." -ForegroundColor Yellow
$deployments = & wrangler deployments list --name $workerName 2>&1
Write-Host $deployments

if ($DryRun) {
  Write-Host "`n[Dry Run] No changes made. To rollback, run without --dry-run." -ForegroundColor Green
  exit 0
}

# Step 2: Confirm rollback
Write-Host "`nWARNING: Rolling back $workerName to previous deployment." -ForegroundColor Red
Write-Host "Continue? (y/N): " -NoNewline
$confirm = Read-Host
if ($confirm -ne "y") {
  Write-Host "Aborted." -ForegroundColor Yellow
  exit 0
}

# Step 3: Execute rollback
Write-Host "`nExecuting rollback..." -ForegroundColor Yellow
try {
  & wrangler rollback --name $workerName 2>&1
  Write-Host "`n✅ Rollback completed." -ForegroundColor Green

  # Step 4: Smoke test
  $baseUrl = if ($Environment -eq "production") { "https://afia.co" } else { "https://afia-stage1.workers.dev" }
  Write-Host "`nRunning smoke test against $baseUrl..." -ForegroundColor Yellow
  $response = try { Invoke-WebRequest -Uri "$baseUrl/api/health" -TimeoutSec 10 } catch { $null }
  if ($response -and $response.StatusCode -eq 200) {
    Write-Host "✅ Smoke test passed (HTTP $($response.StatusCode))" -ForegroundColor Green
  } else {
    Write-Host "❌ Smoke test failed" -ForegroundColor Red
  }
} catch {
  Write-Host "❌ Rollback failed: $_" -ForegroundColor Red
  exit 1
}
