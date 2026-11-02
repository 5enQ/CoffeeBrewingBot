/**
 * Device tilt as gravity. Euler angles (beta, gamma) are awkward for a liquid: gamma jumps by 180° when the phone
 * passes upright, and a phone held upright and turned like a steering wheel barely changes gamma at all.
 * Gravity in the screen's own axes has neither problem: its direction in the screen plane is how the phone is
 * turned (what keeps a liquid level), its part out of the screen is how far the screen faces up.
 */

/** the last reading, for the testers' diagnostics */
export const tiltInfo = { source: 'none' as 'telegram' | 'browser' | 'none', units: '' as '' | 'радианы' | 'градусы', beta: 0, gamma: 0, at: 0 };

const RAD = Math.PI / 180;

/** gravity (unit vector) in the screen's axes: x to the right, y up the screen, z out of the screen; W3C beta/gamma in degrees */
export function gravityOf(beta: number, gamma: number) {
  const b = beta * RAD, g = gamma * RAD;
  return { x: Math.sin(g) * Math.cos(b), y: -Math.sin(b), z: -Math.cos(g) * Math.cos(b) };
}

/** how the phone is turned in the screen plane, radians: 0 upright, positive turned clockwise (right side down) */
export const rollOf = (g: { x: number; y: number }) => Math.atan2(g.x, -g.y);

/** how much the screen faces up: 0 upright, 1 flat on a table face up */
export const lookOf = (g: { z: number }) => -g.z;

/** how strongly the screen plane holds a direction: near flat the roll is meaningless (gravity goes through the screen) */
export const planeOf = (g: { x: number; y: number }) => Math.hypot(g.x, g.y);
