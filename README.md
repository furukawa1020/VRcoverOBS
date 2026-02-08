# VRabater - 白山モチーフ3Dアバターシステム 💙❄️

> **非公式・商用利用可 / GPUなし・無料運用 / AI人格切替可能 / Zoom等どこでも使える**

白山手取川ジオパークの自然美をモチーフにした、めちゃくちゃかわいいWebベース3Dアバターシステムです。
# VRabater (Zoom/Discord用アバターシステム)

白山（ハクサン）をモチーフにした、Webベースの3Dアバターシステムです。
**OBSなどの配信ソフトを使わずに、直接ZoomやDiscordでアバターを表示できます。**

## ✨ 特徴
# OpenSeeFaceを別途ダウンロード後
python facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1
```

## 📁 プロジェクト構造

```
VRabater/
├── apps/
│   ├── web/              # Three.js フロントエンド
│   │   ├── src/
│   │   │   ├── avatar/   # VRM制御・表情・姿勢
│   │   │   ├── audio/    # 音声処理・ボイチェン
│   │   │   ├── tracking/ # トラッキングデータ受信
│   │   │   ├── ui/       # UIコンポーネント
│   │   │   └── main.ts   # エントリーポイント
│   │   └── public/
│   │       └── models/   # VRMファイル
│   ├── gateway/          # OpenSeeFace→WebSocketブリッジ
│   └── ai/               # STT/LLM/TTS パイプライン
├── assets/
│   ├── hdris/            # PBR環境マップ（CC0）
│   ├── vrm/              # ベースVRMモデル
│   └── fonts/            # UIフォント
├── scripts/
│   └── start_all.ps1     # 一括起動スクリプト
└── licenses/
    └── third_party.md    # ライセンス台帳
```

## 🎮 使い方

### 基本操作
1. ブラウザで http://localhost:5173 を開く
2. カメラとマイクのアクセスを許可
3. VRMモデルが表示され、顔の動きに追従します

### AI人格の切替
- **手動モード**: あなた自身が話し、ボイスチェンジャーが適用されます
- **AIモード**: マイクで話すとAIが応答します（STT→LLM→TTS）

### Zoom/Discordで使う
1. OBSで「ブラウザソース」を追加: http://localhost:5173
2. OBSの「仮想カメラ」を開始
3. Zoom/Discordのカメラ設定で「OBS Virtual Camera」を選択
4. 音声は「仮想オーディオデバイス」(VB-Cable等)を経由

## ⚙️ カスタマイズ

### VRMモデルの変更
`apps/web/public/models/` に自作VRMを配置し、`apps/web/src/config.ts` で指定

### AI人格の調整
`apps/ai/prompts/character.txt` でキャラクター設定を編集

### デザインテーマの変更
`apps/web/src/theme.ts` でカラーパレットとビジュアル設定を調整

## 📊 パフォーマンス目標

- **描画**: 30fps以上（1080p）
- **トラッキング遅延**: ≤150ms
- **AI応答**: 2〜4秒（CPU、qwen2.5:3b）
- **メモリ**: ≤4GB（アバター+AI合計）

## 🔒 プライバシー

- すべての処理はローカル実行
- 音声・映像・テキストは外部送信なし
- ログは任意で無効化可能

## 📜 ライセンス

- **プロジェクトコード**: MIT License
- **VRMモデル**: 自作/CC0/商用可ライセンスのみ使用
- **サードパーティ**: `licenses/third_party.md` 参照

**⚠️ 注意**: このプロジェクトは白山市・白山手取川ジオパークの**非公式**プロジェクトです。
公式ロゴ・市章・地図素材は使用していません。

## 🤝 コントリビューション

Issue/PRは歓迎です！ただし以下を守ってください：
- 商用利用可能なアセットのみ
- 公式マークの使用禁止
- プライバシー保護の原則

## 💖 開発者より

白山の自然の美しさと、里山の温かみを、デジタルアバターを通じて表現したいという想いから生まれました。
「めちゃくちゃかわいくて、親しみやすい」キャラクターで、あなたのオンラインコミュニケーションをより楽しく！

---

**作者**: VRabater Project  
**連絡先**: GitHub Issues  
**バージョン**: 1.0.0  
**更新日**: 2025年11月5日
