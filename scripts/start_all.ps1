# VRabater 一括起動スクリプト（PowerShell）
# すべてのサービスを同時に起動します

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  VRabater 起動中...                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 1. Gateway起動（バックグラウンド）
Write-Host "🔌 Gateway起動中..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\gateway; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# 2. Web UI起動（バックグラウンド）
Write-Host "🌐 Web UI起動中..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\web; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# 3. AI Service起動（バックグラウンド）
Write-Host "🤖 AI Service起動中..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\ai; python main.py" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ すべてのサービスが起動しました！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 アクセス先:" -ForegroundColor White
Write-Host "   Web UI:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Gateway: ws://localhost:8080" -ForegroundColor Cyan
Write-Host "   AI API:  http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️ OpenSeeFaceは別途起動が必要です:" -ForegroundColor Yellow
Write-Host "   python facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1" -ForegroundColor Gray
Write-Host ""
Write-Host "停止するには各ウィンドウでCtrl+Cを押してください" -ForegroundColor White

# このウィンドウは開いたままにする
Read-Host "Press Enter to exit..."

