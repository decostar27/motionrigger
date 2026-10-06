import importlib

import cv2
import mediapipe as mp
import numpy as np
from scipy.spatial.transform import Rotation as R
from bvh_export import BVHWriter, get_bvh_bone_directions

try:
    mp_pose = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils
except AttributeError:
    try:
        mp_pose = importlib.import_module('mediapipe.python.solutions.pose')
        mp_drawing = importlib.import_module('mediapipe.python.solutions.drawing_utils')
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "MediaPipe legacy pose API is unavailable. Install a compatible version such as "
            "'mediapipe==0.10.14' on Python 3.12 and re-run this script."
        ) from exc

def vector_to_quaternion(v_from, v_to):
    """Calculates the shortest arc quaternion that rotates v_from to v_to."""
    v_from = v_from / np.linalg.norm(v_from)
    v_to = v_to / np.linalg.norm(v_to)
    
    dot = np.dot(v_from, v_to)
    if dot > 0.999999:
        return R.from_quat([0, 0, 0, 1])
    if dot < -0.999999:
        # 180 degree rotation around any orthogonal vector
        ortho = np.array([1, 0, 0])
        if abs(v_from[0]) > 0.9:
            ortho = np.array([0, 1, 0])
        axis = np.cross(v_from, ortho)
        axis = axis / np.linalg.norm(axis)
        return R.from_rotvec(np.pi * axis)
    
    axis = np.cross(v_from, v_to)
    w = np.sqrt((1.0 + dot) * 2.0)
    axis = axis / w
    return R.from_quat([axis[0], axis[1], axis[2], w / 2.0])

def midpoint(p1, p2):
    return np.array([(p1.x + p2.x)/2, (p1.y + p2.y)/2, (p1.z + p2.z)/2])

def get_landmark_vector(lm1, lm2):
    return np.array([lm2.x - lm1.x, -(lm2.y - lm1.y), -(lm2.z - lm1.z)]) # MediaPipe Y/Z are flipped

def extract_target_directions(landmarks):
    """Map MediaPipe landmarks to target bone directions."""
    l = landmarks.landmark
    dirs = {}
    
    # Hips & Spine
    hips_mid = midpoint(l[mp_pose.PoseLandmark.LEFT_HIP], l[mp_pose.PoseLandmark.RIGHT_HIP])
    shoulders_mid = midpoint(l[mp_pose.PoseLandmark.LEFT_SHOULDER], l[mp_pose.PoseLandmark.RIGHT_SHOULDER])
    spine_dir = np.array([shoulders_mid[0] - hips_mid[0], -(shoulders_mid[1] - hips_mid[1]), -(shoulders_mid[2] - hips_mid[2])])
    
    dirs['Hips'] = spine_dir
    dirs['Spine'] = spine_dir
    
    # Neck/Head
    nose = l[mp_pose.PoseLandmark.NOSE]
    head_dir = np.array([nose.x - shoulders_mid[0], -(nose.y - shoulders_mid[1]), -(nose.z - shoulders_mid[2])])
    dirs['Neck'] = head_dir
    dirs['Head'] = head_dir
    
    # Arms
    dirs['LeftShoulder'] = get_landmark_vector(l[mp_pose.PoseLandmark.LEFT_SHOULDER], l[mp_pose.PoseLandmark.LEFT_ELBOW])
    dirs['LeftArm'] = get_landmark_vector(l[mp_pose.PoseLandmark.LEFT_SHOULDER], l[mp_pose.PoseLandmark.LEFT_ELBOW])
    dirs['LeftForeArm'] = get_landmark_vector(l[mp_pose.PoseLandmark.LEFT_ELBOW], l[mp_pose.PoseLandmark.LEFT_WRIST])
    dirs['LeftHand'] = get_landmark_vector(l[mp_pose.PoseLandmark.LEFT_WRIST], l[mp_pose.PoseLandmark.LEFT_INDEX])
    
    dirs['RightShoulder'] = get_landmark_vector(l[mp_pose.PoseLandmark.RIGHT_SHOULDER], l[mp_pose.PoseLandmark.RIGHT_ELBOW])
    dirs['RightArm'] = get_landmark_vector(l[mp_pose.PoseLandmark.RIGHT_SHOULDER], l[mp_pose.PoseLandmark.RIGHT_ELBOW])
    dirs['RightForeArm'] = get_landmark_vector(l[mp_pose.PoseLandmark.RIGHT_ELBOW], l[mp_pose.PoseLandmark.RIGHT_WRIST])
    dirs['RightHand'] = get_landmark_vector(l[mp_pose.PoseLandmark.RIGHT_WRIST], l[mp_pose.PoseLandmark.RIGHT_INDEX])
    
    # Legs
    dirs['LeftUpLeg'] = get_landmark_vector(l[mp_pose.PoseLandmark.LEFT_HIP], l[mp_pose.PoseLandmark.LEFT_KNEE])
    dirs['LeftLeg'] = get_landmark_vector(l[mp_pose.PoseLandmark.LEFT_KNEE], l[mp_pose.PoseLandmark.LEFT_ANKLE])
    dirs['LeftFoot'] = get_landmark_vector(l[mp_pose.PoseLandmark.LEFT_ANKLE], l[mp_pose.PoseLandmark.LEFT_FOOT_INDEX])
    
    dirs['RightUpLeg'] = get_landmark_vector(l[mp_pose.PoseLandmark.RIGHT_HIP], l[mp_pose.PoseLandmark.RIGHT_KNEE])
    dirs['RightLeg'] = get_landmark_vector(l[mp_pose.PoseLandmark.RIGHT_KNEE], l[mp_pose.PoseLandmark.RIGHT_ANKLE])
    dirs['RightFoot'] = get_landmark_vector(l[mp_pose.PoseLandmark.RIGHT_ANKLE], l[mp_pose.PoseLandmark.RIGHT_FOOT_INDEX])
    
    return dirs, hips_mid

