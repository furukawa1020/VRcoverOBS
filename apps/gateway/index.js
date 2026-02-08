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
    let qx = readFloat();
    let qy = readFloat();
    let qz = readFloat();
    let qw = readFloat();

    // Coordinate System Conversion
    // Unity (LHS) -> Three.js (RHS)
    // Trial 1: x -> -x, y -> y, z -> -z for position.
    // Experimentally flipped x and z components for rotation
    qx = -qx;
    qy = qy; // y is usually up, so keep
    qz = -qz;
    // qw = qw;

    // 6. Euler Angles (Pitch, Yaw, Roll)
    // OpenSeeFace sends these in degrees or radians? Usually degrees in UI, but struct pack might be radians.
    // Let's assume Radians for now as trimesh/numpy usually work in radians, but let's check values.
    // If values are like 10, 20, 30 -> Degrees. If 0.1, 0.5 -> Radians.
    // But logs showed 1.6, 3.0 before... 

    const ex = readFloat(); // Pitch?
    const ey = readFloat(); // Yaw?
    const ez = readFloat(); // Roll?

    // 7. Translation (Face Position)
    const tx = readFloat();
    const ty = readFloat();
    const tz = readFloat();

    // Use Euler directly
    // OpenSeeFace Euler is Y-Up, LHS?
    // Try: Pitch(X) = -ex, Yaw(Y) = -ey, Roll(Z) = -ez
    // Adjust based on observation.

    // Note: If 1.6/3.0 values persist, then byte alignment is wrong.
    // But assuming 0.0 is forward:

    // Euler to Three.js mapping
    // ex (Pitch), ey (Yaw), ez (Roll)
    // Invert all for mirror?

    trackingData.headRotation = {
      x: -ex * (Math.PI / 180.0), // Assuming Degrees? No, OpenSeeFace usually sends Degrees in OSC but maybe Floats in UDP?
      // Wait, facetracker.py uses f.euler. f.euler comes from solvePnP? 
      // Actually Tracker.py: self.euler = decomposition of rotation matrix.
      // Usually Radians in math libraries.
      // Let's try Radians first (direct pass).
      // If it moves CRAZY fast, it's degrees.

      x: -ex,
      y: -ey,
      z: ez   // Trial: Z might not need flip?
    };

    // Override with simple mapping for debugging
    // We will log these values to see what they are.
    if (Math.random() < 0.01) {
      console.log(`[UDP FACE RAW] Pitch:${ex.toFixed(2)} Yaw:${ey.toFixed(2)} Roll:${ez.toFixed(2)}`);
    }

    trackingData.headRotation = {
      x: -ex + 0.2, // Offset adjustment (Face usually looks down a bit)
      y: -ey,
      z: -ez
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


// MediaPipe OSCメッセージハンドラ
oscServerBody.on('message', (oscMsg) => {
  // /body/shoulder/left/position x y z
  // アドレスをパースしてtrackingData.bodyに格納
  const address = oscMsg.address;
  const args = oscMsg.args;

  try {
    const parts = address.split('/');
    // example: ['', 'body', 'shoulder', 'left', 'position']
    if (parts.length >= 5 && parts[1] === 'body') {
      const part = parts[2]; // shoulder
      const side = parts[3]; // left

      if (trackingData.body[part] && trackingData.body[part][side]) {
        trackingData.body[part][side] = { x: args[0], y: args[1], z: args[2] };
      }
    }

    // OSCデータ受信時は即時ブロードキャストするか、一定間隔にするか
    // ここでは顔データと一緒に送るため、更新のみ行う
    broadcastToClients(trackingData);

  } catch (e) {
    console.error('OSCパースエラー:', e);
  }
});

oscServerBody.on('error', (error) => {
  console.log("OSC Error:", error);
});

oscServerBody.open();


function broadcastToClients(data) {
  const message = JSON.stringify(data);
  connectedClients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

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
