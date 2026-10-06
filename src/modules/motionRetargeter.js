/* ========================================
   MotionRig – Motion Retargeter
   Map MediaPipe pose landmarks to
   skeleton bone rotations in real-time
   ======================================== */

import * as THREE from 'three';
import { LANDMARKS, midpoint } from '../utils/landmarkUtils.js';
import { BONE_NAMES, computeTargetDirection, quaternionFromDirections } from '../utils/skeletonUtils.js';

// Define the primary child for each animated bone to determine its direction vector
const BONE_DIRECTIONS = {
  [BONE_NAMES.HIPS]: BONE_NAMES.SPINE,
  [BONE_NAMES.SPINE]: BONE_NAMES.SPINE1,
  [BONE_NAMES.SPINE1]: BONE_NAMES.SPINE2,
  [BONE_NAMES.SPINE2]: BONE_NAMES.NECK,
  [BONE_NAMES.NECK]: BONE_NAMES.HEAD,
  [BONE_NAMES.LEFT_ARM]: BONE_NAMES.LEFT_FOREARM,
  [BONE_NAMES.LEFT_FOREARM]: BONE_NAMES.LEFT_HAND,
  [BONE_NAMES.RIGHT_ARM]: BONE_NAMES.RIGHT_FOREARM,
  [BONE_NAMES.RIGHT_FOREARM]: BONE_NAMES.RIGHT_HAND,
  [BONE_NAMES.LEFT_UP_LEG]: BONE_NAMES.LEFT_LEG,
  [BONE_NAMES.LEFT_LEG]: BONE_NAMES.LEFT_FOOT,
  [BONE_NAMES.RIGHT_UP_LEG]: BONE_NAMES.RIGHT_LEG,
  [BONE_NAMES.RIGHT_LEG]: BONE_NAMES.RIGHT_FOOT,
};

export class MotionRetargeter {
  constructor() {
    this.isActive = false;
    this.boneMapping = null;

    // Smoothing for bone rotations
    this._prevRotations = {};
    this._smoothingFactor = 0.35;

    // Rest pose quaternions and directions (saved when binding)
    this._restPose = {};
    this._restPosition = {};
    this._restWorldQuat = {};
    this._restWorldDir = {};

    // Bones that we animate
    this._animatedBones = [
      BONE_NAMES.HIPS,
      BONE_NAMES.SPINE,
      BONE_NAMES.SPINE1,
      BONE_NAMES.SPINE2,
      BONE_NAMES.NECK,
      BONE_NAMES.HEAD,
      BONE_NAMES.LEFT_ARM,
      BONE_NAMES.LEFT_FOREARM,
      BONE_NAMES.RIGHT_ARM,
      BONE_NAMES.RIGHT_FOREARM,
      BONE_NAMES.LEFT_UP_LEG,
      BONE_NAMES.LEFT_LEG,
      BONE_NAMES.RIGHT_UP_LEG,
      BONE_NAMES.RIGHT_LEG,
    ];
  }

  /**
   * Bind to a bone mapping from AutoRigger
   */
  bind(boneMapping) {
    this.boneMapping = boneMapping;

    // Save rest pose
    this._restPose = {};
    this._restPosition = {};
    this._restWorldQuat = {};
    this._restWorldDir = {};
    
    // Ensure world matrices are fully updated at rest pose
    const rootBone = boneMapping[BONE_NAMES.HIPS];
    if (rootBone) {
        rootBone.updateWorldMatrix(true, true);
    } else {
        // Fallback update all
        for (const bone of Object.values(boneMapping)) {
            bone.updateWorldMatrix(true, true);
        }
    }

    for (const [name, bone] of Object.entries(boneMapping)) {
      this._restPose[name] = bone.quaternion.clone();
      this._restPosition[name] = bone.position.clone();
      
      const worldQuat = new THREE.Quaternion();
      bone.getWorldQuaternion(worldQuat);
      this._restWorldQuat[name] = worldQuat;
      
      // Calculate rest world direction if it has a defined child
      const childName = BONE_DIRECTIONS[name];
      const childBone = childName ? boneMapping[childName] : null;
      
      if (childBone) {
        const bonePos = new THREE.Vector3();
        const childPos = new THREE.Vector3();
        bone.getWorldPosition(bonePos);
        childBone.getWorldPosition(childPos);
        
        const dir = new THREE.Vector3().subVectors(childPos, bonePos);
        if (dir.lengthSq() > 0.0001) {
            dir.normalize();
            this._restWorldDir[name] = dir;
        } else {
            this._restWorldDir[name] = null;
        }
      } else {
        this._restWorldDir[name] = null;
      }
    }

    this._prevRotations = {};
    this.isActive = true;
  }

