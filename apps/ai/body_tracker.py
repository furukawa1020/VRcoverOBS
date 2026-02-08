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
        
        # 3D Model points for PnP (Standard Face Mesh indices - derived from canonical face model)
        # Nose Tip: 1, Chin: 152, Left Eye Left: 33, Right Eye Right: 263, Mouth Left: 61, Mouth Right: 291
        # Approx 3D coord relative to center
        self.face_3d = np.array([
            (0.0, 0.0, 0.0),             # Nose Tip
            (0.0, -330.0, -65.0),        # Chin
            (-225.0, 170.0, -135.0),     # Left Eye Left Corner
            (225.0, 170.0, -135.0),      # Right Eye Right Corner
            (-150.0, -150.0, -125.0),    # Left Mouth Corner
            (150.0, -150.0, -125.0)      # Right Mouth Corner
        ], dtype=np.float64)
        
        print("✅ HolisticTracker initialized")
    
    def start(self, camera_id=0):
        """Start camera and tracking"""
        if self.running:
            print("⚠️ Already running")
            return True # Already running is success
        
        self.cap = cv2.VideoCapture(camera_id)
        if not self.cap.isOpened():
            print("❌ Cannot open camera")
            return False
        
        self.running = True
        self.thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self.thread.start()
        
        print(f"🎥 Camera started (ID: {camera_id})")
        return True
    
    def stop(self):
        """Stop tracking"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()
        print("🛑 Camera stopped")
    
    def _tracking_loop(self):
        """Main tracking loop"""
        fps_time = time.time()
        fps_counter = 0
        
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                print("⚠️ Failed to read frame")
                time.sleep(1)
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
                # self.mp_drawing.draw_landmarks(frame, results.pose_landmarks, self.mp_holistic.POSE_CONNECTIONS)
            
            # 2. Face Tracking (Head Rotation & Expressions)
            if results.face_landmarks:
                self._process_face(results.face_landmarks, img_w, img_h)

            # FPS counter
            fps_counter += 1
            if time.time() - fps_time > 1.0:
                fps = fps_counter / (time.time() - fps_time)
                fps_counter = 0
                fps_time = time.time()
                # cv2.putText(frame, f"FPS: {fps:.1f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            # Show preview
            cv2.imshow("VRabater Holistic", frame)
            
            # Press 'q' to quit
            if cv2.waitKey(1) & 0xFF == ord('q'):
                self.running = False
                break
    
    def _send_pose_data(self, landmarks):
        """Send pose data via OSC"""
        try:
            # Map MediaPipe landmarks to body parts
            landmark_map = {
                'left_shoulder': self.mp_holistic.PoseLandmark.LEFT_SHOULDER.value,
                'right_shoulder': self.mp_holistic.PoseLandmark.RIGHT_SHOULDER.value,
                'left_elbow': self.mp_holistic.PoseLandmark.LEFT_ELBOW.value,
                'right_elbow': self.mp_holistic.PoseLandmark.RIGHT_ELBOW.value,
                'left_wrist': self.mp_holistic.PoseLandmark.LEFT_WRIST.value,
                'right_wrist': self.mp_holistic.PoseLandmark.RIGHT_WRIST.value,
                # 'left_hip': self.mp_holistic.PoseLandmark.LEFT_HIP.value,
                # 'right_hip': self.mp_holistic.PoseLandmark.RIGHT_HIP.value,
            }
            
            # Send each landmark
            for part_name, landmark_id in landmark_map.items():
                lm = landmarks.landmark[landmark_id]
                
                # Send as /body/{part}/{x,y,z}
                self.osc_client.send_message(f"/body/{part_name}/x", lm.x)
                self.osc_client.send_message(f"/body/{part_name}/y", lm.y)
                self.osc_client.send_message(f"/body/{part_name}/z", lm.z)
        
        except Exception as e:
            pass
            # print(f"⚠️ OSC send error: {e}")

    def _process_face(self, landmarks, img_w, img_h):
        try:
             # Extract Keypoints for PnP (Nose, Chin, Eyes, Mouth)
             face_2d = []
             for idx in [1, 152, 33, 263, 61, 291]:
                 lm = landmarks.landmark[idx]
                 x, y = int(lm.x * img_w), int(lm.y * img_h)
                 face_2d.append([x, y])
             
             face_2d = np.array(face_2d, dtype=np.float64)
             
             # Camera Matrix (Approx)
             focal_length = 1 * img_w
             cam_matrix = np.array([
                 [focal_length, 0, img_h / 2],
                 [0, focal_length, img_w / 2],
                 [0, 0, 1]
             ], dtype=np.float64)
             dist_coeffs = np.zeros((4, 1), dtype=np.float64)
             
             # Solve PnP
             success, rot_vec, trans_vec = cv2.solvePnP(self.face_3d, face_2d, cam_matrix, dist_coeffs)
             
             if success:
                 rmat, _ = cv2.Rodrigues(rot_vec)
                 
                 # Manual Euler angle calculation (Yaw, Pitch, Roll)
                 # This depends on camera coordinate convention. 
                 # Assuming Standard: X right, Y down, Z forward
                 
                 # Pitch (X-axis rotation)
                 # Yaw (Y-axis rotation)
                 # Roll (Z-axis rotation)
                 
                 # Sy = sqrt(R00^2 + R10^2)
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

                 # Convert to Degrees
                 pitch = np.degrees(x)
                 yaw = np.degrees(y)
                 roll = np.degrees(z)
                 
                 # Map to OpenSeeFace convention (approx)
                 # OpenSeeFace: +Y is Up?? No, usually standard.
                 # Our AvatarSystem expects:
                 # Pitch: Negative = Up?
                 # Let's send standard values. AvatarSystem has offsets now.
                 
                 # IMPORTANT: PnP rotation 0,0,0 is looking straight at camera.
                 # Pitch might need inversion depending on Y-axis.
                 
                 self.osc_client.send_message("/face/rotation", pitch, yaw, roll)


             # Expressions (Simple Blink/Mouth)
             # Left Eye: top 159, bottom 145. Right Eye: top 386, bottom 374
             
             left_open = abs(landmarks.landmark[159].y - landmarks.landmark[145].y) * 100
             right_open = abs(landmarks.landmark[386].y - landmarks.landmark[374].y) * 100
             
             # Threshold for blink (approx 0.5 - 1.0 is open, < 0.3 is closed)
             # Depends heavily on distance. Ideally divide by face height.
             # Use simple constant for now.
             blink = 0.0
             if (left_open + right_open) / 2 < 0.5: # Extremely close? Need normalization.
                 blink = 1.0 # Or use refinement from Iris
             
             # Better blink detection: Ratio of eye height to eye width
             # Left Eye Width: 33 to 133
             ew_l = np.hypot(landmarks.landmark[33].x - landmarks.landmark[133].x, landmarks.landmark[33].y - landmarks.landmark[133].y)
             eh_l = np.hypot(landmarks.landmark[159].x - landmarks.landmark[145].x, landmarks.landmark[159].y - landmarks.landmark[145].y)
             ratio_l = eh_l / (ew_l + 1e-6)
             
             ew_r = np.hypot(landmarks.landmark[362].x - landmarks.landmark[263].x, landmarks.landmark[362].y - landmarks.landmark[263].y)
             eh_r = np.hypot(landmarks.landmark[386].x - landmarks.landmark[374].x, landmarks.landmark[386].y - landmarks.landmark[374].y)
             ratio_r = eh_r / (ew_r + 1e-6)
             
             avg_ratio = (ratio_l + ratio_r) / 2.0
             if avg_ratio < 0.15: # Common EAR threshold
                 blink = 1.0
             
             # Mouth: 13 (upper) to 14 (lower)
             # Normalization by face height (0 to 152)
             face_h = np.hypot(landmarks.landmark[10].x - landmarks.landmark[152].x, landmarks.landmark[10].y - landmarks.landmark[152].y)
             mw = np.hypot(landmarks.landmark[13].x - landmarks.landmark[14].x, landmarks.landmark[13].y - landmarks.landmark[14].y)
             
             mouth_ratio = mw / (face_h + 1e-6)
             
             mouth_open = 0.0
             if mouth_ratio > 0.05:
                 mouth_open = (mouth_ratio - 0.05) * 5.0 # Scale
                 if mouth_open > 1.0: mouth_open = 1.0
                 
             self.osc_client.send_message("/face/blink", blink)
             self.osc_client.send_message("/face/mouth", mouth_open, 0.0) # Open, Smile
             
             # Eye Gaze (Center 0,0)
             self.osc_client.send_message("/face/eye", 0.0, 0.0)

        except Exception as e:
            pass

if __name__ == "__main__":
    # Test standalone
    tracker = BodyTracker()
    if tracker.start():
        print("✅ Tracking started. Press 'q' in camera window to quit.")
        try:
            while tracker.running:
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\n⚠️ Interrupted")
        finally:
            tracker.stop()
    else:
        print("❌ Failed to start tracking")
