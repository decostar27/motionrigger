/* ========================================
   MotionRig – Skeleton Utilities
   Humanoid bone hierarchy, mapping, and
   rotation helpers for Three.js
   ======================================== */

import * as THREE from 'three';
import { LANDMARKS, midpoint, direction, normalize, cross } from './landmarkUtils.js';

/**
 * Standard humanoid bone names and hierarchy
 */
export const BONE_NAMES = {
  HIPS: 'Hips',
  SPINE: 'Spine',
  SPINE1: 'Spine1',
  SPINE2: 'Spine2',
  NECK: 'Neck',
  HEAD: 'Head',

  LEFT_SHOULDER: 'LeftShoulder',
  LEFT_ARM: 'LeftArm',
  LEFT_FOREARM: 'LeftForeArm',
  LEFT_HAND: 'LeftHand',

  RIGHT_SHOULDER: 'RightShoulder',
  RIGHT_ARM: 'RightArm',
  RIGHT_FOREARM: 'RightForeArm',
  RIGHT_HAND: 'RightHand',

  LEFT_UP_LEG: 'LeftUpLeg',
  LEFT_LEG: 'LeftLeg',
  LEFT_FOOT: 'LeftFoot',

  RIGHT_UP_LEG: 'RightUpLeg',
  RIGHT_LEG: 'RightLeg',
  RIGHT_FOOT: 'RightFoot',
};

/**
 * Bone hierarchy definition
 * parent -> [children]
 */
export const BONE_HIERARCHY = {
  [BONE_NAMES.HIPS]: [BONE_NAMES.SPINE, BONE_NAMES.LEFT_UP_LEG, BONE_NAMES.RIGHT_UP_LEG],
  [BONE_NAMES.SPINE]: [BONE_NAMES.SPINE1],
  [BONE_NAMES.SPINE1]: [BONE_NAMES.SPINE2],
  [BONE_NAMES.SPINE2]: [BONE_NAMES.NECK, BONE_NAMES.LEFT_SHOULDER, BONE_NAMES.RIGHT_SHOULDER],
  [BONE_NAMES.NECK]: [BONE_NAMES.HEAD],
  [BONE_NAMES.HEAD]: [],

  [BONE_NAMES.LEFT_SHOULDER]: [BONE_NAMES.LEFT_ARM],
  [BONE_NAMES.LEFT_ARM]: [BONE_NAMES.LEFT_FOREARM],
  [BONE_NAMES.LEFT_FOREARM]: [BONE_NAMES.LEFT_HAND],
  [BONE_NAMES.LEFT_HAND]: [],

  [BONE_NAMES.RIGHT_SHOULDER]: [BONE_NAMES.RIGHT_ARM],
  [BONE_NAMES.RIGHT_ARM]: [BONE_NAMES.RIGHT_FOREARM],
  [BONE_NAMES.RIGHT_FOREARM]: [BONE_NAMES.RIGHT_HAND],
  [BONE_NAMES.RIGHT_HAND]: [],

  [BONE_NAMES.LEFT_UP_LEG]: [BONE_NAMES.LEFT_LEG],
  [BONE_NAMES.LEFT_LEG]: [BONE_NAMES.LEFT_FOOT],
  [BONE_NAMES.LEFT_FOOT]: [],

  [BONE_NAMES.RIGHT_UP_LEG]: [BONE_NAMES.RIGHT_LEG],
  [BONE_NAMES.RIGHT_LEG]: [BONE_NAMES.RIGHT_FOOT],
  [BONE_NAMES.RIGHT_FOOT]: [],
};

/**
 * Mapping from MediaPipe landmark indices to bone positions
 * Each bone is defined by its position landmarks
 */
