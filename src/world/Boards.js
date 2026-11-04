import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { GROUP } from './Physics.js'
import { BODY_OFFSET, BODY_RADIUS } from './Car.js'
import { OFFSET as CAMERA_OFFSET } from './CameraRig.js'
import { clamp, damp, easeInOutCubic } from '../utils/math.js'

// The info boards on the island. Crash into one and it breaks: the panel shatters into
// pieces that tumble away, its legs topple, and anything mounted on it (a status light,
// a shelf with a model car) falls too. 15–20 seconds later, once the car is clear, the
// pieces fly back together and the board stands where it was.
//
// A whole board also turns see-through while the car is behind it, where it would
// otherwise hide the car from the camera.

const REBUILD_AFTER = { min: 15, max: 20 } // seconds after the crash
const REBUILD_SECONDS = 1.4
// A board can't stand up where the car is, so it rebuilds only once the car is at least
// this far (in metres) from where it stands.
const CLEARANCE = 0.5
const PIECE_SIZE = 2.4 // the panel breaks into pieces roughly this big
const PANEL_DEPTH = 0.2
const KEEP_SPEED = 0.65 // the share of its speed the car keeps when it smashes a board
// Seen from the camera, a board hides the ground behind it for HIDDEN_BEHIND × its height.
const HIDDEN_BEHIND = CAMERA_OFFSET.z / CAMERA_OFFSET.y
const FADED_OPACITY = 0.2

const _turn = new THREE.Quaternion()
const _bodyPosition = new THREE.Vector3()

export class Boards {
  constructor({ scene, physics }) {
    this.scene = scene
    this.physics = physics
    this.boards = []
    this.onBreak = null // (speed) => {}, when the car smashes a board
    this.onRebuilt = null // () => {}, when one stands again
  }

  get brokenCount() {
    return this.boards.filter((board) => board.state !== 'whole').length
  }

