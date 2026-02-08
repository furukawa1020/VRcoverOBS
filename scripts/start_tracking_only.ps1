# Start ONLY the Body/Face Tracker
Write-Host "Starting Body & Face Tracker (No AI)..." -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$AIDir = Join-Path $ProjectRoot "apps\ai"

# Kill existing python processes to be safe
# taskkill /F /IM python.exe /T 2>$null

cd $AIDir
.\venv\Scripts\python.exe body_tracker.py
