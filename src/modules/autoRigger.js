/* ========================================
   MotionRig – Auto Rigger
   Automatic skeleton creation and
   vertex skinning for 3D models
   ======================================== */

import * as THREE from 'three';
import {
  BONE_NAMES,
  BONE_HIERARCHY,
  createHumanoidSkeleton,
  buildBoneMapping,
  getAllBones,
} from '../utils/skeletonUtils.js';

export class AutoRigger {
  constructor() {
    this.skeleton = null;
    this.bones = null;
    this.rootBone = null;
    this.boneMapping = null;
    this.isRigged = false;
    this.rigType = null; // 'existing' or 'generated'
  }

  /**
   * Auto-rig a model
   * If the model has an existing skeleton (FBX), map bones
   * If not (OBJ), create a new skeleton and bind it
   */
  async rig(model, modelInfo) {
    if (modelInfo.hasSkinnedMesh && modelInfo.hasSkeleton) {
      return this._rigExisting(model, modelInfo);
    } else {
      return this._rigFromScratch(model, modelInfo);
    }
  }

  /**
   * Use existing skeleton from FBX model
   */
  _rigExisting(model, modelInfo) {
    const bones = getAllBones(model);
    this.boneMapping = buildBoneMapping(bones);

    // Check how many bones we mapped
    const mappedCount = Object.keys(this.boneMapping).length;

    if (mappedCount < 5) {
      console.warn(`Only mapped ${mappedCount} bones. Skeleton may not animate correctly.`);
    }

    // Find root bone
    this.rootBone = null;
    model.traverse((child) => {
      if (child.isBone && !child.parent?.isBone) {
        this.rootBone = child;
      }
    });

    // Find skeleton from skinned mesh
    model.traverse((child) => {
      if (child.isSkinnedMesh && child.skeleton) {
        this.skeleton = child.skeleton;
      }
    });

    this.bones = {};
    for (const [standardName, bone] of Object.entries(this.boneMapping)) {
      this.bones[standardName] = bone;
    }

    this.isRigged = true;
    this.rigType = 'existing';

    return {
      success: true,
      type: 'existing',
      mappedBones: mappedCount,
      totalBones: bones.length,
      rootBone: this.rootBone,
    };
  }

  /**
   * Create a new skeleton and bind it to OBJ meshes
   */
  _rigFromScratch(model, modelInfo) {
    // Calculate model bounding box for skeleton sizing
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const modelHeight = size.y;

    // Create humanoid skeleton
    const { skeleton, bones, rootBone, tPosePositions } = createHumanoidSkeleton(modelHeight);

    this.skeleton = skeleton;
    this.bones = bones;
    this.rootBone = rootBone;

    // Position root bone to match model
    rootBone.position.x += center.x;
    rootBone.position.z += center.z;
    rootBone.position.y = box.min.y;

    // Recalculate bone world positions for skinning
    rootBone.updateWorldMatrix(true, true);

    // Convert meshes to SkinnedMeshes
    const meshes = [];
    model.traverse((child) => {
      if (child.isMesh && !child.isSkinnedMesh) {
        meshes.push(child);
      }
    });

    for (const mesh of meshes) {
      this._bindMeshToSkeleton(mesh, skeleton, bones, tPosePositions, box.min.y);
    }

    // Add root bone to model
    model.add(rootBone);

    // Set up bone mapping
    this.boneMapping = {};
    for (const [name, bone] of Object.entries(bones)) {
      this.boneMapping[name] = bone;
    }

    this.isRigged = true;
    this.rigType = 'generated';

    return {
      success: true,
      type: 'generated',
      mappedBones: Object.keys(bones).length,
      totalBones: skeleton.bones.length,
      rootBone,
    };
  }

