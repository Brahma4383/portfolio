import * as THREE from 'three'
import { WHEEL_POSITIONS } from './Car.js'

const PUFF_COUNT = 48
const SKID_SEGMENTS = 800
const SKID_WIDTH = 0.32
const SKID_HEIGHT = 0.135

// Dust puffs and tyre marks when the car drifts or brakes hard.
export class Effects {
  constructor(scene) {
    this.scene = scene
    this.buildPuffs()
    this.buildSkids()
    this.emitTimer = 0
    this.rearWheels = WHEEL_POSITIONS.filter((w) => !w.front)
    this.lastMarks = this.rearWheels.map(() => null)
  }

  buildPuffs() {
    const geometry = new THREE.IcosahedronGeometry(0.5, 0)
    this.puffs = Array.from({ length: PUFF_COUNT }, () => {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 1, transparent: true, opacity: 0, depthWrite: false, flatShading: true }),
      )
      mesh.visible = false
      this.scene.add(mesh)
      return { mesh, life: 1, velocity: new THREE.Vector3() }
    })
    this.nextPuff = 0
  }

  buildSkids() {
    this.skidPositions = new Float32Array(SKID_SEGMENTS * 6 * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setDrawRange(0, 0)
    this.skids = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: '#2a2a2a',
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    )
    this.skids.frustumCulled = false
    this.scene.add(this.skids)
    this.skidIndex = 0
    this.skidTotal = 0
  }

  emitPuff(x, z, carVelocity) {
    const puff = this.puffs[this.nextPuff]
    this.nextPuff = (this.nextPuff + 1) % PUFF_COUNT
    puff.life = 0
    puff.mesh.visible = true
    puff.mesh.position.set(x + (Math.random() - 0.5) * 0.4, 0.35, z + (Math.random() - 0.5) * 0.4)
    puff.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0)
    puff.velocity.set(-carVelocity.x * 0.08 + (Math.random() - 0.5), 0.9 + Math.random() * 0.6, -carVelocity.y * 0.08 + (Math.random() - 0.5))
  }

  addSkid(from, to) {
    const dx = to.x - from.x
    const dz = to.z - from.z
    const length = Math.hypot(dx, dz)
    if (length < 0.05) return
    const nx = (-dz / length) * SKID_WIDTH * 0.5
    const nz = (dx / length) * SKID_WIDTH * 0.5
    const p = this.skidPositions
    let i = this.skidIndex * 18
    const vertex = (x, z) => {
      p[i++] = x
      p[i++] = SKID_HEIGHT
      p[i++] = z
    }
    vertex(from.x - nx, from.z - nz)
    vertex(from.x + nx, from.z + nz)
    vertex(to.x - nx, to.z - nz)
    vertex(from.x + nx, from.z + nz)
    vertex(to.x + nx, to.z + nz)
    vertex(to.x - nx, to.z - nz)

    this.skidIndex = (this.skidIndex + 1) % SKID_SEGMENTS
    this.skidTotal = Math.min(this.skidTotal + 1, SKID_SEGMENTS)
    this.skids.geometry.setDrawRange(0, this.skidTotal * 6)
    this.skids.geometry.attributes.position.needsUpdate = true
  }

  wheelPosition(car, wheel) {
    const cos = Math.cos(car.heading)
    const sin = Math.sin(car.heading)
    return {
      x: car.position.x + wheel.x * cos + wheel.z * sin,
      z: car.position.z - wheel.x * sin + wheel.z * cos,
    }
  }

  update(dt, car, input) {
    const sliding = Math.abs(car.lateralSpeed) > 3.2 && car.speed > 5
    const hardBrake = car.braking && car.speed > 9
    const wheelspin = input.throttle > 0 && car.forwardSpeed > 0.5 && car.forwardSpeed < 7

    // tyre marks
    this.rearWheels.forEach((wheel, i) => {
      const point = this.wheelPosition(car, wheel)
      if (sliding || hardBrake) {
        if (this.lastMarks[i]) this.addSkid(this.lastMarks[i], point)
        this.lastMarks[i] = point
      } else {
        this.lastMarks[i] = null
      }
    })

    // dust
    if (sliding || hardBrake || wheelspin) {
      this.emitTimer -= dt
      if (this.emitTimer <= 0) {
        this.emitTimer = sliding ? 0.03 : 0.06
        for (const wheel of this.rearWheels) {
          const point = this.wheelPosition(car, wheel)
          this.emitPuff(point.x, point.z, car.velocity)
        }
      }
    }

    for (const puff of this.puffs) {
      if (puff.life >= 1) continue
      puff.life = Math.min(1, puff.life + dt / 0.9)
      puff.mesh.position.addScaledVector(puff.velocity, dt)
      puff.mesh.scale.setScalar(0.45 + puff.life * 1.7)
      puff.mesh.material.opacity = (1 - puff.life) * 0.6
      if (puff.life >= 1) puff.mesh.visible = false
    }
  }
}
