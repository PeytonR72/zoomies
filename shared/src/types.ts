/** 2D point/vector on the ground plane (X right, Z forward). */
export interface Vec2 {
  x: number;
  z: number;
}

/** Drivable surface kinds. Affects grip + drag. */
export type Surface = 'road' | 'grass';

/** Per-frame control input sampled from the keyboard. */
export interface InputState {
  throttle: boolean; // W
  brake: boolean; // S (brake, then reverse when stopped)
  left: boolean; // A
  right: boolean; // D
}

/** Full physical state of a car. Velocity is a world-space vector (units/sec). */
export interface CarState {
  x: number;
  z: number;
  heading: number; // yaw radians, 0 = facing +Z
  vx: number;
  vz: number;
}

/** A car's lobby identity (color is a hex string like '#ff4d6d'). */
export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
}

/** A circular collidable (props and, later, other cars). */
export interface Circle {
  x: number;
  z: number;
  radius: number;
}

export const NO_INPUT: InputState = { throttle: false, brake: false, left: false, right: false };
