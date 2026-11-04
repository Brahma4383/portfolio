import * as THREE from 'three'
import { createRandom } from '../utils/random.js'
import { headingToward, wrapAngle } from '../utils/math.js'

export const BUG_COUNT = 6
const SQUASH_DISTANCE = 1.9
const FLEE_DISTANCE = 7
const RESPAWN_DELAY = 5

// Little red bugs that wander around the Test Lab. Drive over them to "fix" them.
// They scurry away when the car gets close, so it takes a bit of driving.
export class BugHunt {
  constructor({ scene, x, z, radius }) {
    this.scene = scene
    this.center = { x, z }
    this.radius = radius
    this.random = createRandom(42)
    this.fixed = 0
    this.respawnTimer = 0
    this.onSquash = null

    const shell = new THREE.MeshStandardMaterial({ color: '#d62839', roughness: 0.35 })
    const dark = new THREE.MeshStandardMaterial({ color: '#1d1d1d', roughness: 0.6 })
    const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })
    const geometries = {
      body: new THREE.SphereGeometry(0.7, 14, 10).scale(1, 0.55, 1.25),
      seam: new THREE.BoxGeometry(0.06, 0.06, 1.5),
      head: new THREE.SphereGeometry(0.36, 12, 8),
      eye: new THREE.SphereGeometry(0.1, 8, 6),
      leg: new THREE.BoxGeometry(0.8, 0.08, 0.08).translate(0.4, 0, 0),
      antenna: new THREE.CylinderGeometry(0.03, 0.03, 0.6).translate(0, 0.3, 0),
      spot: new THREE.SphereGeometry(0.14, 8, 6).scale(1, 0.4, 1),
    }

    this.bugs = Array.from({ length: BUG_COUNT }, () => {
      const group = new THREE.Group()
      const body = new THREE.Mesh(geometries.body, shell)
      body.position.y = 0.45
      const seam = new THREE.Mesh(geometries.seam, dark)
      seam.position.set(0, 0.84, 0.05)
      const head = new THREE.Mesh(geometries.head, dark)
      head.position.set(0, 0.42, -0.95)
      group.add(body, seam, head)

      for (const [sx, sz] of [[-0.28, 0.5], [0.28, 0.5], [-0.32, -0.1], [0.32, -0.1]]) {
        const spot = new THREE.Mesh(geometries.spot, dark)
        spot.position.set(sx, 0.78 - Math.abs(sz) * 0.12, sz)
        group.add(spot)
      }
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(geometries.eye, white)
        eye.position.set(side * 0.16, 0.52, -1.22)
        const antenna = new THREE.Mesh(geometries.antenna, dark)
        antenna.position.set(side * 0.14, 0.62, -1.1)
        antenna.rotation.set(-0.6, 0, side * 0.4)
        group.add(eye, antenna)
      }

      const legs = []
      for (const side of [-1, 1]) {
        for (const offset of [-0.45, 0, 0.45]) {
          const leg = new THREE.Mesh(geometries.leg, dark)
          leg.position.set(side * 0.55, 0.3, offset)
          leg.rotation.set(0, side > 0 ? 0 : Math.PI, -0.5)
          group.add(leg)
          legs.push({ leg, side, base: leg.rotation.y, phase: offset * 4 + (side > 0 ? Math.PI : 0) })
        }
      }

      group.traverse((child) => (child.castShadow = true))
      this.scene.add(group)
      return { group, legs, state: 'alive', heading: 0, turn: 0, turnTimer: 0, timer: 0 }
    })

    this.spawnAll()
  }

  spawnAll() {
    this.fixed = 0
    this.respawnTimer = 0
    for (const bug of this.bugs) {
      const angle = this.random.next() * Math.PI * 2
      const distance = Math.sqrt(this.random.next()) * this.radius * 0.8
      bug.group.position.set(this.center.x + Math.cos(angle) * distance, 0.1, this.center.z + Math.sin(angle) * distance)
      bug.group.scale.set(1, 1, 1)
      bug.group.visible = true
      bug.heading = this.random.next() * Math.PI * 2
      bug.state = 'alive'
      bug.timer = 0
    }
  }

  update(dt, elapsed, car) {
    for (const bug of this.bugs) {
      if (bug.state === 'alive') this.wander(bug, dt, elapsed, car)
      else if (bug.state === 'squashed') {
        bug.timer += dt
        bug.group.scale.y = Math.max(0.12, 1 - bug.timer * 9)
        bug.group.scale.x = bug.group.scale.z = 1 + Math.min(bug.timer * 3, 0.35)
        if (bug.timer > 1.4) {
          bug.state = 'gone'
          bug.group.visible = false
        }
      }
    }

    // Once every bug is fixed, a fresh batch appears after you've left the lab.
    if (this.fixed === BUG_COUNT) {
      this.respawnTimer += dt
      const away = Math.hypot(car.position.x - this.center.x, car.position.z - this.center.z) > this.radius + 12
      if (this.respawnTimer > RESPAWN_DELAY && away) this.spawnAll()
    }
  }

  wander(bug, dt, elapsed, car) {
    const position = bug.group.position
    const dx = position.x - car.position.x
    const dz = position.z - car.position.z
    const carDistance = Math.hypot(dx, dz)

    if (carDistance < SQUASH_DISTANCE) {
      bug.state = 'squashed'
      bug.timer = 0
      this.fixed++
      this.onSquash?.(this.fixed, BUG_COUNT, position)
      return
    }

    let target = null
    if (Math.hypot(position.x - this.center.x, position.z - this.center.z) > this.radius) {
      target = headingToward(this.center.x - position.x, this.center.z - position.z)
    } else if (carDistance < FLEE_DISTANCE && car.speed > 1) {
      target = headingToward(dx, dz)
    }

    if (target !== null) {
      bug.heading += Math.sign(wrapAngle(target - bug.heading)) * Math.min(Math.abs(wrapAngle(target - bug.heading)), 4 * dt)
    } else {
      bug.turnTimer -= dt
      if (bug.turnTimer <= 0) {
        bug.turn = this.random.range(-1.6, 1.6)
        bug.turnTimer = this.random.range(0.6, 2)
      }
      bug.heading += bug.turn * dt
    }

    const speed = carDistance < FLEE_DISTANCE ? 4.2 : 1.3
    position.x += -Math.sin(bug.heading) * speed * dt
    position.z += -Math.cos(bug.heading) * speed * dt
    bug.group.rotation.y = bug.heading

    for (const { leg, base, phase } of bug.legs) {
      leg.rotation.y = base + Math.sin(elapsed * speed * 9 + phase) * 0.35
    }
  }
}
