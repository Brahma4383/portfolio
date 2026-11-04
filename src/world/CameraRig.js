import * as THREE from 'three'
import { clamp, damp, easeInOutCubic, lerp } from '../utils/math.js'

// The camera keeps a fixed angle (like a diorama) and slides along with the car.
// Before the start button is pressed it slowly circles the whole island.
export const OFFSET = new THREE.Vector3(0, 21, 24)
const MIN_ZOOM = 0.55
const MAX_ZOOM = 1.6
const LOOK_NORTH = 4 // aim a little north of the car so more of the world ahead is visible
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export class CameraRig {
  constructor(camera) {
    this.camera = camera
    this.mode = 'orbit'
    this.time = 0
    this.zoom = 1
    this.targetZoom = 1
    this.baseZoom = 1 // pulled back on narrow screens so enough of the world fits across
    this.shake = 0
    this.progress = 0
    this.framing = new THREE.Vector2() // world-space shift that keeps the car clear of the info panel
    this.framingTarget = new THREE.Vector2()
    // a spot to keep in view along with the car (the Stormtrooper in the About area)
    this.interest = new THREE.Vector3()
    this.interestWeight = 0
    this.interestTarget = 0

    this.focus = new THREE.Vector3()
    this.lookAt = new THREE.Vector3()
    this.position = new THREE.Vector3()
    this.from = { position: new THREE.Vector3(), lookAt: new THREE.Vector3() }
    this.desired = new THREE.Vector3()
    this.followPosition = new THREE.Vector3()
  }

  zoomBy(factor) {
    this.targetZoom = clamp(this.targetZoom * factor, MIN_ZOOM, MAX_ZOOM)
  }

  // Fly from wherever the camera is now down to the car.
  startFollowing() {
    this.mode = 'transition'
    this.progress = 0
    this.from.position.copy(this.camera.position)
    this.from.lookAt.copy(this.lookAt)
  }

  // Jump straight to the car (after a teleport).
  snap(car) {
    // Any point of interest eases in again from scratch, so a teleport never makes the
    // camera swing back towards the place the car just left.
    this.interestWeight = 0
    this.focus.set(car.position.x + this.framing.x, 0, car.position.z + this.framing.y - LOOK_NORTH)
    if (this.mode !== 'orbit') this.mode = 'follow'
  }

  // Distance from the camera to what it looks at, used to convert screen pixels to metres.
  get distance() {
    return OFFSET.length() * this.zoom * this.baseZoom
  }

  setAspect(aspect) {
    this.baseZoom = clamp(1.3 / aspect, 1, 3)
  }

  setFraming(x, z) {
    this.framingTarget.set(x, z)
  }

  // While `point` is set the camera looks halfway between the car and it, so both stay
  // in view. Pass null to go back to following the car alone.
  setInterest(point) {
    if (point) this.interest.set(point.x, 0, point.z)
    this.interestTarget = point ? 1 : 0
  }

  addShake(amount) {
    if (reducedMotion.matches) return
    this.shake = Math.min(1, this.shake + amount)
  }

  update(dt, car) {
    this.time += dt

    // Look a little ahead of the car so you can see where you're going.
    const ahead = clamp(car.speed * 0.3, 0, 7)
    const speed = car.speed || 1
    this.framing.x = damp(this.framing.x, this.framingTarget.x, 3, dt)
    this.framing.y = damp(this.framing.y, this.framingTarget.y, 3, dt)
    this.interestWeight = damp(this.interestWeight, this.interestTarget, 2.5, dt)
    const toInterest = this.interestWeight * 0.5 // halfway, at most
    const x = car.position.x + (car.velocity.x / speed) * ahead
    const z = car.position.z + (car.velocity.y / speed) * ahead
    this.desired.set(
      lerp(x, this.interest.x, toInterest) + this.framing.x,
      0,
      lerp(z, this.interest.z, toInterest) + this.framing.y - LOOK_NORTH,
    )
    this.focus.x = damp(this.focus.x, this.desired.x, 5, dt)
    this.focus.z = damp(this.focus.z, this.desired.z, 5, dt)
    this.zoom = damp(this.zoom, this.targetZoom, 6, dt)
    this.followPosition.copy(OFFSET).multiplyScalar(this.zoom * this.baseZoom).add(this.focus)

    if (this.mode === 'orbit') {
      const angle = this.time * 0.05 + 0.6
      this.position.set(Math.sin(angle) * 150, 92, Math.cos(angle) * 150)
      this.lookAt.set(0, 0, 0)
    } else if (this.mode === 'transition') {
      this.progress = Math.min(1, this.progress + dt / 2.6)
      const t = easeInOutCubic(this.progress)
      this.position.lerpVectors(this.from.position, this.followPosition, t)
      this.lookAt.lerpVectors(this.from.lookAt, this.focus, t)
      if (this.progress === 1) this.mode = 'follow'
    } else {
      this.position.copy(this.followPosition)
      this.lookAt.copy(this.focus)
    }

    this.camera.position.copy(this.position)
    if (this.shake > 0) {
      const strength = this.shake * this.shake * 0.7
      this.camera.position.x += (Math.random() - 0.5) * strength
      this.camera.position.y += (Math.random() - 0.5) * strength
      this.shake = Math.max(0, this.shake - dt * 2.5)
    }
    this.camera.lookAt(this.lookAt)
  }
}
