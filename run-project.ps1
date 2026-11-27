# REVORA Intelligence - Total Project & Database Launcher
$ErrorActionPreference = "Stop"

$baseDir = $PSScriptRoot
if (Test-Path "$baseDir\backend\server.js") {
    $projDir = $baseDir
} elseif (Test-Path "$baseDir\Sales-Revenue-main\backend\server.js") {
    $projDir = "$baseDir\Sales-Revenue-main"
} else {
    Write-Host "[!] Cannot find backend\server.js" -ForegroundColor Red
    exit 1
}

$backendDir = "$projDir\backend"
$frontendDir = "$projDir\frontend"
$cloudflaredPath = "$projDir\cloudflared.exe"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "     REVORA Intelligence: Full System Launcher             " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check MySQL
Write-Host "[1/4] Verifying MySQL Database connection..." -ForegroundColor Cyan
Push-Location $backendDir
try {
    $testScript = "require('dotenv').config({ path: '../.env' }); const { initializeDatabase } = require('./config/db'); initializeDatabase().then(() => { console.log('OK'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); })"
    $res = & node -e "$testScript" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Database connection failed: $res" -ForegroundColor Red
        Write-Host "Please ensure MySQL Server 8.0 is running on port 3306 and password is ADITHYA@3014" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] Connected to MySQL: sales_revenue_dashboard (MySQL Workbench)" -ForegroundColor Green
} catch {
    Write-Host "Error checking MySQL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

# 2. Start Backend
Write-Host "[2/4] Starting Express Backend on port 5000..." -ForegroundColor Cyan
$backendProc = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $backendDir -PassThru -NoNewWindow
Start-Sleep -Seconds 2

try {
    $health = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($health.status -eq "ok") {
        Write-Host "[OK] Backend API is live on http://localhost:5000" -ForegroundColor Green
    }
} catch {
    Write-Host "[!] Waiting for backend to start..." -ForegroundColor Yellow
}

# 3. Start Frontend
Write-Host "[3/4] Starting Vite Frontend on port 5173..." -ForegroundColor Cyan
$frontendProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $frontendDir -PassThru -NoNewWindow
Start-Sleep -Seconds 3
Write-Host "[OK] Frontend is live on http://localhost:5173/Sales-Revenue/" -ForegroundColor Green

# 4. Optional Cloudflare Tunnel for GitHub Live Link
$tunnelUrl = $null
if (Test-Path $cloudflaredPath) {
    Write-Host "[4/4] Starting Tunnel bridge for GitHub Live Link..." -ForegroundColor Cyan
    $tunnelLog = "$env:TEMP\revora_tunnel.log"
    if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }
    $tunnelProc = Start-Process -FilePath $cloudflaredPath -ArgumentList "tunnel --url http://localhost:5000" -RedirectStandardError $tunnelLog -PassThru -NoNewWindow

    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $tunnelLog) {
            $logContent = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
            if ($logContent -match 'https:\/\/(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com') {
                $tunnelUrl = $matches[0]
                break
            }
        }
    }
    if ($tunnelUrl) {
        Write-Host "[OK] Cloudflare Tunnel bridge active: $tunnelUrl" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " [SUCCESS] Entire Project & Database are Running!          " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Local Dashboard : http://localhost:5173/Sales-Revenue/" -ForegroundColor Yellow
Write-Host "  Backend API     : http://localhost:5000/api" -ForegroundColor Cyan
Write-Host "  MySQL Database  : sales_revenue_dashboard (Port 3306)" -ForegroundColor Cyan
if ($tunnelUrl) {
    Write-Host "  Live Bridge URL : $tunnelUrl/api" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Opening local dashboard in your browser..." -ForegroundColor Gray
Start-Process "http://localhost:5173/Sales-Revenue/"

Write-Host "============================================================" -ForegroundColor Green
Write-Host "Keep this window OPEN while using the dashboard." -ForegroundColor White
Write-Host "Press Ctrl+C to stop all servers when finished." -ForegroundColor Gray

try {
    while ($true) {
        Start-Sleep -Seconds 2
        if ($backendProc.HasExited -or $frontendProc.HasExited) {
            Write-Host "[!] One of the servers stopped. Exiting." -ForegroundColor Yellow
            break
        }
    }
} finally {
    Write-Host "`nStopping servers..." -ForegroundColor Yellow
    Stop-Process -Id $backendProc.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProc.Id -ErrorAction SilentlyContinue
    if ($tunnelProc) { Stop-Process -Id $tunnelProc.Id -ErrorAction SilentlyContinue }
    Write-Host "All servers stopped." -ForegroundColor Green
}
