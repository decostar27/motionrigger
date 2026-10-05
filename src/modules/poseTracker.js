/* ========================================
   MotionRig – Pose Tracker
   MediaPipe Pose landmark detection via
   Vision Tasks API (CDN)
   ======================================== */

import { LandmarkSmoother, drawPoseSkeleton } from '../utils/landmarkUtils.js';

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';

export class PoseTracker {
  constructor() {
    this.poseLandmarker = null;
    this.isInitialized = false;
    this.isRunning = false;
    this.showSkeleton = true;

    this.lastLandmarks = null;
    this.lastWorldLandmarks = null;
    this._smoother = new LandmarkSmoother(0.45);
    this._worldSmoother = new LandmarkSmoother(0.45);

    this._onPoseCallbacks = [];
    this._frameCount = 0;
    this._lastFpsTime = performance.now();
    this._fps = 0;
    this._rafId = null;
  }

  /**
   * Initialize MediaPipe Pose Landmarker
   */
  async init(onStatusUpdate) {
    if (this.isInitialized) return;

    onStatusUpdate?.('Loading MediaPipe Vision...');

    try {
      // Dynamically import the vision tasks module
      const vision = await this._loadVisionModule();

      onStatusUpdate?.('Loading pose model...');

      const { PoseLandmarker, FilesetResolver } = vision;

      const wasmFileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

      this.poseLandmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isInitialized = true;
      onStatusUpdate?.('Pose tracker ready');
    } catch (err) {
      console.error('Failed to initialize PoseTracker:', err);
      onStatusUpdate?.('Failed to load pose model');
      throw err;
    }
  }

  /**
   * Load the MediaPipe Vision module
   */
  async _loadVisionModule() {
    // Try the ES module CDN import
    try {
      const module = await import(
        /* @vite-ignore */
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
      );
      return module;
    } catch (e) {
      console.warn('ESM import failed, trying alternative...', e);
    }

    // Fallback: check if loaded globally
    if (window.vision) {
      return window.vision;
    }

    throw new Error('Could not load MediaPipe Vision module');
  }

  /**
   * Start processing frames from a video element
   */
  startProcessing(videoElement, overlayCanvas) {
    if (!this.isInitialized) {
      console.error('PoseTracker not initialized');
      return;
    }

    this.isRunning = true;
    this._smoother.reset();
    this._worldSmoother.reset();

    const ctx = overlayCanvas.getContext('2d');

    const processFrame = () => {
      if (!this.isRunning) return;

      if (
        videoElement.readyState >= 2 &&
        videoElement.videoWidth > 0
      ) {
        // Resize overlay canvas to match video
        if (
          overlayCanvas.width !== videoElement.videoWidth ||
          overlayCanvas.height !== videoElement.videoHeight
        ) {
          overlayCanvas.width = videoElement.videoWidth;
          overlayCanvas.height = videoElement.videoHeight;
        }

        try {
          const timestamp = performance.now();
          const result = this.poseLandmarker.detectForVideo(videoElement, timestamp);

          if (result.landmarks && result.landmarks.length > 0) {
            // Smooth landmarks
            this.lastLandmarks = this._smoother.smooth(result.landmarks[0]);

            if (result.worldLandmarks && result.worldLandmarks.length > 0) {
              this.lastWorldLandmarks = this._worldSmoother.smooth(result.worldLandmarks[0]);
            }

            // Draw skeleton overlay
            if (this.showSkeleton) {
              drawPoseSkeleton(ctx, this.lastLandmarks, overlayCanvas.width, overlayCanvas.height);
            } else {
              ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            }

            // Notify listeners
            for (const cb of this._onPoseCallbacks) {
              cb({
                landmarks: this.lastLandmarks,
                worldLandmarks: this.lastWorldLandmarks,
                timestamp,
              });
            }
          } else {
            this.lastLandmarks = null;
            this.lastWorldLandmarks = null;
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          }

          // FPS calculation
          this._frameCount++;
          const now = performance.now();
          if (now - this._lastFpsTime >= 1000) {
            this._fps = this._frameCount;
            this._frameCount = 0;
            this._lastFpsTime = now;
          }
        } catch (err) {
          // Silently skip frames that cause errors
          if (!err.message?.includes('Timestamp')) {
            console.warn('Pose detection error:', err);
          }
        }
      }

      this._rafId = requestAnimationFrame(processFrame);
    };

    this._rafId = requestAnimationFrame(processFrame);
  }

  /**
   * Stop processing
   */
  stopProcessing() {
    this.isRunning = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.lastLandmarks = null;
    this.lastWorldLandmarks = null;
    this._smoother.reset();
    this._worldSmoother.reset();
  }

  /**
   * Register a callback for pose updates
   */
  onPose(callback) {
    this._onPoseCallbacks.push(callback);
  }

  /**
   * Remove a pose callback
   */
  offPose(callback) {
    this._onPoseCallbacks = this._onPoseCallbacks.filter((cb) => cb !== callback);
  }

  /**
   * Toggle skeleton overlay
   */
  toggleSkeleton() {
    this.showSkeleton = !this.showSkeleton;
    return this.showSkeleton;
  }

  /**
   * Get current FPS
   */
  getFps() {
    return this._fps;
  }

  /**
   * Get average confidence of last detected landmarks
   */
  getConfidence() {
    if (!this.lastLandmarks) return 0;
    const sum = this.lastLandmarks.reduce((acc, lm) => acc + (lm.visibility || 0), 0);
    return (sum / this.lastLandmarks.length * 100).toFixed(0);
  }

  /**
   * Dispose
   */
  dispose() {
    this.stopProcessing();
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.isInitialized = false;
  }
}
