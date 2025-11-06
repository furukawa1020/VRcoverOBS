# VRabater AI Service - Python 3.11 Setup
Write-Host "`nPython 3.11 Setup`n" -ForegroundColor Cyan

# Python 3.11のパスを探す
$python311Paths = @(
    "C:\Python311\python.exe",
    "C:\Program Files\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
)

$pythonExe = $null
foreach ($path in $python311Paths) {
    if (Test-Path $path) {
        $pythonExe = $path
        Write-Host "✅ Python 3.11 検出: $path" -ForegroundColor Green
        break
    }
}

if (-not $pythonExe) {
    # Search in PATH
    $pythonExe = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
    if ($pythonExe) {
        $version = & $pythonExe --version 2>&1
        if ($version -match "Python 3\.11") {
            Write-Host "OK Python 3.11: $pythonExe" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Python 3.11 not found" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "ERROR: Python not found" -ForegroundColor Red
        exit 1
    }
}

# 既存の仮想環境を削除
if (Test-Path "venv") {
    Write-Host "🗑️ 既存の仮想環境を削除中..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force venv
}

# 仮想環境作成
Write-Host "`n📦 仮想環境作成中..." -ForegroundColor Cyan
& $pythonExe -m venv venv

if (-not (Test-Path "venv\Scripts\activate.ps1")) {
    Write-Host "❌ 仮想環境の作成に失敗しました。" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 仮想環境作成完了" -ForegroundColor Green

# 仮想環境をアクティベート
Write-Host "`n🔌 仮想環境をアクティベート中..." -ForegroundColor Cyan
& ".\venv\Scripts\Activate.ps1"

# pipアップグレード
Write-Host "`n⬆️ pipアップグレード中..." -ForegroundColor Cyan
& ".\venv\Scripts\python.exe" -m pip install --upgrade pip

# 依存パッケージインストール
Write-Host "`n📥 依存パッケージインストール中..." -ForegroundColor Cyan
Write-Host "   - MediaPipe (体トラッキング)" -ForegroundColor White
Write-Host "   - OpenCV (カメラ処理)" -ForegroundColor White
Write-Host "   - Whisper (音声認識)" -ForegroundColor White
Write-Host "   - Flask (Webサーバー)" -ForegroundColor White

& ".\venv\Scripts\pip.exe" install `
    mediapipe `
    opencv-python `
    python-osc `
    openai-whisper `
    flask `
    flask-cors `
    sounddevice `
    scipy `
    requests `
    numpy

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ すべてのパッケージインストール完了！`n" -ForegroundColor Green
    Write-Host "🚀 次のコマンドでAIサービスを起動:" -ForegroundColor Cyan
    Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "   python main.py`n" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ パッケージインストール中にエラーが発生しました。" -ForegroundColor Red
    exit 1
}
