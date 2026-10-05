/* ========================================
   MotionRig – Scene Manager
   Three.js scene setup, rendering, and
   viewport controls
   ======================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.container = this.canvas.parentElement;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.grid = null;
    this.lights = {};
    this.model = null;
    this.skeletonHelper = null;

    this._animationId = null;
    this._onRenderCallbacks = [];
    this._showGrid = true;
    this._showWireframe = false;

    this._init();
  }

  _init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.015);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true, // Transparent bg for glass effect
      powerPreference: 'high-performance', // Hint for NVIDIA GPU
      precision: 'highp', // High precision rendering
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    this.camera.position.set(0, 1.2, 3.5);

    // Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.8, 0);
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI * 0.95;

    // Lighting
    this._setupLights();

    // Grid
    this._setupGrid();

    // Environment
    this._setupEnvironment();

    // Resize handling
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this.container);

    // Initial size
    this._onResize();

    // Start render loop
    this._animate();
  }

  _setupLights() {
    // Ambient
    this.lights.ambient = new THREE.AmbientLight(0x202025, 0.8);
    this.scene.add(this.lights.ambient);

    // Main directional light (key light)
    this.lights.key = new THREE.DirectionalLight(0xffffff, 2.5);
    this.lights.key.position.set(5, 8, 5);
    this.lights.key.castShadow = true;
    this.lights.key.shadow.mapSize.width = 4096; // High quality shadow for NVIDIA power
    this.lights.key.shadow.mapSize.height = 4096;
    this.lights.key.shadow.camera.near = 0.5;
    this.lights.key.shadow.camera.far = 25;
    this.lights.key.shadow.camera.left = -10;
    this.lights.key.shadow.camera.right = 10;
    this.lights.key.shadow.camera.top = 10;
    this.lights.key.shadow.camera.bottom = -10;
    this.lights.key.shadow.bias = -0.0005;
    this.lights.key.shadow.normalBias = 0.02;
    this.scene.add(this.lights.key);

    // Fill light (Nvidia Green)
    this.lights.fill = new THREE.DirectionalLight(0x76b900, 1.2);
    this.lights.fill.position.set(-5, 3, -5);
    this.scene.add(this.lights.fill);

    // Rim light (Cyan/Blue)
    this.lights.rim = new THREE.DirectionalLight(0x00e0ff, 1.5);
    this.lights.rim.position.set(0, 5, -8);
    this.scene.add(this.lights.rim);

    // Hemisphere
    this.lights.hemi = new THREE.HemisphereLight(0xffffff, 0x76b900, 0.5);
    this.scene.add(this.lights.hemi);
  }

  _setupGrid() {
    // Ground plane (receives shadows)
    const groundGeom = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.ground = new THREE.Mesh(groundGeom, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Grid helper
    this.grid = new THREE.GridHelper(20, 40, 0x1a1a3a, 0x12122a);
    this.grid.position.y = 0.001;
    this.scene.add(this.grid);

    // Center marker
    const markerGeom = new THREE.RingGeometry(0.08, 0.1, 32);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0x00e0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    this.centerMarker = new THREE.Mesh(markerGeom, markerMat);
    this.centerMarker.rotation.x = -Math.PI / 2;
    this.centerMarker.position.y = 0.002;
    this.scene.add(this.centerMarker);
  }

  _setupEnvironment() {
    // Simple gradient environment using a sphere
    const envGeom = new THREE.SphereGeometry(40, 32, 32);
    const envMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0a0a0f) },
        bottomColor: { value: new THREE.Color(0x030a03) }, // Slight green tint
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.envSphere = new THREE.Mesh(envGeom, envMat);
    this.scene.add(this.envSphere);
  }

  _onResize() {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _animate() {
    this._animationId = requestAnimationFrame(() => this._animate());
    this.controls.update();

    // Run callbacks
    for (const cb of this._onRenderCallbacks) {
      cb(this);
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Register a callback to run each frame
   */
  onRender(callback) {
    this._onRenderCallbacks.push(callback);
  }

  /**
   * Remove a render callback
   */
  offRender(callback) {
    this._onRenderCallbacks = this._onRenderCallbacks.filter((cb) => cb !== callback);
  }

  /**
   * Add a 3D model to the scene
   */
  addModel(object) {
    if (this.model) {
      this.removeModel();
    }

    this.model = object;

    // Center and scale the model
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetHeight = 1.7; // Standard human height
    const scale = maxDim > 0 ? targetHeight / maxDim : 1;

    object.scale.multiplyScalar(scale);

    // Recalculate after scaling
    box.setFromObject(object);
    box.getCenter(center);
    const newMin = box.min;

    // Position so feet are on ground
    object.position.x -= center.x;
    object.position.y -= newMin.y;
    object.position.z -= center.z;

    // Enable shadows
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Apply liquid glass material
        child.material = new THREE.MeshPhysicalMaterial({
          color: 0xaaaaaa,
          roughness: 0.1,
          metalness: 0.9,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          transparent: true,
          opacity: 0.95,
        });
      }
    });

    this.scene.add(object);

    // Focus camera on model
    this.focusOnModel();

    return { size, scale };
  }

  /**
   * Remove the current model
   */
  removeModel() {
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      this.model = null;
    }

    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper = null;
    }
  }

  /**
   * Focus camera on the current model
   */
  focusOnModel() {
    if (!this.model) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.controls.target.copy(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;

    this.camera.position.set(
      center.x + distance * 0.5,
      center.y + distance * 0.3,
      center.z + distance * 0.8
    );

    this.controls.update();
  }

  /**
   * Toggle grid visibility
   */
  toggleGrid() {
    this._showGrid = !this._showGrid;
    this.grid.visible = this._showGrid;
    this.ground.visible = this._showGrid;
    this.centerMarker.visible = this._showGrid;
    return this._showGrid;
  }

  /**
   * Toggle wireframe on model
   */
  toggleWireframe() {
    this._showWireframe = !this._showWireframe;

    if (this.model) {
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = this._showWireframe));
          } else {
            child.material.wireframe = this._showWireframe;
          }
        }
      });
    }

    return this._showWireframe;
  }

  /**
   * Show skeleton helper for debugging
   */
  showSkeleton(rootBone) {
    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
    }
    this.skeletonHelper = new THREE.SkeletonHelper(rootBone);
    this.skeletonHelper.material.linewidth = 2;
    this.scene.add(this.skeletonHelper);
  }

  /**
   * Reset camera to default position
   */
  resetCamera() {
    this.camera.position.set(0, 1.2, 3.5);
    this.controls.target.set(0, 0.8, 0);
    this.controls.update();
  }

  /**
   * Dispose everything
   */
  dispose() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
    this._resizeObserver.disconnect();
    window.removeEventListener('resize', this._onResize);
    this.removeModel();
    this.renderer.dispose();
    this.controls.dispose();
  }
}
