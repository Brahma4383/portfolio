import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { clamp, damp, headingToward, lerp } from '../utils/math.js'

// The animated character in the classic page's header: the Soldier model from
// the three.js "skeletal animation blending" example, with its idle, walk and
// run animations cross-faded into each other.
// On top of those he answers API requests sent from the little console under him
// (each one acted out, status code and all), follows the mouse with his head, and
// has something to say when you poke him.
// This module is only downloaded the first time the classic page opens.

const MODEL_URL = 'models/Soldier.glb'

// Clip indices inside Soldier.glb (0 Idle, 1 Run, 2 TPose, 3 Walk), as in the three.js example.
const CLIPS = { idle: 0, walk: 3, run: 1 }

// Cross-fade lengths in seconds, from → to.
const FADE = {
  'idle>walk': 0.5,
  'walk>idle': 1,
  'walk>run': 1.5,
  'run>walk': 2,
  'idle>run': 0.8,
  'run>idle': 1,
}

// In his file he faces -Z, with +X on his right (like the Stormtrooper on the island).
const RIGHT = new THREE.Vector3(1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const FRONT = new THREE.Vector3(0, 0, -1)

// The bones the requests turn. The file's bones are called "mixamorig:Head" and so on.
const POSED = [
  'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'RightArm', 'RightForeArm', 'LeftArm', 'LeftForeArm',
  'RightUpLeg', 'RightLeg', 'LeftUpLeg', 'LeftLeg',
]
// How each posed bone follows the poses layered on top of the animation:
// [frequency in Hz, damping]. His spine and legs carry him, so they're stiff and
// don't overshoot (his feet stay put); his arms and head are looser, so they swing
// into a pose a moment after his body, overshoot a little and settle, and his
// forearms trail his upper arms.
const SPRINGS = {
  Spine: [5, 0.9],
  Spine1: [5, 0.85],
  Spine2: [4.5, 0.8],
  Neck: [4, 0.75],
  Head: [3.5, 0.7],
  RightArm: [3.8, 0.65],
  LeftArm: [3.8, 0.65],
  RightForeArm: [3.2, 0.6],
  LeftForeArm: [3.2, 0.6],
  RightUpLeg: [7, 1],
  RightLeg: [7, 1],
  LeftUpLeg: [7, 1],
  LeftLeg: [7, 1],
}
const SPRING_STEP = 1 / 120 // seconds; springs are stepped at least this finely
const SIDES = [
  { side: 1, arm: 'RightArm', fore: 'RightForeArm', hand: 'RightHand' },
  { side: -1, arm: 'LeftArm', fore: 'LeftForeArm', hand: 'LeftHand' },
]
const LEGS = [
  { side: 1, thigh: 'RightUpLeg', knee: 'RightLeg', foot: 'RightFoot' },
  { side: -1, thigh: 'LeftUpLeg', knee: 'LeftLeg', foot: 'LeftFoot' },
]

const rad = THREE.MathUtils.degToRad
const TURN = Math.PI * 2
const smooth = (t) => t * t * (3 - 2 * t)
const progress = (t, start, end) => clamp((t - start) / (end - start), 0, 1)
// rises from 0 to 1 between a and b, holds, then falls back to 0 between c and d
const envelope = (t, a, b, c, d) => smooth(progress(t, a, b)) * (1 - smooth(progress(t, c, d)))

// Directions in his own frame; `side` is 1 for his right arm and -1 for his left.
// sideways: out to his side, `angle` degrees above horizontal (-90 hangs straight down),
// leaning `front` towards his front.
const sideways = (side, angle, front = 0) =>
  new THREE.Vector3(side * Math.cos(rad(angle)), Math.sin(rad(angle)), -front).normalize()
// forwards: swung `angle` degrees forwards (0 hangs down, 90 points ahead, 180 points up),
// held `out` away from his body.
const forwards = (side, angle, out = 0) =>
  new THREE.Vector3(side * out, -Math.cos(rad(angle)), -Math.sin(rad(angle))).normalize()

// The camera looks at LOOK_AT, which puts him a little above the middle of the
// canvas: room over his head for the speech bubble, and under his feet for the response.
const LOOK_AT = new THREE.Vector3(0, 0.76, 0)

// He turns his head up to MAX_LOOK towards the mouse (or towards you, when it's elsewhere).
const MAX_LOOK = rad(50)

// Push-ups: he turns side-on to you, drops forward about his toes (kicking his feet
// back, so he lies across the middle of the picture) until he's leaning PLANK
// degrees, and each push-up lowers him to LOW.
const PLANK = -66
const LOW = -78
const sideOn = (t) => smooth(progress(t, 0, 0.5)) * (1 - smooth(progress(t, 5.3, 5.9)))
const pushupDrop = (t) => progress(t, 0.6, 1.2) ** 2 * (1 - smooth(progress(t, 4.6, 5.3)))
const pushupDepth = (t) => (t > 1.4 && t < 4.4 ? (1 - Math.cos((t - 1.4) * TURN)) / 2 : 0)
const pushupPitch = (t) => rad(PLANK * pushupDrop(t) + (LOW - PLANK) * pushupDepth(t))

// Marching: he turns side-on to you (from the front you can't see his knees come up),
// marches on the spot from MARCH_FROM to MARCH_TO seconds (six steps, one knee up
// every STEP seconds), halts, and turns back.
const STEP = 0.45
const MARCH_FROM = 0.6
const MARCH_TO = MARCH_FROM + 6 * STEP
const marchSideOn = (t) => envelope(t, 0, 0.5, 3.4, 3.9)
const kneeLift = (t, side) => {
  const swing = Math.sin(((t - MARCH_FROM) / STEP) * Math.PI) * envelope(t, MARCH_FROM - 0.1, MARCH_FROM + 0.1, MARCH_TO - 0.2, MARCH_TO)
  return Math.max(0, side * swing)
}

// DELETE /bug: a ladybird scuttles in from BUG_FROM (off to his right, at his feet)
// to where his right foot comes down (see load()). He lifts his knee up and out to
// the side, sumo-style (a knee raised forwards points at you, so you can't see it),
// stomps on it at BUG_STOMP seconds, then steps back so you can see what's left of it.
const BUG_FROM = new THREE.Vector3(1.3, 0, 0.3)
const BUG_STOMP = 1.3
// His right leg: where it starts and ends up, knee up, and the stomp itself (leg
// straight, out to his side no more than ~14° so the foot still reaches the floor).
const LEG_DOWN = { thigh: forwards(1, 0, 0.06), shin: forwards(1, 0, 0.06) }
const KNEE_UP = { thigh: new THREE.Vector3(0.7, -0.05, -0.7).normalize(), shin: new THREE.Vector3(0.2, -1, -0.05).normalize() }
const STOMP = { thigh: new THREE.Vector3(0.22, -0.97, -0.08).normalize(), shin: new THREE.Vector3(0.22, -0.97, -0.08).normalize() }
// which two leg poses he's between at time t, and how far from the first to the second
const stompLeg = (t) => {
  if (t < BUG_STOMP - 0.12) return [LEG_DOWN, KNEE_UP, smooth(progress(t, 0.75, 1.1))]
  if (t < BUG_STOMP) return [KNEE_UP, STOMP, progress(t, BUG_STOMP - 0.12, BUG_STOMP) ** 2]
  return [STOMP, LEG_DOWN, smooth(progress(t, 1.8, 2.3))]
}

// Each request he answers: its HTTP `status`, what he `says` and when (seconds
// from the start), and how he acts it out. `weight` blends the pose in and out;
// `body` moves his whole body (y up, spin round on the spot, pitch forwards about
// his toes, shift backwards); `look: false` stops him following the mouse, and
// `target` makes him watch something else instead.
const ACTIONS = {
  salute: {
    status: '200 OK',
    seconds: 2.6,
    says: [[0, '200 OK 🫡']],
    weight: (t) => envelope(t, 0, 0.35, 2.1, 2.6),
    pose(kit, t) {
      // chest out, elbow out at shoulder height, fingertips to his brow; left arm at
      // his side; a little nod before he lets it go
      kit.turn('Spine2', RIGHT, 5)
      kit.turn('Head', RIGHT, -10 * envelope(t, 1.5, 1.7, 1.8, 2.05))
      kit.aim('RightArm', 'RightForeArm', sideways(1, 5, 0.45))
      kit.aim('RightForeArm', 'RightHand', new THREE.Vector3(-0.8, 0.55, -0.1).normalize())
      kit.aim('LeftArm', 'LeftForeArm', forwards(-1, 0, 0.12))
      kit.aim('LeftForeArm', 'LeftHand', forwards(-1, 4, 0.1))
    },
  },
  pushups: {
    status: '201 Created',
    seconds: 6,
    says: [[0, '201 Created 💪'], [1.9, '1…'], [2.9, '2…'], [3.9, '3!']],
    weight: (t) => envelope(t, 0.5, 1, 4.8, 5.4),
    body: (t) => ({ spin: (TURN / 4) * sideOn(t), shift: 0.8 * pushupDrop(t), pitch: pushupPitch(t) }),
    pose(kit, t) {
      // arms reach for the floor (and bend, elbows out, as he goes down); legs stay straight.
      // Directions are made level with the floor, then tipped into his leaning frame.
      const depth = pushupDepth(t)
      const tip = -pushupPitch(t)
      for (const { side, arm, fore, hand } of SIDES) {
        kit.aim(arm, fore, new THREE.Vector3(side * (0.12 + 0.6 * depth), -1, 0.35 * depth).normalize().applyAxisAngle(RIGHT, tip))
        kit.aim(fore, hand, new THREE.Vector3(side * 0.05, -1, -0.15).normalize().applyAxisAngle(RIGHT, tip))
      }
      for (const { side, thigh, knee, foot } of LEGS) {
        kit.aim(thigh, knee, new THREE.Vector3(side * 0.05, -1, 0).normalize())
        kit.aim(knee, foot, new THREE.Vector3(side * 0.04, -1, 0.03).normalize())
      }
    },
  },
  march: {
    status: '202 Accepted',
    seconds: 4.1,
    says: [[0, '202 Accepted 🥾'], [1.5, 'Left, right, left!'], [2.8, 'Company… halt!']],
    // eyes on you as he marches
    target: (robot) => robot.camera.position,
    weight: (t) => envelope(t, 0, 0.4, 3.6, 4.1),
    body: (t) => ({ spin: (-TURN / 4) * marchSideOn(t) }),
    pose(kit, t) {
      // chest out, knees up to his hips, and each arm swinging forward with the opposite
      // knee, his shoulders turning with it
      const lift = { 1: kneeLift(t, 1), [-1]: kneeLift(t, -1) }
      kit.turn('Spine2', RIGHT, 4)
      kit.turn('Spine2', UP, -7 * (lift[1] - lift[-1]))
      for (const { side, thigh, knee, foot } of LEGS) {
        kit.aim(thigh, knee, forwards(side, 85 * lift[side], 0.06))
        kit.aim(knee, foot, forwards(side, 5 * lift[side], 0.06))
      }
      for (const { side, arm, fore, hand } of SIDES) {
        const swing = 45 * lift[-side] - 25 * lift[side]
        kit.aim(arm, fore, forwards(side, swing, 0.1))
        kit.aim(fore, hand, forwards(side, swing + 15, 0.1))
      }
    },
  },
  bug: {
    status: '204 No Content',
    seconds: 3.4,
    says: [[0, '🐞 Bug spotted…'], [BUG_STOMP, '204 No Content 💥']],
    target: (robot) => robot.bug.position,
    weight: (t) => envelope(t, 0.3, 0.7, 2.6, 3.2),
    pose(kit, t) {
      // right knee up and out to the side (so you can see it from the front), stomp,
      // then a little lift of the foot as he steps back
      const [from, to, u] = stompLeg(t)
      const step = t > BUG_STOMP ? Math.sin(u * Math.PI) : 0
      const thigh = new THREE.Vector3().lerpVectors(from.thigh, to.thigh, u).add(_lift.set(0, 0, -0.3 * step)).normalize()
      const shin = new THREE.Vector3().lerpVectors(from.shin, to.shin, u).add(_lift.set(0, 0, 0.5 * step)).normalize()
      kit.aim('RightUpLeg', 'RightLeg', thigh)
      kit.aim('RightLeg', 'RightFoot', shin)

      // leaning over it, fists up; the stomp jolts his arms out
      const jolt = envelope(t, BUG_STOMP - 0.04, BUG_STOMP, BUG_STOMP + 0.06, BUG_STOMP + 0.4)
      kit.turn('Spine1', RIGHT, -8 - 6 * jolt)
      for (const { side, arm, fore, hand } of SIDES) {
        kit.aim(arm, fore, sideways(side, -60 + 25 * jolt, 0.25))
        kit.aim(fore, hand, forwards(side, 70 - 20 * jolt, 0.3))
      }
    },
    update(robot, t) {
      const { bug, splash, stompAt } = robot
      bug.visible = t < 3
      const squashed = t >= BUG_STOMP
      if (squashed && !bug.userData.squashed && !REDUCED_MOTION.matches) {
        // the stomp lands with a thud that jolts the picture
        robot.canvas.animate([{ translate: '0 0' }, { translate: '0 5px' }, { translate: '0 -2px' }, { translate: '0 0' }], {
          duration: 240,
          easing: 'ease-out',
        })
      }
      bug.userData.squashed = squashed
      if (!squashed) {
        // scuttles in along a wiggly path, legs going, then waits right where his foot comes down
        const u = smooth(progress(t, 0, 0.9))
        const x = lerp(BUG_FROM.x, stompAt.x, u) + Math.sin(u * Math.PI * 3) * 0.1 * (1 - u)
        const z = lerp(BUG_FROM.z, stompAt.z, u)
        if (u < 1) bug.rotation.y = headingToward(x - bug.position.x, z - bug.position.z) + Math.sin(t * 40) * 0.2
        bug.position.set(x, 0, z)
        bug.scale.setScalar(1)
        bug.userData.legs.forEach((leg, i) => (leg.rotation.y = u < 1 ? Math.sin(t * 45 + i * 2) * 0.5 : 0))
      } else {
        // squashed flat, then gone
        const flat = smooth(progress(t, BUG_STOMP, BUG_STOMP + 0.06))
        const gone = 1 - smooth(progress(t, 2.6, 3))
        bug.scale.set(lerp(1, 1.4, flat) * gone, lerp(1, 0.12, flat) * gone, lerp(1, 1.4, flat) * gone)
      }
      // a ring of dust rushes out from under his foot
      const ring = progress(t, BUG_STOMP, BUG_STOMP + 0.45)
      splash.visible = ring > 0 && ring < 1
      splash.position.set(stompAt.x, 0.005, stompAt.z)
      splash.scale.setScalar(lerp(0.6, 2.4, Math.sqrt(ring)))
      splash.material.opacity = 0.5 * (1 - ring)
    },
  },
  teapot: {
    status: '418 I’m a teapot',
    seconds: 4,
    says: [[0, '418 I’m a teapot 🫖'], [1.5, 'Tip me over, pour me out ☕']],
    weight: (t) => envelope(t, 0, 0.5, 3.4, 4),
    pose(kit, t) {
      // here is my handle (left hand on hip), here is my spout (right arm, bent up)...
      const tip = envelope(t, 1.4, 2, 2.8, 3.3)
      kit.turn('Spine', FRONT, 10 * tip)
      kit.turn('Spine1', FRONT, 10 * tip)
      kit.turn('Spine2', FRONT, 8 * tip)
      kit.turn('Head', FRONT, 6 * tip)
      kit.aim('LeftArm', 'LeftForeArm', sideways(-1, -40, -0.1))
      kit.aim('LeftForeArm', 'LeftHand', new THREE.Vector3(0.75, -0.55, -0.1).normalize())
      kit.aim('RightArm', 'RightForeArm', sideways(1, -10, 0.3))
      kit.aim('RightForeArm', 'RightHand', sideways(1, 45, 0.3))
    },
  },
  deploy: {
    status: '500 Internal Server Error',
    seconds: 3.4,
    says: [[0, '500 Internal Server Error 🔥'], [1.4, 'Who deploys on a Friday? 🤦']],
    look: false,
    weight: (t) => envelope(t, 0, 0.5, 2.8, 3.4),
    pose(kit, t) {
      // facepalm: head drops into his right hand and shakes slowly
      const shake = Math.sin((t - 1) * 6) * 8 * envelope(t, 1, 1.3, 2.4, 2.8)
      kit.turn('Spine2', RIGHT, -6)
      kit.turn('Neck', RIGHT, -8)
      kit.turn('Head', RIGHT, -18)
      kit.turn('Head', UP, shake)
      kit.aim('RightArm', 'RightForeArm', forwards(1, 50, 0.25))
      kit.aim('RightForeArm', 'RightHand', new THREE.Vector3(-0.45, 0.85, 0.25).normalize())
    },
  },
  // Not a request you can send: what poking him too often too fast does to him.
  dizzy: {
    seconds: 3.2,
    look: false,
    weight: (t) => envelope(t, 0, 0.2, 2.7, 3.2),
    body: (t) => ({ spin: smooth(progress(t, 0, 1.4)) * TURN * 2 }),
    pose(kit, t) {
      // two quick turns with his arms flung out, then his head goes round in circles
      const reel = envelope(t, 1.1, 1.4, 2.6, 3.1)
      kit.turn('Spine1', FRONT, Math.sin(t * 7) * 6 * reel)
      kit.turn('Head', FRONT, Math.sin(t * 7) * 14 * reel)
      kit.turn('Head', UP, Math.cos(t * 7) * 12 * reel)
      for (const { side, arm, fore, hand } of SIDES) {
        kit.aim(arm, fore, sideways(side, -20, 0.1))
        kit.aim(fore, hand, sideways(side, -10, 0.1))
      }
    },
  },
}

// What he gets up to by himself when he's left standing about in Idle (see
// updateFidget()). Played like ACTIONS, but a request or a poke cuts them short.
const FIDGETS = {
  lookAround: {
    seconds: 4,
    look: false,
    weight: (t) => envelope(t, 0, 0.3, 3.6, 4),
    pose(kit, t) {
      // glances over his left shoulder, then his right, turning from the chest up
      const turn = 55 * smooth(progress(t, 0.3, 1)) - 110 * smooth(progress(t, 1.6, 2.4)) + 55 * smooth(progress(t, 3, 3.7))
      kit.turn('Spine1', UP, 0.12 * turn)
      kit.turn('Spine2', UP, 0.15 * turn)
      kit.turn('Neck', UP, 0.3 * turn)
      kit.turn('Head', UP, 0.43 * turn)
      kit.turn('Head', FRONT, -0.12 * turn)
    },
  },
  stretch: {
    seconds: 4.4,
    look: false,
    weight: (t) => envelope(t, 0, 0.8, 3.4, 4.4),
    pose(kit, t) {
      // arms up in a wide V, leaning back and looking up, then a bend to each side
      const bend = Math.sin(progress(t, 1.1, 3.1) * TURN) * 6
      kit.turn('Spine1', RIGHT, 5)
      kit.turn('Spine2', RIGHT, 6)
      kit.turn('Spine1', FRONT, bend)
      kit.turn('Spine2', FRONT, bend)
      kit.turn('Head', RIGHT, 14)
      for (const { side, arm, fore, hand } of SIDES) {
        kit.aim(arm, fore, sideways(side, 62, -0.05))
        kit.aim(fore, hand, sideways(side, 80, -0.05))
      }
    },
  },
  watch: {
    seconds: 3.4,
    look: false,
    says: [[0.9, 'Any requests? ⌚']],
    weight: (t) => envelope(t, 0, 0.6, 2.7, 3.4),
    pose(kit) {
      // lifts his left wrist in front of his chest, and turns to look down at his watch
      kit.aim('LeftArm', 'LeftForeArm', forwards(-1, 35, 0.45))
      kit.aim('LeftForeArm', 'LeftHand', new THREE.Vector3(0.8, 0.3, -0.5).normalize())
      kit.turn('Spine2', UP, 8)
      kit.turn('Neck', RIGHT, -12)
      kit.turn('Head', RIGHT, -18)
      kit.turn('Head', UP, 18)
    },
  },
  akimbo: {
    seconds: 4,
    weight: (t) => envelope(t, 0, 0.6, 3.3, 4),
    pose(kit, t) {
      // hands on his hips, shifting his weight from side to side, his head tilting the other way
      const sway = Math.sin(progress(t, 0.5, 3.5) * TURN)
      kit.turn('Spine', FRONT, 4 * sway)
      kit.turn('Head', FRONT, -9 * sway)
      for (const { side, arm, fore, hand } of SIDES) {
        kit.aim(arm, fore, sideways(side, -40, -0.1))
        kit.aim(fore, hand, new THREE.Vector3(-side * 0.75, -0.55, -0.1).normalize())
      }
    },
  },
}
// He first fidgets FIRST_FIDGET seconds after he's ready, then after every
// FIDGET_GAP seconds (somewhere between the two) of being left alone.
const FIRST_FIDGET = 4
const FIDGET_GAP = [6, 11]

// What he says when you poke him, one line per poke, round and round.
const POKE_LINES = [
  'Hey! 👋',
  'Hehe, that tickles 😆',
  'Are you testing me? 🧪',
  'Test passed: I’m awake ✅',
  'Found a bug? I’ll log it 🐞',
  'Works on my machine 🤷',
]
// Poke him RAPID_POKES times within RAPID_SECONDS and he gets dizzy instead.
const RAPID_POKES = 5
const RAPID_SECONDS = 3
const TOO_MANY = '429 Too Many Requests'
const FLINCH_SECONDS = 0.6
const BUBBLE_SECONDS = 2.2

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

const _from = new THREE.Vector3()
const _to = new THREE.Vector3()
const _ndc = new THREE.Vector2()
const _turn = new THREE.Quaternion()
const _scaled = new THREE.Quaternion()
const _parent = new THREE.Quaternion()
const _local = new THREE.Quaternion()
const _aim = new THREE.Quaternion()
const _lift = new THREE.Vector3()
const _offset = new THREE.Quaternion()
const _error = new THREE.Quaternion()
const _step = new THREE.Quaternion()
const _pull = new THREE.Vector3()
const _axis = new THREE.Vector3()

// A rotation that follows its target as if on a spring: it lags a little behind,
// overshoots a touch (with `damping` below 1) and settles. `hz` is how quickly.
class SpringRotation {
  constructor(hz, damping) {
    this.stiffness = (TURN * hz) ** 2
    this.damping = 2 * damping * TURN * hz
    this.value = new THREE.Quaternion()
    this.velocity = new THREE.Vector3() // radians per second, about each axis
  }

  update(target, dt) {
    const steps = Math.ceil(dt / SPRING_STEP)
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      // how far it has to go, as a rotation vector (axis × angle), the short way round
      _error.copy(this.value).invert().premultiply(target)
      if (_error.w < 0) _error.set(-_error.x, -_error.y, -_error.z, -_error.w)
      const sin = Math.hypot(_error.x, _error.y, _error.z)
      const angle = 2 * Math.atan2(sin, _error.w)
      _pull.set(_error.x, _error.y, _error.z).multiplyScalar(sin > 1e-6 ? angle / sin : 2)

      this.velocity.addScaledVector(_pull, this.stiffness * h).addScaledVector(this.velocity, -this.damping * h)
      const speed = this.velocity.length()
      if (speed > 1e-6) this.value.premultiply(_step.setFromAxisAngle(_axis.copy(this.velocity).divideScalar(speed), speed * h))
    }
    return this.value.normalize()
  }
}

