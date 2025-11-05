# Zoom/Discord/Teams 配信ガイド

## 🎥 仮想カメラで配信する方法

VRabaterのアバターをZoom/Discord/Teamsで使うには、**仮想カメラソフト**が必要です。

---

## 方法1: OBS Studio + 仮想カメラ（推奨）⭐

### インストール
1. **OBS Studio** をダウンロード
   - https://obsproject.com/ja/download
   - 無料、最も安定

2. OBSを起動して設定

### 設定手順

#### 1. ブラウザソースを追加
1. OBS Studio起動
2. 「ソース」→「+」→「ブラウザ」
3. URL: `http://localhost:5173`
4. 幅: `1920`、高さ: `1080`
5. 「カスタムCSS」に以下を追加（背景透過）:
   ```css
   body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }
   ```
6. ✅「ページが表示されていないときにソースをシャットダウン」をOFF

#### 2. クロマキー（背景透過）を設定
1. ブラウザソースを右クリック→「フィルタ」
2. 「+」→「クロマキー」
3. 色キーの種類: 緑
4. 類似性: 400
5. 滑らかさ: 80

#### 3. 仮想カメラを開始
1. OBS右下「仮想カメラ開始」をクリック
2. 仮想カメラ名: `OBS Virtual Camera`

#### 4. Zoom/Discordで使用
- **Zoom**: 設定→ビデオ→カメラ→「OBS Virtual Camera」を選択
- **Discord**: 設定→音声・ビデオ→カメラ→「OBS Virtual Camera」を選択
- **Teams**: デバイス設定→カメラ→「OBS Virtual Camera」を選択

### 背景を追加したい場合
1. 「ソース」→「+」→「画像」で背景画像を追加
2. ブラウザソースを一番上に移動（ドラッグ）

---

## 方法2: Snap Camera（簡単だが開発終了）

### 注意
⚠️ Snap Cameraは2023年に開発終了。既にインストール済みなら使用可能。

### 設定（インストール済みの場合）
1. Snap Camera起動
2. ブラウザウィンドウをキャプチャ
3. Zoom/Discordで「Snap Camera」を選択

---

## 方法3: XSplit VCam

### インストール
- https://www.xsplit.com/vcam
- 有料（無料版は透かしあり）

### 設定
1. XSplit VCam起動
2. ソース: ブラウザウィンドウ
3. Zoom/Discordで「XSplit VCam」を選択

---

## 方法4: NDI + NDI Virtual Input（上級者向け）

### 必要なもの
1. **OBS Studio** + **obs-ndi** プラグイン
2. **NDI Tools** (NDI Virtual Input)

### 設定
1. OBS→ツール→NDI Output設定→「Main Output」を有効化
2. NDI Virtual Input起動
3. ソース: `OBS (Main Output)` を選択
4. Zoom/Discordで「NewTek NDI Video」を選択

**メリット**: 低遅延、高画質

---

## 🎤 音声について

### マイク音声をアバターに反映
1. VRabaterで「マイクを有効化」
2. ブラウザがマイクアクセスを許可
3. 音声の大きさで口が動く（リップシンク）

### Zoom/Discordでの音声
- **通常のマイク**をそのまま使用
- VRabaterのボイスチェンジャー機能は開発中

### 仮想オーディオデバイス（ボイチェン配信したい場合）
1. **VB-CABLE** または **Voicemeeter** をインストール
   - https://vb-audio.com/Cable/
2. VRabaterの音声出力 → 仮想ケーブル → Zoom/Discord

---

## 💡 使い方のコツ

### 画質を上げる
- OBS: 出力解像度を1920x1080に
- VRabater: ブラウザのズームを100%に

### 遅延を減らす
- OBS: 設定→映像→FPS共通値→60fps
- ブラウザ: ハードウェアアクセラレーションON

### 背景を透過
- OBS: クロマキーフィルタを使用
- VRabater: 背景色は透明に設定済み

### 照明を改善
- OBS: ソース→フィルタ→色補正

---

## ✅ 推奨構成

### 最小構成（無料）
- **OBS Studio** + 仮想カメラ
- デフォルトマイク
- Zoom/Discord標準機能

### 推奨構成
- **OBS Studio** + 仮想カメラ
- **VB-CABLE** (ボイチェン用)
- 照明改善、背景追加

### プロ構成
- **OBS Studio** + **NDI**
- 高画質Webカメラ (OpenSeeFace用)
- コンデンサーマイク + オーディオインターフェース

---

## トラブルシューティング

### 仮想カメラが表示されない
1. OBS再起動
2. Zoom/Discord再起動
3. PCを再起動

### 映像がカクカクする
- OBS: 設定→映像→FPS共通値→30fps
- ブラウザのタブを他に開きすぎない

### 音声と映像がズレる
- OBS: ソース→フィルタ→遅延追加
- 音声を-50ms〜-200ms遅延

### Zoomで「カメラが使用中」
- OBSが既に起動しているか確認
- 他のカメラアプリを終了

---

## 📹 配信開始チェックリスト

- [ ] VRabater起動 (http://localhost:5173)
- [ ] OpenSeeFace起動（顔トラッキング）
- [ ] マイク許可（ブラウザ）
- [ ] OBS起動
- [ ] ブラウザソース追加
- [ ] 仮想カメラ開始
- [ ] Zoom/DiscordでOBS Virtual Cameraを選択
- [ ] マイクテスト
- [ ] 表情テスト（笑顔、驚き、まばたき）

これで配信準備完了！🎉