export const LANDMARK_TO_BONE = {
  [BONE_NAMES.HIPS]: { landmarks: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP], type: 'midpoint' },
  [BONE_NAMES.SPINE]: { landmarks: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER], type: 'spine_lower' },
  [BONE_NAMES.SPINE1]: { landmarks: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER], type: 'spine_mid' },
  [BONE_NAMES.SPINE2]: { landmarks: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER], type: 'midpoint' },
  [BONE_NAMES.NECK]: { landmarks: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER], type: 'neck' },
  [BONE_NAMES.HEAD]: { landmarks: [LANDMARKS.NOSE, LANDMARKS.LEFT_EAR, LANDMARKS.RIGHT_EAR], type: 'head' },

  [BONE_NAMES.LEFT_SHOULDER]: { landmarks: [LANDMARKS.LEFT_SHOULDER], type: 'single' },
  [BONE_NAMES.LEFT_ARM]: { landmarks: [LANDMARKS.LEFT_SHOULDER], type: 'single' },
  [BONE_NAMES.LEFT_FOREARM]: { landmarks: [LANDMARKS.LEFT_ELBOW], type: 'single' },
  [BONE_NAMES.LEFT_HAND]: { landmarks: [LANDMARKS.LEFT_WRIST], type: 'single' },

  [BONE_NAMES.RIGHT_SHOULDER]: { landmarks: [LANDMARKS.RIGHT_SHOULDER], type: 'single' },
  [BONE_NAMES.RIGHT_ARM]: { landmarks: [LANDMARKS.RIGHT_SHOULDER], type: 'single' },
  [BONE_NAMES.RIGHT_FOREARM]: { landmarks: [LANDMARKS.RIGHT_ELBOW], type: 'single' },
  [BONE_NAMES.RIGHT_HAND]: { landmarks: [LANDMARKS.RIGHT_WRIST], type: 'single' },

  [BONE_NAMES.LEFT_UP_LEG]: { landmarks: [LANDMARKS.LEFT_HIP], type: 'single' },
  [BONE_NAMES.LEFT_LEG]: { landmarks: [LANDMARKS.LEFT_KNEE], type: 'single' },
  [BONE_NAMES.LEFT_FOOT]: { landmarks: [LANDMARKS.LEFT_ANKLE], type: 'single' },

  [BONE_NAMES.RIGHT_UP_LEG]: { landmarks: [LANDMARKS.RIGHT_HIP], type: 'single' },
  [BONE_NAMES.RIGHT_LEG]: { landmarks: [LANDMARKS.RIGHT_KNEE], type: 'single' },
  [BONE_NAMES.RIGHT_FOOT]: { landmarks: [LANDMARKS.RIGHT_ANKLE], type: 'single' },
};

/**
 * Common alternative bone name patterns used in FBX/OBJ models.
 * Used for automatic bone name mapping.
 */