// Turns his bones on top of whatever pose the mixer has given them. Moves are
// described in his own frame, in plain terms ("point the forearm up"), whatever
// axes the bones themselves happen to use. `weight` scales every turn, so a move
// can be blended in and out.
class PoseKit {
  constructor(model, mover) {
    this.mover = mover
    this.bones = {}
    // not just the skeleton's bones: the tips (like HeadTop_End) are plain nodes
    model.traverse((child) => {
      if (child.name.startsWith('mixamorig')) this.bones[child.name.replace('mixamorig', '')] = child
    })
    this.posed = POSED.map((name) => this.bones[name])
    this.saved = this.posed.map((bone) => bone.quaternion.clone())
    this.springs = POSED.map((name) => new SpringRotation(...SPRINGS[name]))
    this.frame = new THREE.Quaternion() // turns world directions into his own frame
    this.weight = 1
  }

  // Call once every move has been turned for this frame. What the moves added on top
  // of the mixer's pose goes through each bone's spring (see SPRINGS), so he flows
  // from one pose into the next; idle, walk and run themselves play as animated.
  settle(dt) {
    this.posed.forEach((bone, i) => {
      _offset.copy(this.saved[i]).invert().premultiply(bone.quaternion)
      bone.quaternion.copy(this.springs[i].update(_offset, dt)).multiply(this.saved[i])
    })
  }

