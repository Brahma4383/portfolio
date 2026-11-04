import * as THREE from 'three'
import { clamp, damp, easeOutBack, headingToward, lerp, wrapAngle } from '../utils/math.js'
import { createEmoteBubbleTexture } from '../utils/textures.js'

// The Stormtrooper in the About area, from the three.js Collada skinning example.
// His file holds a single animation, the dance. Every other move is made here:
// his bones are turned into poses, and the poses are baked into ordinary animation
// clips that the mixer cross-fades with the dance.
//
// He dances while nobody's around, stops to wave when you arrive, does any emote
// you pick in the About panel, and jumps when you honk.

const MODEL_URL = 'models/stormtrooper/stormtrooper.dae'
const HEIGHT = 3.4
const FPS = 30
const IDLE_SECONDS = 4
const GREET_SECONDS = 15
const BUBBLE_COLOR = '#e76f51'

// In his file he faces -Z, with +X on his right. Turned half round he faces the
// camera, and from there he turns up to MAX_TURN either way to look at the car.
const FACE_CAMERA = Math.PI
const MAX_TURN = 0.7

// Flips and cartwheels turn him about his hips, this high above his feet.
const PIVOT = 1.9

const RIGHT = new THREE.Vector3(1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)

// The bones the baked moves control. Everything else (hands, toes) keeps its rest pose.
const POSED = [
  'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'RightArm', 'RightForeArm', 'LeftArm', 'LeftForeArm',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftUpLeg', 'LeftLeg', 'LeftFoot',
]
const SIDES = [
  { side: 1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand' },
  { side: -1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand' },
]
const LEGS = [
  { side: 1, thigh: 'RightUpLeg', knee: 'RightLeg', foot: 'RightFoot', toe: 'RightToeBase' },
  { side: -1, thigh: 'LeftUpLeg', knee: 'LeftLeg', foot: 'LeftFoot', toe: 'LeftToeBase' },
]

const rad = THREE.MathUtils.degToRad
const TURN = Math.PI * 2
const smooth = (t) => t * t * (3 - 2 * t)
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const progress = (t, start, end) => clamp((t - start) / (end - start), 0, 1)
// rises from 0 to 1 between a and b, holds, then falls back to 0 between c and d
const envelope = (t, a, b, c, d) => smooth(progress(t, a, b)) * (1 - smooth(progress(t, c, d)))
// height of a jump that leaves the ground at `up` and lands at `down`, peaking at `peak`
const hop = (t, up, down, peak) => {
  const u = progress(t, up, down)
  return 4 * peak * u * (1 - u)
}
// whole turns made between `start` and `end`, easing in and out
const rotation = (t, start, end, turns) => easeInOut(progress(t, start, end)) * TURN * turns

// Directions in his own frame; `side` is 1 for his right arm and -1 for his left.
// sideways: out to his side, `angle` degrees above horizontal (-90 hangs straight down),
// leaning `front` towards his front.
const sideways = (side, angle, front = 0) =>
  new THREE.Vector3(side * Math.cos(rad(angle)), Math.sin(rad(angle)), -front).normalize()
// forwards: swung `angle` degrees forwards (0 hangs down, 90 points ahead, 180 points up),
// held `out` away from his body.
const forwards = (side, angle, out = 0) =>
  new THREE.Vector3(side * out, -Math.cos(rad(angle)), -Math.sin(rad(angle))).normalize()

// Standing at ease: arms by his sides, breathing and glancing around.
function stand(kit, t = 0) {
  kit.restore()
  const cycle = (t / IDLE_SECONDS) * Math.PI * 2
  kit.turn('Spine2', RIGHT, Math.sin(cycle) * 1.5)
  kit.turn('Head', UP, Math.sin(cycle + 1) * 5)
  for (const { side, arm, fore, hand } of SIDES) {
    kit.aim(arm, fore, forwards(side, 5, 0.16))
    kit.aim(fore, hand, forwards(side, 16, 0.1))
  }
}

// Points both arms: `upper` and `lower` give each segment's direction for a side.
function arms(kit, upper, lower) {
  for (const { side, arm, fore, hand } of SIDES) {
    kit.aim(arm, fore, upper(side))
    kit.aim(fore, hand, lower(side))
  }
}

// Bends both legs: thighs swung `hip` degrees forwards, shins pointing `shin` degrees
// (negative is backwards), feet kept flat.
function bend(kit, hip, shin, spread = 0.06) {
  for (const { side, thigh, knee, foot } of LEGS) {
    kit.aim(thigh, knee, forwards(side, hip, spread))
    kit.aim(knee, foot, forwards(side, shin, spread))
  }
  kit.flatFeet()
}

// Key poses the tricks are built from. Each one goes on top of the standing pose.
const POSES = {
  stand() {},
  crouch(kit) {
    bend(kit, 62, -38)
    kit.turn('Spine1', RIGHT, -12)
    arms(kit, (s) => forwards(s, -38, 0.18), (s) => forwards(s, -28, 0.12)) // swung back
  },
  reachUp(kit) {
    arms(kit, (s) => forwards(s, 168, 0.14), (s) => forwards(s, 172, 0.1))
  },
  reachForward(kit) {
    arms(kit, (s) => forwards(s, 115, 0.12), (s) => forwards(s, 125, 0.1))
  },
  tuck(kit) {
    bend(kit, 128, -18, 0.1)
    kit.turn('Spine', RIGHT, -12)
    kit.turn('Spine1', RIGHT, -14)
    kit.turn('Head', RIGHT, -12)
    arms(kit, (s) => forwards(s, 72, 0.32), (s) => forwards(s, 8, 0.18)) // hugging his shins
  },
  open(kit) {
    bend(kit, 22, 4)
    arms(kit, (s) => sideways(s, 28, 0.2), (s) => sideways(s, 34, 0.2))
  },
  land(kit) {
    bend(kit, 26, -8)
    arms(kit, (s) => forwards(s, 82, 0.3), (s) => forwards(s, 88, 0.25))
  },
  absorb(kit) {
    bend(kit, 58, -34)
    kit.turn('Spine1', RIGHT, -10)
    arms(kit, (s) => forwards(s, 74, 0.3), (s) => forwards(s, 80, 0.25))
  },
  hug(kit) {
    bend(kit, 18, -4)
    // forearms folded across his chest
    arms(kit, (s) => forwards(s, 22, 0.1), (s) => new THREE.Vector3(-s, 0.35, -0.6).normalize())
  },
}

// A flip or jump: crouch, take off reaching `reach`, hold `air` while airborne,
// open up, land and stand. Times are when each pose is reached.
const flight = (reach, air) => [
  [0, POSES.stand],
  [0.32, POSES.crouch],
  [0.46, reach],
  [0.62, air],
  [1.0, air],
  [1.16, POSES.open],
  [1.26, POSES.land],
  [1.46, POSES.absorb],
  [1.9, POSES.stand],
]
const onGround = (t) => t < 0.46 || t > 1.26

// Each move describes either `keys` (poses reached at given times, blended in between)
// or `pose` (the move at full strength at time t) with `weight` to blend it in and out.
// `body` moves his whole body: y (up), flip (head over heels) and spin (round on the
// spot). `grounded` says when his feet are on the ground, so bent knees lower him
// instead of lifting his feet.
const MOVES = [
  {
    id: 'Wave',
    label: 'Wave',
    icon: '👋',
    seconds: 2.6,
    weight: (t) => envelope(t, 0, 0.5, 2.1, 2.6),
    pose(kit, t) {
      const wave = Math.sin(Math.max(0, t - 0.5) * Math.PI * 4.4) * 28
      kit.aim('RightArm', 'RightForeArm', sideways(1, 28, 0.2))
      kit.aim('RightForeArm', 'RightHand', sideways(1, 84 + wave, 0.3))
    },
  },
  {
    id: 'Yes',
    label: 'Yes',
    icon: '🙂',
    seconds: 1.8,
    weight: (t) => envelope(t, 0, 0.15, 1.6, 1.8),
    pose(kit, t) {
      const nod = (1 - Math.cos(progress(t, 0.15, 1.6) * Math.PI * 4)) / 2
      kit.turn('Neck', RIGHT, -10 * nod)
      kit.turn('Head', RIGHT, -22 * nod)
    },
  },
  {
    id: 'No',
    label: 'No',
    icon: '🙅',
    seconds: 1.8,
    weight: (t) => envelope(t, 0, 0.15, 1.6, 1.8),
    pose(kit, t) {
      const shake = Math.sin(progress(t, 0.15, 1.6) * Math.PI * 4) * 30
      kit.turn('Neck', UP, shake * 0.3)
      kit.turn('Head', UP, shake * 0.7)
    },
  },
  {
    id: 'Bow',
    label: 'Bow',
    icon: '🙇',
    seconds: 2.2,
    weight: (t) => envelope(t, 0, 0.7, 1.4, 2.2),
    pose(kit) {
      kit.turn('Spine', RIGHT, -14)
      kit.turn('Spine1', RIGHT, -16)
      kit.turn('Spine2', RIGHT, -14)
      kit.turn('Head', RIGHT, -12)
      // arms keep hanging straight down
      for (const { side, arm, fore, hand } of SIDES) {
        kit.aim(arm, fore, forwards(side, 0, 0.1))
        kit.aim(fore, hand, forwards(side, 8, 0.06))
      }
    },
  },
  {
    id: 'Punch',
    label: 'Punch',
    icon: '👊',
    seconds: 2.3,
    weight: (t) => envelope(t, 0, 0.3, 1.9, 2.3),
    pose(kit, t) {
      // guard up, then right, left, right jabs
      const jab = (start) => envelope(t, start, start + 0.12, start + 0.2, start + 0.4)
      const reach = { RightArm: Math.max(jab(0.45), jab(1.35)), LeftArm: jab(0.9) }
      kit.turn('Spine1', UP, (reach.RightArm - reach.LeftArm) * 14) // turn into each punch
      for (const { side, arm, fore, hand } of SIDES) {
        const k = reach[arm]
        kit.aim(arm, fore, forwards(side, lerp(30, 86, k), lerp(0.35, 0.05, k)))
        kit.aim(fore, hand, forwards(side, lerp(155, 90, k), lerp(-0.25, 0, k)))
      }
    },
  },
  {
    id: 'Jump',
    label: 'Jump',
    icon: '⤴️',
    seconds: 1.5,
    weight: (t) => envelope(t, 0, 0.3, 1.1, 1.5),
    body: (t) => ({ y: hop(t, 0.3, 0.95, 1.1) }),
    pose(kit) {
      // arms up in a V
      for (const { side, arm, fore, hand } of SIDES) {
        kit.aim(arm, fore, sideways(side, 58, 0.1))
        kit.aim(fore, hand, sideways(side, 68, 0.1))
      }
    },
  },
  {
    id: 'Spin',
    label: 'Spin',
    icon: '🔄',
    seconds: 1.5,
    weight: (t) => envelope(t, 0, 0.3, 1.2, 1.5),
    body: (t) => ({ spin: smooth(progress(t, 0.15, 1.3)) * TURN }),
    pose(kit) {
      // arms out to the sides
      for (const { side, arm, fore, hand } of SIDES) {
        kit.aim(arm, fore, sideways(side, -18))
        kit.aim(fore, hand, sideways(side, -12))
      }
    },
  },

  // ---------- tricks ----------
  {
    id: 'Backflip',
    label: 'Backflip',
    icon: '↩️',
    trick: true,
    seconds: 1.9,
    keys: flight(POSES.reachUp, POSES.tuck),
    grounded: onGround,
    body: (t) => ({ y: hop(t, 0.46, 1.26, 1.5), flip: rotation(t, 0.44, 1.22, 1) }),
  },
  {
    id: 'Frontflip',
    label: 'Frontflip',
    icon: '↪️',
    trick: true,
    seconds: 1.9,
    keys: flight(POSES.reachForward, POSES.tuck),
    grounded: onGround,
    body: (t) => ({ y: hop(t, 0.46, 1.26, 1.5), flip: -rotation(t, 0.44, 1.22, 1) }),
  },
  {
    id: 'WindmillSpin',
    label: 'Windmill Spin',
    icon: '🌪️',
    trick: true,
    seconds: 2.6,
    weight: (t) => envelope(t, 0, 0.3, 2.3, 2.6),
    body: (t) => ({ spin: rotation(t, 0.2, 2.4, 2) }),
    pose(kit, t) {
      // arms straight out, tipping up and down like the sails of a windmill
      const tip = Math.sin(t * Math.PI * 2.4) * 42
      kit.turn('Spine1', RIGHT, 6)
      kit.aim('RightArm', 'RightForeArm', sideways(1, tip))
      kit.aim('RightForeArm', 'RightHand', sideways(1, tip))
      kit.aim('LeftArm', 'LeftForeArm', sideways(-1, -tip))
      kit.aim('LeftForeArm', 'LeftHand', sideways(-1, -tip))
    },
  },
  {
    id: 'SpinJump',
    label: '360 Spin Jump',
    icon: '💫',
    trick: true,
    seconds: 1.7,
    keys: [
      [0, POSES.stand],
      [0.3, POSES.crouch],
      [0.44, POSES.hug],
      [1.08, POSES.hug],
      [1.26, POSES.absorb],
      [1.7, POSES.stand],
    ],
    grounded: (t) => t < 0.44 || t > 1.08,
    body: (t) => ({ y: hop(t, 0.42, 1.1, 1.4), spin: rotation(t, 0.4, 1.12, 1) }),
  },
]

const DANCE = { id: 'Dance', label: 'Dance', icon: '🕺' }
const MOVE_BY_ID = Object.fromEntries(MOVES.map((move) => [move.id, move]))
const GREETINGS = ['Wave', 'Yes', 'Bow']

// What the About panel offers, in order: everyday moves, then tricks.
export const EMOTES = [...MOVES.filter((move) => !move.trick), DANCE, ...MOVES.filter((move) => move.trick)].map(
  ({ id, label, icon, trick = false }) => ({ id, label, icon, trick }),
)
const ICON_BY_ID = Object.fromEntries(EMOTES.map((emote) => [emote.id, emote.icon]))

const _from = new THREE.Vector3()
const _to = new THREE.Vector3()
const _turn = new THREE.Quaternion()
const _parent = new THREE.Quaternion()
const _local = new THREE.Quaternion()

// Builds poses by turning his bones. Moves are described in his own frame, in plain
// terms ("point the forearm up"), whatever axes the bones themselves happen to use.
class PoseKit {
  constructor(avatar) {
    this.avatar = avatar
    this.bones = {}
    avatar.traverse((child) => {
      if (child.isBone) this.bones[child.name.replace('mixamorig_', '')] = child
    })
    this.rest = POSED.map((name) => this.bones[name].quaternion.clone())
    this.hips = this.bones.Hips
    this.hipsRest = this.hips.position.clone()
    // which way each foot points at rest, so bent legs can keep the feet flat
    this.footRest = LEGS.map(({ foot, toe }) =>
      this.bones[toe].getWorldPosition(new THREE.Vector3()).sub(this.bones[foot].getWorldPosition(_from)).normalize(),
    )
    this.groundRest = this.lowestFoot()
  }

  restore() {
    this.apply(this.rest)
  }

  snapshot() {
    return POSED.map((name) => this.bones[name].quaternion.clone())
  }

  // Sets every POSED bone from a snapshot, with his hips back at their rest height.
  apply(pose) {
    POSED.forEach((name, i) => this.bones[name].quaternion.copy(pose[i]))
    this.hips.position.copy(this.hipsRest)
    this.avatar.updateMatrixWorld(true)
  }

  flatFeet() {
    LEGS.forEach(({ foot, toe }, i) => this.aim(foot, toe, this.footRest[i]))
  }

  lowestFoot() {
    return Math.min(...LEGS.flatMap(({ foot, toe }) => [foot, toe].map((name) => this.bones[name].getWorldPosition(_to).y)))
  }

  // Bent knees lift his feet off the ground; lower his hips until the feet touch it again.
  plant() {
    const drop = this.lowestFoot() - this.groundRest
    if (Math.abs(drop) < 1e-6) return
    this.hips.getWorldPosition(_from)
    _from.y -= drop
    this.hips.position.copy(this.hips.parent.worldToLocal(_from))
    this.avatar.updateMatrixWorld(true)
  }

  // Rotates a bone about one of his axes, carrying its children with it.
  turn(name, axis, degrees) {
    this.rotate(this.bones[name], _turn.setFromAxisAngle(axis, rad(degrees)))
  }

  // Points the segment from a bone to `child` along `direction`.
  aim(name, child, direction) {
    const bone = this.bones[name]
    bone.getWorldPosition(_from)
    this.bones[child].getWorldPosition(_to)
    this.rotate(bone, _turn.setFromUnitVectors(_to.sub(_from).normalize(), direction))
  }

  rotate(bone, turn) {
    bone.parent.getWorldQuaternion(_parent)
    // new local rotation = parent⁻¹ · turn · parent · local
    _local.copy(_parent).invert().multiply(turn).multiply(_parent)
    bone.quaternion.premultiply(_local)
    bone.updateMatrixWorld(true)
  }
}

// The pose at time t of a move made of key poses: the two keys either side, blended.
function blendKeys(keys, t) {
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1].at) i++
  const from = keys[i]
  const to = keys[i + 1]
  const u = smooth(progress(t, from.at, to.at))
  return from.pose.map((q, b) => q.clone().slerp(to.pose[b], u))
}

