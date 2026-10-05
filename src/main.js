/* ========================================
   MotionRig – Main Application Entry Point
   Wires up all modules and handles UI state
   ======================================== */

import { SceneManager } from './modules/sceneManager.js';
import { CameraManager } from './modules/cameraManager.js';
import { VideoManager } from './modules/videoManager.js';
import { PoseTracker } from './modules/poseTracker.js';
import { ModelLoader } from './modules/modelLoader.js';
import { AutoRigger } from './modules/autoRigger.js';
import { MotionRetargeter } from './modules/motionRetargeter.js';
import { Recorder } from './modules/recorder.js';

// ─── App State ───────────────────────────────────────
const state = {
  mode: 'camera', // 'camera' or 'video'
  cameraActive: false,
  modelLoaded: false,
  isRigged: false,
  isRecording: false,
};

// ─── Module Instances ────────────────────────────────
let sceneManager;
let cameraManager;
let videoManager;
let poseTracker;
let modelLoader;
let autoRigger;
let motionRetargeter;
let recorder;

// ─── DOM Elements ────────────────────────────────────
const els = {};

function cacheDOMElements() {
  els.loadingScreen = document.getElementById('loading-screen');
  els.loadingStatus = document.getElementById('loading-status');
  els.loadingBar = document.getElementById('loading-bar');
  els.app = document.getElementById('app');

  els.modeCameraBtn = document.getElementById('btn-mode-camera');
  els.modeVideoBtn = document.getElementById('btn-mode-video');

  els.statusDot = document.querySelector('.status-dot');
  els.statusText = document.getElementById('status-text');

  els.cameraView = document.getElementById('camera-view');
  els.videoView = document.getElementById('video-view');
  els.cameraPlaceholder = document.getElementById('camera-placeholder');

  els.startCameraBtn = document.getElementById('btn-start-camera');
  els.stopCameraBtn = document.getElementById('btn-stop-camera');
  els.recordBtn = document.getElementById('btn-record');
  els.exportBtn = document.getElementById('btn-export-motion');
  els.toggleSkeletonBtn = document.getElementById('btn-toggle-skeleton');

  els.poseOverlay = document.getElementById('pose-overlay');
  els.videoPoseOverlay = document.getElementById('video-pose-overlay');

  els.statFps = document.getElementById('stat-fps');
  els.statLandmarks = document.getElementById('stat-landmarks');
  els.statConfidence = document.getElementById('stat-confidence');
  els.statRecording = document.getElementById('stat-recording');

  els.modelUploadOverlay = document.getElementById('model-upload-overlay');
  els.modelUploadZone = document.getElementById('model-upload-zone');
  els.modelFileInput = document.getElementById('model-file-input');
  els.browseModelBtn = document.getElementById('btn-browse-model');

  els.modelInfo = document.getElementById('model-info');
  els.infoModelName = document.getElementById('info-model-name');
  els.infoVertices = document.getElementById('info-vertices');
  els.infoFaces = document.getElementById('info-faces');
  els.infoSkeleton = document.getElementById('info-skeleton');
  els.infoRigged = document.getElementById('info-rigged');
  els.removeModelBtn = document.getElementById('btn-remove-model');
  els.autoRigBtn = document.getElementById('btn-auto-rig');

  els.riggingStatus = document.getElementById('rigging-status');
  els.riggingStatusText = document.getElementById('rigging-status-text');

  els.resetCameraBtn = document.getElementById('btn-reset-camera-3d');
  els.toggleGridBtn = document.getElementById('btn-toggle-grid');
  els.toggleWireframeBtn = document.getElementById('btn-toggle-wireframe');

  els.resizeHandle = document.getElementById('resize-handle');
  els.panelLeft = document.getElementById('panel-left');
  els.panelRight = document.getElementById('panel-right');

  els.toastContainer = document.getElementById('toast-container');

  els.panelLeftTitle = document.getElementById('panel-left-title');
}

