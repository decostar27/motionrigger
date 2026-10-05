/* ========================================
   MotionRig – Video Manager
   Video file upload, playback, and
   frame extraction
   ======================================== */

export class VideoManager {
  constructor() {
    this.videoElement = document.getElementById('video-player');
    this.fileInput = document.getElementById('video-file-input');
    this.uploadZone = document.getElementById('video-upload-zone');
    this.placeholder = document.getElementById('video-placeholder');
    this.controlsEl = document.getElementById('video-controls');
    this.playBtn = document.getElementById('btn-video-play');
    this.timeline = document.getElementById('video-timeline');
    this.progressBar = document.getElementById('timeline-progress');
    this.timeDisplay = document.getElementById('video-time');
    this.speedSelect = document.getElementById('video-speed');

    this.isLoaded = false;
    this.isPlaying = false;
    this.fileName = '';

    this._setupEvents();
  }

  _setupEvents() {
    // File input
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.loadFile(e.target.files[0]);
      }
    });

    // Drag and drop
    this.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadZone.classList.add('dragover');
    });

    this.uploadZone.addEventListener('dragleave', () => {
      this.uploadZone.classList.remove('dragover');
    });

    this.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this.loadFile(e.dataTransfer.files[0]);
      }
    });

    this.uploadZone.addEventListener('click', () => {
      this.fileInput.click();
    });

    // Play/pause
    this.playBtn.addEventListener('click', () => {
      this.togglePlay();
    });

    // Timeline seeking
    this.timeline.addEventListener('click', (e) => {
      const rect = this.timeline.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      this.seek(ratio * this.videoElement.duration);
    });

    // Speed
    this.speedSelect.addEventListener('change', () => {
      this.videoElement.playbackRate = parseFloat(this.speedSelect.value);
    });

    // Time update
    this.videoElement.addEventListener('timeupdate', () => {
      this._updateTimeline();
    });

    this.videoElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this._updatePlayButton();
    });
  }

  /**
   * Load a video file
   */
  async loadFile(file) {
    // Validate
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi)$/i)) {
      throw new Error('Unsupported video format. Please use MP4, WebM, or MOV.');
    }

    this.fileName = file.name;

    const url = URL.createObjectURL(file);
    this.videoElement.src = url;

    await new Promise((resolve, reject) => {
      this.videoElement.onloadeddata = resolve;
      this.videoElement.onerror = () => reject(new Error('Failed to load video'));
    });

    this.isLoaded = true;
    this.placeholder.classList.add('hidden');
    this.controlsEl.classList.remove('hidden');
    this._updateTimeline();

    return {
      width: this.videoElement.videoWidth,
      height: this.videoElement.videoHeight,
      duration: this.videoElement.duration,
      name: file.name,
    };
  }

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.videoElement.pause();
      this.isPlaying = false;
    } else {
      this.videoElement.play();
      this.isPlaying = true;
    }
    this._updatePlayButton();
  }

  /**
   * Seek to a specific time
   */
  seek(time) {
    this.videoElement.currentTime = Math.max(0, Math.min(time, this.videoElement.duration));
  }

  /**
   * Get the video element for processing
   */
  getVideoElement() {
    return this.videoElement;
  }

  /**
   * Check if video is ready for processing
   */
  isReady() {
    return this.isLoaded && this.videoElement.readyState >= 2;
  }

  _updateTimeline() {
    if (!this.isLoaded) return;

    const current = this.videoElement.currentTime;
    const total = this.videoElement.duration;
    const pct = (current / total) * 100;

    this.progressBar.style.width = `${pct}%`;
    this.timeDisplay.textContent = `${this._formatTime(current)} / ${this._formatTime(total)}`;
  }

  _updatePlayButton() {
    this.playBtn.innerHTML = this.isPlaying
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  }

  _formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  /**
   * Unload video
   */
  unload() {
    this.videoElement.pause();
    this.videoElement.src = '';
    this.isLoaded = false;
    this.isPlaying = false;
    this.placeholder.classList.remove('hidden');
    this.controlsEl.classList.add('hidden');
  }
}