// Samples a move into an animation clip that sets every POSED bone, and his hips'
// height, on every frame.
function bake(kit, move) {
  const frames = Math.max(2, Math.round(move.seconds * FPS))
  const times = []
  const values = POSED.map(() => [])
  const hips = []
  const keys = move.keys?.map(([at, pose]) => {
    stand(kit)
    pose(kit)
    return { at, pose: kit.snapshot() }
  })

  for (let i = 0; i <= frames; i++) {
    const t = (i / frames) * move.seconds
    let pose
    if (move.loop) {
      move.pose(kit, t)
      pose = kit.snapshot()
    } else if (keys) {
      pose = blendKeys(keys, t)
    } else {
      stand(kit)
      const base = kit.snapshot()
      move.pose(kit, t)
      const k = move.weight(t)
      pose = kit.snapshot().map((q, b) => base[b].slerp(q, k))
    }
    kit.apply(pose)
    if (move.grounded?.(t)) kit.plant()
    times.push(t)
    pose.forEach((q, b) => values[b].push(q.x, q.y, q.z, q.w))
    hips.push(...kit.hips.position.toArray())
  }

  kit.restore()
  // the Collada loader names its tracks after the bones' uuids, so these do too
  const tracks = POSED.map((name, b) => new THREE.QuaternionKeyframeTrack(`${kit.bones[name].uuid}.quaternion`, times, values[b]))
  tracks.push(new THREE.VectorKeyframeTrack(`${kit.hips.uuid}.position`, times, hips))
  return new THREE.AnimationClip(move.id, move.seconds, tracks)
}

