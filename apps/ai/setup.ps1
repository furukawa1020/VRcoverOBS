Write-Host "Python 3.11 Virtual Environment Setup" -ForegroundColor Cyan

# Find Python 3.11
$python311 = $null
$paths = @(
    "C:\Python311\python.exe",
    "C:\Program Files\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        $python311 = $p
        Write-Host "Found: $p" -ForegroundColor Green
        break
    }
}

if (-not $python311) {
    Write-Host "Python 3.11 not found. Please install it." -ForegroundColor Red
    exit 1
}

# Remove old venv
if (Test-Path "venv") {
    Write-Host "Removing old venv..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force venv
}

# Create venv
Write-Host "Creating venv..." -ForegroundColor Cyan
& $python311 -m venv venv

# Activate and install
Write-Host "Installing packages..." -ForegroundColor Cyan
& ".\venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\venv\Scripts\pip.exe" install mediapipe opencv-python python-osc openai-whisper flask flask-cors sounddevice scipy requests numpy

Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "To start: .\venv\Scripts\python.exe main.py" -ForegroundColor Yellow