export const BONE_NAME_ALIASES = {
  [BONE_NAMES.HIPS]: ['hips', 'pelvis', 'root', 'hip', 'mixamorig:hips', 'bip01_pelvis'],
  [BONE_NAMES.SPINE]: ['spine', 'spine0', 'mixamorig:spine', 'bip01_spine'],
  [BONE_NAMES.SPINE1]: ['spine1', 'spine_01', 'mixamorig:spine1', 'bip01_spine1'],
  [BONE_NAMES.SPINE2]: ['spine2', 'spine_02', 'chest', 'mixamorig:spine2', 'bip01_spine2'],
  [BONE_NAMES.NECK]: ['neck', 'neck0', 'mixamorig:neck', 'bip01_neck'],
  [BONE_NAMES.HEAD]: ['head', 'mixamorig:head', 'bip01_head'],

  [BONE_NAMES.LEFT_SHOULDER]: ['leftshoulder', 'l_shoulder', 'shoulder_l', 'mixamorig:leftshoulder', 'bip01_l_clavicle'],
  [BONE_NAMES.LEFT_ARM]: ['leftarm', 'leftupperarm', 'l_arm', 'l_upperarm', 'arm_l', 'mixamorig:leftarm', 'bip01_l_upperarm'],
  [BONE_NAMES.LEFT_FOREARM]: ['leftforearm', 'leftlowerarm', 'l_forearm', 'l_lowerarm', 'forearm_l', 'mixamorig:leftforearm', 'bip01_l_forearm'],
  [BONE_NAMES.LEFT_HAND]: ['lefthand', 'l_hand', 'hand_l', 'mixamorig:lefthand', 'bip01_l_hand'],

  [BONE_NAMES.RIGHT_SHOULDER]: ['rightshoulder', 'r_shoulder', 'shoulder_r', 'mixamorig:rightshoulder', 'bip01_r_clavicle'],
  [BONE_NAMES.RIGHT_ARM]: ['rightarm', 'rightupperarm', 'r_arm', 'r_upperarm', 'arm_r', 'mixamorig:rightarm', 'bip01_r_upperarm'],
  [BONE_NAMES.RIGHT_FOREARM]: ['rightforearm', 'rightlowerarm', 'r_forearm', 'r_lowerarm', 'forearm_r', 'mixamorig:rightforearm', 'bip01_r_forearm'],
  [BONE_NAMES.RIGHT_HAND]: ['righthand', 'r_hand', 'hand_r', 'mixamorig:righthand', 'bip01_r_hand'],

  [BONE_NAMES.LEFT_UP_LEG]: ['leftupleg', 'leftthigh', 'l_thigh', 'l_upleg', 'thigh_l', 'mixamorig:leftupleg', 'bip01_l_thigh'],
  [BONE_NAMES.LEFT_LEG]: ['leftleg', 'leftshin', 'leftlowerleg', 'l_leg', 'l_shin', 'shin_l', 'mixamorig:leftleg', 'bip01_l_calf'],
  [BONE_NAMES.LEFT_FOOT]: ['leftfoot', 'l_foot', 'foot_l', 'mixamorig:leftfoot', 'bip01_l_foot'],

  [BONE_NAMES.RIGHT_UP_LEG]: ['rightupleg', 'rightthigh', 'r_thigh', 'r_upleg', 'thigh_r', 'mixamorig:rightupleg', 'bip01_r_thigh'],
  [BONE_NAMES.RIGHT_LEG]: ['rightleg', 'rightshin', 'rightlowerleg', 'r_leg', 'r_shin', 'shin_r', 'mixamorig:rightleg', 'bip01_r_calf'],
  [BONE_NAMES.RIGHT_FOOT]: ['rightfoot', 'r_foot', 'foot_r', 'mixamorig:rightfoot', 'bip01_r_foot'],
};

/**
 * Try to match a bone name from a model to our standard bone names
 */
export function matchBoneName(modelBoneName) {
  const lower = modelBoneName.toLowerCase().replace(/[\s_.-]/g, '');

  for (const [standardName, aliases] of Object.entries(BONE_NAME_ALIASES)) {
    for (const alias of aliases) {
      if (lower === alias.replace(/[\s_.-]/g, '')) {
        return standardName;
      }
    }
    // Fuzzy: check if the bone name contains the standard name
    if (lower.includes(standardName.toLowerCase())) {
      return standardName;
    }
  }

  return null;
}

/**
 * Create a humanoid skeleton from bone positions
 * Returns { skeleton, bones, rootBone }
 */
