# 全身トラッキングガイド

## 🎯 トラッキング構成

VRabaterは**顔 + 体**の両方をトラッキングできます!

### システム構成
```
カメラ
 ├─ OpenSeeFace (顔トラッキング) → OSC (port 11573) → Gateway → Web UI
 └─ MediaPipe Pose (体トラッキング) → OSC (port 11574) → Gateway → Web UI
```

---

## 📦 インストール

### 1. OpenSeeFace (顔トラッキング)

#### Pythonパッケージをインストール
```powershell
pip install onnxruntime opencv-python pillow numpy
```

#### OpenSeeFaceをクローン
```powershell
cd C:\Users\wakuw
git clone https://github.com/emilianavt/OpenSeeFace.git
cd OpenSeeFace
```

#### モデルファイルをダウンロード
OpenSeeFaceフォルダに以下のファイルが必要です:
- `lm.dat` (3KB) - 顔ランドマークモデル
- `facetracker.py` - メインスクリプト

GitHubから自動でダウンロードされます。

---

### 2. MediaPipe Pose (体トラッキング)

#### Pythonパッケージをインストール
```powershell
pip install mediapipe python-osc
```

#### トラッキングスクリプトを作成
`C:\Users\wakuw\bodytracker.py` を作成:

```python
import cv2
import mediapipe as mp
from pythonosc import udp_client
import time

# OSC設定
OSC_IP = "127.0.0.1"
OSC_PORT = 11574  # 顔と別ポート

# MediaPipe初期化
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,  # 0=軽量, 1=通常, 2=高精度
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# OSCクライアント
osc_client = udp_client.SimpleUDPClient(OSC_IP, OSC_PORT)

# カメラ起動
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
cap.set(cv2.CAP_PROP_FPS, 30)

print("✅ 体トラッキング開始")
print(f"📡 OSC送信先: {OSC_IP}:{OSC_PORT}")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    
    # RGB変換
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    
    # 姿勢推定
    results = pose.process(image)
    
    # 描画用に戻す
    image.flags.writeable = True
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    
    if results.pose_landmarks:
        # ランドマーク描画
        mp_drawing.draw_landmarks(
            image,
            results.pose_landmarks,
            mp_pose.POSE_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2),
            mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
        )
        
        # 主要な関節をOSC送信
        landmarks = results.pose_landmarks.landmark
        
        # 肩
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
        osc_client.send_message("/body/shoulder/left", 
            [left_shoulder.x, left_shoulder.y, left_shoulder.z])
        osc_client.send_message("/body/shoulder/right", 
            [right_shoulder.x, right_shoulder.y, right_shoulder.z])
        
        # 肘
        left_elbow = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW]
        right_elbow = landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW]
        osc_client.send_message("/body/elbow/left", 
            [left_elbow.x, left_elbow.y, left_elbow.z])
        osc_client.send_message("/body/elbow/right", 
            [right_elbow.x, right_elbow.y, right_elbow.z])
        
        # 手首
        left_wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST]
        right_wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST]
        osc_client.send_message("/body/wrist/left", 
            [left_wrist.x, left_wrist.y, left_wrist.z])
        osc_client.send_message("/body/wrist/right", 
            [right_wrist.x, right_wrist.y, right_wrist.z])
        
        # 腰
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
        osc_client.send_message("/body/hip/left", 
            [left_hip.x, left_hip.y, left_hip.z])
        osc_client.send_message("/body/hip/right", 
            [right_hip.x, right_hip.y, right_hip.z])
        
        # 膝
        left_knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE]
        osc_client.send_message("/body/knee/left", 
            [left_knee.x, left_knee.y, left_knee.z])
        osc_client.send_message("/body/knee/right", 
            [right_knee.x, right_knee.y, right_knee.z])
        
        # 足首
        left_ankle = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]
        right_ankle = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE]
        osc_client.send_message("/body/ankle/left", 
            [left_ankle.x, left_ankle.y, left_ankle.z])
        osc_client.send_message("/body/ankle/right", 
            [right_ankle.x, right_ankle.y, right_ankle.z])
    
    # プレビュー表示
    cv2.imshow('Body Tracking', image)
    
    if cv2.waitKey(5) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

---

## 🚀 起動方法

### ターミナル1: Gateway (すでに起動中)
```powershell
cd C:\Users\wakuw\OneDrive\画像\デスクトップ\.vscode\VRabater\apps\gateway
npm run dev
```

### ターミナル2: Web UI (すでに起動中)
```powershell
cd C:\Users\wakuw\OneDrive\画像\デスクトップ\.vscode\VRabater\apps\web
npm run dev
```

### ターミナル3: AI Service (すでに起動中)
```powershell
cd C:\Users\wakuw\OneDrive\画像\デスクトップ\.vscode\VRabater\apps\ai
python main.py
```

### ターミナル4: 顔トラッキング (OpenSeeFace)
```powershell
cd C:\Users\wakuw\OpenSeeFace
python facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1 --ip 127.0.0.1 --port 11573
```

### ターミナル5: 体トラッキング (MediaPipe)
```powershell
cd C:\Users\wakuw
python bodytracker.py
```

---

## ✅ 確認方法

1. **Gateway**: `✅ OSCサーバー起動: 11573` が表示される
2. **Web UI**: ブラウザで `http://localhost:5173` を開く
3. **OpenSeeFace**: `Tracking FPS: XX.X` が表示される
4. **MediaPipe**: ウィンドウに骨格が描画される

