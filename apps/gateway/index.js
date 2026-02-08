/**
 * Gateway - OpenSeeFace → WebSocket ブリッジ
 * OpenSeeFaceからUDPでトラッキングデータを受信し、
 * WebSocketでWebブラウザに配信する
 */

const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const dgram = require('dgram');
const osc = require('osc');

const WS_PORT = 8080;
const FACE_UDP_PORT = 11573; // OpenSeeFaceのポート
const BODY_OSC_PORT = 11574; // MediaPipeのポート

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

// OpenSeeFace UDPサーバー (バイナリパケット用)
const faceUdpServer = dgram.createSocket('udp4');
let packetCount = 0;


// MediaPipe OSCサーバー
const oscServerBody = new osc.UDPPort({
  localAddress: '0.0.0.0',
  localPort: BODY_OSC_PORT,
  metadata: true
});

// トラッキングデータのパース用
let trackingData = {
  // 顔データ
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
  // 体データ
  body: {
    shoulder: { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 } },
    elbow: { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 } },
    wrist: { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 } },
    hip: { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 } },
    knee: { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 } },
    ankle: { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 } },
  }
};

// OpenSeeFace UDPメッセージハンドラ
faceUdpServer.on('message', (msg, rinfo) => {
  packetCount++;
  if (packetCount % 100 === 0) {
    console.log(`📨 Face UDP: ${packetCount} packets (Last: ${rinfo.address}:${rinfo.port})`);
  }

  try {

    // OpenSeeFaceのバイナリフォーマットをパース
    // OpenSeeFaceのバイナリフォーマット
    // Time(8) + ID(4) + W(4) + H(4) + EyeR(4) + EyeL(4) + Success(1) + PnP(4) + Qx(4) + Qy(4) + Qz(4) + Qw(4) + ...
    if (msg.length < 12) return;

    let pos = 12; // Time + ID skipped

    // Helper to safely read floats
    const readFloat = () => {
      if (pos + 4 > msg.length) return 0;
      const value = msg.readFloatLE(pos);
      pos += 4;
      return value;
    };

    // 1. Width & Height (Skip or use if needed)
    const cameraWidth = readFloat();
    const cameraHeight = readFloat();

    // 2. Eye Blink (0.0 - 1.0, OpenSeeFace sends 'openness')
    const rightEyeOpen = readFloat();
    const leftEyeOpen = readFloat();

    // 3. Success (1 byte)
    let success = 0;
    if (pos + 1 <= msg.length) {
      success = msg.readUInt8(pos);
      pos += 1;
    }

    // 4. PnP Error
    const pnpError = readFloat();

    // 5. Quaternion Rotation
    // OpenSeeFace (Unity Convention: Left-Handed, Y-Up)
    // We need to convert to Three.js (Right-Handed, Y-Up)
    // Typically: x -> -x, y -> y, z -> -z for position.
    // For Quaternion: x -> x, y -> -y, z -> -z, w -> w ?
    // Let's try standard conversion for webcam mirroring.

    let qx = readFloat();
    let qy = readFloat();
    let qz = readFloat();
    let qw = readFloat();

    // Coordinate System Conversion
    // Unity (LHS) -> Three.js (RHS)
    // Swap X and Z? Or Negate?
    // Experimentally: 
    // If input is mirrored (webcam), we might need to flip X.

    // Trial 1: x, -y, -z, w (Conjugate-ish?)
    qx = -qx;
    qy = qy;
    qz = -qz;
    // qw = qw;

    // 6. Euler Angles (Optional, but we use Quaternions)
    const ex = readFloat();
    const ey = readFloat();
    const ez = readFloat();

    // 7. Translation (Face Position)
    const tx = readFloat();
    const ty = readFloat();
    const tz = readFloat();

    // Quaternion → Euler変換
    const sinr_cosp = 2 * (qw * qx + qy * qz);
    const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (qw * qy - qz * qx);
    const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

    const siny_cosp = 2 * (qw * qz + qx * qy);
    const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    trackingData.headRotation = {
      x: -pitch, // Negate pitch to match VRM look (Up/Down)
      y: -yaw,   // Negate yaw for Mirror effect
      z: -roll   // Negate roll
    };

    // Face Position
    trackingData.facePosition = {
      x: tx,
      y: ty,
      z: tz
    };

    // Blink (1.0 = closed, 0.0 = open in our app usually? Or opposite?
    // VRM usually expects 1.0 = Closed (Weight).
    // OpenSeeFace sends "Openness" (1.0 = Open).
    // So Blink = 1.0 - Openness
    trackingData.blink = 1.0 - ((rightEyeOpen + leftEyeOpen) / 2.0);

    // Mouth - OpenSeeFace sends landmarks later, but for now we might not have them easily parsed
    // The standard packet ends here? No, landmarks follow.
    // For now, let's just get head/eyes working.
    // We can infer mouth open from landmarks if we parse them, or just default to 0 for now until verified.
    // NOTE: Facetracker.py sends landmarks AFTER translation.
    // Let's iterate landmarks if we want smooth mouth.

    // ... Parsing landmarks for mouth (optional for basic movement) ...
    // There are 66 landmarks * 2 floats (x,y) + 1 float (conf) = 3 floats per landmark
    // 66 * 12 bytes = 792 bytes.

    // Simplified Mouth Calculation (if enough data)
    // We need landmark 62 (top lip) and 66 (bottom lip)? 
    // Facetracker.py landmarks are: y, x, c

    // For now, keep mouth static or use a simple hack if user speaks (audio based is handled elsewhere).
    trackingData.mouthOpen = 0;

    trackingData.confidence = success ? 0.9 : 0.0;
    trackingData.timestamp = Date.now();


    // デバッグ: 1%の確率でログ出力
    if (Math.random() < 0.01) {
      console.log('[UDP FACE] rotation:', trackingData.headRotation, 'blink:', trackingData.blink);
    }

    // 接続中のすべてのクライアントにブロードキャスト
    broadcastToClients(trackingData);

  } catch (error) {
    console.error('❌ 顔UDPパースエラー:', error.message);
  }
});

