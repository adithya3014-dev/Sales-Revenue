# Connects local MySQL Workbench and Backend to the GitHub Live Link
$ErrorActionPreference = "Stop"

# Determine directory
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
$cloudflaredPath = "$projDir\cloudflared.exe"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "    REVORA Intelligence: MySQL - GitHub Live Connector      " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Verify MySQL
Write-Host "[1/4] Checking MySQL Database connection..." -ForegroundColor Cyan
Push-Location $backendDir
try {
    $testScript = "require('dotenv').config({ path: '../.env' }); const { initializeDatabase } = require('./config/db'); initializeDatabase().then(() => { console.log('OK'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); })"
    $res = & node -e "$testScript" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Database connection failed: $res" -ForegroundColor Red
        Write-Host "Please ensure MySQL Server is running on port 3306 and password is ADITHYA@3014" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] MySQL connected successfully (Database: sales_revenue_dashboard)" -ForegroundColor Green
} catch {
    Write-Host "Error checking MySQL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

# 2. Start Backend Server
Write-Host "[2/4] Starting local Express Backend on port 5000..." -ForegroundColor Cyan
$backendProc = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $backendDir -PassThru -NoNewWindow
Start-Sleep -Seconds 3

# Verify backend health
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($health.status -eq "ok") {
        Write-Host "[OK] Backend API is running on http://localhost:5000" -ForegroundColor Green
    } else {
        Write-Host "[!] Backend responded but with unexpected status" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[!] Waiting for backend to finish booting..." -ForegroundColor Yellow
}

# 3. Start Cloudflare Tunnel
Write-Host "[3/4] Establishing secure HTTPS Cloudflare Tunnel for GitHub Live Link..." -ForegroundColor Cyan
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "cloudflared.exe not found at $cloudflaredPath" -ForegroundColor Red
    Stop-Process -Id $backendProc.Id -ErrorAction SilentlyContinue
    exit 1
}

$tunnelLog = "$env:TEMP\revora_tunnel.log"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

$tunnelProc = Start-Process -FilePath $cloudflaredPath -ArgumentList "tunnel --url http://localhost:5000" -RedirectStandardError $tunnelLog -PassThru -NoNewWindow

Write-Host "    Waiting for tunnel URL..." -ForegroundColor Gray
$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $logContent = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($logContent -match 'https:\/\/(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com') {
            $tunnelUrl = $matches[0]
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host "Failed to get tunnel URL within 30 seconds." -ForegroundColor Red
    Stop-Process -Id $backendProc.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $tunnelProc.Id -ErrorAction SilentlyContinue
    exit 1
}

$apiUrl = "$tunnelUrl/api"

# 4. Display Connection Instructions
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " [SUCCESS] Your MySQL database and Backend are LIVE!        " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Live Tunnel URL : $tunnelUrl" -ForegroundColor Cyan
Write-Host " API Endpoint    : $apiUrl" -ForegroundColor Cyan
Write-Host " Local MySQL DB  : sales_revenue_dashboard (MySQL Workbench)" -ForegroundColor Cyan
Write-Host ""
Write-Host "=== HOW TO CONNECT YOUR GITHUB LIVE LINK ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "OPTION 1 (Instant Click): Open this link in your browser:" -ForegroundColor White
Write-Host "https://adithya3014-dev.github.io/Sales-Revenue/?api=$apiUrl" -ForegroundColor Green
Write-Host ""
Write-Host "OPTION 2 (Browser Console):" -ForegroundColor White
Write-Host "1. Open https://adithya3014-dev.github.io/Sales-Revenue/" -ForegroundColor Gray
Write-Host "2. Press F12 -> Console" -ForegroundColor Gray
Write-Host "3. Paste and run:" -ForegroundColor Gray
Write-Host "   localStorage.setItem('revora_api_url', '$apiUrl'); location.reload();" -ForegroundColor Yellow
Write-Host ""
Write-Host "=== IN MYSQL WORKBENCH ===" -ForegroundColor Yellow
Write-Host "1. Open MySQL Workbench and connect to Local Instance (Port 3306)." -ForegroundColor Gray
Write-Host "2. In the SCHEMAS sidebar, refresh and expand 'sales_revenue_dashboard'." -ForegroundColor Gray
Write-Host "3. Any changes you make or imports done through the live link appear in MySQL Workbench!" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the backend and tunnel when you are done." -ForegroundColor Gray

try {
    while ($true) {
        Start-Sleep -Seconds 2
        if ($backendProc.HasExited -or $tunnelProc.HasExited) {
            Write-Host "[!] One of the processes stopped. Exiting." -ForegroundColor Yellow
            break
        }
    }
} finally {
    Write-Host "`nStopping backend and tunnel..." -ForegroundColor Yellow
    Stop-Process -Id $backendProc.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $tunnelProc.Id -ErrorAction SilentlyContinue
    Write-Host "Disconnected." -ForegroundColor Green
}