export function createHumanoidSkeleton(modelHeight = 1.7) {
  const bones = {};
  const boneArray = [];
  const scale = modelHeight;

  // T-pose positions (normalized, Y-up)
  const tPosePositions = {
    [BONE_NAMES.HIPS]: new THREE.Vector3(0, 0.53 * scale, 0),
    [BONE_NAMES.SPINE]: new THREE.Vector3(0, 0.57 * scale, 0),
    [BONE_NAMES.SPINE1]: new THREE.Vector3(0, 0.63 * scale, 0),
    [BONE_NAMES.SPINE2]: new THREE.Vector3(0, 0.72 * scale, 0),
    [BONE_NAMES.NECK]: new THREE.Vector3(0, 0.82 * scale, 0),
    [BONE_NAMES.HEAD]: new THREE.Vector3(0, 0.88 * scale, 0),

    [BONE_NAMES.LEFT_SHOULDER]: new THREE.Vector3(0.08 * scale, 0.80 * scale, 0),
    [BONE_NAMES.LEFT_ARM]: new THREE.Vector3(0.16 * scale, 0.80 * scale, 0),
    [BONE_NAMES.LEFT_FOREARM]: new THREE.Vector3(0.33 * scale, 0.80 * scale, 0),
    [BONE_NAMES.LEFT_HAND]: new THREE.Vector3(0.47 * scale, 0.80 * scale, 0),

    [BONE_NAMES.RIGHT_SHOULDER]: new THREE.Vector3(-0.08 * scale, 0.80 * scale, 0),
    [BONE_NAMES.RIGHT_ARM]: new THREE.Vector3(-0.16 * scale, 0.80 * scale, 0),
    [BONE_NAMES.RIGHT_FOREARM]: new THREE.Vector3(-0.33 * scale, 0.80 * scale, 0),
    [BONE_NAMES.RIGHT_HAND]: new THREE.Vector3(-0.47 * scale, 0.80 * scale, 0),

    [BONE_NAMES.LEFT_UP_LEG]: new THREE.Vector3(0.09 * scale, 0.50 * scale, 0),
    [BONE_NAMES.LEFT_LEG]: new THREE.Vector3(0.09 * scale, 0.28 * scale, 0),
    [BONE_NAMES.LEFT_FOOT]: new THREE.Vector3(0.09 * scale, 0.03 * scale, 0),

    [BONE_NAMES.RIGHT_UP_LEG]: new THREE.Vector3(-0.09 * scale, 0.50 * scale, 0),
    [BONE_NAMES.RIGHT_LEG]: new THREE.Vector3(-0.09 * scale, 0.28 * scale, 0),
    [BONE_NAMES.RIGHT_FOOT]: new THREE.Vector3(-0.09 * scale, 0.03 * scale, 0),
  };

  // Create bones
  function createBone(name, parentBone) {
    const bone = new THREE.Bone();
    bone.name = name;

    const worldPos = tPosePositions[name];

    if (parentBone) {
      const parentWorldPos = tPosePositions[parentBone.name];
      bone.position.copy(worldPos.clone().sub(parentWorldPos));
      parentBone.add(bone);
    } else {
      bone.position.copy(worldPos);
    }

    bones[name] = bone;
    boneArray.push(bone);

    // Create children
    const children = BONE_HIERARCHY[name] || [];
    for (const childName of children) {
      createBone(childName, bone);
    }

    return bone;
  }

  const rootBone = createBone(BONE_NAMES.HIPS, null);

  const skeleton = new THREE.Skeleton(boneArray);

  return { skeleton, bones, rootBone, tPosePositions };
}

/**
 * Calculate a quaternion rotation from a direction vector
 * relative to a reference (rest pose) direction
 */
export function quaternionFromDirections(fromDir, toDir) {
  const from = new THREE.Vector3(fromDir.x, fromDir.y, fromDir.z).normalize();
  const to = new THREE.Vector3(toDir.x, toDir.y, toDir.z).normalize();

  const quat = new THREE.Quaternion();
  quat.setFromUnitVectors(from, to);

  return quat;
}

/**
 * Compute bone rotation from MediaPipe landmarks
 * Converts landmark positions to bone-local quaternion rotations
 */
