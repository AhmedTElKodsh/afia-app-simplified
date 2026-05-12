$ErrorActionPreference = "Stop"

Write-Host "Afia Symphony verification"

pnpm --filter @afia/shared test
pnpm --filter worker test
pnpm --filter web test
pnpm build

Write-Host "Verification complete."
