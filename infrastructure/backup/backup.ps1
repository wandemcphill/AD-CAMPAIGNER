param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$OutputDir = "backups"
)

if (-not $DatabaseUrl) {
  throw "DATABASE_URL is required for backups."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputDir "fliptrybe-$timestamp.sql"

pg_dump $DatabaseUrl --file $output
Write-Output "Backup written to $output"
