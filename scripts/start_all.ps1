# VRabater Startup Script
# Launches all services in separate windows

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Starting VRabater System...            " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Determine absolute paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# 1. Gateway
Write-Host "1. Starting Gateway..." -ForegroundColor Yellow
$GatewayScript = Join-Path $ProjectRoot "apps\gateway\start_gateway.bat"
Start-Process -FilePath "$GatewayScript"
# Write-Host "   (Gateway is managed by AI Agent)" -ForegroundColor Gray

Start-Sleep -Seconds 2

# 2. Web UI
Write-Host "2. Starting Web UI..." -ForegroundColor Yellow
$WebDir = Join-Path $ProjectRoot "apps\web"
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "Write-Host 'Web UI'; cd '$WebDir'; npm run dev"

Start-Sleep -Seconds 2

# 3. AI Service
Write-Host "3. Starting AI Service..." -ForegroundColor Yellow
$AIDir = Join-Path $ProjectRoot "apps\ai"
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "Write-Host 'AI Service (Tracking Only)'; cd '$AIDir'; .\venv\Scripts\python.exe main.py"

# 4. OpenSeeFace (Face Tracking) - Disabled (Using MediaPipe Holistic)
# Write-Host "4. Starting OpenSeeFace..." -ForegroundColor Yellow
# $OSFDir = Join-Path $ProjectRoot "tools\OpenSeeFace"
# Note: OSF needs to run from project root or tools dir usually, but let's try explicit path
# Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "Write-Host 'Face Tracker'; cd '$ProjectRoot'; python tools/OpenSeeFace/facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green

Write-Host ""
Write-Host "📋 Access Points:" -ForegroundColor White
Write-Host "   Web UI:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Gateway: ws://127.0.0.1:8080" -ForegroundColor Cyan
Write-Host "   AI API:  http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️ OpenSeeFace needs to be started manually if needed:" -ForegroundColor Yellow
Write-Host "   python tools/OpenSeeFace/facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1" -ForegroundColor Gray

Write-Host ""
Write-Host "Press Enter to exit this launcher (services will keep running)..."
Read-Host