def main():
    cap = cv2.VideoCapture(0)
    
    writer = BVHWriter(fps=30)
    rest_dirs = get_bvh_bone_directions()
    
    print("Press 'q' to stop recording and save BVH.")
    
    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5, model_complexity=1) as pose:
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                break
                
            image.flags.writeable = False
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = pose.process(image)
            
            image.flags.writeable = True
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            if results.pose_world_landmarks:
                mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
                
                target_dirs, hips_pos = extract_target_directions(results.pose_world_landmarks)
                
                # Calculate global rotations
                global_quats = {}
                for bone_name, rest_dir in rest_dirs.items():
                    if bone_name in target_dirs:
                        target_dir = target_dirs[bone_name]
                        if np.linalg.norm(target_dir) > 1e-5:
                            q = vector_to_quaternion(rest_dir, target_dir)
                            global_quats[bone_name] = q
                        else:
                            global_quats[bone_name] = R.from_quat([0,0,0,1])
                    else:
                        global_quats[bone_name] = R.from_quat([0,0,0,1])
                
                # Convert to local Euler angles (ZXY)
                frame_data = []
                
                # Root position (scale mediapipe meters to cm, and map correctly)
                frame_data.extend([hips_pos[0]*100, -hips_pos[1]*100, -hips_pos[2]*100])
                
                def process_node(node, parent_global_quat):
                    # Get local quat
                    global_quat = global_quats.get(node.name, R.from_quat([0,0,0,1]))
                    local_quat = parent_global_quat.inv() * global_quat
                    
                    if not node.is_end_site:
                        # BVH ZXY mapping
                        euler = local_quat.as_euler('zxy', degrees=True)
                        frame_data.extend([euler[0], euler[1], euler[2]])
                        
                        for child in node.children:
                            process_node(child, global_quat)
                            
                process_node(writer.root, R.from_quat([0,0,0,1]))
                writer.add_frame(frame_data)
                
            cv2.imshow('Motion Capture', cv2.flip(image, 1))
            
            if cv2.waitKey(5) & 0xFF == ord('q'):
                break

    print(f"Writing {len(writer.frames)} frames to output.bvh...")
    writer.write('output.bvh')
    print("Done! You can import output.bvh into Blender or Maya.")
    
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
