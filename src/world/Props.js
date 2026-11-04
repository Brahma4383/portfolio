import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { GROUP } from './Physics.js'
import { BODY_OFFSET, BODY_RADIUS } from './Car.js'
import { createGlyphGeometry, layoutText } from '../utils/pixelFont.js'
import { createCrateTexture } from '../utils/textures.js'
import { clamp, easeInOutCubic, easeOutBack } from '../utils/math.js'

const PIN_RESET_DELAY = 4

// A crate stack or pixel word that gets knocked rebuilds itself REBUILD_AFTER seconds
// later: its pieces fly home one after another (crates bottom row first, letters left
// to right), each flight lasting REBUILD_FLIGHT seconds. It waits only while the car
// stands where the pieces would land (within REBUILD_CLEARANCE metres of its footprint).
const REBUILD_AFTER = 20
const REBUILD_FLIGHT = 1.1
const REBUILD_STAGGER = 0.18
const REBUILD_CLEARANCE = 0.3

export class Props {
  constructor({ scene, physics }) {
    this.scene = scene
    this.physics = physics
    this.items = []
    this.pins = []
    this.groups = [] // crate stacks and pixel words, each rebuilt as one piece
    this.bowling = { state: 'ready', timer: 0, home: null }
    this.onBowlingResult = null
    this.onGroupsChange = null // (kind, knocked) => {}, how many 'crates' or 'text' groups are out of shape
  }

  add(mesh, body) {
    body.collisionFilterGroup = GROUP.PROP
    body.collisionFilterMask = GROUP.GROUND | GROUP.STATIC | GROUP.PROP | GROUP.CAR
    body.sleepSpeedLimit = 0.25
    body.sleepTimeLimit = 0.6
    this.physics.world.addBody(body)
    body.sleep()

    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)

