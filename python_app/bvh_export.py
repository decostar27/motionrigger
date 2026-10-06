import numpy as np
from scipy.spatial.transform import Rotation as R

class BVHNode:
    def __init__(self, name, offset, is_root=False, is_end_site=False):
        self.name = name
        self.offset = np.array(offset, dtype=float)
        self.is_root = is_root
        self.is_end_site = is_end_site
        self.children = []
        self.parent = None
        self.channels = ['Zrotation', 'Xrotation', 'Yrotation']
        if self.is_root:
            self.channels = ['Xposition', 'Yposition', 'Zposition'] + self.channels

    def add_child(self, child):
        self.children.append(child)
        child.parent = self

class BVHWriter:
    def __init__(self, fps=30):
        self.fps = fps
        self.root = None
        self.nodes = []
        self.frames = []
        self._build_skeleton()

    def _build_skeleton(self):
        # A basic simplified humanoid skeleton matching MediaPipe
        # Offsets are roughly based on a standard T-pose (scaled to ~1.7m)
        scale = 100.0 # cm
        
        self.root = BVHNode('Hips', [0, 100, 0], is_root=True)
        self.nodes.append(self.root)

        spine = BVHNode('Spine', [0, 10, 0])
        self.root.add_child(spine)
        self.nodes.append(spine)
        
        neck = BVHNode('Neck', [0, 15, 0])
        spine.add_child(neck)
        self.nodes.append(neck)
        
        head = BVHNode('Head', [0, 10, 0])
        neck.add_child(head)
        self.nodes.append(head)
        
        head_end = BVHNode('Head_End', [0, 10, 0], is_end_site=True)
        head.add_child(head_end)

        # Left Arm
        l_shoulder = BVHNode('LeftShoulder', [15, 10, 0])
        spine.add_child(l_shoulder)
        self.nodes.append(l_shoulder)
        
        l_arm = BVHNode('LeftArm', [15, 0, 0])
        l_shoulder.add_child(l_arm)
        self.nodes.append(l_arm)
        
        l_forearm = BVHNode('LeftForeArm', [25, 0, 0])
        l_arm.add_child(l_forearm)
        self.nodes.append(l_forearm)
        
        l_hand = BVHNode('LeftHand', [25, 0, 0])
        l_forearm.add_child(l_hand)
        self.nodes.append(l_hand)
        
        l_hand_end = BVHNode('LeftHand_End', [10, 0, 0], is_end_site=True)
        l_hand.add_child(l_hand_end)

        # Right Arm
        r_shoulder = BVHNode('RightShoulder', [-15, 10, 0])
        spine.add_child(r_shoulder)
        self.nodes.append(r_shoulder)
        
        r_arm = BVHNode('RightArm', [-15, 0, 0])
        r_shoulder.add_child(r_arm)
        self.nodes.append(r_arm)
        
        r_forearm = BVHNode('RightForeArm', [-25, 0, 0])
        r_arm.add_child(r_forearm)
        self.nodes.append(r_forearm)
        
        r_hand = BVHNode('RightHand', [-25, 0, 0])
        r_forearm.add_child(r_hand)
        self.nodes.append(r_hand)
        
        r_hand_end = BVHNode('RightHand_End', [-10, 0, 0], is_end_site=True)
        r_hand.add_child(r_hand_end)

        # Left Leg
        l_upleg = BVHNode('LeftUpLeg', [10, -5, 0])
        self.root.add_child(l_upleg)
        self.nodes.append(l_upleg)
        
        l_leg = BVHNode('LeftLeg', [0, -40, 0])
        l_upleg.add_child(l_leg)
        self.nodes.append(l_leg)
        
        l_foot = BVHNode('LeftFoot', [0, -40, 0])
        l_leg.add_child(l_foot)
        self.nodes.append(l_foot)
        
        l_foot_end = BVHNode('LeftFoot_End', [0, -10, 10], is_end_site=True)
        l_foot.add_child(l_foot_end)

        # Right Leg
        r_upleg = BVHNode('RightUpLeg', [-10, -5, 0])
        self.root.add_child(r_upleg)
        self.nodes.append(r_upleg)
        
        r_leg = BVHNode('RightLeg', [0, -40, 0])
        r_upleg.add_child(r_leg)
        self.nodes.append(r_leg)
        
        r_foot = BVHNode('RightFoot', [0, -40, 0])
        r_leg.add_child(r_foot)
        self.nodes.append(r_foot)
        
        r_foot_end = BVHNode('RightFoot_End', [0, -10, 10], is_end_site=True)
        r_foot.add_child(r_foot_end)

    def add_frame(self, frame_data):
        # frame_data is a list of floats corresponding to the channels of all nodes
        self.frames.append(frame_data)

    def write(self, filename):
        with open(filename, 'w') as f:
            f.write("HIERARCHY\n")
            self._write_node(f, self.root, 0)
            
            f.write("MOTION\n")
            f.write(f"Frames: {len(self.frames)}\n")
            f.write(f"Frame Time: {1.0 / self.fps:.6f}\n")
            
            for frame in self.frames:
                f.write(" ".join([f"{val:.4f}" for val in frame]) + "\n")

    def _write_node(self, f, node, indent_level):
        indent = "  " * indent_level
        if node.is_root:
            f.write(f"{indent}ROOT {node.name}\n")
        elif node.is_end_site:
            f.write(f"{indent}End Site\n")
        else:
            f.write(f"{indent}JOINT {node.name}\n")
            
        f.write(f"{indent}{{\n")
        indent_inner = "  " * (indent_level + 1)
        f.write(f"{indent_inner}OFFSET {node.offset[0]:.4f} {node.offset[1]:.4f} {node.offset[2]:.4f}\n")
        
        if not node.is_end_site:
            ch_str = " ".join(node.channels)
            f.write(f"{indent_inner}CHANNELS {len(node.channels)} {ch_str}\n")
            for child in node.children:
                self._write_node(f, child, indent_level + 1)
                
        f.write(f"{indent}}}\n")

def get_bvh_bone_directions():
    # Defines the vector direction for each bone in the rest T-pose
    return {
        'Hips': np.array([0, 1, 0]),
        'Spine': np.array([0, 1, 0]),
        'Neck': np.array([0, 1, 0]),
        'Head': np.array([0, 1, 0]),
        
        'LeftShoulder': np.array([1, 0, 0]),
        'LeftArm': np.array([1, 0, 0]),
        'LeftForeArm': np.array([1, 0, 0]),
        'LeftHand': np.array([1, 0, 0]),
        
        'RightShoulder': np.array([-1, 0, 0]),
        'RightArm': np.array([-1, 0, 0]),
        'RightForeArm': np.array([-1, 0, 0]),
        'RightHand': np.array([-1, 0, 0]),
        
        'LeftUpLeg': np.array([0, -1, 0]),
        'LeftLeg': np.array([0, -1, 0]),
        'LeftFoot': np.array([0, 0, 1]),
        
        'RightUpLeg': np.array([0, -1, 0]),
        'RightLeg': np.array([0, -1, 0]),
        'RightFoot': np.array([0, 0, 1]),
    }
