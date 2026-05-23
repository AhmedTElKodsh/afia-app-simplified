param(
  [string] $WorkerConfig = "worker/wrangler.jsonc"
)

$ErrorActionPreference = "Stop"

$secretNames = @(
  "ADMIN_TOKEN",
  "GEMINI_API_KEYS",
  "GEMINI_API_KEYS2",
  "GEMINI_API_KEYS3",
  "GEMINI_API_KEYS4",
  "GEMINI_API_KEY",
  "GEMINI_API_KEY2",
  "GEMINI_API_KEY3",
  "GEMINI_API_KEY4",
  "OPENROUTER_API_KEYS",
  "OPENROUTER_API_KEY",
  "OPENROUTER_API_KEY2",
  "OPENROUTER_API_KEY3",
  "OPENROUTER_API_KEY4",
  "OPENROUTER_MODEL_IDS",
  "OPENROUTER_MODEL_ID",
  "GROK_API_KEYS",
  "GROK_API_KEY",
  "GROK_API_KEY2",
  "GROK_API_KEY3",
  "GROK_API_KEY4",
  "GROK_MODEL_ID",
  "GROK_FALLBACK_CONFIDENCE",
  "MODEL_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET"
)

foreach ($name in $secretNames) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Host "Skipping $name because it is not set in this shell."
    continue
  }

  Write-Host "Uploading $name to Cloudflare Workers secrets..."
  $value | npx.cmd wrangler@latest secret put $name --config $WorkerConfig
}
