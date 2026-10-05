/* ========================================
   MotionRig – Marker Placer
   Mixamo-style visual joint placement on
   3D models using raycasting
   ======================================== */

import * as THREE from 'three';

/**
 * Marker definitions — the joints the user places
 * Ordered by the sequence the user should place them
 */
export const MARKER_DEFS = [
  { id: 'chin',            label: 'Chin',            color: '#facc15', group: 'head' },
  { id: 'neck',            label: 'Neck',            color: '#facc15', group: 'head' },
  { id: 'leftShoulder',    label: 'Left Shoulder',   color: '#00e0ff', group: 'leftArm' },
  { id: 'rightShoulder',   label: 'Right Shoulder',  color: '#ec4899', group: 'rightArm' },
  { id: 'leftElbow',       label: 'Left Elbow',      color: '#00e0ff', group: 'leftArm' },
  { id: 'rightElbow',      label: 'Right Elbow',     color: '#ec4899', group: 'rightArm' },
  { id: 'leftWrist',       label: 'Left Wrist',      color: '#00e0ff', group: 'leftArm' },
  { id: 'rightWrist',      label: 'Right Wrist',     color: '#ec4899', group: 'rightArm' },
  { id: 'groin',           label: 'Groin / Hips',    color: '#10b981', group: 'torso' },
  { id: 'leftKnee',        label: 'Left Knee',       color: '#10b981', group: 'leftLeg' },
  { id: 'rightKnee',       label: 'Right Knee',      color: '#f59e0b', group: 'rightLeg' },
  { id: 'leftAnkle',       label: 'Left Ankle',      color: '#10b981', group: 'leftLeg' },
  { id: 'rightAnkle',      label: 'Right Ankle',     color: '#f59e0b', group: 'rightLeg' },
];

/**
 * Bone connections to draw between placed markers
 * Each entry is [fromMarkerId, toMarkerId]
 */
