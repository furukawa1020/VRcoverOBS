"""
VRabater AI Service
ローカルLLM (Ollama) + STT (Whisper/Vosk) + TTS (Piper) + Body Tracking (MediaPipe)
"""

import os
import json
import time
import threading
import queue
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_sock import Sock

# Virtual Camera
from virtual_cam import VirtualCamera


# Body Tracking
from body_tracker import BodyTracker

# 音声処理
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wavfile

# STT
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("[WARN] Whisper is not installed (pip install openai-whisper)")

# Ollama API
import requests

# TTS
try:
    from gtts import gTTS
    import io
    import base64
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False
    print("[WARN] gTTS is not installed (pip install gtts)")

app = Flask(__name__)
CORS(app)
sock = Sock(app)


# 設定
CONFIG = {
    "stt": {
        "model": "base",  # tiny, base, small, medium
        "language": "ja",
        "sample_rate": 16000,
        "buffer_duration": 3.0,
    },
    "llm": {
        "url": "http://localhost:11434",  # Ollama default
        "model": "qwen2.5:3b-instruct-q4_K_M",
        "max_tokens": 100,
        "temperature": 0.8,
        "system_prompt": """あなたは白山の里山に住む、優しくて親しみやすい相棒です。
言葉には「水」「流れ」「澄む」「峠」などの自然の比喩を控えめに使い、
短く、テンポよく応答します。冗長にならず、相手の意図をくみ取って一言で提案します。

例：
- ユーザー「疲れた...」→ あなた「お疲れさま。少し流れに身を任せてみる？」
- ユーザー「何か面白いことない?」→ あなた「峠を越える冒険はどう？」
"""
    },
    "tts": {
        "model": "ja-JP-wavenet-B",
        "speed": 1.1,
        "pitch": 1.2,
    }
}

# グローバル変数
whisper_model = None
audio_queue = queue.Queue()
is_recording = False
is_recording = False
body_tracker = None  # MediaPipe Body Tracker
virtual_cam = None   # Virtual Camera



def init_whisper():
    """Whisperモデルの初期化"""
    global whisper_model
    
    if not WHISPER_AVAILABLE:
        print("⚠️ Whisper未インストール、STT無効")
        return False
    
    try:
        model_name = CONFIG["stt"]["model"]
        print(f"[LOAD] Whisper {model_name} model loading...")
        whisper_model = whisper.load_model(model_name)
        print(f"[OK] Whisper initialized")
        return True
    except Exception as e:
        print(f"[ERROR] Whisper initialization error: {e}")
        return False


def stt_transcribe(audio_data):
    """音声からテキストへ変換"""
    if not whisper_model:
        return {"error": "Whisperモデル未初期化"}
    
    try:
        # 一時ファイルに保存
        temp_file = "temp_audio.wav"
        wavfile.write(temp_file, CONFIG["stt"]["sample_rate"], audio_data)
        
        # 文字起こし
        result = whisper_model.transcribe(
            temp_file,
            language=CONFIG["stt"]["language"],
            fp16=False  # CPUの場合はFalse
        )
        
        # クリーンアップ
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        return {"text": result["text"], "language": result["language"]}
    
    except Exception as e:
        print(f"❌ STTエラー: {e}")
        return {"error": str(e)}


