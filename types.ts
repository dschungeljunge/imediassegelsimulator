export interface Vector2D {
  x: number;
  y: number;
}

export interface BoatState {
  position: Vector2D; // World position
  heading: number;    // Radians, 0 points East (Right), PI/2 points South (Down)
  speed: number;      // Current scalar speed
  rudderAngle: number; // Visual rudder angle
  sailAngle: number;   // Visual sail angle relative to boat
}

export interface WindState {
  direction: number; // Radians. 0 means wind blows towards East (Left to Right)
  speed: number;
}

// Ein fester Fels im Spielfeld, mit Position und Kollider-Radius
export interface RockState {
  position: Vector2D;
  radius: number;
}