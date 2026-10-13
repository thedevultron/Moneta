#Requires -Version 5.1
<#
  Moneta production start (local PC).
  Usage: powershell -ExecutionPolicy Bypass -File scripts/start-prod.ps1 [-Port 3000]
#>
param([int]$Port = 3000)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (!(Test-Path ".env")) { Copy-Item ".env.example" ".env"; Write-Host "Created .env — paste your GEMINI_API_KEY into it." -ForegroundColor Yellow }
if (!(Test-Path "data")) { New-Item -ItemType Directory -Path "data" | Out-Null }

Write-Host "== Moneta: installing ==" -ForegroundColor Cyan
npm install --no-audit --no-fund
Write-Host "== Moneta: typecheck ==" -ForegroundColor Cyan
npm run typecheck
Write-Host "== Moneta: build ==" -ForegroundColor Cyan
npm run build
Write-Host "== Moneta: starting on http://localhost:$Port ==" -ForegroundColor Green
npm run start -- -p $Port
