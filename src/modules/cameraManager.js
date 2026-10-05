/* ========================================
   MotionRig – Camera Manager
   Webcam access and streaming
   ======================================== */

export class CameraManager {
  constructor() {
    this.videoElement = document.getElementById('camera-feed');
    this.stream = null;
    this.isActive = false;
    this._devices = [];
    this._currentDeviceIndex = 0;

    this._constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: 'user',
      },
      audio: false,
    };
  }

  /**
   * Start the camera
   */
  async start() {
    try {
      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      this._devices = devices.filter((d) => d.kind === 'videoinput');

      this.stream = await navigator.mediaDevices.getUserMedia(this._constraints);
      this.videoElement.srcObject = this.stream;

      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          resolve();
        };
      });

      this.isActive = true;
      return {
        width: this.videoElement.videoWidth,
        height: this.videoElement.videoHeight,
      };
    } catch (err) {
      console.error('Camera access failed:', err);
      throw new Error(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : `Camera error: ${err.message}`
      );
    }
  }

  /**
   * Stop the camera
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.videoElement.srcObject = null;
    this.isActive = false;
  }

  /**
   * Switch to the next available camera
   */
  async switchCamera() {
    if (this._devices.length < 2) return;

    this._currentDeviceIndex = (this._currentDeviceIndex + 1) % this._devices.length;
    const deviceId = this._devices[this._currentDeviceIndex].deviceId;

    this.stop();

    this._constraints.video.deviceId = { exact: deviceId };
    delete this._constraints.video.facingMode;

    return this.start();
  }

  /**
   * Get the video element for processing
   */
  getVideoElement() {
    return this.videoElement;
  }

  /**
   * Get current dimensions
   */
  getDimensions() {
    return {
      width: this.videoElement.videoWidth || 640,
      height: this.videoElement.videoHeight || 480,
    };
  }
}