  // The mixer only writes a bone when its animated value changes, so before each
  // update, put back what it last wrote; afterwards, remember what it wrote this time.
  restore() {
    this.posed.forEach((bone, i) => bone.quaternion.copy(this.saved[i]))
  }

  save() {
    this.posed.forEach((bone, i) => this.saved[i].copy(bone.quaternion))
  }

  // Call once his body has been moved for this frame, before turning any bones.
  begin() {
    this.mover.updateMatrixWorld()
    this.mover.getWorldQuaternion(this.frame).invert()
  }

  // Rotates a bone about one of his axes, carrying its children with it.
  turn(name, axis, degrees, amount = 1) {
    this.rotate(this.bones[name], _turn.setFromAxisAngle(axis, rad(degrees)), amount)
  }

  // Points the segment from a bone to `child` along `direction`.
  aim(name, child, direction, amount = 1) {
    this.bones[name].getWorldPosition(_from)
    this.bones[child].getWorldPosition(_to)
    const current = _to.sub(_from).applyQuaternion(this.frame).normalize()
    this.rotate(this.bones[name], _turn.setFromUnitVectors(current, direction), amount)
  }

  rotate(bone, turn, amount = 1) {
    _scaled.identity().slerp(turn, this.weight * amount)
    bone.parent.getWorldQuaternion(_parent).premultiply(this.frame)
    // new local rotation = parent⁻¹ · turn · parent · local
    _local.copy(_parent).invert().multiply(_scaled).multiply(_parent)
    bone.quaternion.premultiply(_local)
  }
}

