import os
import sys
import cv2
import mediapipe as mp
import threading
import time
import numpy as np
from pythonosc import udp_client

# MediaPipe Tasks API imports
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Set environment variable for MediaPipe
os.environ['MEDIAPIPE_DISABLE_GPU'] = '1'

class BodyTracker:
    def __init__(self, osc_host="127.0.0.1", osc_port=11574):
        self.osc_host = osc_host
        self.osc_port = osc_port
        self.osc_client = udp_client.SimpleUDPClient(osc_host, osc_port)
        
        self.cap = None
        self.running = False
        self.thread = None
        
        # Paths to models
        base_path = os.path.dirname(os.path.abspath(__file__))
        face_model_path = os.path.join(base_path, "models", "face_landmarker.task")
        pose_model_path = os.path.join(base_path, "models", "pose_landmarker.task")
        
        # Check if models exist
        if not os.path.exists(face_model_path) or not os.path.exists(pose_model_path):
            print(f"[WARN] MediaPipe models missing in {base_path}/models")
        
        # Init Face Landmarker
        try:
            face_options = vision.FaceLandmarkerOptions(
                base_options=python.BaseOptions(model_asset_path=face_model_path),
                running_mode=vision.RunningMode.IMAGE,
                output_face_blendshapes=True
            )
            self.face_landmarker = vision.FaceLandmarker.create_from_options(face_options)
            print("[OK] FaceLandmarker initialized")
        except Exception as e:
            print(f"[ERROR] FaceLandmarker Init Error: {e}")
            self.face_landmarker = None
        
        # Init Pose Landmarker
        try:
            pose_options = vision.PoseLandmarkerOptions(
                base_options=python.BaseOptions(model_asset_path=pose_model_path),
                running_mode=vision.RunningMode.IMAGE
            )
            self.pose_landmarker = vision.PoseLandmarker.create_from_options(pose_options)
            print("[OK] PoseLandmarker initialized")
        except Exception as e:
            print(f"[ERROR] PoseLandmarker Init Error: {e}")
            self.pose_landmarker = None
        
        # 3D Model points for PnP
        self.face_3d = np.array([
            (0.0, 0.0, 0.0),             # Nose tip
            (0.0, -330.0, -65.0),        # Chin
            (-225.0, 170.0, -135.0),     # Left Eye Left Corner
            (225.0, 170.0, -135.0),      # Right Eye Right Corner
            (-150.0, -150.0, -125.0),    # Left Mouth Corner
            (150.0, -150.0, -125.0)      # Right Mouth Corner
        ], dtype=np.float64)
    
    def start(self):
        """Start camera and tracking."""
        if self.running:
            print("[WARN] Already running")
            return True
        
        # Try camera IDs 0, 1, 2
        for cam_id in [0, 1, 2]:
            print(f"SEARCH Checking camera ID {cam_id}...")
            self.cap = cv2.VideoCapture(cam_id)
            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    print(f"[OK] Camera opened successfully (ID: {cam_id})")
                    self.running = True
                    self.thread = threading.Thread(target=self._tracking_loop, daemon=True)
                    self.thread.start()
                    return True
                else:
                    self.cap.release()
            
        print("[ERROR] Could not find any working camera.")
        return False
    
    def stop(self):
        """Stop tracking"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        if self.cap:
            self.cap.release()
        print("[STOP] Camera stopped")
    
    def _tracking_loop(self):
        """Main tracking loop"""
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.1)
                continue
            
            frame = cv2.flip(frame, 1)
            img_h, img_w, _ = frame.shape
            
            # Convert to MediaPipe Image
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                
                # 1. Body Tracking (Pose)
                if self.pose_landmarker:
                    pose_result = self.pose_landmarker.detect(mp_image)
                    if pose_result and pose_result.pose_landmarks:
                        self._send_pose_data(pose_result.pose_landmarks[0])
                
                # 2. Face Tracking (Rotation & Expressions)
                if self.face_landmarker:
                    face_result = self.face_landmarker.detect(mp_image)
                    if face_result and face_result.face_landmarks:
                        self._process_face(face_result.face_landmarks[0], img_w, img_h)
            except Exception as e:
                # print(f"Tracking error: {e}")
                pass
            
            # CPU performance control
            time.sleep(0.01)

    def _send_pose_data(self, landmarks):
        """Extract landmarks and send via OSC"""
        landmark_map = {
            'left_shoulder': 11,
            'right_shoulder': 12,
            'left_elbow': 13,
            'right_elbow': 14,
            'left_wrist': 15,
            'right_wrist': 16,
        }
        
        for part_name, landmark_id in landmark_map.items():
            lm = landmarks[landmark_id]
            self.osc_client.send_message(f"/body/{part_name}/x", float(lm.x))
            self.osc_client.send_message(f"/body/{part_name}/y", float(lm.y))
            self.osc_client.send_message(f"/body/{part_name}/z", float(lm.z))

    def _process_face(self, face_landmarks, img_w, img_h):
        """Estimate head rotation using PnP"""
        pnp_indices = [1, 152, 33, 263, 61, 291]
        
        face_2d = []
        for idx in pnp_indices:
            lm = face_landmarks[idx]
            face_2d.append([lm.x * img_w, lm.y * img_h])
        
        face_2d = np.array(face_2d, dtype=np.float64)
        
        focal_length = img_w
        cam_matrix = np.array([
            [focal_length, 0, img_h / 2],
            [0, focal_length, img_w / 2],
            [0, 0, 1]
        ], dtype=np.float64)
        
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)
        success, rot_vec, trans_vec = cv2.solvePnP(self.face_3d, face_2d, cam_matrix, dist_coeffs)
        
        if success:
            rmat, _ = cv2.Rodrigues(rot_vec)
            angles, _, _, _, _, _ = cv2.RQDecompose(rmat)
            
            pitch = angles[0]
            yaw = angles[1]
            roll = angles[2]
            
            self.osc_client.send_message("/face/rotation", float(pitch), float(yaw), float(roll))

        # Basic Blink / Mouth
        eye_l_top = face_landmarks[159]
        eye_l_bot = face_landmarks[145]
        eye_dist = abs(eye_l_top.y - eye_l_bot.y)
        blink = 1.0 if eye_dist < 0.008 else 0.0
        self.osc_client.send_message("/face/blink", float(blink))
        
        m_top = face_landmarks[13]
        m_bot = face_landmarks[14]
        mouth_open = max(0.0, (m_bot.y - m_top.y - 0.01) * 20)
        self.osc_client.send_message("/face/mouth", float(mouth_open), 0.0)
        self.osc_client.send_message("/face/eye", 0.0, 0.0)

if __name__ == "__main__":
    tracker = BodyTracker()
    if tracker.start():
        try:
            print("[OK] Tracker running. Press Ctrl+C to stop.")
            while tracker.running:
                time.sleep(0.1)
        except KeyboardInterrupt:
            pass
        finally:
            tracker.stop()
