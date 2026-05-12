$ErrorActionPreference = "Stop"

Write-Host "Afia Symphony preflight"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is required for Afia Stage 1 validation."
}

if (-not (Test-Path "package.json")) {
  throw "Run this hook from the Afia repository root."
}

if (-not (Test-Path "docs/project-context.md")) {
  throw "Missing docs/project-context.md. Agents need the compact Afia project context."
}

if (-not (Test-Path ".kiro/specs/stage1-llm-api-only/requirements.md")) {
  throw "Missing Stage 1 requirements spec."
}

pnpm --version
pnpm install --frozen-lockfile

Write-Host "Preflight complete."
