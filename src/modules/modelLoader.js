/* ========================================
   MotionRig – Model Loader
   OBJ and FBX file loading with Three.js
   ======================================== */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getAllBones } from '../utils/skeletonUtils.js';

export class ModelLoader {
  constructor() {
    this.currentModel = null;
    this.modelInfo = null;
    
    this.manager = new THREE.LoadingManager();
    this.objectURLs = [];

    this._objLoader = new OBJLoader(this.manager);
    this._mtlLoader = new MTLLoader(this.manager);
    this._fbxLoader = new FBXLoader(this.manager);
    this._gltfLoader = new GLTFLoader(this.manager);
  }

  /**
   * Load a model from a File object
   * Supports OBJ (with optional MTL) and FBX
   */
  async loadFromFile(files) {
    // Convert FileList to array
    const fileArray = Array.from(files);

    // Find the main model file
    const objFile = fileArray.find((f) => f.name.toLowerCase().endsWith('.obj'));
    const fbxFile = fileArray.find((f) => f.name.toLowerCase().endsWith('.fbx'));
    const gltfFile = fileArray.find((f) => f.name.toLowerCase().endsWith('.gltf') || f.name.toLowerCase().endsWith('.glb'));
    const mtlFile = fileArray.find((f) => f.name.toLowerCase().endsWith('.mtl'));

    if (!objFile && !fbxFile && !gltfFile) {
      throw new Error('No supported model file found. Please upload OBJ, FBX, or GLTF/GLB.');
    }

    // Map all uploaded files to object URLs for texture resolution
    this._cleanupObjectURLs();
    const fileMap = new Map();
    fileArray.forEach((file) => {
      const url = URL.createObjectURL(file);
      this.objectURLs.push(url);
      // Store both full name and lowercase name for flexible matching
      fileMap.set(file.name, url);
      fileMap.set(file.name.toLowerCase(), url);
    });

    this.manager.setURLModifier((url) => {
      // Ignore data URIs and blob URIs that are already resolved
      if (url.startsWith('data:') || url.startsWith('blob:')) return url;

      // Extract filename from the URL (in case it comes with paths)
      const fileName = url.split('/').pop().split('\\').pop();
      if (fileMap.has(fileName)) {
        return fileMap.get(fileName);
      } else if (fileMap.has(fileName.toLowerCase())) {
        return fileMap.get(fileName.toLowerCase());
      }
      
      // If it's trying to fetch a file that wasn't uploaded, it will likely hit Vite's SPA fallback
      // and hang or crash. Throw a clear error instead.
      throw new Error(`Missing associated file: ${fileName}. Please make sure you select/upload all associated files (like .bin, .mtl, and textures) together with your model.`);
    });

    let model;

    if (gltfFile) {
      model = await this._loadGLTF(gltfFile);
    } else if (fbxFile) {
      model = await this._loadFBX(fbxFile);
    } else if (objFile) {
      model = await this._loadOBJ(objFile, mtlFile);
    }

    // Gather info
    const fileName = (gltfFile || fbxFile || objFile).name;
    this.currentModel = model;
    this.modelInfo = this._gatherModelInfo(model, fileName);

    return { model, info: this.modelInfo };
  }

  _cleanupObjectURLs() {
    this.objectURLs.forEach((url) => URL.revokeObjectURL(url));
    this.objectURLs = [];
  }

  /**
   * Load GLTF/GLB file
   */
  async _loadGLTF(file) {
    const arrayBuffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
      try {
        this._gltfLoader.parse(arrayBuffer, '', (gltf) => {
          const group = gltf.scene;

          // Apply a default material to meshes without one
          group.traverse((child) => {
            if (child.isMesh) {
              if (!child.material || (Array.isArray(child.material) && child.material.length === 0)) {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0x8888aa,
                  roughness: 0.5,
                  metalness: 0.2,
                });
              }
            }
          });

          resolve(group);
        }, (err) => {
          reject(new Error(`Failed to parse GLTF file: ${err.message || err}`));
        });
      } catch (err) {
        reject(new Error(`Failed to parse GLTF file: ${err.message}`));
      }
    });
  }

  /**
   * Load FBX file
   */
  async _loadFBX(file) {
    const arrayBuffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
      try {
        const group = this._fbxLoader.parse(arrayBuffer, '');

        // Apply a default material to meshes without one
        group.traverse((child) => {
          if (child.isMesh) {
            if (!child.material || (Array.isArray(child.material) && child.material.length === 0)) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x8888aa,
                roughness: 0.5,
                metalness: 0.2,
              });
            } else if (!Array.isArray(child.material)) {
              // Convert Phong to Standard for better lighting
              if (child.material.isMeshPhongMaterial) {
                const oldMat = child.material;
                child.material = new THREE.MeshStandardMaterial({
                  color: oldMat.color,
                  map: oldMat.map,
                  normalMap: oldMat.normalMap,
                  roughness: 0.6,
                  metalness: 0.1,
                });
              }
            }
          }
        });

        resolve(group);
      } catch (err) {
        reject(new Error(`Failed to parse FBX file: ${err.message}`));
      }
    });
  }

  /**
   * Load OBJ file with optional MTL
   */
  async _loadOBJ(objFile, mtlFile) {
    const objText = await objFile.text();

    let materials = null;

    if (mtlFile) {
      try {
        const mtlText = await mtlFile.text();
        materials = this._mtlLoader.parse(mtlText, '');
        materials.preload();
      } catch (err) {
        console.warn('Failed to load MTL file:', err);
      }
    }

    if (materials) {
      this._objLoader.setMaterials(materials);
    }

    const group = this._objLoader.parse(objText);

    // Apply default material if needed
    group.traverse((child) => {
      if (child.isMesh) {
        if (!child.material || child.material.name === '') {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x8888aa,
            roughness: 0.5,
            metalness: 0.2,
            side: THREE.DoubleSide,
          });
        }
      }
    });

    return group;
  }

  /**
   * Gather model information
   */
  _gatherModelInfo(model, fileName) {
    let vertices = 0;
    let faces = 0;
    let meshCount = 0;
    const bones = getAllBones(model);
    let hasSkeleton = bones.length > 0;
    let hasSkinnedMesh = false;

    model.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        const geom = child.geometry;
        if (geom) {
          vertices += geom.attributes.position ? geom.attributes.position.count : 0;
          faces += geom.index ? geom.index.count / 3 : vertices / 3;
        }
      }
      if (child.isSkinnedMesh) {
        hasSkinnedMesh = true;
      }
    });

    return {
      name: fileName,
      vertices,
      faces: Math.floor(faces),
      meshCount,
      boneCount: bones.length,
      hasSkeleton,
      hasSkinnedMesh,
      bones,
    };
  }

  /**
   * Get all meshes from the loaded model
   */
  getMeshes() {
    if (!this.currentModel) return [];

    const meshes = [];
    this.currentModel.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
      }
    });

    return meshes;
  }

  /**
   * Get the existing skeleton from an FBX model
   */
  getExistingSkeleton() {
    if (!this.currentModel) return null;

    let skeleton = null;

    this.currentModel.traverse((child) => {
      if (child.isSkinnedMesh && child.skeleton) {
        skeleton = child.skeleton;
      }
    });

    return skeleton;
  }

  /**
   * Dispose current model
   */
  dispose() {
    this.currentModel = null;
    this.modelInfo = null;
  }
}
