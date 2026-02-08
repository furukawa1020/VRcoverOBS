"""
MediaPipe Body Tracking (Updated for MediaPipe 0.10.x API)
Uses new 'tasks' API instead of deprecated 'solutions'.
"""

import os
import sys
import cv2
import threading
import time
import numpy as np
from pythonosc import udp_client

# Set environment variable for MediaPipe
os.environ['MEDIAPIPE_DISABLE_GPU'] = '1'

# Import new MediaPipe API
try:
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
    from mediapipe.framework.formats import landmark_pb2
    MEDIAPIPE_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ MediaPipe import error: {e}")
    MEDIAPIPE_AVAILABLE = False

class BodyTracker:
    def __init__(self, osc_host="127.0.0.1", osc_port=11574):
        if not MEDIAPIPE_AVAILABLE:
            print("❌ MediaPipe not available")
            return
            
        # OSC client for sending data to Gateway
        self.osc_client = udp_client.SimpleUDPClient(osc_host, osc_port)
        
        # Camera
        self.cap = None
        self.running = False
        self.thread = None
        
        # MediaPipe Pose Landmarker options
        base_options = python.BaseOptions(model_asset_path='')  # Use default model
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        try:
            self.pose_landmarker = vision.PoseLandmarker.create_from_options(options)
            print("✅ BodyTracker initialized (MediaPipe 0.10.x)")
        except Exception as e:
            print(f"❌ Failed to create PoseLandmarker: {e}")
            self.pose_landmarker = None
    
    def start(self, camera_id=0):
        """Start camera and tracking"""
        if not MEDIAPIPE_AVAILABLE or not self.pose_landmarker:
            print("❌ Cannot start: MediaPipe not initialized")
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
        frame_timestamp_ms = 0
        
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                print("⚠️ Failed to read frame")
                time.sleep(1)
                continue
            
            # Flip horizontally (mirror mode)
            frame = cv2.flip(frame, 1)
            
            # Convert to RGB (MediaPipe requirement)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            
            # Process frame
            try:
                frame_timestamp_ms += 33  # Approx 30 FPS
                result = self.pose_landmarker.detect_for_video(mp_image, frame_timestamp_ms)
                
                if result.pose_landmarks:
                    self._send_pose_data(result.pose_landmarks[0])
                    
            except Exception as e:
                print(f"⚠️ Tracking error: {e}")
            
            # FPS counter
            fps_counter += 1
            if time.time() - fps_time > 1.0:
                fps_counter = 0
                fps_time = time.time()
            
            # Show preview
            cv2.imshow("VRabater Body Tracker", frame)
            
            # Press 'q' to quit
            if cv2.waitKey(1) & 0xFF == ord('q'):
                self.running = False
                break
    
    def _send_pose_data(self, landmarks):
        """Send pose data via OSC"""
        try:
            # MediaPipe Pose landmarks indices
            # https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
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
                if landmark_id < len(landmarks):
                    lm = landmarks[landmark_id]
                    
                    # Send as /body/{part}/{x,y,z}
                    self.osc_client.send_message(f"/body/{part_name}/x", lm.x)
                    self.osc_client.send_message(f"/body/{part_name}/y", lm.y)
                    self.osc_client.send_message(f"/body/{part_name}/z", lm.z)
        
        except Exception as e:
            pass  # Suppress OSC errors

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
