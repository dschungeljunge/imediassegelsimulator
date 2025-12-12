export const WIND_SPEED = 15; // Knots approx
export const MAX_BOAT_SPEED = 5;
export const TURN_RATE = 0.04;
export const ACCELERATION = 0.05;
export const DRAG = 0.02;
export const NO_GO_ZONE_DEG = 45; // Degrees from wind direction where lift fails
export const FPS = 60;

// Convert degrees to radians
export const degToRad = (deg: number) => (deg * Math.PI) / 180;
export const radToDeg = (rad: number) => (rad * 180) / Math.PI;

// Normalize angle to -PI to PI
export const normalizeAngle = (angle: number) => {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
};