// 体トラッキングデータ受信
oscServerBody.on('message', (oscMsg) => {
  try {
    const address = oscMsg.address;
    const args = oscMsg.args.map(arg => arg.value);

    // デバッグ: 5%の確率でログ出力（体データは少ないので確率アップ）
    if (Math.random() < 0.05) {
      console.log('[OSC BODY]', address, '→', args);
    }

    // 体データのパース: /body/shoulder/left → body.shoulder.left
    if (address.startsWith('/body/')) {
      const parts = address.split('/');
      const joint = parts[2]; // shoulder, elbow, wrist, hip, knee, ankle
      const side = parts[3];  // left, right

      if (trackingData.body[joint] && trackingData.body[joint][side]) {
        trackingData.body[joint][side] = {
          x: args[0] || 0,
          y: args[1] || 0,
          z: args[2] || 0,
        };
      }
    }

    trackingData.timestamp = Date.now();
    broadcastToClients(trackingData);
  } catch (error) {
    console.error('体トラッキングエラー:', error);
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
║  VRabater Gateway Server (全身対応)    ║
╠════════════════════════════════════════╣
║  WebSocket: ws://localhost:${WS_PORT}      ║
║  UDP Face:  0.0.0.0:${FACE_UDP_PORT}       ║
║  OSC Body:  0.0.0.0:${BODY_OSC_PORT}       ║
╚════════════════════════════════════════╝

⏳ トラッキングシステムの起動を待機中...
  `);
});

// UDPサーバー起動 (顔 - OpenSeeFace)
faceUdpServer.bind(FACE_UDP_PORT, '0.0.0.0');
faceUdpServer.on('listening', () => {
  console.log('✅ 顔トラッキングUDP起動:', FACE_UDP_PORT);
});

// OSCサーバー起動 (体 - MediaPipe)
oscServerBody.open();
oscServerBody.on('ready', () => {
  console.log('✅ 体トラッキングOSC起動:', BODY_OSC_PORT);
});

// エラーハンドリング
faceUdpServer.on('error', (error) => {
  console.error('❌ 顔UDPエラー:', error.message);
});

oscServerBody.on('error', (error) => {
  console.error('❌ 体OSCエラー:', error);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Gateway停止中...');
  faceUdpServer.close();
  oscServerBody.close();
  wss.close();
  process.exit(0);
});
