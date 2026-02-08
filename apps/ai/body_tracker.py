"""
MediaPipe Holistic Tracking (Body + Face)
Replaces OpenSeeFace for single-camera setups.
"""

import os
import sys

# Fix MediaPipe path issue
venv_path = os.path.dirname(sys.executable)
site_packages = os.path.join(venv_path, 'Lib', 'site-packages')
mediapipe_path = os.path.join(site_packages, 'mediapipe')

# Set environment variable for MediaPipe
os.environ['MEDIAPIPE_DISABLE_GPU'] = '1'

import cv2
import mediapipe as mp
import threading
import time
import numpy as np
from pythonosc import udp_client

class BodyTracker:
    def __init__(self, osc_host="127.0.0.1", osc_port=11574):
        # MediaPipe setup (Use Holistic for Face+Body)
        self.mp_holistic = mp.solutions.holistic
        self.mp_drawing = mp.solutions.drawing_utils
        
        # Holistic model
        self.holistic = self.mp_holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            refine_face_landmarks=True, # Improves eye/iris tracking
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # OSC client for sending data to Gateway
        self.osc_client = udp_client.SimpleUDPClient(osc_host, osc_port)
        
        # Camera
        self.cap = None
        self.running = False
        self.thread = None
        
        # 3D Model points for PnP (Standard Face Mesh indices)
        self.face_3d = np.array([
            (0.0, 0.0, 0.0),             # Nose Tip
            (0.0, -330.0, -65.0),        # Chin
            (-225.0, 170.0, -135.0),     # Left Eye Left Corner
            (225.0, 170.0, -135.0),      # Right Eye Right Corner
            (-150.0, -150.0, -125.0),    # Left Mouth Corner
            (150.0, -150.0, -125.0)      # Right Mouth Corner
        ], dtype=np.float64)
        
        print("✅ HolisticTracker initialized")
    
    def start(self):
        """Start camera and tracking. Silently retry multiple IDs."""
        if self.running:
            print("⚠️ Already running")
            return True
        
        # Try camera IDs 0, 1, 2
        for cam_id in [0, 1, 2]:
            print(f"🔍 Checking camera ID {cam_id}...")
            self.cap = cv2.VideoCapture(cam_id)
            if self.cap.isOpened():
                # Test read
                ret, frame = self.cap.read()
                if ret:
                    print(f"✅ Camera opened successfully (ID: {cam_id})")
                    self.running = True
                    self.thread = threading.Thread(target=self._tracking_loop, daemon=True)
                    self.thread.start()
                    return True
                else:
                    print(f"⚠️ Camera {cam_id} opened but cannot read frame.")
                    self.cap.release()
            else:
                print(f"❌ Camera {cam_id} is not accessible.")
        
        print("❌ Could not find any working camera.")
        return False
    
    def stop(self):
        """Stop tracking"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        if self.cap:
            self.cap.release()
        print("🛑 Camera stopped")
    
    def _tracking_loop(self):
        """Main tracking loop"""
        fps_time = time.time()
        fps_counter = 0
        
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                print("⚠️ Failed to capture frame. Retrying...")
                time.sleep(0.5)
                continue
            
            # Flip horizontally (mirror mode)
            frame = cv2.flip(frame, 1)
            img_h, img_w, _ = frame.shape
            
            # Convert to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe Holistic
            results = self.holistic.process(rgb_frame)
            
            # 1. Body Tracking
            if results.pose_landmarks:
                self._send_pose_data(results.pose_landmarks)
            
            # 2. Face Tracking (Head Rotation & Expressions)
            if results.face_landmarks:
                self._process_face(results.face_landmarks, img_w, img_h)

            # FPS counter
            fps_counter += 1
            if time.time() - fps_time > 1.0:
                fps = fps_counter / (time.time() - fps_time)
                fps_counter = 0
                fps_time = time.time()
                # print(f"FPS: {fps:.1f}")
    
    def _send_pose_data(self, landmarks):
        """Send pose data via OSC"""
        try:
            landmark_map = {
                'left_shoulder': self.mp_holistic.PoseLandmark.LEFT_SHOULDER.value,
                'right_shoulder': self.mp_holistic.PoseLandmark.RIGHT_SHOULDER.value,
                'left_elbow': self.mp_holistic.PoseLandmark.LEFT_ELBOW.value,
                'right_elbow': self.mp_holistic.PoseLandmark.RIGHT_ELBOW.value,
                'left_wrist': self.mp_holistic.PoseLandmark.LEFT_WRIST.value,
                'right_wrist': self.mp_holistic.PoseLandmark.RIGHT_WRIST.value,
            }
            
            for part_name, landmark_id in landmark_map.items():
                lm = landmarks.landmark[landmark_id]
                self.osc_client.send_message(f"/body/{part_name}/x", lm.x)
                self.osc_client.send_message(f"/body/{part_name}/y", lm.y)
                self.osc_client.send_message(f"/body/{part_name}/z", lm.z)
        except Exception:
            pass

    def _process_face(self, landmarks, img_w, img_h):
        try:
             # Extract Keypoints for PnP
             face_2d = []
             for idx in [1, 152, 33, 263, 61, 291]:
                 lm = landmarks.landmark[idx]
                 x, y = int(lm.x * img_w), int(lm.y * img_h)
                 face_2d.append([x, y])
             
             face_2d = np.array(face_2d, dtype=np.float64)
             
             focal_length = 1 * img_w
             cam_matrix = np.array([
                 [focal_length, 0, img_h / 2],
                 [0, focal_length, img_w / 2],
                 [0, 0, 1]
             ], dtype=np.float64)
             dist_coeffs = np.zeros((4, 1), dtype=np.float64)
             
             success, rot_vec, trans_vec = cv2.solvePnP(self.face_3d, face_2d, cam_matrix, dist_coeffs)
             
             if success:
                 rmat, _ = cv2.Rodrigues(rot_vec)
                 sy = np.sqrt(rmat[0,0] * rmat[0,0] +  rmat[1,0] * rmat[1,0])
                 singular = sy < 1e-6
                 if not singular:
                     x = np.arctan2(rmat[2,1] , rmat[2,2])
                     y = np.arctan2(-rmat[2,0], sy)
                     z = np.arctan2(rmat[1,0], rmat[0,0])
                 else:
                     x = np.arctan2(-rmat[1,2], rmat[1,1])
                     y = np.arctan2(-rmat[2,0], sy)
                     z = 0

                 pitch = np.degrees(x)
                 yaw = np.degrees(y)
                 roll = np.degrees(z)
                 
                 self.osc_client.send_message("/face/rotation", pitch, yaw, roll)

             # Simple Blink detection
             left_eye_top = landmarks.landmark[159]
             left_eye_bottom = landmarks.landmark[145]
             left_open = abs(left_eye_top.y - left_eye_bottom.y)
             
             right_eye_top = landmarks.landmark[386]
             right_eye_bottom = landmarks.landmark[374]
             right_open = abs(right_eye_top.y - right_eye_bottom.y)
             
             blink = 0.0
             if (left_open + right_open) / 2 < 0.01: # Threshold based on normalized y
                 blink = 1.0
             
             # Simple Mouth detection
             upper_lip = landmarks.landmark[13]
             lower_lip = landmarks.landmark[14]
             mouth_dist = abs(upper_lip.y - lower_lip.y)
             
             mouth_open = 0.0
             if mouth_dist > 0.02:
                 mouth_open = (mouth_dist - 0.02) * 10
                 if mouth_open > 1.0: mouth_open = 1.0
                 
             self.osc_client.send_message("/face/blink", blink)
             self.osc_client.send_message("/face/mouth", mouth_open, 0.0)
             self.osc_client.send_message("/face/eye", 0.0, 0.0)

        except Exception:
            pass

if __name__ == "__main__":
    tracker = BodyTracker()
    if tracker.start():
        try:
            while tracker.running:
                time.sleep(0.1)
        except KeyboardInterrupt:
            pass
        finally:
            tracker.stop()
