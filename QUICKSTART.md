# 🚀 VRabater クイックスタート

**5分で始める！白山モチーフ3Dアバターシステム**

---

## ステップ1: 必要なソフトのインストール（初回のみ）

### 1-1. Node.js
https://nodejs.org/ → LTS版をダウンロード・インストール

### 1-2. Python
https://www.python.org/ → 最新版（3.10以上）をダウンロード・インストール

### 1-3. Ollama
https://ollama.ai/ → OSに合わせてインストール

---

## ステップ2: プロジェクトのセットアップ

### PowerShellを開いて実行:

```powershell
# プロジェクトフォルダに移動
cd VRabater

# 依存関係のインストール
npm install

# Web UI
cd apps/web
npm install
cd ../..

# Gateway
cd apps/gateway
npm install
cd ../..

# AI Service（Python）
cd apps/ai
pip install -r requirements.txt
cd ../..
```

---

## ステップ3: LLMモデルのダウンロード

```powershell
# Ollamaで日本語最適モデルを取得
ollama pull qwen2.5:3b-instruct-q4_K_M
```

これには数分かかります（約2GB）☕

---

## ステップ4: VRMモデルの準備

### 方法A: VRoid Studioで自作（推奨・30分）

1. VRoid Studio をインストール: https://vroid.com/studio
2. 新規キャラ作成
3. **白山カラーで装飾**:
   - 髪: 翠青(#1E6F68)
   - 目: 碧い瞳
   - 服: 木肌(#A67C52) + 玄岩(#2E2B2B)
4. エクスポート → VRMで保存
5. `hakusan_avatar.vrm` にリネーム
6. `assets/vrm/` に配置

### 方法B: サンプルVRMをダウンロード（5分）

1. VRoid Hub等で商用可モデルを探す
2. ダウンロード後、`assets/vrm/hakusan_avatar.vrm` に配置

---

## ステップ5: 起動！

```powershell
# 一括起動スクリプト実行
.\scripts\start_all.ps1
```

3つのウィンドウが開きます:
- 🔌 Gateway (WebSocket)
- 🌐 Web UI (Vite)
- 🤖 AI Service (Flask)

---

## ステップ6: ブラウザで開く

http://localhost:5173

カメラとマイクのアクセスを **許可** してください。

---

## ステップ7: 動かしてみる！

### 基本操作

1. **表情を動かす**: 顔を動かすと自動追従（OpenSeeFace必要）
2. **ボイスチェンジャー**: 右下パネルで「オン」→ 話すと声が変わる
3. **AI人格**: 「AIモード」に切替 → 話しかけると応答

### Zoomで使う（オプション）

1. OBS Studioをインストール
2. 「ブラウザソース」で `http://localhost:5173` 追加
3. 「仮想カメラ開始」
4. Zoomで「OBS Virtual Camera」選択

---

## 🎉 完了！

あとは自由にカスタマイズして楽しんでください！

---

## ⚠️ OpenSeeFace（顔トラッキング）を使う場合

**別途ダウンロードが必要**:
1. https://github.com/emilianavt/OpenSeeFace/releases
2. 解凍して任意フォルダに配置
3. 起動:

```powershell
python facetracker.py -c 0 -W 640 -H 480 --discard-after 0 --scan-every 0 --no-3d-adapt 1
```

---

## 📚 もっと詳しく知りたい

- **セットアップ詳細**: `SETUP.md`
- **開発者向け**: `DEVELOPMENT.md`
- **よくある質問**: `FAQ.md`

---

## 🆘 困ったときは

1. ブラウザで **F12** → Console でエラー確認
2. `FAQ.md` で検索
3. GitHub Issues で質問

---

**楽しんでください！💙❄️**