---

## 🎮 トラッキング範囲

### 顔トラッキング (OpenSeeFace)
- 👄 口の開き
- 😊 笑顔
- 👁️ まばたき
- 🤨 眉毛の動き
- 👀 視線方向
- 🔄 頭の回転(Yaw/Pitch/Roll)

### 体トラッキング (MediaPipe Pose)
- 💪 肩 (左右)
- 💪 肘 (左右)
- ✋ 手首 (左右)
- 🦴 腰 (左右)
- 🦵 膝 (左右)
- 🦶 足首 (左右)

**合計33ランドマーク**をトラッキング!

---

## ⚙️ Gatewayの拡張 (体データ受信)

`apps/gateway/index.js`に体トラッキング用のOSCポートを追加する必要があります。

### 修正箇所
```javascript
const OSC_PORT_FACE = 11573; // 顔
const OSC_PORT_BODY = 11574; // 体

const oscServerFace = new osc.Server(OSC_PORT_FACE, '0.0.0.0');
const oscServerBody = new osc.Server(OSC_PORT_BODY, '0.0.0.0');

let trackingData = {
  // 既存の顔データ
  mouthOpen: 0,
  mouthSmile: 0,
  blink: 0,
  // 新規: 体データ
  body: {
    shoulder: { left: [0, 0, 0], right: [0, 0, 0] },
    elbow: { left: [0, 0, 0], right: [0, 0, 0] },
    wrist: { left: [0, 0, 0], right: [0, 0, 0] },
    hip: { left: [0, 0, 0], right: [0, 0, 0] },
    knee: { left: [0, 0, 0], right: [0, 0, 0] },
    ankle: { left: [0, 0, 0], right: [0, 0, 0] },
  }
};

// 体トラッキングデータ受信
oscServerBody.on('message', (msg) => {
  const [address, ...args] = msg;
  
  if (address.startsWith('/body/')) {
    const parts = address.split('/');
    const joint = parts[2]; // shoulder, elbow, etc.
    const side = parts[3];  // left, right
    
    if (trackingData.body[joint]) {
      trackingData.body[joint][side] = args;
    }
    
    broadcast(trackingData);
  }
});
```

---

## 💡 高精度トラッキングオプション

### より正確な体トラッキング
```python
pose = mp_pose.Pose(
    model_complexity=2,  # 2 = 最高精度（重い）
    smooth_landmarks=True,
    min_detection_confidence=0.7,  # 検出精度を上げる
    min_tracking_confidence=0.7
)
```

### VR機器を使う場合
- **SteamVR + Vive Tracker**: 完全6DoFトラッキング
- **Quest 2/3**: ハンドトラッキング + Body Tracking
- **Kinect Azure**: 深度センサーで高精度

---

## トラブルシューティング

### カメラが2つ必要?
いいえ!**1つのカメラ**で顔と体、両方トラッキングできます。

**方法1: 2つのスクリプトで同じカメラを共有**
- OpenSeeFace: カメラ0 (顔用)
- MediaPipe: カメラ0 (体用)

⚠️ 同時に同じカメラは使えないので、どちらか1つに統合します。

**方法2: 統合スクリプト (推奨)**
OpenSeeFace + MediaPipeを1つのスクリプトにまとめる。

### 体が検出されない
- カメラから1.5m〜3m離れる
- 全身が映るように調整
- 照明を明るくする

### トラッキングが遅い
- `model_complexity=0` (軽量モード)
- 解像度を下げる (320x240)
- GPU版MediaPipeを使用

---

## 📹 次のステップ

1. ✅ OpenSeeFaceインストール
2. ✅ MediaPipeインストール
3. ✅ Gatewayに体トラッキング追加
4. ✅ Web UIで体の動きを反映
5. ⭐ **OBSで配信!**

全部準備できたら、Zoom/Discordで**全身アバター配信**ができます! 🎉