  /**
   * Bind a mesh to the skeleton using distance-based skinning weights
   */
  _bindMeshToSkeleton(mesh, skeleton, bones, tPosePositions, yOffset) {
    const geometry = mesh.geometry;

    if (!geometry || !geometry.attributes.position) return;

    const posAttr = geometry.attributes.position;
    const vertexCount = posAttr.count;
    const boneArray = skeleton.bones;
    const boneCount = boneArray.length;

    // Max bones per vertex
    const maxBonesPerVertex = 4;

    // Prepare skinning data
    const skinIndices = new Float32Array(vertexCount * maxBonesPerVertex);
    const skinWeights = new Float32Array(vertexCount * maxBonesPerVertex);

    // Get bone world positions
    const boneWorldPositions = boneArray.map((bone) => {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      return pos;
    });

    // Apply mesh world transform to vertices
    mesh.updateWorldMatrix(true, false);
    const worldMatrix = mesh.matrixWorld;

    for (let i = 0; i < vertexCount; i++) {
      const vertex = new THREE.Vector3(
        posAttr.getX(i),
        posAttr.getY(i),
        posAttr.getZ(i)
      );
      vertex.applyMatrix4(worldMatrix);

      // Calculate distances to all bones
      const distances = boneWorldPositions.map((bonePos, idx) => ({
        index: idx,
        distance: vertex.distanceTo(bonePos),
      }));

      // Sort by distance and pick closest bones
      distances.sort((a, b) => a.distance - b.distance);

      const closest = distances.slice(0, maxBonesPerVertex);

      // Convert distances to weights (inverse distance weighting)
      const epsilon = 0.001;
      let totalWeight = 0;
      const weights = closest.map((d) => {
        const w = 1.0 / (d.distance + epsilon);
        totalWeight += w;
        return w;
      });

      // Normalize weights
      for (let j = 0; j < maxBonesPerVertex; j++) {
        const idx = i * maxBonesPerVertex + j;
        if (j < closest.length) {
          skinIndices[idx] = closest[j].index;
          skinWeights[idx] = weights[j] / totalWeight;
        } else {
          skinIndices[idx] = 0;
          skinWeights[idx] = 0;
        }
      }
    }

    // Set skinning attributes
    geometry.setAttribute(
      'skinIndex',
      new THREE.BufferAttribute(
        new Uint16Array(skinIndices),
        maxBonesPerVertex
      )
    );
    geometry.setAttribute(
      'skinWeight',
      new THREE.BufferAttribute(skinWeights, maxBonesPerVertex)
    );

    // Create SkinnedMesh
    const skinnedMesh = new THREE.SkinnedMesh(geometry, mesh.material);
    skinnedMesh.name = mesh.name;
    skinnedMesh.castShadow = true;
    skinnedMesh.receiveShadow = true;

    // Bind skeleton
    skinnedMesh.add(skeleton.bones[0]); // Needs a bone as child for binding
    skinnedMesh.bind(skeleton);

    // Replace original mesh
    const parent = mesh.parent;
    if (parent) {
      skinnedMesh.position.copy(mesh.position);
      skinnedMesh.rotation.copy(mesh.rotation);
      skinnedMesh.scale.copy(mesh.scale);

      parent.remove(mesh);
      parent.add(skinnedMesh);
    }
  }

  /**
   * Get the bone mapping for retargeting
   */
  getBoneMapping() {
    return this.boneMapping;
  }

  /**
   * Get all mapped standard bone names
   */
  getMappedBoneNames() {
    return Object.keys(this.boneMapping || {});
  }