export class Stormtrooper {
  constructor({ scene, x, z, baseY }) {
    this.scene = scene
    this.position = new THREE.Vector3(x, baseY, z)
    this.ready = false
    this.mode = null // 'Dance', 'Idle' or the emote being played
    this.queued = null // the emote to play once the current trick ends
    this.lift = 0
    this.yaw = FACE_CAMERA
    this.awayTimer = 0
    this.greetTimer = GREET_SECONDS
    this.onAction = null
  }

  async load() {
    const { ColladaLoader } = await import('three/addons/loaders/ColladaLoader.js')
    const avatar = (await new ColladaLoader().loadAsync(MODEL_URL)).scene
    avatar.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    // bake his moves while he still stands in his own frame, unscaled
    avatar.updateMatrixWorld(true)
    const kit = new PoseKit(avatar)
    const clips = [{ id: 'Idle', seconds: IDLE_SECONDS, loop: true, pose: stand }, ...MOVES].map((move) => bake(kit, move))

    this.mixer = new THREE.AnimationMixer(avatar)
    this.actions = { Dance: this.mixer.clipAction(avatar.animations[0]) }
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip)
      if (clip.name !== 'Idle') {
        action.loop = THREE.LoopOnce
        action.clampWhenFinished = true
      }
      this.actions[clip.name] = action
    }
    this.mixer.addEventListener('finished', (event) => {
      if (event.action !== this.active) return
      const next = this.queued ?? 'Idle'
      this.queued = null
      this.setMode(next)
    })

    // He starts out dancing. Measure him as he's drawn in that pose, then scale him to a
    // fixed height and stand him in the middle of the plinth. updateMatrixWorld (not
    // updateWorldMatrix) has to come first: only it refreshes a skinned mesh's bind
    // inverse, and without that the measurement comes out rotated and the wrong size.
    this.active = this.actions.Dance
    this.active.play()
    this.mode = 'Dance'
    this.mixer.update(0)
    avatar.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(avatar, true)
    const center = bounds.getCenter(new THREE.Vector3())
    const scale = HEIGHT / (bounds.max.y - bounds.min.y)
    avatar.scale.multiplyScalar(scale)
    avatar.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale)

    // mover carries him through jumps, spins and flips, turning about his hips
    const body = new THREE.Group()
    body.position.y = -PIVOT
    body.add(avatar)
    this.mover = new THREE.Group()
    this.mover.add(body)
    this.placeBody(null, 0)
    this.holder = new THREE.Group()
    this.holder.position.copy(this.position)
    this.holder.rotation.y = this.yaw
    this.holder.add(this.mover)

    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
    this.bubble.visible = false
    this.bubbleTextures = {}
    this.holder.add(this.bubble)

    this.scene.add(this.holder)
    this.ready = true
  }

  // Plays an emote from EMOTES. Dance switches dancing on and off.
  play(id) {
    if (!this.ready || !ICON_BY_ID[id]) return
    this.request(id === 'Dance' && this.mode === 'Dance' ? 'Idle' : id)
  }

  greet() {
    if (this.ready) this.request('Wave')
  }

  hearHorn(position) {
    if (this.ready && this.distanceTo(position) < 30) this.request('Jump')
  }

  // A move that carries his whole body (a jump, spin or flip) always finishes, so he
  // never snaps from mid-air back onto the plinth; anything asked for meanwhile waits.
  request(id) {
    if (MOVE_BY_ID[this.mode]?.body) this.queued = id
    else this.setMode(id)
  }

  // Places his whole body for move `id` at time t (standing still when it has no `body`).
  placeBody(id, t) {
    const { y = 0, flip = 0, spin = 0 } = MOVE_BY_ID[id]?.body?.(t) ?? {}
    this.mover.position.set(0, PIVOT + y, 0)
    this.mover.rotation.set(flip, spin, 0)
    this.lift = y
  }

  distanceTo(point) {
    return Math.hypot(point.x - this.position.x, point.z - this.position.z)
  }

  setMode(id) {
    this.fadeTo(this.actions[id], id === 'Dance' || this.mode === 'Dance' ? 0.45 : 0.25)
    this.mode = id
    this.awayTimer = 0
    this.greetTimer = GREET_SECONDS
    if (id !== 'Idle') this.showBubble(ICON_BY_ID[id], MOVE_BY_ID[id]?.seconds ?? 2)
    this.onAction?.(id === 'Idle' ? null : id)
  }

  // Cross-fade from whatever is playing to `next`, as in the three.js examples.
  fadeTo(next, seconds) {
    const previous = this.active
    this.active = next
    if (previous !== next) previous.fadeOut(seconds)
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(seconds).play()
  }

  showBubble(icon, seconds) {
    this.bubbleTextures[icon] ??= createEmoteBubbleTexture(icon, BUBBLE_COLOR)
    this.bubble.material.map = this.bubbleTextures[icon]
    this.bubble.material.needsUpdate = true
    this.bubble.visible = true
    this.bubbleAge = 0
    this.bubbleLife = seconds
  }

  update(dt, car) {
    if (!this.ready) return
    const distance = this.distanceTo(car.position)
    if (distance > 90) return // too far away to see

    this.mixer.update(dt)

    if (this.mode === 'Idle') {
      // he dances again once you've driven off, and says hello now and then while you're near
      this.awayTimer = distance > 35 ? this.awayTimer + dt : 0
      if (distance < 30) this.greetTimer -= dt
      if (this.awayTimer > 4) this.setMode('Dance')
      else if (this.greetTimer <= 0) this.setMode(GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
    }

    this.placeBody(this.mode, this.active.time)

    // look at the car, but never turn far enough to show the camera his back
    let target = FACE_CAMERA
    if (this.mode !== 'Dance' && distance < 40) {
      const toCar = headingToward(car.position.x - this.position.x, car.position.z - this.position.z)
      target += clamp(wrapAngle(toCar - FACE_CAMERA), -MAX_TURN, MAX_TURN)
    }
    this.yaw = damp(this.yaw, target, 4, dt)
    this.holder.rotation.y = this.yaw

    if (this.bubble.visible) {
      this.bubbleAge += dt
      this.bubble.scale.setScalar(2.1 * easeOutBack(Math.min(1, this.bubbleAge * 5)))
      this.bubble.material.opacity = 1 - progress(this.bubbleAge, this.bubbleLife - 0.25, this.bubbleLife)
      this.bubble.position.y = HEIGHT + 1.4 + Math.max(0, this.lift)
      if (this.bubbleAge >= this.bubbleLife) this.bubble.visible = false
    }
  }
}
