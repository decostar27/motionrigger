/* ========================================
   MotionRig – Motion Recorder
   Record and export pose animation data
   ======================================== */

export class Recorder {
  constructor() {
    this.isRecording = false;
    this.keyframes = [];
    this._startTime = 0;
    this._duration = 0;
  }

  /**
   * Start recording
   */
  start() {
    this.keyframes = [];
    this._startTime = performance.now();
    this.isRecording = true;
  }

  /**
   * Record a frame of pose data
   */
  recordFrame(poseData) {
    if (!this.isRecording || !poseData) return;

    const elapsed = performance.now() - this._startTime;

    this.keyframes.push({
      time: elapsed / 1000, // seconds
      landmarks: poseData.landmarks?.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
      })),
      worldLandmarks: poseData.worldLandmarks?.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
      })),
    });

    this._duration = elapsed / 1000;
  }

  /**
   * Stop recording
   */
  stop() {
    this.isRecording = false;
    return {
      keyframes: this.keyframes.length,
      duration: this._duration,
    };
  }

  /**
   * Export recording as JSON
   */
  exportJSON() {
    const data = {
      version: '1.0',
      app: 'MotionRig',
      timestamp: new Date().toISOString(),
      duration: this._duration,
      fps: this.keyframes.length / Math.max(this._duration, 0.001),
      keyframeCount: this.keyframes.length,
      keyframes: this.keyframes,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Download
    const a = document.createElement('a');
    a.href = url;
    a.download = `motionrig_recording_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return data;
  }

  /**
   * Get recording stats
   */
  getStats() {
    return {
      isRecording: this.isRecording,
      keyframes: this.keyframes.length,
      duration: this._duration.toFixed(1),
      fps: this.keyframes.length > 0
        ? (this.keyframes.length / Math.max(this._duration, 0.001)).toFixed(1)
        : '0',
    };
  }

  /**
   * Clear recording
   */
  clear() {
    this.keyframes = [];
    this._duration = 0;
    this._startTime = 0;
    this.isRecording = false;
  }
}
