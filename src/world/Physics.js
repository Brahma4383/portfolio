import * as CANNON from 'cannon-es'
import { clamp } from '../utils/math.js'
import { DRIVE_RADIUS } from './layout.js'

// Collision groups for cannon-es bodies.
export const GROUP = { GROUND: 1, STATIC: 2, PROP: 4, CAR: 8 }

// Two physics systems work together here:
//  - cannon-es simulates the loose props (letters, crates, bowling pins) so they
//    tumble properly. The car is a kinematic body in that world: it shoves props
//    around but is never pushed back by them.
//  - The car itself drives with simple arcade physics on the ground plane, and
//    bumps into the static scenery (trees, buildings, posts) through `collide()`.
export class Physics {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -25, 0), allowSleep: true })
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.defaultContactMaterial.friction = 0.35
    this.world.defaultContactMaterial.restitution = 0.15
    this.world.solver.iterations = 8

    const ground = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      collisionFilterGroup: GROUP.GROUND,
      collisionFilterMask: GROUP.PROP,
    })
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.world.addBody(ground)

    // Static scenery as seen by the car: circles and rotated boxes on the ground plane.
    this.colliders = []
  }

  // A round obstacle (tree trunk, post, rock).
  addCircle(x, z, r, height = 3) {
    this.colliders.push({ type: 'circle', x, z, r })
    this.addStaticBody(x, z, r * 1.6, r * 1.6, 0, height)
  }

  // A rectangular obstacle; `rotation` is around the vertical axis, like Object3D.rotation.y.
  addBox(x, z, width, depth, rotation = 0, height = 3) {
    this.colliders.push({
      type: 'box',
      x,
      z,
      hw: width / 2,
      hd: depth / 2,
      cos: Math.cos(rotation),
      sin: Math.sin(rotation),
    })
    this.addStaticBody(x, z, width, depth, rotation, height)
  }

  // Props bounce off the same scenery the car does.
  addStaticBody(x, z, width, depth, rotation, height) {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
      position: new CANNON.Vec3(x, height / 2, z),
      collisionFilterGroup: GROUP.STATIC,
      collisionFilterMask: GROUP.PROP,
    })
    body.quaternion.setFromEuler(0, rotation, 0)
    this.world.addBody(body)
  }

  // Finds every obstacle a circle at (x, z) overlaps and returns the push-out
  // directions and depths. Used for the front and back of the car.
  collide(x, z, radius, out = []) {
    out.length = 0

    for (const c of this.colliders) {
      const dx = x - c.x
      const dz = z - c.z
      if (c.type === 'circle') {
        const min = radius + c.r
        const distSq = dx * dx + dz * dz
        if (distSq >= min * min) continue
        const dist = Math.sqrt(distSq) || 0.0001
        out.push({ nx: dx / dist, nz: dz / dist, depth: min - dist })
        continue
      }

      // Box: work in the box's own frame, where it is axis-aligned.
      const reach = radius + Math.max(c.hw, c.hd) * 1.42
      if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue
      const lx = dx * c.cos - dz * c.sin
      const lz = dx * c.sin + dz * c.cos
      const cx = clamp(lx, -c.hw, c.hw)
      const cz = clamp(lz, -c.hd, c.hd)
      let nx
      let nz
      let depth

      if (cx === lx && cz === lz) {
        // centre is inside the box: leave through the nearest side
        const outX = c.hw - Math.abs(lx)
        const outZ = c.hd - Math.abs(lz)
        if (outX < outZ) {
          nx = Math.sign(lx) || 1
          nz = 0
          depth = outX + radius
        } else {
          nx = 0
          nz = Math.sign(lz) || 1
          depth = outZ + radius
        }
      } else {
        const ex = lx - cx
        const ez = lz - cz
        const distSq = ex * ex + ez * ez
        if (distSq >= radius * radius) continue
        const dist = Math.sqrt(distSq)
        nx = ex / dist
        nz = ez / dist
        depth = radius - dist
      }

      // back to world space
      out.push({ nx: nx * c.cos + nz * c.sin, nz: -nx * c.sin + nz * c.cos, depth })
    }

    // The edge of the island.
    const fromCentre = Math.hypot(x, z)
    if (fromCentre > DRIVE_RADIUS - radius) {
      out.push({ nx: -x / fromCentre, nz: -z / fromCentre, depth: fromCentre - (DRIVE_RADIUS - radius) })
    }

    return out
  }

  step(dt) {
    this.world.step(1 / 60, dt, 4)
  }
}