    const item = {
      mesh,
      body,
      homePosition: body.position.clone(),
      homeQuaternion: body.quaternion.clone(),
      popIn: 1,
    }
    this.items.push(item)
    this.sync(item)
    return item
  }

  // A set of props that is rebuilt together. `area` is the ground it stands on, which
  // the car must keep clear of while it rebuilds.
  addGroup(kind, area) {
    const group = { kind, area, items: [], state: 'standing', timer: 0 }
    this.groups.push(group)
    return group
  }

  // Big pixel letters standing on the ground, one physics body per letter.
  // Knocked over, the word puts itself back together.
  addText(text, { x, z, pixel, depth = pixel * 1.6, spacing = pixel * 1.3, color, mass = 2 }) {
    const { letters, width, height } = layoutText(text, pixel, spacing)
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
    const word = this.addGroup('text', { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 })

    for (const letter of letters) {
      const geometry = createGlyphGeometry(letter.char, pixel, depth)
      if (!geometry) continue
      const body = new CANNON.Body({
        mass,
        shape: new CANNON.Box(new CANNON.Vec3(letter.width / 2, height / 2, depth / 2)),
        position: new CANNON.Vec3(x + letter.x, height / 2, z),
      })
      word.items.push(this.add(new THREE.Mesh(geometry, material), body))
    }
  }

  // A 3-2-1 pyramid of crates. labels[0] goes on top. Knocked over, it rebuilds itself.
  addCrateStack(labels, { x, z, size, color }) {
    const geometry = new THREE.BoxGeometry(size, size, size)
    const rows = [[0], [-0.5, 0.5], [-1, 0, 1]]
    const halfWidth = 1.5 * size * 1.04 + size / 2
    const stack = this.addGroup('crates', { minX: x - halfWidth, maxX: x + halfWidth, minZ: z - size / 2, maxZ: z + size / 2 })
    let index = 0

    rows.forEach((offsets, row) => {
      const level = rows.length - 1 - row
      for (const offset of offsets) {
        const label = labels[index++]
        if (!label) continue
        const material = new THREE.MeshStandardMaterial({ map: createCrateTexture({ label, color }), roughness: 0.7 })
        const body = new CANNON.Body({
          mass: 1.2,
          shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
          position: new CANNON.Vec3(x + offset * size * 1.04, size / 2 + level * (size + 0.02), z),
        })
        // rebuilt bottom row first, so prepend: the rows are made top first
        stack.items.unshift(this.add(new THREE.Mesh(geometry, material), body))
      }
    })
  }

  // Ten bowling pins in the classic triangle; the head pin is the southernmost.
  addBowlingPins(x, z) {
    const profile = [
      [0, -0.6], [0.22, -0.6], [0.3, -0.36], [0.28, -0.1], [0.17, 0.18],
      [0.12, 0.3], [0.16, 0.44], [0.13, 0.56], [0, 0.6],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    const pinGeometry = new THREE.LatheGeometry(profile, 14)
    const stripeGeometry = new THREE.CylinderGeometry(0.15, 0.16, 0.08, 14)
    const white = new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: 0.3 })
    const red = new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.4 })

    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        const mesh = new THREE.Mesh(pinGeometry, white)
        const stripe = new THREE.Mesh(stripeGeometry, red)
        stripe.position.y = 0.24
        mesh.add(stripe)
        const body = new CANNON.Body({
          mass: 0.6,
          shape: new CANNON.Cylinder(0.18, 0.28, 1.2, 10),
          position: new CANNON.Vec3(x + (i - row / 2) * 1.05, 0.6, z - row * 0.95),
        })
        const pin = this.add(mesh, body)
        pin.isPin = true
        this.pins.push(pin)
      }
    }
    this.bowling.home = new THREE.Vector3(x, 0, z - 1.5)
  }

  sync(item) {
    item.mesh.position.copy(item.body.position)
    item.mesh.quaternion.copy(item.body.quaternion)
  }

  resetItem(item) {
    const { body } = item
    body.position.copy(item.homePosition)
    body.quaternion.copy(item.homeQuaternion)
    body.velocity.setZero()
    body.angularVelocity.setZero()
    body.sleep()
    item.popIn = 0
    this.sync(item)
  }

  isDisplaced(item) {
    const { body, homePosition, homeQuaternion } = item
    const moved = body.position.distanceTo(homePosition) > 0.25
    const q = body.quaternion
    const dot = Math.abs(q.x * homeQuaternion.x + q.y * homeQuaternion.y + q.z * homeQuaternion.z + q.w * homeQuaternion.w)
    return moved || dot < 0.995
  }

  isPinDown(item) {
    const q = item.body.quaternion
    const up = 1 - 2 * (q.x * q.x + q.z * q.z) // y component of the pin's up axis
    return up < 0.6 || item.body.position.distanceTo(item.homePosition) > 1.4
  }

  update(dt, car) {
    for (const item of this.items) {
      const { body, mesh } = item
      if (item.flying) continue // on its way home; see rebuildGroup()

      if (item.popIn < 1) {
        item.popIn = Math.min(1, item.popIn + dt * 2.5)
        mesh.scale.setScalar(Math.max(0.001, easeOutBack(item.popIn)))
      }

      const fellOff = body.position.y < -8 || Math.hypot(body.position.x, body.position.z) > 160
      if (fellOff) {
        this.resetItem(item)
        continue
      }

      if (body.sleepState !== CANNON.Body.SLEEPING) this.sync(item)
    }

    this.updateGroups(dt, car)
    this.updateBowling(dt, car.position)
  }

  // ---------- crate stacks and pixel words ----------

  updateGroups(dt, car) {
    for (const group of this.groups) {
      if (group.state === 'standing') {
        if (group.items.some((item) => this.isDisplaced(item))) this.setGroupState(group, 'knocked')
      } else if (group.state === 'knocked') {
        group.timer += dt
        if (group.timer >= REBUILD_AFTER && !this.carOver(group.area, car)) this.startRebuild(group)
      } else {
        this.rebuildGroup(group, dt)
      }
    }
  }

  setGroupState(group, state) {
    group.state = state
    group.timer = 0
    const knocked = this.groups.filter((other) => other.kind === group.kind && other.state !== 'standing').length
    this.onGroupsChange?.(group.kind, knocked)
  }

  // Does the car (two circles, one over each axle) stand on or right next to `area`?
  carOver(area, car) {
    const forwardX = -Math.sin(car.heading)
    const forwardZ = -Math.cos(car.heading)
    return [1, -1].some((end) => {
      const x = car.position.x + forwardX * BODY_OFFSET * end
      const z = car.position.z + forwardZ * BODY_OFFSET * end
      return Math.hypot(x - clamp(x, area.minX, area.maxX), z - clamp(z, area.minZ, area.maxZ)) < BODY_RADIUS + REBUILD_CLEARANCE
    })
  }

  // Lift every piece out of the physics world and remember where it lies, ready to fly home.
  startRebuild(group) {
    this.setGroupState(group, 'rebuilding')
    for (const item of group.items) {
      this.physics.world.removeBody(item.body)
      item.flying = {
        position: item.mesh.position.clone(),
        quaternion: item.mesh.quaternion.clone(),
        home: new THREE.Quaternion(item.homeQuaternion.x, item.homeQuaternion.y, item.homeQuaternion.z, item.homeQuaternion.w),
      }
      item.mesh.scale.setScalar(1)
    }
  }

  // Each piece arcs back to its place, one after another; when the last has landed
  // they all rejoin the physics world, standing exactly as they started.
  rebuildGroup(group, dt) {
    group.timer += dt
    group.items.forEach((item, i) => {
      const { position, quaternion, home } = item.flying
      const t = easeInOutCubic(clamp((group.timer - i * REBUILD_STAGGER) / REBUILD_FLIGHT, 0, 1))
      item.mesh.position.lerpVectors(position, item.homePosition, t)
      item.mesh.position.y += Math.sin(t * Math.PI) * Math.min(2, 0.5 + position.distanceTo(item.homePosition) * 0.25)
      item.mesh.quaternion.slerpQuaternions(quaternion, home, t)
    })

    if (group.timer < (group.items.length - 1) * REBUILD_STAGGER + REBUILD_FLIGHT) return
    for (const item of group.items) {
      const { body } = item
      body.position.copy(item.homePosition)
      body.quaternion.copy(item.homeQuaternion)
      body.velocity.setZero()
      body.angularVelocity.setZero()
      this.physics.world.addBody(body)
      body.sleep()
      item.flying = null
      this.sync(item)
    }
    this.setGroupState(group, 'standing')
  }

  updateBowling(dt, carPosition) {
    if (!this.pins.length) return
    const bowling = this.bowling
    const down = this.pins.filter((pin) => this.isPinDown(pin)).length

    if (bowling.state === 'ready' && down > 0) {
      bowling.state = 'rolling'
      bowling.timer = 0
    } else if (bowling.state === 'rolling') {
      bowling.timer += dt
      if (down === this.pins.length || bowling.timer > 3.5) {
        this.onBowlingResult?.(down, this.pins.length)
        bowling.state = 'done'
        bowling.timer = 0
      }
    } else if (bowling.state === 'done') {
      bowling.timer += dt
      const carNear = Math.hypot(carPosition.x - bowling.home.x, carPosition.z - bowling.home.z) < 9
      if (bowling.timer > PIN_RESET_DELAY && !carNear) {
        this.pins.forEach((pin) => this.resetItem(pin))
        bowling.state = 'ready'
      }
    }
  }
}