  /**
   * Rig from user-placed marker positions (Mixamo-style)
   * markerPositions: { chin: Vector3, neck: Vector3, leftShoulder: Vector3, ... }
   */
  rigFromMarkers(model, markerPositions) {
    const mp = markerPositions;

    // Build bone world positions from marker positions
    // We compute intermediate bones (spine, spine1, spine2) from the markers
    const hipCenter = mp.groin.clone();
    const neckPos = mp.neck.clone();
    const chinPos = mp.chin.clone();

    // Head is above chin
    const headPos = chinPos.clone();
    headPos.y += (chinPos.y - neckPos.y) * 0.5;

    // Spine chain: groin → spine → spine1 → spine2(=neck area)
    const spineDir = neckPos.clone().sub(hipCenter);
    const spinePos = hipCenter.clone().add(spineDir.clone().multiplyScalar(0.25));
    const spine1Pos = hipCenter.clone().add(spineDir.clone().multiplyScalar(0.50));
    const spine2Pos = hipCenter.clone().add(spineDir.clone().multiplyScalar(0.80));

    // Build bone positions map keyed by BONE_NAMES
    const boneWorldPositions = {
      [BONE_NAMES.HIPS]: hipCenter,
      [BONE_NAMES.SPINE]: spinePos,
      [BONE_NAMES.SPINE1]: spine1Pos,
      [BONE_NAMES.SPINE2]: spine2Pos,
      [BONE_NAMES.NECK]: neckPos,
      [BONE_NAMES.HEAD]: headPos,

      [BONE_NAMES.LEFT_SHOULDER]: mp.leftShoulder.clone(),
      [BONE_NAMES.LEFT_ARM]: mp.leftShoulder.clone(),
      [BONE_NAMES.LEFT_FOREARM]: mp.leftElbow.clone(),
      [BONE_NAMES.LEFT_HAND]: mp.leftWrist.clone(),

      [BONE_NAMES.RIGHT_SHOULDER]: mp.rightShoulder.clone(),
      [BONE_NAMES.RIGHT_ARM]: mp.rightShoulder.clone(),
      [BONE_NAMES.RIGHT_FOREARM]: mp.rightElbow.clone(),
      [BONE_NAMES.RIGHT_HAND]: mp.rightWrist.clone(),

      [BONE_NAMES.LEFT_UP_LEG]: new THREE.Vector3(mp.leftKnee.x, hipCenter.y, mp.leftKnee.z),
      [BONE_NAMES.LEFT_LEG]: mp.leftKnee.clone(),
      [BONE_NAMES.LEFT_FOOT]: mp.leftAnkle.clone(),

      [BONE_NAMES.RIGHT_UP_LEG]: new THREE.Vector3(mp.rightKnee.x, hipCenter.y, mp.rightKnee.z),
      [BONE_NAMES.RIGHT_LEG]: mp.rightKnee.clone(),
      [BONE_NAMES.RIGHT_FOOT]: mp.rightAnkle.clone(),
    };

    // Create bones
    const bones = {};
    const boneArray = [];

    function createBone(name, parentBone) {
      const bone = new THREE.Bone();
      bone.name = name;

      const worldPos = boneWorldPositions[name];
      if (!worldPos) return bone;

      if (parentBone) {
        const parentWorldPos = boneWorldPositions[parentBone.name];
        if (parentWorldPos) {
          bone.position.copy(worldPos.clone().sub(parentWorldPos));
        } else {
          bone.position.copy(worldPos);
        }
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
    rootBone.updateWorldMatrix(true, true);

    const skeleton = new THREE.Skeleton(boneArray);

    this.skeleton = skeleton;
    this.bones = bones;
    this.rootBone = rootBone;

    // Get bone world positions for skinning
    const boneWorldPosArray = boneArray.map((bone) => {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      return pos;
    });

    // Convert meshes to SkinnedMeshes
    const meshes = [];
    model.traverse((child) => {
      if (child.isMesh && !child.isSkinnedMesh) {
        meshes.push(child);
      }
    });

    for (const mesh of meshes) {
      this._bindMeshToSkeleton(mesh, skeleton, bones, boneWorldPositions, 0);
    }

    // Add root bone to model
    model.add(rootBone);

    // Set up bone mapping
    this.boneMapping = {};
    for (const [name, bone] of Object.entries(bones)) {
      this.boneMapping[name] = bone;
    }

    this.isRigged = true;
    this.rigType = 'manual';

    return {
      success: true,
      type: 'manual',
      mappedBones: Object.keys(bones).length,
      totalBones: skeleton.bones.length,
      rootBone,
    };
  }

  /**
   * Reset the rigger state
   */
  reset() {
    this.skeleton = null;
    this.bones = null;
    this.rootBone = null;
    this.boneMapping = null;
    this.isRigged = false;
    this.rigType = null;
  }
}
