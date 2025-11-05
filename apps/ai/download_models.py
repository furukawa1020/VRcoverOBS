"""
モデルダウンロードスクリプト
Whisper、Piperモデルの自動取得
"""

import os
import sys
import urllib.request
import zipfile

# モデル保存先
MODELS_DIR = "./models"
os.makedirs(MODELS_DIR, exist_ok=True)

# Whisperは自動ダウンロードされるため、ここでは何もしない
# （初回transcribe時に自動取得）

print("""
╔════════════════════════════════════════╗
║  VRabater モデルダウンローダー         ║
╚════════════════════════════════════════╝

Whisperモデル:
  初回実行時に自動ダウンロードされます
  サイズ: tiny(39MB), base(74MB), small(244MB)

Piperモデル（日本語TTS）:
  将来実装予定

実行するには:
  1. Ollamaをインストール: https://ollama.ai
  2. LLMモデルをダウンロード:
     ollama pull qwen2.5:3b-instruct-q4_K_M

✅ 準備完了！main.py を実行してください。
""")