def llm_generate(prompt, system_prompt=None):
    """Ollama LLMで応答生成"""
    try:
        url = f"{CONFIG['llm']['url']}/api/generate"
        
        payload = {
            "model": CONFIG["llm"]["model"],
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": CONFIG["llm"]["temperature"],
                "num_predict": CONFIG["llm"]["max_tokens"],
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return {"text": result.get("response", ""), "model": result.get("model")}
    
    except requests.exceptions.ConnectionError:
        return {"error": "Ollamaに接続できません。起動していますか？"}
    except Exception as e:
        print(f"[ERROR] LLM Error: {e}")
        return {"error": str(e)}


def tts_synthesize(text):
    """テキストから音声合成（gTTS）"""
    if not TTS_AVAILABLE:
        print(f"⚠️ TTS: gTTSが利用できません")
        return {"audio": None, "message": "TTS未インストール"}
    
    try:
        # gTTSで音声合成
        tts = gTTS(text=text, lang='ja', slow=False)
        
        # メモリ上のバッファに保存
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        # Base64エンコード
        audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')
        
        print(f"[TTS] Synthesizing: {text[:30]}...")
        return {
            "audio": audio_base64,
            "format": "mp3",
            "message": "音声合成完了"
        }
    except Exception as e:
        print(f"[ERROR] TTS Error: {e}")
        return {"audio": None, "message": f"TTS failure: {str(e)}"}


# ===== API エンドポイント =====

@app.route('/health', methods=['GET'])
def health_check():
    """ヘルスチェック"""
    return jsonify({
        "status": "ok",
        "services": {
            "stt": whisper_model is not None,
            "llm": check_ollama_status(),
            "tts": TTS_AVAILABLE
        }
    })


@app.route('/stt', methods=['POST'])
def stt_endpoint():
    """音声認識エンドポイント"""
    if not whisper_model:
        return jsonify({"error": "STT未初期化"}), 503
    
    try:
        # 音声データ受信（base64 or バイナリ）
        audio_data = request.files.get('audio')
        if not audio_data:
            return jsonify({"error": "音声データがありません"}), 400
        
        # NumPy配列に変換
        audio_bytes = audio_data.read()
        audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
        
        # 文字起こし
        result = stt_transcribe(audio_array)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/llm', methods=['POST'])
def llm_endpoint():
    """LLM推論エンドポイント"""
    data = request.json
    
    if not data or 'prompt' not in data:
        return jsonify({"error": "promptが必要です"}), 400
    
    prompt = data['prompt']
    system_prompt = data.get('system_prompt', CONFIG['llm']['system_prompt'])
    
    result = llm_generate(prompt, system_prompt)
    
    return jsonify(result)


@app.route('/tts', methods=['POST'])
def tts_endpoint():
    """音声合成エンドポイント"""
    data = request.json
    
    if not data or 'text' not in data:
        return jsonify({"error": "textが必要です"}), 400
    
    result = tts_synthesize(data['text'])
    
    return jsonify(result)


@app.route('/chat', methods=['POST'])
def chat_endpoint():
    """統合チャット（STT → LLM → TTS）"""
    data = request.json
    
    if not data or 'text' not in data:
        return jsonify({"error": "textが必要です"}), 400
    
    user_input = data['text']
    
    # LLM応答生成
    llm_result = llm_generate(user_input, CONFIG['llm']['system_prompt'])
    
    if 'error' in llm_result:
        return jsonify(llm_result), 500
    
    response_text = llm_result['text']
    
    # TTS（音声合成）
    tts_result = tts_synthesize(response_text)
    
    return jsonify({
        "input": user_input,
        "response": response_text,
        "audio": tts_result.get('audio'),
        "audio_format": tts_result.get('format', 'mp3')
    })


@sock.route('/stream')
def stream_socket(ws):
    """ブラウザからの映像フレームを受信するWebSocket"""
    global virtual_cam
    
    # 仮想カメラが起動していない場合は起動
    if not virtual_cam:
        virtual_cam = VirtualCamera()
        if not virtual_cam.start():
            # 起動失敗した場合
            ws.close()
            return

    print("🔌 WebSocket: 映像ストリーム接続")
    
    try:
        while True:
            # バイナリデータ(JPEG/PNG)を受信
            data = ws.receive()
            if data:
                virtual_cam.send_frame(data)
                
    except Exception as e:
        print(f"[WARN] WebSocket disconnected: {e}")
    finally:
        pass
        # 接続が切れてもカメラは維持する（再接続のため）



def check_ollama_status():
    """Ollamaが起動しているか確認"""
    try:
        response = requests.get(f"{CONFIG['llm']['url']}/api/tags", timeout=3)
        return response.status_code == 200
    except:
        return False


# ===== メイン処理 =====

if __name__ == '__main__':
    print("""
+------------------------------------------+
|  VRabater AI Service                     |
+------------------------------------------+
|  STT: Whisper (Local)                    |
|  LLM: Ollama                             |
|  TTS: gTTS (Google Text-to-Speech)       |
|  Body: MediaPipe Holistic                |
+------------------------------------------+
    """)
    
    # Whisper初期化
    if WHISPER_AVAILABLE:
        init_whisper()
    
    # Ollama確認
    if check_ollama_status():
        print(f"[OK] Ollama connection OK: {CONFIG['llm']['url']}")
    else:
        print(f"[WARN] Ollama is not running: {CONFIG['llm']['url']}")
        print("   How to start: ollama serve")
    
    # Body Tracker初期化 & 起動
    print("[LOAD] Body Tracking initializing...")
    try:
        # Body Trackerを起動 (※ OpenSeeFaceとカメラが競合するため、デフォルトではOFFにします)
        # ユーザー要望により有効化: カメラ競合に注意
        body_tracker = BodyTracker()
        if body_tracker.start():
             print("[OK] Body Tracking started")
        else:
             print("[WARN] Body Tracking start failed (Camera busy?)")
             body_tracker = None

    except Exception as e:
        print(f"[ERROR] Body Tracking Error: {e}")
        body_tracker = None

    except Exception as e:
        print(f"⚠️ Body Tracking エラー: {e}")
        body_tracker = None
    
    # Flask起動
    print("\n[START] AI Service starting: http://localhost:5000\n")
    try:
        app.run(host='0.0.0.0', port=5000, debug=False)
    finally:
        # 終了時にBody Trackerを停止
        if body_tracker:
            body_tracker.stop()
        if virtual_cam:
            virtual_cam.stop()


