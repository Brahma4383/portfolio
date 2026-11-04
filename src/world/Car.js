import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { GROUP } from './Physics.js'
import { clamp, damp } from '../utils/math.js'
import { buildCarBody, WHEEL_RADIUS } from './CarBody.js'
import { carById, DEFAULT_CAR } from '../data/cars.js'

export { WHEEL_POSITIONS } from './CarBody.js'

// Arcade handling. Speeds are in m/s, accelerations in m/s².
const TUNING = {
  acceleration: 20,
  boostAcceleration: 30,
  brakeDeceleration: 40,
  reverseAcceleration: 12,
  maxSpeed: 24,
  boostMaxSpeed: 34,
  maxReverse: 9,
  drag: 0.3,
  rolling: 4,
  grip: 12, // how quickly sideways sliding dies out
  driftGrip: 1.4, // ... and with the handbrake on
  handbrakeDeceleration: 6,
  maxSteer: 0.6,
  steerSpeed: 8,
  wheelBase: 2.7,
}

// The car's footprint is approximated by two circles, one at each end.
export const BODY_RADIUS = 1.08
export const BODY_OFFSET = 0.95

export class Car {
  constructor({ scene, physics }) {
    this.physics = physics
    this.position = new THREE.Vector3()
    this.velocity = new THREE.Vector2() // (x, z) in world space
    this.heading = 0
    this.steerAngle = 0
    this.forwardSpeed = 0
    this.lateralSpeed = 0
    this.yawRate = 0
    this.braking = false
    this.wheelSpin = 0
    this.pitch = 0
    this.roll = 0
    this.previousForward = 0
    this.propImpact = 0
    this.contacts = []
    this.night = 0

    this.group = new THREE.Group()
    this.setDesign(DEFAULT_CAR)
    scene.add(this.group)

    // Kinematic body in the prop world: it pushes letters, crates and pins out of the way.
    this.body = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Box(new CANNON.Vec3(1.02, 0.75, 2.1)),
      collisionFilterGroup: GROUP.CAR,
      collisionFilterMask: GROUP.PROP,
    })
    this.body.allowSleep = false
    physics.world.addBody(this.body)

    // Hitting a heavy prop slows the car down a little.
    this.body.addEventListener('collide', (event) => {
      const loss = clamp(event.body.mass * 0.035, 0, 0.3)
      this.velocity.multiplyScalar(1 - loss)
      this.propImpact = Math.max(this.propImpact, this.velocity.length() * Math.min(1, event.body.mass / 3))
    })
  }

  // Dresses the car as one of the designs in data/cars.js. Driving state is untouched,
  // so it can be swapped mid-corner without a jolt.
  setDesign(id) {
    const design = carById[id] ?? carById[DEFAULT_CAR]
    if (this.designId === design.id) return
    this.designId = design.id

    if (this.body3d) {
      this.group.remove(this.body3d)
      this.body3d.traverse((child) => {
        child.geometry?.dispose()
        if (child.material) [].concat(child.material).forEach((material) => material.dispose())
      })
    }

    const built = buildCarBody(design)
    this.body3d = new THREE.Group()
    this.chassis = built.chassis
    this.body3d.add(this.chassis)
    this.wheels = built.wheels
    for (const wheel of this.wheels) this.body3d.add(wheel.pivot)
    this.headlights = built.headlights
    for (const light of this.headlights) this.body3d.add(light, light.target)
    this.headlightMaterial = built.headlightMaterial
    this.taillightMaterial = built.taillightMaterial
    this.flashers = built.flashers
    this.group.add(this.body3d)

    this.setNight(this.night)
    this.syncVisuals()
  }

  reset({ x, z, heading }) {
    this.position.set(x, 0, z)
    this.heading = heading
    this.velocity.set(0, 0)
    this.steerAngle = 0
    this.forwardSpeed = 0
    this.lateralSpeed = 0
    this.yawRate = 0
    this.previousForward = 0
    this.syncVisuals()
    this.syncBody()
  }

  // Returns the strength of any bump against the scenery this frame (0 if none).
  update(dt, input) {
    const t = TUNING
    const fwdX = -Math.sin(this.heading)
    const fwdZ = -Math.cos(this.heading)
    const rightX = Math.cos(this.heading)
    const rightZ = -Math.sin(this.heading)

    let forward = this.velocity.x * fwdX + this.velocity.y * fwdZ
    let lateral = this.velocity.x * rightX + this.velocity.y * rightZ
    const maxSpeed = input.boost ? t.boostMaxSpeed : t.maxSpeed
    this.braking = false

    if (input.throttle > 0) {
      if (forward < -0.5) {
        forward += t.brakeDeceleration * dt
        this.braking = true
      } else if (forward < maxSpeed) {
        const acceleration = input.boost ? t.boostAcceleration : t.acceleration
        forward = Math.min(forward + acceleration * input.throttle * dt, maxSpeed)
      }
    } else if (input.throttle < 0) {
      if (forward > 0.5) {
        forward -= t.brakeDeceleration * dt
        this.braking = true
      } else {
        forward = Math.max(forward + t.reverseAcceleration * input.throttle * dt, -t.maxReverse)
      }
    } else {
      const slow = t.rolling * dt
      forward = Math.abs(forward) <= slow ? 0 : forward - Math.sign(forward) * slow
    }

    if (forward > maxSpeed) forward = damp(forward, maxSpeed, 2, dt)
    forward -= forward * t.drag * dt

    if (input.handbrake) {
      forward -= Math.sign(forward) * Math.min(Math.abs(forward), t.handbrakeDeceleration * dt)
      this.braking = true
    }
    lateral *= Math.exp(-(input.handbrake ? t.driftGrip : t.grip) * dt)

    // Less steering lock at speed keeps the car controllable.
    const speedFactor = 1 - 0.55 * clamp(Math.abs(forward) / t.boostMaxSpeed, 0, 1)
    this.steerAngle = damp(this.steerAngle, input.steer * t.maxSteer * speedFactor, t.steerSpeed, dt)
    this.yawRate = (forward / t.wheelBase) * Math.tan(this.steerAngle) * (input.handbrake ? 1.45 : 1)

    // Velocity is built from the heading *before* turning, so a turn leaves some
    // sideways slip behind — that is what makes the car slide and drift.
    this.velocity.set(fwdX * forward + rightX * lateral, fwdZ * forward + rightZ * lateral)
    this.heading += this.yawRate * dt
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.y * dt

    const impact = this.resolveCollisions()

    this.forwardSpeed = forward
    this.lateralSpeed = lateral
    this.animate(dt, forward)
    this.syncBody()
    return impact
  }

  resolveCollisions() {
    let impact = 0
    const fwdX = -Math.sin(this.heading)
    const fwdZ = -Math.cos(this.heading)

    for (const end of [1, -1]) {
      const cx = this.position.x + fwdX * BODY_OFFSET * end
      const cz = this.position.z + fwdZ * BODY_OFFSET * end
      for (const hit of this.physics.collide(cx, cz, BODY_RADIUS, this.contacts)) {
        this.position.x += hit.nx * hit.depth
        this.position.z += hit.nz * hit.depth
        const into = this.velocity.x * hit.nx + this.velocity.y * hit.nz
        if (into < 0) {
          // remove the part of the velocity going into the obstacle, plus a small bounce
          this.velocity.x -= hit.nx * into * 1.3
          this.velocity.y -= hit.nz * into * 1.3
          impact = Math.max(impact, -into)
        }
      }
    }

    if (impact > 3) this.velocity.multiplyScalar(0.85)
    return impact
  }

  animate(dt, forward) {
    this.syncVisuals()

    this.wheelSpin += (forward / WHEEL_RADIUS) * dt
    for (const wheel of this.wheels) {
      wheel.spinner.rotation.x = -this.wheelSpin
      if (wheel.front) wheel.pivot.rotation.y = this.steerAngle
    }

    // The body squats when accelerating, dives when braking and leans out of turns.
    const acceleration = (forward - this.previousForward) / Math.max(dt, 0.001)
    this.previousForward = forward
    this.pitch = damp(this.pitch, clamp(acceleration * 0.004, -0.07, 0.07), 6, dt)
    this.roll = damp(this.roll, clamp(-this.yawRate * forward * 0.006, -0.1, 0.1), 6, dt)
    this.chassis.rotation.set(this.pitch, 0, this.roll)

    if (this.flashers) {
      // police lights: blue and red take turns, four flashes a second
      const phase = Math.floor(performance.now() / 125) % 2
      this.flashers[0].emissiveIntensity = phase === 0 ? 3 : 0.2
      this.flashers[1].emissiveIntensity = phase === 1 ? 3 : 0.2
    }

    this.taillightMaterial.emissiveIntensity = damp(
      this.taillightMaterial.emissiveIntensity,
      this.braking || forward < -0.5 ? 3 : 0.4,
      14,
      dt,
    )
  }

  syncVisuals() {
    this.group.position.set(this.position.x, 0, this.position.z)
    this.group.rotation.y = this.heading
  }

  syncBody() {
    this.body.position.set(this.position.x, 0.78, this.position.z)
    this.body.velocity.set(this.velocity.x, 0, this.velocity.y)
    this.body.quaternion.setFromEuler(0, this.heading, 0)
    this.body.angularVelocity.set(0, this.yawRate, 0)
  }

  // 0 = day, 1 = night
  setNight(amount) {
    this.night = amount
    for (const light of this.headlights) light.intensity = amount * 60
    this.headlightMaterial.emissiveIntensity = 0.5 + amount * 2.5
  }

  get speed() {
    return this.velocity.length()
  }

  consumePropImpact() {
    const value = this.propImpact
    this.propImpact = 0
    return value
  }
}
