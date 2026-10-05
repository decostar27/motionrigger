/* ========================================
   MotionRig – Landmark Utilities
   MediaPipe Pose landmark constants and
   processing helpers
   ======================================== */

/**
 * MediaPipe Pose landmark indices (33 landmarks)
 */
export const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/**
 * Skeleton connections for drawing the pose overlay
 * Each pair is [startLandmark, endLandmark]
 */
export const SKELETON_CONNECTIONS = [
  // Face
  [LANDMARKS.LEFT_EAR, LANDMARKS.LEFT_EYE],
  [LANDMARKS.RIGHT_EAR, LANDMARKS.RIGHT_EYE],
  [LANDMARKS.LEFT_EYE, LANDMARKS.NOSE],
  [LANDMARKS.RIGHT_EYE, LANDMARKS.NOSE],
  [LANDMARKS.MOUTH_LEFT, LANDMARKS.MOUTH_RIGHT],

  // Torso
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP],
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP],
  [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],

  // Left arm
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
  [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
  [LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_PINKY],
  [LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_INDEX],
  [LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_THUMB],
  [LANDMARKS.LEFT_INDEX, LANDMARKS.LEFT_PINKY],

  // Right arm
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
  [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
  [LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_PINKY],
  [LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_INDEX],
  [LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_THUMB],
  [LANDMARKS.RIGHT_INDEX, LANDMARKS.RIGHT_PINKY],

  // Left leg
  [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE],
  [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
  [LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_HEEL],
  [LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_FOOT_INDEX],
  [LANDMARKS.LEFT_HEEL, LANDMARKS.LEFT_FOOT_INDEX],

  // Right leg
  [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE],
  [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
  [LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_HEEL],
  [LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_FOOT_INDEX],
  [LANDMARKS.RIGHT_HEEL, LANDMARKS.RIGHT_FOOT_INDEX],
];

/**
 * Connection colors for different body parts
 */
export const CONNECTION_COLORS = {
  face: 'rgba(0, 224, 255, 0.6)',
  torso: 'rgba(139, 92, 246, 0.8)',
  leftArm: 'rgba(0, 224, 255, 0.8)',
  rightArm: 'rgba(236, 72, 153, 0.8)',
  leftLeg: 'rgba(16, 185, 129, 0.8)',
  rightLeg: 'rgba(245, 158, 11, 0.8)',
};

/**
 * Get the color for a specific connection index
 */
export function getConnectionColor(index) {
  if (index < 5) return CONNECTION_COLORS.face;
  if (index < 9) return CONNECTION_COLORS.torso;
  if (index < 15) return CONNECTION_COLORS.leftArm;
  if (index < 21) return CONNECTION_COLORS.rightArm;
  if (index < 26) return CONNECTION_COLORS.leftLeg;
  return CONNECTION_COLORS.rightLeg;
}

/**
 * Compute the midpoint between two landmarks
 */
export function midpoint(lm1, lm2) {
  return {
    x: (lm1.x + lm2.x) / 2,
    y: (lm1.y + lm2.y) / 2,
    z: (lm1.z + lm2.z) / 2,
  };
}

/**
 * Compute the average visibility across a set of landmarks
 */
export function averageVisibility(landmarks, indices) {
  let sum = 0;
  for (const i of indices) {
    sum += landmarks[i].visibility || 0;
  }
  return sum / indices.length;
}

/**
 * Calculate the angle between three points (in radians)
 * Point b is the vertex
 */
export function angleBetween(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);

  if (magBA === 0 || magBC === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle);
}

/**
 * Compute direction vector between two landmarks
 */
export function direction(from, to) {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
    z: to.z - from.z,
  };
}

/**
 * Normalize a 3D vector
 */
export function normalize(v) {
  const mag = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

/**
 * Cross product of two 3D vectors
 */
export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Exponential Moving Average filter for smoothing landmarks
 */
export class LandmarkSmoother {
  constructor(alpha = 0.4) {
    this.alpha = alpha;
    this.prevLandmarks = null;
  }

  smooth(landmarks) {
    if (!this.prevLandmarks) {
      this.prevLandmarks = landmarks.map((lm) => ({ ...lm }));
      return landmarks;
    }

    const smoothed = landmarks.map((lm, i) => {
      const prev = this.prevLandmarks[i];
      return {
        x: prev.x + this.alpha * (lm.x - prev.x),
        y: prev.y + this.alpha * (lm.y - prev.y),
        z: prev.z + this.alpha * (lm.z - prev.z),
        visibility: lm.visibility,
      };
    });

    this.prevLandmarks = smoothed.map((lm) => ({ ...lm }));
    return smoothed;
  }

  reset() {
    this.prevLandmarks = null;
  }
}

/**
 * Draw the pose skeleton on a canvas
 */
export function drawPoseSkeleton(ctx, landmarks, width, height, options = {}) {
  const {
    lineWidth = 3,
    dotRadius = 5,
    showDots = true,
    showLines = true,
    dotColor = '#00e0ff',
  } = options;

  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length === 0) return;

  // Draw connections
  if (showLines) {
    SKELETON_CONNECTIONS.forEach((connection, index) => {
      const [startIdx, endIdx] = connection;
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      if (
        (start.visibility || 0) < 0.3 ||
        (end.visibility || 0) < 0.3
      )
        return;

      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.strokeStyle = getConnectionColor(index);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    });
  }

  // Draw landmarks
  if (showDots) {
    landmarks.forEach((lm) => {
      if ((lm.visibility || 0) < 0.3) return;

      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();

      // Glow effect
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, dotRadius + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 224, 255, 0.2)';
      ctx.fill();
    });
  }
}