  // A board on two legs, leaning back by `tilt` (radians from upright), with `texture`
  // on its front face. Returns the panel, for placing things relative to it.
  add({ x, z, width, height, texture, frame, tilt }) {
    // Transparent from the start, though fully opaque until they fade: switching a
    // material to transparent mid-drive would swap its shader and stutter.
    const frameMaterial = new THREE.MeshStandardMaterial({ color: frame, roughness: 0.6, transparent: true })
    const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75, transparent: true })

    const lift = 0.6 + (height / 2) * Math.cos(tilt)
    const panel = this.mesh(
      new THREE.BoxGeometry(width, height, PANEL_DEPTH),
      [frameMaterial, frameMaterial, frameMaterial, frameMaterial, face, frameMaterial],
      x,
      lift,
      z,
    )
    panel.rotation.x = -tilt
    panel.updateMatrixWorld()

    // legs, hidden behind the board
    const legHeight = lift + (height / 2) * Math.cos(tilt) * 0.4
    const legs = [-1, 1].map((side) =>
      this.mesh(
        new THREE.BoxGeometry(0.25, legHeight, 0.25),
        frameMaterial,
        x + side * (width / 2 - 0.8),
        legHeight / 2,
        z - (height / 2) * Math.sin(tilt) * 0.4,
      ),
    )

    const depth = height * Math.sin(tilt)
    const top = lift + (height / 2) * Math.cos(tilt)
    this.boards.push({
      panel,
      width,
      height,
      materials: [frameMaterial, face],
      casters: [panel, ...legs],
      parts: [], // legs and anything attached: they fall when the board breaks
      pieces: null, // the panel's pieces, cut the first time it breaks
      state: 'whole', // 'whole', 'broken' or 'rebuilding'
      timer: 0,
      rebuildAfter: 0,
      opacity: 1,
      footprint: { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 },
      behind: { minX: x - width / 2 - 1.5, maxX: x + width / 2 + 1.5, minZ: z - depth / 2 - top * HIDDEN_BEHIND, maxZ: z - depth / 2 },
    })
    for (const leg of legs) this.attach(panel, leg)
    return panel
  }

  // Something mounted on a board (a light, a shelf, a model) falls with it and comes
  // back with it. It must be a direct child of the scene, so its transform is a world one.
  attach(panel, object) {
    const board = this.boards.find((item) => item.panel === panel)
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    const size = box.getSize(new THREE.Vector3()).multiplyScalar(0.5).max(new THREE.Vector3(0.05, 0.05, 0.05))
    board.parts.push(this.part(object, size, box.getCenter(new THREE.Vector3()), new THREE.Quaternion()))
  }

  update(dt, car) {
    for (const board of this.boards) {
      if (board.state === 'whole') {
        if (this.touches(board.footprint, car, 0)) this.smash(board, car)
        else this.fade(board, dt, car.position)
      } else if (board.state === 'broken') {
        for (const part of this.moving(board)) this.follow(part)
        board.timer += dt
        if (board.timer > board.rebuildAfter && !this.touches(board.footprint, car, CLEARANCE)) this.startRebuild(board)
      } else {
        this.rebuild(board, dt)
      }
    }
  }

  // ---------- breaking ----------

  smash(board, car) {
    board.state = 'broken'
    board.timer = 0
    board.rebuildAfter = REBUILD_AFTER.min + Math.random() * (REBUILD_AFTER.max - REBUILD_AFTER.min)
    this.setOpacity(board, 1)

    board.pieces ??= this.cut(board)
    board.panel.visible = false
    for (const piece of board.pieces) {
      piece.object.position.copy(piece.homePosition)
      piece.object.quaternion.copy(piece.homeQuaternion)
      piece.object.visible = true
    }

    const speed = car.speed
    const front = new THREE.Vector3(-Math.sin(car.heading), 0, -Math.cos(car.heading)).multiplyScalar(2).add(car.position)
    for (const part of this.moving(board)) this.launch(part, car, front)
    car.velocity.multiplyScalar(KEEP_SPEED)
    this.onBreak?.(speed)
  }

  // Cuts the panel into a grid of pieces, each showing its own part of the picture.
  cut(board) {
    const { panel, width, height } = board
    const cols = clamp(Math.round(width / PIECE_SIZE), 2, 6)
    const rows = clamp(Math.round(height / PIECE_SIZE), 2, 4)
    const pieceWidth = width / cols
    const pieceHeight = height / rows
    const pieces = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const geometry = new THREE.BoxGeometry(pieceWidth * 0.98, pieceHeight * 0.98, PANEL_DEPTH)
        // the front face (vertices 16–19 of a box) shows this piece's share of the texture
        const uv = geometry.attributes.uv
        for (let i = 16; i < 20; i++) {
          uv.setXY(i, (col + uv.getX(i)) / cols, 1 - (row + 1 - uv.getY(i)) / rows)
        }
        const piece = this.mesh(geometry, panel.material, 0, 0, 0)
        piece.visible = false
        piece.position.copy(panel.localToWorld(new THREE.Vector3(-width / 2 + (col + 0.5) * pieceWidth, height / 2 - (row + 0.5) * pieceHeight, 0)))
        piece.quaternion.copy(panel.quaternion)
        const size = new THREE.Vector3(pieceWidth / 2, pieceHeight / 2, PANEL_DEPTH / 2)
        pieces.push(this.part(piece, size, piece.position.clone(), piece.quaternion.clone()))
      }
    }
    return pieces
  }

  // Sends a part flying: on with the car, out from where it hit, and tumbling.
  launch(part, car, impact) {
    const { x: hx, y: hy, z: hz } = part.size
    const body = new CANNON.Body({
      mass: clamp(hx * hy * hz * 12, 0.3, 3),
      shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)),
      position: new CANNON.Vec3(part.bodyPosition.x, part.bodyPosition.y, part.bodyPosition.z),
      quaternion: new CANNON.Quaternion(part.bodyQuaternion.x, part.bodyQuaternion.y, part.bodyQuaternion.z, part.bodyQuaternion.w),
      collisionFilterGroup: GROUP.PROP,
      collisionFilterMask: GROUP.GROUND | GROUP.STATIC | GROUP.PROP | GROUP.CAR,
      linearDamping: 0.05,
      angularDamping: 0.15,
    })
    body.sleepSpeedLimit = 0.3
    body.sleepTimeLimit = 0.8

    const away = new THREE.Vector3(part.bodyPosition.x - impact.x, 0, part.bodyPosition.z - impact.z)
    const distance = away.length()
    away.normalize()
    const push = 1 - clamp(distance / 8, 0, 0.7) // the nearer the impact, the harder it flies
    const spread = () => (Math.random() - 0.5) * 2
    body.velocity.set(
      car.velocity.x * 0.75 * push + away.x * 2.5 + spread(),
      2 + Math.random() * 3 + car.speed * 0.12 * push,
      car.velocity.y * 0.75 * push + away.z * 2.5 + spread(),
    )
    body.angularVelocity.set(spread() * 4, spread() * 4, spread() * 4)
    this.physics.world.addBody(body)
    part.body = body
  }

  // Moves a part's object to wherever its physics body has got to.
  follow(part) {
    const { body, object } = part
    _turn.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w).multiply(part.inverse)
    object.quaternion.copy(_turn).multiply(part.homeQuaternion)
    object.position.copy(part.offset).applyQuaternion(_turn).add(_bodyPosition.set(body.position.x, body.position.y, body.position.z))
  }

  // ---------- rebuilding ----------

  startRebuild(board) {
    board.state = 'rebuilding'
    board.timer = 0
    for (const part of this.moving(board)) {
      this.physics.world.removeBody(part.body)
      part.body = null
      part.from = { position: part.object.position.clone(), quaternion: part.object.quaternion.clone() }
    }
  }

  rebuild(board, dt) {
    board.timer += dt
    const t = easeInOutCubic(Math.min(1, board.timer / REBUILD_SECONDS))
    for (const part of this.moving(board)) {
      part.object.position.lerpVectors(part.from.position, part.homePosition, t)
      part.object.position.y += Math.sin(t * Math.PI) * 1.2 // a little hop on the way back
      part.object.quaternion.slerpQuaternions(part.from.quaternion, part.homeQuaternion, t)
    }
    if (t < 1) return
    for (const piece of board.pieces) piece.object.visible = false
    board.panel.visible = true
    board.state = 'whole'
    this.onRebuilt?.()
  }

  // ---------- helpers ----------

  // Does the car (two circles, one over each axle) come within `margin` of `rect`?
  touches(rect, car, margin) {
    const forwardX = -Math.sin(car.heading)
    const forwardZ = -Math.cos(car.heading)
    for (const end of [1, -1]) {
      const x = car.position.x + forwardX * BODY_OFFSET * end
      const z = car.position.z + forwardZ * BODY_OFFSET * end
      const dx = x - clamp(x, rect.minX, rect.maxX)
      const dz = z - clamp(z, rect.minZ, rect.maxZ)
      if (dx * dx + dz * dz < (BODY_RADIUS + margin) ** 2) return true
    }
    return false
  }

  fade(board, dt, { x, z }) {
    const r = board.behind
    const target = x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ ? FADED_OPACITY : 1
    if (board.opacity === target) return
    const opacity = damp(board.opacity, target, 10, dt)
    this.setOpacity(board, Math.abs(opacity - target) < 0.01 ? target : opacity)
  }

  setOpacity(board, opacity) {
    board.opacity = opacity
    for (const material of board.materials) {
      material.opacity = opacity
      material.depthWrite = opacity === 1 // a faded board mustn't hide what's behind it
    }
    // a see-through board shouldn't leave a dark slab of shadow on the ground
    for (const mesh of board.casters) mesh.castShadow = opacity > 0.6
  }

  moving(board) {
    return board.pieces ? [...board.pieces, ...board.parts] : board.parts
  }

  // Bookkeeping for something that flies off and comes back: where it belongs, and the
  // box its physics body uses (`size` is half its extent, centred on `bodyPosition`).
  part(object, size, bodyPosition, bodyQuaternion) {
    return {
      object,
      homePosition: object.position.clone(),
      homeQuaternion: object.quaternion.clone(),
      size,
      bodyPosition,
      bodyQuaternion,
      inverse: bodyQuaternion.clone().invert(),
      offset: object.position.clone().sub(bodyPosition), // the object's origin, from the body's centre
      body: null,
      from: null,
    }
  }

  mesh(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)
    return mesh
  }
}
