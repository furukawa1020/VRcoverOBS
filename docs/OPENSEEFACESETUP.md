# OpenSeeFace セットアップガイド

## インストール

### 1. OpenSeeFaceをダウンロード
```bash
git clone https://github.com/emilianavt/OpenSeeFace.git
cd OpenSeeFace
```

### 2. Python依存関係をインストール
```bash
pip install onnxruntime opencv-python pillow numpy
```

### 3. モデルファイルをダウンロード
- モデルファイルは自動的にダウンロードされます

## 起動方法

### Webカメラで顔トラッキング開始
```bash
# デフォルト設定（カメラID 0、OSCポート11573）
python facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1 --max-feature-updates 900

# より高精度（FPS低下あり）
python facetracker.py -c 0 -W 1280 -H 720 --model 3 --discard-after 0
```

### パラメータ説明
- `-c 0`: カメラID（デフォルトWebカメラ）
- `-W 640 -H 480`: 解像度（640x480が軽い、1280x720が高精度）
- `--model 3`: モデル精度（0-4、3が推奨）
- `--discard-after 0`: 顔を見失ってもトラッキング継続
- `--scan-every 0`: 顔検出を常時実行
- `--no-3d-adapt 1`: 3D適応を無効化（安定性UP）

## OSC送信先

OpenSeeFaceは以下にOSCデータを送信：
- **IP**: 127.0.0.1 (localhost)
- **ポート**: 11573

VRabaterのGatewayが11573ポートで受信します。

## トラブルシューティング

### カメラが認識されない
```bash
# 利用可能なカメラを確認
python -c "import cv2; print([i for i in range(10) if cv2.VideoCapture(i).read()[0]])"
```

### FPSが低い
- 解像度を下げる: `-W 640 -H 480`
- モデルを軽くする: `--model 1`
- GPU版onnxruntimeを使う: `pip install onnxruntime-gpu`

### トラッキングが不安定
- 照明を明るくする
- カメラを顔の正面に配置
- `--no-3d-adapt 1` を追加

## 確認方法

起動すると以下が表示されます：
```
=== Camera 0 (640 x 480 @ 30.0 fps) ===
Waiting for camera...
Detected face
Sending face data to 127.0.0.1:11573
FPS: 28.5
```

これでVRabaterが顔の動きを受信できます！