export function computeBoneRotation(boneName, landmarks, restPoseDir) {
  const L = LANDMARKS;

  let fromPos, toPos;
  let refDir = new THREE.Vector3(0, 1, 0); // Default up

  switch (boneName) {
    case BONE_NAMES.HIPS: {
      const leftHip = landmarks[L.LEFT_HIP];
      const rightHip = landmarks[L.RIGHT_HIP];
      const leftShoulder = landmarks[L.LEFT_SHOULDER];
      const rightShoulder = landmarks[L.RIGHT_SHOULDER];
      const hipMid = midpoint(leftHip, rightHip);
      const shoulderMid = midpoint(leftShoulder, rightShoulder);
      fromPos = hipMid;
      toPos = shoulderMid;
      break;
    }
    case BONE_NAMES.SPINE:
    case BONE_NAMES.SPINE1:
    case BONE_NAMES.SPINE2: {
      const lh = landmarks[L.LEFT_HIP];
      const rh = landmarks[L.RIGHT_HIP];
      const ls = landmarks[L.LEFT_SHOULDER];
      const rs = landmarks[L.RIGHT_SHOULDER];
      fromPos = midpoint(lh, rh);
      toPos = midpoint(ls, rs);
      break;
    }
    case BONE_NAMES.NECK: {
      const shoulderMid = midpoint(landmarks[L.LEFT_SHOULDER], landmarks[L.RIGHT_SHOULDER]);
      fromPos = shoulderMid;
      toPos = landmarks[L.NOSE];
      break;
    }
    case BONE_NAMES.HEAD: {
      fromPos = landmarks[L.NOSE];
      toPos = {
        x: landmarks[L.NOSE].x,
        y: landmarks[L.NOSE].y - 0.1,
        z: landmarks[L.NOSE].z,
      };
      break;
    }
    case BONE_NAMES.LEFT_ARM: {
      fromPos = landmarks[L.LEFT_SHOULDER];
      toPos = landmarks[L.LEFT_ELBOW];
      refDir = new THREE.Vector3(1, 0, 0);
      break;
    }
    case BONE_NAMES.LEFT_FOREARM: {
      fromPos = landmarks[L.LEFT_ELBOW];
      toPos = landmarks[L.LEFT_WRIST];
      refDir = new THREE.Vector3(1, 0, 0);
      break;
    }
    case BONE_NAMES.RIGHT_ARM: {
      fromPos = landmarks[L.RIGHT_SHOULDER];
      toPos = landmarks[L.RIGHT_ELBOW];
      refDir = new THREE.Vector3(-1, 0, 0);
      break;
    }
    case BONE_NAMES.RIGHT_FOREARM: {
      fromPos = landmarks[L.RIGHT_ELBOW];
      toPos = landmarks[L.RIGHT_WRIST];
      refDir = new THREE.Vector3(-1, 0, 0);
      break;
    }
    case BONE_NAMES.LEFT_UP_LEG: {
      fromPos = landmarks[L.LEFT_HIP];
      toPos = landmarks[L.LEFT_KNEE];
      refDir = new THREE.Vector3(0, -1, 0);
      break;
    }
    case BONE_NAMES.LEFT_LEG: {
      fromPos = landmarks[L.LEFT_KNEE];
      toPos = landmarks[L.LEFT_ANKLE];
      refDir = new THREE.Vector3(0, -1, 0);
      break;
    }
    case BONE_NAMES.RIGHT_UP_LEG: {
      fromPos = landmarks[L.RIGHT_HIP];
      toPos = landmarks[L.RIGHT_KNEE];
      refDir = new THREE.Vector3(0, -1, 0);
      break;
    }
    case BONE_NAMES.RIGHT_LEG: {
      fromPos = landmarks[L.RIGHT_KNEE];
      toPos = landmarks[L.RIGHT_ANKLE];
      refDir = new THREE.Vector3(0, -1, 0);
      break;
    }
    default:
      return new THREE.Quaternion();
  }

  if (!fromPos || !toPos) return new THREE.Quaternion();

  // MediaPipe uses normalized coords: x right, y down, z toward camera
  // Three.js: x right, y up, z toward viewer
  const dir = new THREE.Vector3(
    toPos.x - fromPos.x,
    -(toPos.y - fromPos.y), // Flip Y
    -(toPos.z - fromPos.z)  // Flip Z
  ).normalize();

  const quat = new THREE.Quaternion();
  quat.setFromUnitVectors(refDir, dir);

  return quat;
}

/**
 * Build a bone name mapping between model bones and standard bones
 */
export function buildBoneMapping(modelBones) {
  const mapping = {};

  for (const bone of modelBones) {
    const standardName = matchBoneName(bone.name);
    if (standardName) {
      mapping[standardName] = bone;
    }
  }

  return mapping;
}

/**
 * Get all bones from a Three.js object hierarchy
 */
export function getAllBones(object) {
  const bones = [];

  object.traverse((child) => {
    if (child.isBone) {
      bones.push(child);
    }
  });

  return bones;
}