// ─── Toast Notifications ─────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${message}</span>
  `;

  els.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Status Updates ──────────────────────────────────
function setStatus(text, color = null) {
  els.statusText.textContent = text;
  if (color) {
    els.statusDot.style.background = color;
  }
}

// ─── Mode Switching ──────────────────────────────────
function switchMode(mode) {
  state.mode = mode;

  // Update buttons
  els.modeCameraBtn.classList.toggle('active', mode === 'camera');
  els.modeVideoBtn.classList.toggle('active', mode === 'video');

  // Update views
  els.cameraView.classList.toggle('hidden', mode !== 'camera');
  els.videoView.classList.toggle('hidden', mode !== 'video');

  // Update controls
  els.startCameraBtn.classList.toggle('hidden', mode !== 'camera');
  els.stopCameraBtn.classList.toggle('hidden', mode !== 'camera' || !state.cameraActive);

  // Panel title
  els.panelLeftTitle.textContent = mode === 'camera' ? 'Motion Capture' : 'Video Analysis';

  // Stop camera if switching away
  if (mode !== 'camera' && state.cameraActive) {
    stopCamera();
  }

  // Stop video processing if switching away
  if (mode !== 'video') {
    poseTracker.stopProcessing();
  }
}

// ─── Camera Controls ─────────────────────────────────
async function startCamera() {
  try {
    setStatus('Starting camera...', '#f59e0b');
    const dims = await cameraManager.start();
    state.cameraActive = true;

    els.cameraPlaceholder.classList.add('hidden');
    els.startCameraBtn.classList.add('hidden');
    els.stopCameraBtn.classList.remove('hidden');

    // Start pose tracking
    poseTracker.startProcessing(
      cameraManager.getVideoElement(),
      els.poseOverlay
    );

    setStatus('Tracking', '#10b981');
    showToast(`Camera started (${dims.width}×${dims.height})`, 'success');
  } catch (err) {
    setStatus('Camera error', '#ff3b30');
    showToast(err.message, 'error');
  }
}

function stopCamera() {
  cameraManager.stop();
  poseTracker.stopProcessing();
  state.cameraActive = false;

  els.cameraPlaceholder.classList.remove('hidden');
  els.startCameraBtn.classList.remove('hidden');
  els.stopCameraBtn.classList.add('hidden');

  // Clear overlay
  const ctx = els.poseOverlay.getContext('2d');
  ctx.clearRect(0, 0, els.poseOverlay.width, els.poseOverlay.height);

  setStatus('Ready', '#10b981');
}

// ─── Model Loading ───────────────────────────────────
async function loadModel(files) {
  try {
    setStatus('Loading model...', '#f59e0b');
    els.riggingStatus.classList.remove('hidden');
    els.riggingStatusText.textContent = 'Loading model...';

    const { model, info } = await modelLoader.loadFromFile(files);
    sceneManager.addModel(model);

    // Update model info UI
    els.modelUploadOverlay.classList.add('hidden');
    els.modelInfo.classList.remove('hidden');
    els.infoModelName.textContent = info.name;
    els.infoVertices.textContent = info.vertices.toLocaleString();
    els.infoFaces.textContent = info.faces.toLocaleString();
    els.infoSkeleton.textContent = info.hasSkeleton
      ? `${info.boneCount} bones`
      : 'None';
    els.infoRigged.textContent = 'No';

    state.modelLoaded = true;

    els.riggingStatus.classList.add('hidden');
    setStatus('Model loaded', '#10b981');
    showToast(`Loaded: ${info.name} (${info.vertices.toLocaleString()} vertices)`, 'success');

    // Auto-rig if model has existing skeleton
    if (info.hasSkinnedMesh && info.hasSkeleton) {
      showToast('Model has existing skeleton – auto-rigging...', 'info');
      setTimeout(() => autoRigModel(), 500);
    }
  } catch (err) {
    els.riggingStatus.classList.add('hidden');
    setStatus('Load failed', '#ff3b30');
    showToast(err.message, 'error');
    console.error('Model load error:', err);
  }
}

function removeModel() {
  sceneManager.removeModel();
  modelLoader.dispose();
  autoRigger.reset();
  motionRetargeter.unbind();

  state.modelLoaded = false;
  state.isRigged = false;

  els.modelUploadOverlay.classList.remove('hidden');
  els.modelInfo.classList.add('hidden');

  setStatus('Ready', '#10b981');
  showToast('Model removed', 'info');
}

// ─── Auto-Rigging ────────────────────────────────────
async function autoRigModel() {
  if (!state.modelLoaded) {
    showToast('Please load a 3D model first', 'warning');
    return;
  }

  try {
    els.riggingStatus.classList.remove('hidden');
    els.riggingStatusText.textContent = 'Auto-rigging model...';
    setStatus('Rigging...', '#8b5cf6');

    // Small delay so the UI updates
    await new Promise((r) => setTimeout(r, 100));

    const result = await autoRigger.rig(
      modelLoader.currentModel,
      modelLoader.modelInfo
    );

    if (result.success) {
      state.isRigged = true;
      els.infoRigged.textContent = 'Yes';
      els.infoSkeleton.textContent = `${result.mappedBones} mapped / ${result.totalBones} total`;

      // Bind retargeter
      motionRetargeter.bind(autoRigger.getBoneMapping());

      // Show skeleton helper
      if (autoRigger.rootBone) {
        sceneManager.showSkeleton(autoRigger.rootBone);
      }

      showToast(
        `Auto-rigged (${result.type}): ${result.mappedBones} bones mapped`,
        'success'
      );
      setStatus('Rigged & Ready', '#10b981');
    }
  } catch (err) {
    showToast(`Rigging failed: ${err.message}`, 'error');
    setStatus('Rig failed', '#ff3b30');
    console.error('Auto-rig error:', err);
  } finally {
    els.riggingStatus.classList.add('hidden');
  }
}

// ─── Recording ───────────────────────────────────────
function toggleRecording() {
  if (recorder.isRecording) {
    const stats = recorder.stop();
    state.isRecording = false;
    els.recordBtn.classList.remove('recording');
    els.recordBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
      Record Motion
    `;
    showToast(
      `Recording stopped: ${stats.keyframes} frames, ${stats.duration.toFixed(1)}s`,
      'success'
    );
  } else {
    recorder.start();
    state.isRecording = true;
    els.recordBtn.classList.add('recording');
    els.recordBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
      Stop Recording
    `;
    showToast('Recording started...', 'info');
  }
}

function exportMotion() {
  if (recorder.keyframes.length === 0) {
    showToast('No recorded motion to export. Record first!', 'warning');
    return;
  }

  recorder.exportJSON();
  showToast('Motion data exported as JSON', 'success');
}

// ─── Stats Update Loop ──────────────────────────────
function updateStats() {
  els.statFps.textContent = poseTracker.getFps();
  els.statLandmarks.textContent = poseTracker.lastLandmarks
    ? poseTracker.lastLandmarks.length
    : '--';
  els.statConfidence.textContent = poseTracker.lastLandmarks
    ? `${poseTracker.getConfidence()}%`
    : '--';

  const recStats = recorder.getStats();
  els.statRecording.textContent = recStats.isRecording
    ? `${recStats.duration}s`
    : 'OFF';
  els.statRecording.style.color = recStats.isRecording
    ? '#ff3b30'
    : 'var(--accent-cyan)';

  requestAnimationFrame(updateStats);
}

// ─── Pose → Model Pipeline ──────────────────────────
function onPoseDetected(poseData) {
  // Record if active
  if (recorder.isRecording) {
    recorder.recordFrame(poseData);
  }

  // Retarget to model if rigged
  if (state.isRigged && motionRetargeter.isActive) {
    motionRetargeter.applyPose(poseData);
  }
}

// ─── Resize Handle ───────────────────────────────────
function setupResizeHandle() {
  const handle = els.resizeHandle;
  let isResizing = false;
  let startX = 0;
  let startLeftWidth = 0;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startLeftWidth = els.panelLeft.getBoundingClientRect().width;
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    const newWidth = startLeftWidth + delta;
    const totalWidth = els.panelLeft.parentElement.getBoundingClientRect().width;
    const pct = (newWidth / totalWidth) * 100;

    if (pct > 20 && pct < 80) {
      els.panelLeft.style.flex = `0 0 ${pct}%`;
      els.panelRight.style.flex = `1`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// ─── Model Upload (Drag & Drop) ─────────────────────
function setupModelUpload() {
  const zone = els.modelUploadZone;
  const input = els.modelFileInput;

  // Click to browse
  els.browseModelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });

  zone.addEventListener('click', () => {
    input.click();
  });

  input.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadModel(e.target.files);
    }
  });

  // Drag events
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      loadModel(e.dataTransfer.files);
    }
  });

  // Also allow dropping anywhere on viewport
  const viewport = document.getElementById('viewport-container');
  viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (state.modelLoaded) return; // Don't allow drop if model already loaded
    zone.classList.add('dragover');
  });

  viewport.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      loadModel(e.dataTransfer.files);
    }
  });
}

// ─── Initialize Application ─────────────────────────
async function init() {
  cacheDOMElements();

  els.loadingStatus.textContent = 'Setting up 3D viewport...';

  // Initialize modules
  sceneManager = new SceneManager('viewport-canvas');
  cameraManager = new CameraManager();
  videoManager = new VideoManager();
  poseTracker = new PoseTracker();
  modelLoader = new ModelLoader();
  autoRigger = new AutoRigger();
  motionRetargeter = new MotionRetargeter();
  recorder = new Recorder();

  // Initialize pose tracker (loads MediaPipe model)
  await poseTracker.init((status) => {
    els.loadingStatus.textContent = status;
  });

  // Register pose callback
  poseTracker.onPose(onPoseDetected);

  // ─── Wire up UI Events ───────────────────────────
  // Mode switching
  els.modeCameraBtn.addEventListener('click', () => switchMode('camera'));
  els.modeVideoBtn.addEventListener('click', () => switchMode('video'));

  // Camera controls
  els.startCameraBtn.addEventListener('click', startCamera);
  els.stopCameraBtn.addEventListener('click', stopCamera);

  // Video: start tracking when video plays
  const videoPlayer = document.getElementById('video-player');
  videoPlayer.addEventListener('play', () => {
    if (state.mode === 'video' && videoManager.isLoaded) {
      poseTracker.startProcessing(videoPlayer, els.videoPoseOverlay);
    }
  });
  videoPlayer.addEventListener('pause', () => {
    if (state.mode === 'video') {
      poseTracker.stopProcessing();
    }
  });

  // Recording
  els.recordBtn.addEventListener('click', toggleRecording);
  els.exportBtn.addEventListener('click', exportMotion);

  // Skeleton toggle
  els.toggleSkeletonBtn.addEventListener('click', () => {
    const show = poseTracker.toggleSkeleton();
    els.toggleSkeletonBtn.classList.toggle('active', show);
    showToast(show ? 'Skeleton overlay: ON' : 'Skeleton overlay: OFF', 'info', 2000);
  });

  // 3D viewport controls
  els.resetCameraBtn.addEventListener('click', () => {
    sceneManager.resetCamera();
    if (state.modelLoaded) sceneManager.focusOnModel();
  });

  els.toggleGridBtn.addEventListener('click', () => {
    const show = sceneManager.toggleGrid();
    els.toggleGridBtn.classList.toggle('active', !show);
  });

  els.toggleWireframeBtn.addEventListener('click', () => {
    const show = sceneManager.toggleWireframe();
    els.toggleWireframeBtn.classList.toggle('active', show);
  });

  // Model management
  els.removeModelBtn.addEventListener('click', removeModel);
  els.autoRigBtn.addEventListener('click', autoRigModel);

  // Setup resize handle
  setupResizeHandle();

  // Setup model upload
  setupModelUpload();

  // Start stats update loop
  requestAnimationFrame(updateStats);

  // ─── Show App ────────────────────────────────────
  els.loadingStatus.textContent = 'Ready!';

  setTimeout(() => {
    els.loadingScreen.classList.add('hidden');
    els.app.classList.remove('hidden');
  }, 800);

  setStatus('Ready', '#10b981');
}

// ─── Start App ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
