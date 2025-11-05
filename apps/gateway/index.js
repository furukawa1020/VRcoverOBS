/**
 * Gateway - OpenSeeFace → WebSocket ブリッジ
 * OpenSeeFaceからOSC/TCPでトラッキングデータを受信し、
 * WebSocketでWebブラウザに配信する
 */

const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const osc = require('node-osc');

const WS_PORT = 8080;
const OSC_PORT = 11573; // OpenSeeFaceのデフォルトポート

// WebSocketサーバー
const server = createServer();
const wss = new WebSocketServer({ server });

let connectedClients = new Set();

// WebSocket接続管理
wss.on('connection', (ws) => {
  console.log('✅ クライアント接続:', ws._socket?.remoteAddress);
  connectedClients.add(ws);

  ws.on('close', () => {
    console.log('❌ クライアント切断');
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocketエラー:', error);
    connectedClients.delete(ws);
  });
});

// OpenSeeFace OSCサーバー
const oscServer = new osc.Server(OSC_PORT, '0.0.0.0');

// トラッキングデータのパース用
let trackingData = {
  mouthOpen: 0,
  mouthSmile: 0,
  blink: 0,
  eyebrowUp: 0,
  eyeX: 0,
  eyeY: 0,
  headRotation: { x: 0, y: 0, z: 0 },
  facePosition: { x: 0, y: 0, z: 0 },
  timestamp: Date.now(),
  confidence: 1.0,
};

oscServer.on('message', (msg) => {
  try {
    const [address, ...args] = msg;
    
    // デバッグ: 最初の10メッセージをログ出力
    if (Math.random() < 0.01) { // 1%の確率でログ出力
      console.log('[OSC DEBUG]', address, args);
    }

    // OpenSeeFaceのOSCメッセージをパース
    switch (address) {
      case '/face/mouth/open':
        trackingData.mouthOpen = Math.max(0, Math.min(1, args[0]));
        break;
      case '/face/mouth/smile':
        trackingData.mouthSmile = Math.max(0, Math.min(1, args[0]));
        break;
      case '/face/eye/blink':
        trackingData.blink = Math.max(0, Math.min(1, args[0]));
        break;
      case '/face/eyebrow/up':
        trackingData.eyebrowUp = Math.max(0, Math.min(1, args[0]));
        break;
      case '/face/eye/x':
        trackingData.eyeX = args[0];
        break;
      case '/face/eye/y':
        trackingData.eyeY = args[0];
        break;
      case '/face/head/rotation':
        trackingData.headRotation = {
          x: args[0] || 0, // pitch
          y: args[1] || 0, // yaw
          z: args[2] || 0, // roll
        };
        break;
      case '/face/position':
        trackingData.facePosition = {
          x: args[0] || 0,
          y: args[1] || 0,
          z: args[2] || 0,
        };
        break;
      case '/face/confidence':
        trackingData.confidence = args[0];
        break;
    }

    trackingData.timestamp = Date.now();

    // 接続中のすべてのクライアントにブロードキャスト
    broadcastToClients(trackingData);

  } catch (error) {
    console.error('OSCメッセージ処理エラー:', error);
  }
});

function broadcastToClients(data) {
  const message = JSON.stringify(data);
  
  connectedClients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// サーバー起動
server.listen(WS_PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  VRabater Gateway Server               ║
╠════════════════════════════════════════╣
║  WebSocket: ws://localhost:${WS_PORT}      ║
║  OSC Listen: 0.0.0.0:${OSC_PORT}            ║
╚════════════════════════════════════════╝

⏳ OpenSeeFaceの起動を待機中...

OpenSeeFaceを起動するには:
  python facetracker.py -c 0 -W 640 -H 480 \\
    --discard-after 0 --scan-every 0 --no-3d-adapt 1 \\
    --ip 127.0.0.1 --port ${OSC_PORT}
  `);
});

console.log('✅ OSCサーバー起動:', OSC_PORT);

// エラーハンドリング
oscServer.on('error', (error) => {
  // Malformed Packetエラーは無視(OpenSeeFaceとの互換性問題)
  if (error.message && error.message.includes('Malformed Packet')) {
    return; // 無視
  }
  console.error('❌ OSCサーバーエラー:', error);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Gateway停止中...');
  oscServer.close();
  wss.close();
  process.exit(0);
});