  /**
   * Apply pose landmarks to the skeleton
   * Called each frame with new pose data
   */
  applyPose(poseData) {
    if (!this.isActive || !this.boneMapping || !poseData) return;

    const landmarks = poseData.worldLandmarks || poseData.landmarks;
    if (!landmarks || landmarks.length < 33) return;

    // Calculate hip position for root motion
    this._applyRootMotion(landmarks);

    // Apply rotations to each bone
    for (const boneName of this._animatedBones) {
      const bone = this.boneMapping[boneName];
      if (!bone) continue;

      const restDir = this._restWorldDir[boneName];
      const restWorldQuat = this._restWorldQuat[boneName];
      const restLocalQuat = this._restPose[boneName];
      
      let targetLocalQuat = restLocalQuat.clone();

      if (restDir && restWorldQuat) {
        // Compute target direction from landmarks in world space
        const targetDir = computeTargetDirection(boneName, landmarks);
        
        if (targetDir) {
          // Compute rotation needed in world space to align restDir to targetDir
          const deltaWorldQuat = quaternionFromDirections(restDir, targetDir);
          
          // Apply this delta rotation to the bone's rest world quaternion
          const targetWorldQuat = deltaWorldQuat.clone().multiply(restWorldQuat);
          
          // Convert the new world quaternion back to local space
          const parentWorldQuat = new THREE.Quaternion();
          if (bone.parent) {
            bone.parent.updateWorldMatrix(true, false);
            bone.parent.getWorldQuaternion(parentWorldQuat);
          }
          targetLocalQuat = parentWorldQuat.invert().multiply(targetWorldQuat);
        }
      }

      // Smooth the rotation
      const smoothedQuat = this._smoothRotation(boneName, targetLocalQuat);

      // Apply
      bone.quaternion.copy(smoothedQuat);
      bone.updateWorldMatrix(false, false);
    }
  }

  /**
   * Apply root motion (hip translation)
   */
  _applyRootMotion(landmarks) {
    const hipBone = this.boneMapping[BONE_NAMES.HIPS];
    if (!hipBone) return;

    const leftHip = landmarks[LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[LANDMARKS.RIGHT_HIP];
    const hipCenter = midpoint(leftHip, rightHip);

    // Map MediaPipe coordinates to scene coordinates
    // MediaPipe world landmarks are in meters, centered at hip
    // X: right, Y: down, Z: toward camera (we flip Y and Z)
    const scaleX = 1.0;
    const scaleY = 1.0;
    const scaleZ = 1.0;

    // Only apply subtle translation for body sway
    // Large translations make the model move out of frame
    const offsetX = hipCenter.x * scaleX * 0.3;
    const offsetY = -hipCenter.y * scaleY * 0.1;
    const offsetZ = -hipCenter.z * scaleZ * 0.3;

    const restPos = this._restPosition[BONE_NAMES.HIPS];
    if (!restPos) return;

    const targetX = restPos.x + offsetX;
    const targetZ = restPos.z + offsetZ;

    // Smooth translation
    const alpha = 0.2;
    hipBone.position.x += (targetX - hipBone.position.x) * alpha;
    hipBone.position.z += (targetZ - hipBone.position.z) * alpha;
  }

  /**
   * Smooth rotation using SLERP
   */
  _smoothRotation(boneName, targetQuat) {
    if (!this._prevRotations[boneName]) {
      this._prevRotations[boneName] = targetQuat.clone();
      return targetQuat;
    }

    const prev = this._prevRotations[boneName];
    const smoothed = prev.clone().slerp(targetQuat, this._smoothingFactor);
    this._prevRotations[boneName] = smoothed.clone();

    return smoothed;
  }

  /**
   * Reset to rest pose
   */
  resetPose() {
    if (!this.boneMapping || !this._restPose) return;

    for (const [name, bone] of Object.entries(this.boneMapping)) {
      const rest = this._restPose[name];
      if (rest) {
        bone.quaternion.copy(rest);
      }
    }

    this._prevRotations = {};
  }

  /**
   * Set smoothing factor (0-1, lower = smoother but more latency)
   */
  setSmoothingFactor(factor) {
    this._smoothingFactor = Math.max(0.1, Math.min(1.0, factor));
  }

  /**
   * Unbind and deactivate
   */
  unbind() {
    this.resetPose();
    this.isActive = false;
    this.boneMapping = null;
    this._restPose = {};
    this._prevRotations = {};
  }
}