// The ladybird DELETE /bug sends scuttling in for him to stomp on. It faces -Z, and
// stands on six legs (in userData.legs) that the action scurries while it runs.
function createBug() {
  const bug = new THREE.Group()
  const body = new THREE.Group()
  body.scale.setScalar(1.6) // built small, then made big enough to see next to his boot
  bug.add(body)
  const red = new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.4 })
  const black = new THREE.MeshStandardMaterial({ color: '#2b2d42', roughness: 0.6 })
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 12, 0, TURN, 0, Math.PI / 2), red)
  shell.scale.y = 0.75
  shell.position.y = 0.012
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 10), black)
  head.position.set(0, 0.032, -0.09)
  body.add(shell, head)
  for (const [x, z] of [[0.04, -0.03], [-0.04, -0.03], [0.035, 0.035], [-0.035, 0.035]]) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), black)
    spot.position.set(x, 0.067, z)
    body.add(spot)
  }
  for (const side of [1, -1]) {
    const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.06), black)
    antenna.position.set(side * 0.018, 0.06, -0.135)
    antenna.rotation.set(0.6, side * 0.35, 0)
    body.add(antenna)
  }
  // each leg slopes down and out from under the shell, and swings about where it joins
  bug.userData.legs = []
  for (const z of [-0.045, 0, 0.045]) {
    for (const side of [1, -1]) {
      const geometry = new THREE.BoxGeometry(0.075, 0.01, 0.01).translate(0.0375, 0, 0).rotateZ(side > 0 ? -0.55 : Math.PI + 0.55)
      const leg = new THREE.Mesh(geometry, black)
      leg.position.set(side * 0.055, 0.04, z)
      body.add(leg)
      bug.userData.legs.push(leg)
    }
  }
  bug.traverse((part) => (part.castShadow = true))
  bug.visible = false
  return bug
}

