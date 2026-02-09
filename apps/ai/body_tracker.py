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
        pose_model_path = os.path.join(base_path, "models", "pose_landmarker.task")
        
        # Init Face Landmarker (DISABLED - CAUSES HANG)
        self.face_landmarker = None
        
        # Init Pose Landmarker
        try:
            print("[INFO] Tracker v2 Starting... (Coordinate Logging Enabled)")
            pose_options = vision.PoseLandmarkerOptions(
                base_options=python.BaseOptions(model_asset_path=pose_model_path),
                running_mode=vision.RunningMode.IMAGE
            )
            self.pose_landmarker = vision.PoseLandmarker.create_from_options(pose_options)
            print("[OK] PoseLandmarker initialized (Face Priority via Pose)")
        except Exception as e:
            print(f"[ERROR] PoseLandmarker Init Error: {e}")
            self.pose_landmarker = None
        
        # 3D Model points for PnP (Adjusted for Pose Landmarks)
        # Using 5 points: Nose, L-Eye, R-Eye, L-Mouth, R-Mouth
        self.face_3d = np.array([
            (0.0, 0.0, 0.0),             # Nose (0)
            (-225.0, 170.0, -135.0),     # Left Eye (2/3)
            (225.0, 170.0, -135.0),      # Right Eye (5/6)
            (-150.0, -150.0, -125.0),    # Left Mouth (9)
            (150.0, -150.0, -125.0)      # Right Mouth (10)
        ], dtype=np.float64)
    
    def start(self):
        """Start camera and tracking."""
        if self.running:
            print("[WARN] Already running")
            return True
        
        # Try camera IDs 0, 1, 2 (Reverted to 0 first as it worked before)
        for cam_id in [0, 1, 2]:
            print(f"SEARCH Checking camera ID {cam_id}...")
            self.cap = cv2.VideoCapture(cam_id)
            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    print(f"[OK] Camera opened successfully (ID: {cam_id})")
                    self.camera_id = cam_id
                    self.cap.release() # Release so tracking loop can open it
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
        print(f"[INFO] Tracker started.")
        self.cap = cv2.VideoCapture(self.camera_id)
        
        # FPS Calculation
        frame_count = 0
        start_time = time.time()

        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                print("[WARN] Camera frame empty. Retrying...")
                time.sleep(0.5)
                continue

            try:
                # To improve performance, optionally mark the image as not writeable to
                # pass by reference.
                frame.flags.writeable = False
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # 1. Body Tracking (Pose) - NOW INCLUDES FACE APPROX
                pose_result = None
                if self.pose_landmarker:
                    pose_result = self.pose_landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame))

                frame.flags.writeable = True
                # frame = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR) # Not needed if we don't display

                img_h, img_w, _ = frame.shape

                if pose_result and pose_result.pose_landmarks:
                    landmarks = pose_result.pose_landmarks[0]
                    # Process Body
                    self._send_pose_data(landmarks) # Renamed from _process_body_pose to match existing
                    
                    # Process Face
                    self._process_face_from_pose(landmarks, img_w, img_h)
                    
                    # FPS/Status Log (Every 30 frames ~ 1 sec)
                    frame_count += 1
                    if frame_count % 30 == 0:
                        elapsed = time.time() - start_time
                        fps = frame_count / elapsed
                        print(f"[STATUS] FPS: {fps:.1f} | Tracking Active")
                        frame_count = 0
                        start_time = time.time()
                    
                else:
                    # If no pose is detected
                    frame_count += 1
                    if frame_count % 30 == 0:
                        elapsed = time.time() - start_time
                        fps = frame_count / elapsed
                        print(f"[STATUS] FPS: {fps:.1f} | Searching for body...")
                        frame_count = 0
                        start_time = time.time()

            except Exception as e:
                print(f"[ERROR] Tracking loop error: {e}")
                # Simple retry logic (optional, but keep it minimal)
                time.sleep(1.0)
                import traceback
                traceback.print_exc()
            
            # CPU performance control
            time.sleep(0.01)

    def _send_pose_data(self, landmarks):
        """Extract landmarks and send via OSC"""
        # Map: BodyTracker Key -> (Gateway Part, Gateway Side)
        landmark_map = {
            'left_shoulder': ('shoulder', 'left', 11),
            'right_shoulder': ('shoulder', 'right', 12),
            'left_elbow': ('elbow', 'left', 13),
            'right_elbow': ('elbow', 'right', 14),
            'left_wrist': ('wrist', 'left', 15),
            'right_wrist': ('wrist', 'right', 16),
            # Add hips/knees if needed, assuming Gateway supports them
            # 'left_hip': ('hip', 'left', 23),
            # 'right_hip': ('hip', 'right', 24),
        }
        
        for key, (part, side, idx) in landmark_map.items():
            lm = landmarks[idx]
            # Send /body/{part}/{side} x y z
            self.osc_client.send_message(f"/body/{part}/{side}", [float(lm.x), float(lm.y), float(lm.z)])

        # Log coordinates occasionally for debugging
        left_wrist = landmarks[15]
        print(f"[COORD] L-Wrist: ({left_wrist.x:.2f}, {left_wrist.y:.2f}, {left_wrist.z:.2f})")

    def _process_face_from_pose(self, landmarks, img_w, img_h):
        """Estimate head rotation using Pose Landmarks (0-10)"""
        # Pose Landmarks: 0=Nose, 2=LEye, 5=REye, 9=LMouth, 10=RMouth
        pnp_indices = [0, 2, 5, 9, 10]
        
        face_2d = []
        for idx in pnp_indices:
            lm = landmarks[idx]
            face_2d.append([lm.x * img_w, lm.y * img_h])
        
        face_2d = np.array(face_2d, dtype=np.float64)
        
        focal_length = img_w
        cam_matrix = np.array([
            [focal_length, 0, img_h / 2],
            [0, focal_length, img_w / 2],
            [0, 0, 1]
        ], dtype=np.float64)
        
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)
        success, rot_vec, trans_vec = cv2.solvePnP(self.face_3d, face_2d, cam_matrix, dist_coeffs, flags=cv2.SOLVEPNP_EPNP)
        
        if success:
            rmat, _ = cv2.Rodrigues(rot_vec)
            # Manual Rotation Matrix to Euler Angles conversion
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
            
            # Convert to degrees for easier debugging and likely receiver expectation
            pitch = x * (180.0 / np.pi)
            yaw = y * (180.0 / np.pi)
            roll = z * (180.0 / np.pi)
            
            self.osc_client.send_message("/face/rotation", [float(pitch), float(yaw), float(roll)])
            print(f"[DEBUG] Face Rot: P={pitch:.2f}, Y={yaw:.2f}, R={roll:.2f}")

        # Reset Face expression for safety
        self.osc_client.send_message("/face/blink", 0.0)
        self.osc_client.send_message("/face/mouth", [0.0, 0.0])
        self.osc_client.send_message("/face/eye", [0.0, 0.0])

    # ---------------------------------------------------------
    # ERROR HANDLING UNCOMMENTED
    # ---------------------------------------------------------
            # except Exception as e:
            #    print(f"[ERROR] Tracking error: {e}")
            #    pass

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
