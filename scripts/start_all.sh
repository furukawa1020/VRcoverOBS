#!/bin/bash
# VRabater 一括起動スクリプト（macOS/Linux用）

echo "╔════════════════════════════════════════╗"
echo "║  VRabater 起動中...                    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 1. Gateway起動
echo "🔌 Gateway起動中..."
cd apps/gateway && npm run dev &
GATEWAY_PID=$!

sleep 2

# 2. Web UI起動
echo "🌐 Web UI起動中..."
cd ../web && npm run dev &
WEB_PID=$!

sleep 2

# 3. AI Service起動
echo "🤖 AI Service起動中..."
cd ../ai && python3 main.py &
AI_PID=$!

sleep 3

echo ""
echo "✅ すべてのサービスが起動しました！"
echo ""
echo "📋 アクセス先:"
echo "   Web UI:  http://localhost:5173"
echo "   Gateway: ws://localhost:8080"
echo "   AI API:  http://localhost:5000"
echo ""
echo "⚠️ OpenSeeFaceは別途起動が必要です:"
echo "   python facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1"
echo ""
echo "停止するには Ctrl+C を押してください"

# シグナルハンドラ（終了時にすべてのプロセスを停止）
trap "kill $GATEWAY_PID $WEB_PID $AI_PID; exit" SIGINT SIGTERM

# 待機
wait
