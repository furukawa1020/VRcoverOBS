"""
Body and Face Tracking using cvzone (MediaPipe wrapper)
Provides compatibility layer for Windows MediaPipe issues
"""

import os
import sys
import cv2
import threading
import time
import numpy as np
from pythonosc import udp_client

# Import cvzone wrappers
try:
    from cvzone.PoseModule import PoseDetector
    from cvzone.FaceMeshModule import FaceMeshDetector
    CVZONE_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ cvzone import error: {e}")
    CVZONE_AVAILABLE = False

class BodyTracker:
    def __init__(self, osc_host="127.0.0.1", osc_port=11574):
        if not CVZONE_AVAILABLE:
            print("❌ cvzone not available")
            return
            
        # OSC client for sending data to Gateway
        self.osc_client = udp_client.SimpleUDPClient(osc_host, osc_port)
        
        # Camera
        self.cap = None
        self.running = False
        self.thread = None
        
        # Initialize detectors
        try:
            self.pose_detector = PoseDetector(
                staticMode=False,
                modelComplexity=1,
                smoothLandmarks=True,
                detectionCon=0.5,
                trackCon=0.5
            )
            self.face_detector = FaceMeshDetector(
                staticMode=False,
                maxFaces=1,
                minDetectionCon=0.5,
                minTrackCon=0.5
            )
            print("✅ BodyTracker initialized (cvzone)")
        except Exception as e:
            print(f"❌ Failed to create detectors: {e}")
            self.pose_detector = None
            self.face_detector = None
    
    def start(self, camera_id=0):
        """Start camera and tracking"""
        if not CVZONE_AVAILABLE or not self.pose_detector:
            print("❌ Cannot start: cvzone not initialized")
            return False
            
        if self.running:
            print("⚠️ Already running")
            return True
        
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
            
            # 1. Body Tracking (Pose)
            try:
                frame = self.pose_detector.findPose(frame, draw=False)
                lmList, bboxInfo = self.pose_detector.findPosition(frame, draw=False)
                
                if lmList:
                    self._send_pose_data(lmList)
            except Exception as e:
                pass  # Suppress pose errors
            
            # 2. Face Tracking
            try:
                frame, faces = self.face_detector.findFaceMesh(frame, draw=False)
                
                if faces:
                    self._process_face(faces[0], img_w, img_h)
            except Exception as e:
                pass  # Suppress face errors
            
            # FPS counter
            fps_counter += 1
            if time.time() - fps_time > 1.0:
                fps_counter = 0
                fps_time = time.time()
            
            # Show preview
            cv2.imshow("VRabater Tracker (cvzone)", frame)
            
            # Press 'q' to quit
            if cv2.waitKey(1) & 0xFF == ord('q'):
                self.running = False
                break
    
    def _send_pose_data(self, lmList):
        """Send pose data via OSC"""
        try:
            # cvzone PoseDetector returns list: [id, x, y, z]
            # MediaPipe Pose landmarks indices
            landmark_map = {
                'left_shoulder': 11,
                'right_shoulder': 12,
                'left_elbow': 13,
                'right_elbow': 14,
                'left_wrist': 15,
                'right_wrist': 16,
            }
            
            # Send each landmark
            for part_name, landmark_id in landmark_map.items():
                if landmark_id < len(lmList):
                    lm = lmList[landmark_id]
                    # lm format: [id, x_pixels, y_pixels, z_depth]
                    # Normalize to 0-1 range
                    x = lm[1] / 640.0 if len(lm) > 1 else 0
                    y = lm[2] / 480.0 if len(lm) > 2 else 0
                    z = lm[3] if len(lm) > 3 else 0
                    
                    # Send as /body/{part}/{x,y,z}
                    self.osc_client.send_message(f"/body/{part_name}/x", x)
                    self.osc_client.send_message(f"/body/{part_name}/y", y)
                    self.osc_client.send_message(f"/body/{part_name}/z", z)
        
        except Exception as e:
            pass  # Suppress OSC errors
    
    def _process_face(self, face_landmarks, img_w, img_h):
        """Process face tracking data and send via OSC"""
        try:
            # face_landmarks is a list of [x, y, z] for each landmark
            # Calculate head rotation using PnP
            
            # Key points for PnP (Nose, Chin, Eyes, Mouth)
            # Face mesh indices: Nose tip=1, Chin=152, Left eye=33, Right eye=263
            face_indices = [1, 152, 33, 263, 61, 291]
            
            face_2d = []
            for idx in face_indices:
                if idx < len(face_landmarks):
                    lm = face_landmarks[idx]
                    x, y = int(lm[0]), int(lm[1])
                    face_2d.append([x, y])
            
            if len(face_2d) != 6:
                return
            
            face_2d = np.array(face_2d, dtype=np.float64)
            
            # 3D model points
            face_3d = np.array([
                (0.0, 0.0, 0.0),             # Nose
                (0.0, -330.0, -65.0),        # Chin
                (-225.0, 170.0, -135.0),     # Left Eye
                (225.0, 170.0, -135.0),      # Right Eye
                (-150.0, -150.0, -125.0),    # Left Mouth
                (150.0, -150.0, -125.0)      # Right Mouth
            ], dtype=np.float64)
            
            # Camera matrix
            focal_length = 1 * img_w
            cam_matrix = np.array([
                [focal_length, 0, img_h / 2],
                [0, focal_length, img_w / 2],
                [0, 0, 1]
            ], dtype=np.float64)
            dist_coeffs = np.zeros((4, 1), dtype=np.float64)
            
            # Solve PnP
            success, rot_vec, trans_vec = cv2.solvePnP(face_3d, face_2d, cam_matrix, dist_coeffs)
            
            if success:
                rmat, _ = cv2.Rodrigues(rot_vec)
                
                # Calculate Euler angles
                sy = np.sqrt(rmat[0,0] * rmat[0,0] + rmat[1,0] * rmat[1,0])
                singular = sy < 1e-6
                
                if not singular:
                    x = np.arctan2(rmat[2,1], rmat[2,2])
                    y = np.arctan2(-rmat[2,0], sy)
                    z = np.arctan2(rmat[1,0], rmat[0,0])
                else:
                    x = np.arctan2(-rmat[1,2], rmat[1,1])
                    y = np.arctan2(-rmat[2,0], sy)
                    z = 0
                
                # Convert to degrees
                pitch = np.degrees(x)
                yaw = np.degrees(y)
                roll = np.degrees(z)
                
                self.osc_client.send_message("/face/rotation", pitch, yaw, roll)
            
            # Simple blink detection using eye landmarks
            # Left eye: 159 (top), 145 (bottom)
            # Right eye: 386 (top), 374 (bottom)
            if 159 < len(face_landmarks) and 145 < len(face_landmarks):
                left_eye_h = abs(face_landmarks[159][1] - face_landmarks[145][1])
                right_eye_h = abs(face_landmarks[386][1] - face_landmarks[374][1]) if 386 < len(face_landmarks) else left_eye_h
                
                avg_eye_h = (left_eye_h + right_eye_h) / 2
                blink = 1.0 if avg_eye_h < 5 else 0.0  # Threshold in pixels
                
                self.osc_client.send_message("/face/blink", blink)
            
            # Mouth detection
            if 13 < len(face_landmarks) and 14 < len(face_landmarks):
                mouth_h = abs(face_landmarks[13][1] - face_landmarks[14][1])
                mouth_open = max(0.0, min(1.0, (mouth_h - 10) / 20))
                
                self.osc_client.send_message("/face/mouth", mouth_open, 0.0)
            
            # Eye gaze (center for now)
            self.osc_client.send_message("/face/eye", 0.0, 0.0)
            
        except Exception as e:
            pass  # Suppress face processing errors

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
