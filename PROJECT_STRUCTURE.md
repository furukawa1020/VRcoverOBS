# VRabater プロジェクト構造図

```
VRabater/
│
├── 📄 README.md              # プロジェクト概要・使い方
├── 📄 QUICKSTART.md          # 5分クイックスタート
├── 📄 SETUP.md               # 詳細セットアップガイド
├── 📄 DEVELOPMENT.md         # 開発者向けドキュメント
├── 📄 FAQ.md                 # よくある質問
├── 📄 LICENSE                # MITライセンス
├── 📄 .gitignore             # Git除外設定
├── 📦 package.json           # ルートpackage.json（workspaces）
│
├── 📁 apps/                  # アプリケーション本体
│   │
│   ├── 📁 web/               # フロントエンド（Three.js + TypeScript）
│   │   ├── 📁 src/
│   │   │   ├── 📁 avatar/
│   │   │   │   └── AvatarSystem.ts      # VRM制御・描画・アニメーション
│   │   │   ├── 📁 audio/
│   │   │   │   └── AudioProcessor.ts    # 音声処理・ボイチェン・リップシンク
│   │   │   ├── 📁 tracking/
│   │   │   │   ├── TrackingClient.ts    # WebSocket受信
│   │   │   │   └── types.ts             # 型定義
│   │   │   ├── 📁 ui/
│   │   │   │   └── UI.ts                # コントロールパネル
│   │   │   ├── config.ts                # 設定・カラーパレット
│   │   │   └── main.ts                  # エントリーポイント
│   │   ├── 📁 public/
│   │   │   └── 📁 models/
│   │   │       └── README.txt           # VRM配置先
│   │   ├── index.html                   # HTMLテンプレート
│   │   ├── vite.config.ts               # Vite設定
│   │   ├── tsconfig.json                # TypeScript設定
│   │   └── package.json                 # 依存関係
│   │
│   ├── 📁 gateway/           # WebSocketゲートウェイ（Node.js）
│   │   ├── index.js          # OSC→WebSocketブリッジ
│   │   └── package.json      # 依存関係
│   │
│   └── 📁 ai/                # AIサービス（Python + Flask）
│       ├── main.py           # REST APIサーバー
│       ├── requirements.txt  # Python依存関係
│       ├── download_models.py # モデルダウンロードスクリプト
│       └── 📁 models/
│           └── .gitkeep      # Whisper/Piperモデル保存先
│
├── 📁 assets/                # 静的アセット
│   ├── 📁 hdris/             # PBR環境マップ（.hdr）
│   │   ├── .gitkeep
│   │   └── (CC0 HDRIファイル)
│   ├── 📁 vrm/               # VRMモデル
│   │   ├── .gitkeep
│   │   ├── README.txt
│   │   └── hakusan_avatar.vrm
│   └── 📁 fonts/             # UIフォント（将来使用）
│
├── 📁 licenses/              # ライセンス管理
│   └── third_party.md        # サードパーティライセンス台帳
│
└── 📁 scripts/               # 起動スクリプト
    ├── start_all.ps1         # Windows一括起動
    └── start_all.sh          # macOS/Linux一括起動
```

---

## 🎨 カラーパレット（白山モチーフ）

| 色名 | HEX | RGB | 用途 | モチーフ |
|------|-----|-----|------|----------|
| **雪白** | `#F7F7F7` | `247, 247, 247` | 背景・ハイライト | 白山の雪 |
| **翠青** | `#1E6F68` | `30, 111, 104` | プライマリ・強調 | 手取川の碧 |
| **玄岩** | `#2E2B2B` | `46, 43, 43` | 背景・シャドウ | 火山岩・玄武岩 |
| **木肌** | `#A67C52` | `166, 124, 82` | セカンダリ・暖色 | 里山材の温もり |

---

## 🔄 データフロー図

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザー                              │
│  🎥 Webカメラ  │  🎤 マイク  │  ⌨️ キーボード               │
└──────┬──────────┴──────┬──────────┴──────┬──────────────────┘
       │                 │                 │
       │ 映像             │ 音声            │ テキスト
       ▼                 ▼                 ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ OpenSeeFace  │   │  WebAudio    │   │   REST API   │
