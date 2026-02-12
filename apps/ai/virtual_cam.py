
import pyvirtualcam
import numpy as np
import cv2
import threading
import time

class VirtualCamera:
    def __init__(self, width=1280, height=720, fps=24):
        self.width = width
        self.height = height
        self.fps = fps
        self.cam = None
        self.running = False
        self.thread = None
        self.current_frame = None
        self.lock = threading.Lock()

    def start(self):
        """仮想カメラへの出力を開始"""
        if self.running:
            return

        try:
            # OBS Virtual Cameraなどを自動検出して接続
            # fmt=pyvirtualcam.PixelFormat.BGR (OpenCV用)
            self.cam = pyvirtualcam.Camera(
                width=self.width, 
                height=self.height, 
                fps=self.fps, 
                fmt=pyvirtualcam.PixelFormat.BGR
            )
            print(f"✅ 仮想カメラ開始: {self.cam.device} ({self.width}x{self.height} @ {self.fps}fps)")
            
            self.running = True
            self.thread = threading.Thread(target=self._loop, daemon=True)
            self.thread.start()
            return True
        except Exception as e:
            print(f"❌ 仮想カメラの初期化に失敗: {e}")
            print("   (OBS Virtual Cameraなどのドライバがインストールされているか確認してください)")
            return False

    def stop(self):
        """仮想カメラへの出力を停止"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        if self.cam:
            self.cam.close()
            self.cam = None
        print("🛑 仮想カメラ停止")

    def send_frame(self, frame_data):
        """
        画像データ(バイナリ)を受け取り、OpenCV形式に変換してセットする
        frame_data: bytes (JPEG/PNG encoded)
        """
        try:
            # バイナリ -> numpy array
            nparr = np.frombuffer(frame_data, np.uint8)
            # デコード (BGR形式)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return

            # リサイズが必要な場合
            if img.shape[1] != self.width or img.shape[0] != self.height:
                img = cv2.resize(img, (self.width, self.height))

            with self.lock:
                self.current_frame = img

        except Exception as e:
            print(f"⚠️ フレーム処理エラー: {e}")

    def _loop(self):
        """定期的にフレームを仮想カメラに送るループ"""
        print(f"🎥 仮想カメラ出力ループ開始")
        
        # デフォルトの黒画面
        blank_frame = np.zeros((self.height, self.width, 3), np.uint8)
        
        while self.running:
            start_time = time.time()

            with self.lock:
                if self.current_frame is not None:
                    # 最新のフレームを送る
                    self.cam.send(self.current_frame)
                else:
                    # フレームが来てないときは黒画面
                    self.cam.send(blank_frame)

            # FPS制御
            elapsed = time.time() - start_time
            sleep_time = max(0, (1.0 / self.fps) - elapsed)
            self.cam.sleep_until_next_frame()
