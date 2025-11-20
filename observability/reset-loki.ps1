<#
Reset Loki named volumes and restart observability dev stack.

Run from repository root (PowerShell):
  .\observability\reset-loki.ps1

This will:
 - stop the dev compose stack
 - remove named volumes `loki-data` and `loki-wal`
 - recreate the stack
#>

param()

Write-Host "Stopping observability stack..."
docker compose -f docker-compose.dev.yml down

Write-Host "Removing Loki named volumes (loki-data, loki-wal)..."
try {
    docker volume rm "$(docker compose -f docker-compose.dev.yml ps -q | Out-String)" -ErrorAction SilentlyContinue | Out-Null
} catch {
    # ignore
}

# Remove by name if present
docker volume rm $(docker volume ls -q --filter name=loki-data) -f 2>$null
docker volume rm $(docker volume ls -q --filter name=loki-wal) -f 2>$null

Write-Host "Recreating observability stack (detached)..."
docker compose -f docker-compose.dev.yml up -d

Write-Host "Waiting a few seconds for services to initialize..."
Start-Sleep -Seconds 10

Write-Host "Done. Check Loki readiness: http://localhost:3100/ready"