│(顔トラッキング│   │ (Tone.js)    │   │              │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │ OSC             │ 処理済音声        │ JSON
       ▼                 ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Gateway    │   │  仮想Audio   │   │ AI Service   │
│ (WebSocket)  │   │   Device     │   │  (Flask)     │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                 │                   │
       │ WebSocket       │ システム音声       │ HTTP
       ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      Web UI (Browser)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ AvatarSystem │  │AudioProcessor│  │      UI      │      │
│  │  (Three.js)  │  │              │  │  (Controls)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌───────────────────────────────────────────────────┐      │
│  │         Canvas (WebGL Rendering)                  │      │
│  │  - VRM Model (PBR Material)                       │      │
│  │  - HDRI Environment                               │      │
│  │  - Real-time Expression & Pose                    │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│           出力先（Zoom / Discord / OBS等）                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 モジュール依存関係

```
main.ts
  ├── AvatarSystem
  │     ├── three.js
  │     ├── @pixiv/three-vrm
  │     └── RGBELoader (HDRI)
  │
  ├── TrackingClient
  │     └── WebSocket API
  │
  ├── AudioProcessor
  │     └── Tone.js
  │
  └── UI
        ├── AvatarSystem
        ├── AudioProcessor
        └── TrackingClient
```

---

## 🚀 起動シーケンス

```
1. npm run dev (ルート)
   ↓
2. Gateway起動 (Node.js)
   - OSCサーバー立ち上げ (port 11573)
   - WebSocketサーバー立ち上げ (port 8080)
   ↓
3. Web UI起動 (Vite)
   - Vite dev server (port 5173)
   ↓
4. AI Service起動 (Python)
   - Flask server (port 5000)
   - Whisper初期化
   - Ollama接続確認
   ↓
5. ブラウザアクセス (http://localhost:5173)
   - main.ts 実行
   - AvatarSystem 初期化
   - VRM読み込み
   - TrackingClient 接続
   - AudioProcessor 初期化
   - UI構築
   ↓
6. OpenSeeFace起動（ユーザー手動）
   - OSC送信開始 → Gateway → WebSocket → Browser
   ↓
7. アバター表示・トラッキング開始 🎉
```

---

## 📊 パフォーマンス目標

| 項目 | 目標値 | 計測方法 |
|------|--------|----------|
| **描画FPS** | ≥30fps | ブラウザDevTools > Performance |
| **トラッキング遅延** | ≤150ms | カメラ入力→表情反映 |
| **AI応答時間** | 2〜4秒 | STT→LLM→TTS合計 |
| **メモリ使用量** | ≤4GB | タスクマネージャー |
| **CPU使用率** | ≤70% | 定常状態での平均 |

---

## 🔐 セキュリティ・プライバシー

```
[ローカル処理のみ]
  - 映像: ブラウザ→OpenSeeFace（ローカル）
  - 音声: ブラウザ→WebAudio（ローカル）
  - テキスト: ブラウザ→Ollama（ローカル）

[外部送信: なし]
  - クラウドAPI: 使用しない
  - テレメトリ: 送信しない
  - ログ: ローカル保存のみ（任意で無効化可）

[ネットワーク通信]
  - localhost のみ（127.0.0.1 / ::1）
  - 初回: モデルダウンロード（Ollama, Whisper）
  - 以降: 完全オフライン
```

---

## 🎯 開発優先度（ロードマップ）

### v1.0 ✅ （現在）
- [x] VRM表示・PBRレンダリング
- [x] OpenSeeFace連携
- [x] ボイスチェンジャー（ピッチ）
- [x] Ollama LLM統合
- [x] Whisper STT
- [x] UI基本実装

### v1.1 🔜 （次期）
- [ ] Piper TTS統合
- [ ] フォルマントシフト（WASM）
- [ ] 表情プリセット追加
- [ ] パフォーマンス最適化

### v1.2 🚧 （将来）
- [ ] パーティクルシステム（雪・霧）
- [ ] 背景カスタマイズ
- [ ] RVC音声変換（オプション・GPU）
- [ ] VRM着せ替え機能

### v2.0 💭 （構想）
- [ ] WebRTC多人数ルーム
- [ ] 感情推定（HRV）
- [ ] モバイル対応
- [ ] VTuberスタジオ連携

---

## 📚 学習リソース

### 初心者向け
- [VRM仕様書](https://vrm.dev/ja/)
- [three.js入門](https://threejs.org/manual/#ja/)
- [Web Audio API](https://developer.mozilla.org/ja/docs/Web/API/Web_Audio_API)

### 中級者向け
- [PBRレンダリング理論](https://learnopengl.com/PBR/Theory)
- [Tone.js ドキュメント](https://tonejs.github.io/)
- [Ollama API Reference](https://github.com/ollama/ollama/blob/main/docs/api.md)

### 上級者向け
- [VRM Expression仕様](https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_vrm-1.0)
- [WebGL最適化](https://www.khronos.org/webgl/wiki/WebGL_Best_Practices)
- [音声信号処理](https://ccrma.stanford.edu/~jos/sasp/)

---

**作成日**: 2025年11月5日  
**バージョン**: 1.0.0  
**ライセンス**: MIT License
