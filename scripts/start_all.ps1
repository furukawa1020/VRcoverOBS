# VRabater Startup Script
# Launches all services in separate windows

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Starting VRabater System...            " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Gateway
Write-Host "1. Starting Gateway..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "Write-Host 'Gateway Service'; cd apps\gateway; node index.js; if (\$?) { Write-Host 'Gateway Stopped' } else { Write-Error 'Gateway Failed'; Read-Host 'Press Enter to close...' }"

Start-Sleep -Seconds 2

# 2. Web UI
Write-Host "2. Starting Web UI..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "Write-Host 'Web UI'; cd apps\web; npm run dev"

Start-Sleep -Seconds 2

# 3. AI Service
Write-Host "3. Starting AI Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "Write-Host 'AI Service'; cd apps\ai; python main.py"

# 4. OpenSeeFace (Face Tracking)
Write-Host "4. Starting OpenSeeFace..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "Write-Host 'Face Tracker'; python tools/OpenSeeFace/facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1"

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green

Write-Host ""
Write-Host "📋 Access Points:" -ForegroundColor White
Write-Host "   Web UI:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Gateway: ws://localhost:8080" -ForegroundColor Cyan
Write-Host "   AI API:  http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️ OpenSeeFace needs to be started manually if needed:" -ForegroundColor Yellow
Write-Host "   python tools/OpenSeeFace/facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1" -ForegroundColor Gray

Write-Host ""
Write-Host "Press Enter to exit this launcher (services will keep running)..."
Read-Host