// The ring of dust that rushes out from under his foot when he stomps on the bug.
function createSplash() {
  const splash = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.22, 40),
    new THREE.MeshBasicMaterial({ color: '#2b2d42', transparent: true, opacity: 0, depthWrite: false }),
  )
  splash.rotation.x = -Math.PI / 2
  splash.visible = false
  return splash
}

export class HeroRobot {
  constructor(figure) {
    this.figure = figure
    this.canvas = figure.querySelector('canvas')
    this.bubble = figure.querySelector('.robot__bubble')
    this.response = figure.querySelector('.robot__response')
    this.buttons = [...figure.querySelectorAll('[data-move]')]
    this.actionButtons = [...figure.querySelectorAll('[data-action]')]
    this.active = false
    this.onScreen = true
    this.current = 'idle'
    this.queued = null
    this.action = null // { id, move, time, said } of the request being acted out
    this.queuedAction = null // the request to act out once the current one ends
    this.fidget = null // { id, move, time, said } of what he's doing by himself, if anything
    this.lastFidget = null
    this.restless = FIRST_FIDGET // seconds left until he fidgets
    this.pokes = 0
    this.pokeTimes = []
    this.line = 0
    this.flinch = FLINCH_SECONDS
    this.bubbleLeft = 0
    this.pointer = null // where the mouse is on the page, in client pixels
    this.look = new THREE.Quaternion()
    this.lookWeight = 1
    this.raycaster = new THREE.Raycaster()

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
    this.camera.position.set(1.43, 1.84, -4.29)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 3)
    hemi.position.set(0, 20, 0)
    const sun = new THREE.DirectionalLight(0xffffff, 3)
    sun.position.set(-3, 10, -10)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 1, far: 25 })
    this.scene.add(hemi, sun)

    // invisible floor that only shows the shadow, so he stands on the page itself
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.ShadowMaterial({ opacity: 0.18 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    // mover carries him through spins and push-ups (turned round first, then tipped forward)
    this.mover = new THREE.Group()
    this.mover.rotation.order = 'YXZ'
    this.bug = createBug()
    this.splash = createSplash()
    this.scene.add(this.mover, this.bug, this.splash)

    // Drag to turn him around (mouse only, so touch screens can still scroll the page).
    if (!window.matchMedia('(pointer: coarse)').matches) {
      this.controls = new OrbitControls(this.camera, this.canvas)
      this.controls.target.copy(LOOK_AT)
      this.controls.enableZoom = false
      this.controls.enablePan = false
      this.controls.enableDamping = true
      this.controls.minPolarAngle = this.controls.maxPolarAngle = Math.PI / 2.35
    }
    this.camera.lookAt(LOOK_AT)

    this.timer = new THREE.Timer()
    this.timer.connect(document)

    for (const button of this.buttons) {
      button.addEventListener('click', () => this.play(button.dataset.move))
    }
    for (const button of this.actionButtons) {
      button.addEventListener('click', () => this.act(button.dataset.action))
    }
    this.bindPointer()
    new ResizeObserver(() => this.resize()).observe(this.canvas)
    new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting
      this.updateLoop()
    }).observe(this.canvas)

    this.resize()
    this.load()
  }

  bindPointer() {
    // A click on him (not the end of a drag) pokes him.
    let down = null
    this.canvas.addEventListener('pointerdown', (event) => (down = { x: event.clientX, y: event.clientY }))
    this.canvas.addEventListener('click', (event) => {
      const dragged = down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6
      if (!dragged && this.hits(event)) this.poke()
    })
    this.canvas.addEventListener('pointermove', (event) => this.figure.toggleAttribute('data-hover', this.hits(event)))
    this.canvas.addEventListener('pointerleave', () => this.figure.removeAttribute('data-hover'))

    // His head follows the mouse anywhere on the page.
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') this.pointer = { x: event.clientX, y: event.clientY }
    })
    document.documentElement.addEventListener('pointerleave', () => (this.pointer = null))
  }

  async load() {
    this.figure.dataset.state = 'loading'
    try {
      const gltf = await new GLTFLoader().loadAsync(MODEL_URL)
      const model = gltf.scene
      model.traverse((object) => {
        if (object.isMesh) object.castShadow = true
      })
      this.mover.add(model)

      this.mixer = new THREE.AnimationMixer(model)
      this.actions = Object.fromEntries(
        Object.entries(CLIPS).map(([name, index]) => [name, this.mixer.clipAction(gltf.animations[index])]),
      )
      // All three play all the time; their weights decide what you see.
      for (const [name, action] of Object.entries(this.actions)) {
        this.setWeight(action, name === 'idle' ? 1 : 0)
        action.play()
      }
      // wait for the current walk/run loop to end before switching, so the feet line up
      this.mixer.addEventListener('loop', (event) => {
        if (this.queued && event.action === this.actions[this.current]) this.crossFade(this.queued)
      })
      this.mixer.update(0)
      this.kit = new PoseKit(model, this.mover)

      // an invisible box around him, standing still, to tell when the mouse is on him
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model, true)
      const size = bounds.getSize(new THREE.Vector3())
      this.hitBox = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial())
      bounds.getCenter(this.hitBox.position)
      this.hitBox.visible = false
      this.mover.add(this.hitBox)

      // push-ups tip him forward about the tips of his toes
      const toes = ['LeftToe_End', 'RightToe_End'].map((name) => this.kit.bones[name].getWorldPosition(new THREE.Vector3()))
      this.toes = toes[0].add(toes[1]).multiplyScalar(0.5).setY(0)
      // the bug waits where the ball of his right foot comes down: strike the stomp
      // pose for a moment to find out where that is, then put him back
      this.kit.begin()
      this.kit.aim('RightUpLeg', 'RightLeg', STOMP.thigh)
      this.kit.aim('RightLeg', 'RightFoot', STOMP.shin)
      this.stompAt = this.kit.bones.RightToeBase.getWorldPosition(new THREE.Vector3()).setY(0)
      this.kit.restore()

      this.buttons.forEach((button) => (button.disabled = false))
      this.actionButtons.forEach((button) => (button.disabled = false))
      this.figure.dataset.move = 'idle'
      this.figure.dataset.action = ''
      this.figure.dataset.fidget = ''
      this.figure.dataset.pokes = '0'
      this.figure.dataset.state = 'ready'
      this.render()
    } catch (error) {
      console.warn('Could not load the 3D character', error)
      this.figure.dataset.state = 'error'
    }
  }

  // Switch to 'idle', 'walk' or 'run'.
  play(name) {
    if (!this.actions?.[name]) return
    this.buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.move === name)))
    this.rest()

    if (name === this.current) {
      this.queued = null
      return
    }
    // From idle, switch straight away; from walk or run, wait for the end of the current step.
    if (this.current === 'idle') this.crossFade(name)
    else this.queued = name
  }

  crossFade(name) {
    const from = this.actions[this.current]
    const to = this.actions[name]
    this.setWeight(to, 1)
    to.time = 0
    from.crossFadeTo(to, FADE[`${this.current}>${name}`] ?? 1, true)
    this.current = name
    this.queued = null
    this.figure.dataset.move = name
  }

  // crossFadeTo() disables the action it fades from, so re-enable before reusing it.
  setWeight(action, weight) {
    action.enabled = true
    action.setEffectiveTimeScale(1)
    action.setEffectiveWeight(weight)
  }

  // Acts out one of ACTIONS on top of idle, walk or run. Asked for while another
  // is playing, it waits for that one to finish.
  act(id) {
    const move = ACTIONS[id]
    if (!move || !this.kit) return
    if (this.action) {
      if (this.action.id !== id) this.queuedAction = id
      return
    }
    this.action = { id, move, time: 0, said: 0 }
    this.figure.dataset.action = id
    this.actionButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.action === id)))
    if (move.status) this.respond(move.status)
  }

  endAction() {
    const next = this.queuedAction
    this.action = null
    this.queuedAction = null
    this.figure.dataset.action = ''
    this.actionButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'))
    this.rest()
    if (next) this.act(next)
  }

  // Left standing about in Idle, every so often he does one of FIDGETS by himself.
  // A request or a poke cuts it short (the springs ease him out of it), and so does
  // walking or running; then he waits a while again.
  updateFidget(dt) {
    if (this.action || this.current !== 'idle' || REDUCED_MOTION.matches) {
      this.fidget = null
    } else if (this.fidget) {
      if ((this.fidget.time += dt) >= this.fidget.move.seconds) {
        this.fidget = null
        this.rest()
      }
    } else if ((this.restless -= dt) <= 0) {
      const ids = Object.keys(FIDGETS).filter((id) => id !== this.lastFidget)
      const id = ids[Math.floor(Math.random() * ids.length)]
      this.lastFidget = id
      this.fidget = { id, move: FIDGETS[id], time: 0, said: 0 }
    }
    const id = this.fidget?.id ?? ''
    if (this.figure.dataset.fidget !== id) this.figure.dataset.fidget = id
  }

  rest() {
    this.restless = lerp(FIDGET_GAP[0], FIDGET_GAP[1], Math.random())
  }

  // Shows the response under his feet, coloured by its class (2xx, 4xx, 5xx).
  respond(status) {
    const ms = 18 + Math.floor(Math.random() * 60)
    const code = document.createElement('b')
    const time = document.createElement('small')
    code.textContent = status
    time.textContent = `· ${ms} ms`
    this.response.replaceChildren(code, ' ', time)
    this.response.dataset.tone = status[0] === '2' ? 'ok' : status[0] === '4' ? 'warn' : 'error'
    if (!REDUCED_MOTION.matches) {
      this.response.animate([{ scale: 0.85, opacity: 0.4 }, { scale: 1, opacity: 1 }], {
        duration: 220,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      })
    }
  }

  poke() {
    this.pokes += 1
    this.figure.dataset.pokes = String(this.pokes)
    this.flinch = 0
    this.fidget = null
    this.rest()

    const now = performance.now() / 1000
    this.pokeTimes = this.pokeTimes.filter((time) => now - time < RAPID_SECONDS)
    this.pokeTimes.push(now)
    if (this.pokeTimes.length >= RAPID_POKES) {
      this.pokeTimes = []
      this.respond(TOO_MANY)
      this.say(`${TOO_MANY} 😵‍💫`, 3)
      this.act('dizzy')
    } else {
      this.say(POKE_LINES[this.line++ % POKE_LINES.length])
    }
  }

  // Is the pointer of this mouse event over him?
  hits(event) {
    if (!this.hitBox) return false
    const rect = this.canvas.getBoundingClientRect()
    _ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(_ndc, this.camera)
    return this.raycaster.intersectObject(this.hitBox).length > 0
  }

  say(text, seconds = BUBBLE_SECONDS) {
    this.bubble.textContent = text
    this.bubbleHalf = this.bubble.offsetWidth / 2
    this.bubbleLeft = seconds
    this.placeBubble()
    if (!REDUCED_MOTION.matches) {
      this.bubble.animate([{ scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1 }], {
        duration: 260,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      })
    }
  }

  // Keeps the bubble just above his head, inside the canvas.
  placeBubble() {
    this.kit.bones.HeadTop_End.getWorldPosition(_from)
    _from.y += 0.12
    _from.project(this.camera)
    const { clientWidth: width, clientHeight: height } = this.canvas
    const x = clamp(((_from.x + 1) / 2) * width, this.bubbleHalf, width - this.bubbleHalf)
    this.bubble.style.left = `${x}px`
    this.bubble.style.top = `${((1 - _from.y) / 2) * height}px`
  }

  // Everything layered on top of the mixer: the request being acted out (or, left
  // alone, a fidget), a flinch when he's poked, and his head following the mouse.
  animate(dt) {
    const { kit } = this
    if (this.action && (this.action.time += dt) >= this.action.move.seconds) this.endAction()
    this.updateFidget(dt)

    const action = this.action ?? this.fidget
    const move = action?.move
    const t = action?.time ?? 0
    const says = move?.says ?? []
    while (action && action.said < says.length && says[action.said][0] <= t) this.say(says[action.said++][1])

    // Spins turn him on the spot; pitch tips him forward about his toes, which stay
    // where they are (or `shift` metres behind, from where he faces).
    const { y = 0, spin = 0, pitch = 0, shift = 0 } = move?.body?.(t) ?? {}
    this.mover.rotation.set(pitch, spin, 0)
    _from.copy(this.toes).applyQuaternion(this.mover.quaternion)
    _to.set(0, 0, shift).add(this.toes).applyAxisAngle(UP, spin)
    this.mover.position.subVectors(_to, _from)
    this.mover.position.y += y
    move?.update?.(this, t)
    kit.begin()

    if (move) {
      kit.weight = move.weight(t)
      move.pose(kit, t)
    }
    kit.weight = 1
    if (this.flinch < FLINCH_SECONDS) {
      this.flinch += dt
      const k = envelope(this.flinch, 0, 0.06, 0.15, FLINCH_SECONDS)
      kit.turn('Spine1', RIGHT, 10, k)
      kit.turn('Head', RIGHT, 16, k)
    }
    this.lookWeight = damp(this.lookWeight, move?.look === false ? 0 : 1, 6, dt)
    this.follow(dt, move?.target?.(this))
    kit.settle(dt)

    if (this.bubbleLeft > 0) {
      this.bubbleLeft -= dt
      if (this.bubbleLeft > 0) this.placeBubble()
      else this.bubble.textContent = ''
    }
  }

  // Turns his head towards `target`, else the mouse, else you (the camera).
  follow(dt, target) {
    this.kit.bones.Head.getWorldPosition(_from)
    if (target) {
      _to.copy(target)
    } else if (this.pointer) {
      const rect = this.canvas.getBoundingClientRect()
      _ndc.set(((this.pointer.x - rect.left) / rect.width) * 2 - 1, -((this.pointer.y - rect.top) / rect.height) * 2 + 1)
      this.raycaster.setFromCamera(_ndc, this.camera)
      this.raycaster.ray.at(this.camera.position.distanceTo(_from), _to)
    } else {
      _to.copy(this.camera.position)
    }
    _to.sub(_from).applyQuaternion(this.kit.frame).normalize()
    _aim.identity().rotateTowards(_turn.setFromUnitVectors(FRONT, _to), MAX_LOOK)
    this.look.slerp(_aim, 1 - Math.exp(-8 * dt))
    // the neck takes part of the turn and the head the rest; between requests his
    // chest turns with them a little too
    const chest = this.action ? 0 : 0.15
    this.kit.rotate(this.kit.bones.Spine2, this.look, chest * this.lookWeight)
    this.kit.rotate(this.kit.bones.Neck, this.look, 0.35 * this.lookWeight)
    this.kit.rotate(this.kit.bones.Head, this.look, (0.65 - chest) * this.lookWeight)
  }

  // Only animate while the classic page is open and the character is on screen.
  setActive(active) {
    this.active = active
    this.updateLoop()
  }

  updateLoop() {
    const running = this.active && this.onScreen
    this.renderer.setAnimationLoop(running ? (time) => this.render(time) : null)
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  render(time) {
    this.timer.update(time)
    const dt = Math.min(this.timer.getDelta(), 0.1)
    this.controls?.update()
    if (this.mixer) {
      this.kit.restore()
      this.mixer.update(dt)
      this.kit.save()
      this.animate(dt)
    }
    this.renderer.render(this.scene, this.camera)
  }
}