const BONE_CONNECTIONS = [
  ['chin', 'neck'],
  ['neck', 'leftShoulder'],
  ['neck', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['neck', 'groin'],
  ['groin', 'leftKnee'],
  ['groin', 'rightKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightKnee', 'rightAnkle'],
];

export class MarkerPlacer {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.camera = sceneManager.camera;
    this.renderer = sceneManager.renderer;
    this.canvas = sceneManager.canvas;

    this.isActive = false;
    this.currentStep = 0;

    /** @type {Map<string, THREE.Vector3>} */
    this.markerPositions = new Map();

    /** @type {Map<string, THREE.Mesh>} */
    this._markerMeshes = new Map();

    /** @type {THREE.Group} */
    this._markersGroup = new THREE.Group();
    this._markersGroup.name = 'MarkerPlacerGroup';
    this._markersGroup.renderOrder = 999;

    /** @type {THREE.Group} */
    this._linesGroup = new THREE.Group();
    this._linesGroup.name = 'MarkerLinesGroup';
    this._linesGroup.renderOrder = 998;

    /** Preview marker that follows the mouse */
    this._previewMarker = null;

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    // Callbacks
    this._onMarkerPlaced = null;
    this._onAllPlaced = null;
    this._onStepChanged = null;

    // Bound event handlers
    this._handleClick = this._handleClick.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleRightClick = this._handleRightClick.bind(this);

    // Pulsing animation for active marker
    this._pulseTime = 0;
    this._animatePreview = this._animatePreview.bind(this);
    this._animFrameId = null;
  }

  /**
   * Enter rigging mode
   */
  activate() {
    this.isActive = true;
    this.currentStep = 0;
    this.markerPositions.clear();
    this._clearMeshes();

    this.scene.add(this._markersGroup);
    this.scene.add(this._linesGroup);

    this._createPreviewMarker();

    // Attach events
    this.canvas.addEventListener('click', this._handleClick);
    this.canvas.addEventListener('mousemove', this._handleMouseMove);
    this.canvas.addEventListener('contextmenu', this._handleRightClick);
    this.canvas.style.cursor = 'crosshair';

    // Disable orbit controls partially — we still allow orbiting with middle mouse / right drag
    // but click = place marker
    this.sceneManager.controls.enableRotate = true;
    this.sceneManager.controls.mouseButtons = {
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    this._animFrameId = requestAnimationFrame(this._animatePreview);

    this._onStepChanged?.(this.currentStep);
  }

  /**
   * Exit rigging mode
   */
  deactivate() {
    this.isActive = false;

    this.canvas.removeEventListener('click', this._handleClick);
    this.canvas.removeEventListener('mousemove', this._handleMouseMove);
    this.canvas.removeEventListener('contextmenu', this._handleRightClick);
    this.canvas.style.cursor = '';

    // Restore orbit controls
    this.sceneManager.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }

    this._removePreviewMarker();
  }

  /**
   * Clean up all marker visuals from the scene
   */
  cleanup() {
    this.deactivate();
    this._clearMeshes();
    this.scene.remove(this._markersGroup);
    this.scene.remove(this._linesGroup);
    this.markerPositions.clear();
    this.currentStep = 0;
  }

  /**
   * Get the current marker definition
   */
  getCurrentMarker() {
    if (this.currentStep >= MARKER_DEFS.length) return null;
    return MARKER_DEFS[this.currentStep];
  }

  /**
   * Get all placed marker positions as a plain object
   * { chin: Vector3, neck: Vector3, ... }
   */
  getMarkerPositions() {
    const result = {};
    for (const [id, pos] of this.markerPositions) {
      result[id] = pos.clone();
    }
    return result;
  }

  /**
   * Check if all markers have been placed
   */
  isComplete() {
    return this.markerPositions.size >= MARKER_DEFS.length;
  }

  /**
   * Register callbacks
   */
  onMarkerPlaced(cb) { this._onMarkerPlaced = cb; }
  onAllPlaced(cb) { this._onAllPlaced = cb; }
  onStepChanged(cb) { this._onStepChanged = cb; }

  // ─── Private Methods ─────────────────────────────

  _handleClick(event) {
    if (!this.isActive || this.currentStep >= MARKER_DEFS.length) return;

    // Don't place markers on UI clicks (buttons etc.)
    if (event.target !== this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);

    // Raycast against model meshes
    const model = this.sceneManager.model;
    if (!model) return;

    const meshes = [];
    model.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });

    const intersects = this._raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      this._placeMarker(point);
    }
  }

  _handleMouseMove(event) {
    if (!this.isActive || !this._previewMarker) return;

    const rect = this.canvas.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);

    const model = this.sceneManager.model;
    if (!model) return;

    const meshes = [];
    model.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });

    const intersects = this._raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      this._previewMarker.visible = true;
      this._previewMarker.position.copy(intersects[0].point);
      this.canvas.style.cursor = 'crosshair';
    } else {
      this._previewMarker.visible = false;
      this.canvas.style.cursor = 'default';
    }
  }

  _handleRightClick(event) {
    event.preventDefault();
    if (!this.isActive) return;
    this.undoLast();
  }

  _placeMarker(position) {
    const def = MARKER_DEFS[this.currentStep];
    if (!def) return;

    // Store position
    this.markerPositions.set(def.id, position.clone());

    // Create visual marker
    this._createMarkerMesh(def, position);

    // Update bone connections
    this._updateBoneLines();

    this.currentStep++;
    this._onMarkerPlaced?.(def, position, this.currentStep);
    this._onStepChanged?.(this.currentStep);

    // Update preview color for next step
    this._updatePreviewColor();

    if (this.currentStep >= MARKER_DEFS.length) {
      this._previewMarker.visible = false;
      this._onAllPlaced?.(this.getMarkerPositions());
    }
  }

  /**
   * Undo the last placed marker
   */
  undoLast() {
    if (this.currentStep <= 0) return;

    this.currentStep--;
    const def = MARKER_DEFS[this.currentStep];

    // Remove position
    this.markerPositions.delete(def.id);

    // Remove mesh
    const mesh = this._markerMeshes.get(def.id);
    if (mesh) {
      this._markersGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      this._markerMeshes.delete(def.id);
    }

    // Update lines
    this._updateBoneLines();

    // Show preview again
    if (this._previewMarker) {
      this._previewMarker.visible = true;
    }

    this._updatePreviewColor();
    this._onStepChanged?.(this.currentStep);
  }

  /**
   * Reset all markers
   */
  resetAll() {
    this._clearMeshes();
    this.markerPositions.clear();
    this.currentStep = 0;

    if (this._previewMarker) {
      this._previewMarker.visible = true;
    }
    this._updatePreviewColor();
    this._onStepChanged?.(this.currentStep);
  }

  _createMarkerMesh(def, position) {
    // Sphere marker
    const geometry = new THREE.SphereGeometry(0.018, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(def.color),
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    sphere.renderOrder = 999;
    sphere.name = `marker_${def.id}`;

    // Outer glow ring
    const ringGeom = new THREE.RingGeometry(0.022, 0.032, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(def.color),
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.renderOrder = 999;
    sphere.add(ring);

    // Make ring always face camera
    this.sceneManager.onRender(() => {
      ring.lookAt(this.camera.position);
    });

    this._markersGroup.add(sphere);
    this._markerMeshes.set(def.id, sphere);
  }

  _createPreviewMarker() {
    const geometry = new THREE.SphereGeometry(0.02, 16, 16);
    const color = MARKER_DEFS[0]?.color || '#ffffff';
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    this._previewMarker = new THREE.Mesh(geometry, material);
    this._previewMarker.visible = false;
    this._previewMarker.renderOrder = 1000;
    this._markersGroup.add(this._previewMarker);
  }

  _removePreviewMarker() {
    if (this._previewMarker) {
      this._markersGroup.remove(this._previewMarker);
      this._previewMarker.geometry?.dispose();
      this._previewMarker.material?.dispose();
      this._previewMarker = null;
    }
  }

  _updatePreviewColor() {
    if (!this._previewMarker) return;
    const def = MARKER_DEFS[this.currentStep];
    if (def) {
      this._previewMarker.material.color.set(def.color);
    }
  }

  _animatePreview() {
    if (!this.isActive) return;

    this._pulseTime += 0.05;
    if (this._previewMarker && this._previewMarker.visible) {
      const scale = 1 + Math.sin(this._pulseTime * 3) * 0.3;
      this._previewMarker.scale.setScalar(scale);
      this._previewMarker.material.opacity = 0.3 + Math.sin(this._pulseTime * 3) * 0.2;
    }

    this._animFrameId = requestAnimationFrame(this._animatePreview);
  }

  _updateBoneLines() {
    // Clear existing lines
    while (this._linesGroup.children.length > 0) {
      const child = this._linesGroup.children[0];
      this._linesGroup.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }

    // Draw connections between placed markers
    for (const [fromId, toId] of BONE_CONNECTIONS) {
      const fromPos = this.markerPositions.get(fromId);
      const toPos = this.markerPositions.get(toId);

      if (fromPos && toPos) {
        const geometry = new THREE.BufferGeometry().setFromPoints([fromPos, toPos]);
        const fromDef = MARKER_DEFS.find((d) => d.id === fromId);
        const material = new THREE.LineBasicMaterial({
          color: new THREE.Color(fromDef?.color || '#ffffff'),
          transparent: true,
          opacity: 0.6,
          depthTest: false,
        });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 998;
        this._linesGroup.add(line);
      }
    }
  }

  _clearMeshes() {
    // Clear markers
    for (const [, mesh] of this._markerMeshes) {
      this._markersGroup.remove(mesh);
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    }
    this._markerMeshes.clear();

    // Clear lines
    while (this._linesGroup.children.length > 0) {
      const child = this._linesGroup.children[0];
      this._linesGroup.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
  }
}
