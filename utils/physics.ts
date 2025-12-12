import { BoatState, WindState } from '../types';
import { MAX_BOAT_SPEED, NO_GO_ZONE_DEG, WIND_SPEED, degToRad, normalizeAngle } from '../constants';

/**
 * Helper to determine if the boat is in the No-Go Zone (dead angle).
 */
export const isInNoGoZone = (heading: number, windDirection: number): boolean => {
  const angleOfAttack = Math.abs(normalizeAngle(heading - windDirection));
  const angleFromIntoWind = Math.PI - angleOfAttack; 
  const angleDeg = (angleFromIntoWind * 180) / Math.PI;
  return Math.abs(angleDeg) < NO_GO_ZONE_DEG;
};

/**
 * Calculates the target speed of the boat based on its angle relative to the wind.
 * This simulates a standard "Polar Diagram" for a sailboat.
 */
export const calculateTargetSpeed = (heading: number, wind: WindState): number => {
  // Wind flows from Left to Right (0 radians).
  
  // Angle between boat heading and wind direction
  const angleOfAttack = Math.abs(normalizeAngle(heading - wind.direction));
  
  // Calculate angle distance from "Into the Wind" (West / PI)
  const angleFromIntoWind = Math.PI - angleOfAttack; 
  const angleDeg = (angleFromIntoWind * 180) / Math.PI;

  if (Math.abs(angleDeg) < NO_GO_ZONE_DEG) {
    // In the No-Go Zone (Irons)
    return 0;
  }

  // Simple polar curve approximation
  // Peak at 90 degrees (Beam Reach)
  // Dip at 180 (Running)
  // Zero at 0 (Irons)
  
  // Normalized 0..1 performance factor
  let performance = 0;
  
  if (Math.abs(angleDeg) >= 90) {
      // From beam reach to running
      // Running (180) is usually slower than beam reach (90)
      // Lerp from 1.0 down to 0.7
      const t = (Math.abs(angleDeg) - 90) / 90;
      performance = 1.0 - (t * 0.3);
  } else {
      // From close hauled to beam reach
      // Ramp from 0.4 (close hauled) to 1.0 (beam reach)
      // angleDeg is between 45 and 90
      const t = (Math.abs(angleDeg) - NO_GO_ZONE_DEG) / (90 - NO_GO_ZONE_DEG);
      performance = 0.3 + (t * 0.7);
  }

  // Make speed meaningfully scale with wind strength, but keep it bounded.
  // Level 1 windSpeed is WIND_SPEED, higher levels increase it in App.tsx.
  const windFactorRaw = wind.speed / WIND_SPEED; // 1.0 at level 1
  const windFactor = Math.max(0.6, Math.min(2.2, windFactorRaw));

  return performance * MAX_BOAT_SPEED * windFactor;
};

/**
 * Calculates the ideal sail angle visually based on wind.
 */
export const calculateSailTrim = (heading: number, windDirection: number): number => {
  let relAngle = normalizeAngle(heading - windDirection + Math.PI); 
  
  const absAngle = Math.abs(relAngle);
  
  // Boom angle magnitude
  let boomMag = (absAngle / Math.PI) * 85 * (Math.PI / 180); // Up to 85 degrees
  
  const cross = -Math.sin(heading); 
  
  return boomMag * (cross > 0 ? -1 : 1);
};