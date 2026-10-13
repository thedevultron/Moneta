#Requires -Version 5.1
<#
  Expose Moneta to the internet via Cloudflare quick tunnel (free, HTTPS, no router config).
  Prereqs: Moneta running locally (scripts/start-prod.ps1), cloudflared installed:
    winget install --id Cloudflare.cloudflared
  Usage: powershell -ExecutionPolicy Bypass -File scripts/expose-cloudflared.ps1 [-Port 3000]
#>
param([int]$Port = 3000)
$ErrorActionPreference = "Stop"

if (!(Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host "cloudflared not found. Install it first:" -ForegroundColor Yellow
  Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor White
  exit 1
}
Write-Host "== Exposing http://localhost:$Port to the internet ==" -ForegroundColor Cyan
Write-Host "Share the https://*.trycloudflare.com URL. Stop with Ctrl+C." -ForegroundColor Green
cloudflared tunnel --url "http://localhost:$Port"
