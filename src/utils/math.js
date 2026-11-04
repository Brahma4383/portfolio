export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const lerp = (a, b, t) => a + (b - a) * t

// Frame-rate independent smoothing: moves `a` toward `b` at rate `lambda` per second.
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// Overshoots a little before settling, for things that pop into view.
export const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2)

export function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

// Shortest distance from point P to the segment AB, all on the ground plane (x, z).
export function distanceToSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax
  const abz = bz - az
  const lengthSq = abx * abx + abz * abz
  const t = lengthSq === 0 ? 0 : clamp(((px - ax) * abx + (pz - az) * abz) / lengthSq, 0, 1)
  const dx = px - (ax + abx * t)
  const dz = pz - (az + abz * t)
  return Math.sqrt(dx * dx + dz * dz)
}

// The car's heading is an angle around the Y axis where 0 faces north (-z).
// These convert between that angle and a ground direction.
export const headingToward = (dx, dz) => Math.atan2(-dx, -dz)
export const forwardOf = (heading) => ({ x: -Math.sin(heading), z: -Math.cos(heading) })
