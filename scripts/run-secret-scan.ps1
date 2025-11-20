param(
  [switch]$UpdateBaseline
)

Write-Host "Running detect-secrets scan (PowerShell)..."
if (-not (Get-Command detect-secrets -ErrorAction SilentlyContinue)) {
  Write-Host "detect-secrets not found. Install with: pip install detect-secrets" -ForegroundColor Yellow
  exit 2
}

if ($UpdateBaseline) {
  detect-secrets scan --update .secrets.baseline
} else {
  detect-secrets scan --baseline .secrets.baseline > scan-output.txt
  $rc = $LASTEXITCODE
  if ($rc -ne 0) {
    Write-Host "Potential secrets found. Inspect scan-output.txt and update .secrets.baseline if intentional." -ForegroundColor Red
    exit 1
  }
}
