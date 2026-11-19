import { clamp, wrapAngle } from '../utils/math.js'

const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  boost: ['ShiftLeft', 'ShiftRight'],
}
const DRIVING_KEYS = new Set(Object.values(BINDINGS).flat())

// One-shot keys. `always` ones also work before the engine has started.
const ACTIONS = {
  KeyR: { name: 'reset' },
  KeyH: { name: 'horn' },
  KeyN: { name: 'night' },
  KeyC: { name: 'cars' },
  KeyM: { name: 'sound', always: true },
  Enter: { name: 'interact' },
  Escape: { name: 'escape', always: true },
}

// The steering wheel turns this far either way (in radians, about 110°) for full lock.
const WHEEL_LOCK = 1.9
// How quickly it springs back to the middle once it's let go (per second).
const WHEEL_RETURN = 9
// The hub, as a share of the wheel's radius. A thumb there can't say which way it's
// turning, so the wheel holds still until the thumb is back out on the rim.
const WHEEL_HUB = 0.25

// Keyboard on desktop; a steering wheel and pedals on touch screens.
export class Controls {
  constructor({ wheel, wheelRim, gasButton, brakeButton, driftButton }) {
    this.enabled = false
    this.pressed = new Set()
    this.handlers = {}
    // `angle` is how far the wheel is turned, clockwise on screen; `grip` is where the thumb
    // holding it was last, as an angle around the wheel's centre (null in the hub)
    this.wheel = { pointer: null, angle: 0, grip: null, drawn: 0, element: wheel, rim: wheelRim }
    this.touchGas = false
    this.touchBrake = false
    this.touchDrift = false
    this.lastInputTime = performance.now()
    this.input = { throttle: 0, steer: 0, handbrake: false, boost: false }

    window.addEventListener('keydown', (event) => this.onKeyDown(event))
    window.addEventListener('keyup', (event) => {
      this.pressed.delete(event.code)
      if (this.enabled && DRIVING_KEYS.has(event.code)) event.preventDefault()
    })
    window.addEventListener('blur', () => this.release())

    this.setupWheel()
    this.setupPedal(gasButton, (down) => (this.touchGas = down))
    this.setupPedal(brakeButton, (down) => (this.touchBrake = down))
    this.setupPedal(driftButton, (down) => (this.touchDrift = down))
  }

  on(action, handler) {
    this.handlers[action] = handler
  }

  onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target.closest?.('input, textarea, select')) return

    const action = ACTIONS[event.code]
    if (action && !event.repeat && (this.enabled || action.always)) {
      // let a focused button or link handle its own Enter key
      const onControl = event.target.closest?.('button, a')
      if (!(event.code === 'Enter' && onControl)) this.handlers[action.name]?.()
    }

    if (this.enabled && DRIVING_KEYS.has(event.code)) {
      event.preventDefault()
      this.pressed.add(event.code)
      this.handlers.drive?.()
    }
  }

  // Grab the rim and turn it, like a real wheel: what counts is how far the thumb
  // goes round the centre, so it can hold the wheel anywhere.
  setupWheel() {
    const wheel = this.wheel
    const { element } = wheel

    const gripAt = (event) => {
      const box = element.getBoundingClientRect()
      const dx = event.clientX - (box.left + box.width / 2)
      const dy = event.clientY - (box.top + box.height / 2)
      return Math.hypot(dx, dy) < (box.width / 2) * WHEEL_HUB ? null : Math.atan2(dy, dx)
    }

    element.addEventListener('pointerdown', (event) => {
      if (wheel.pointer !== null || !this.enabled) return
      event.preventDefault()
      wheel.pointer = event.pointerId
      wheel.grip = gripAt(event)
      element.setPointerCapture(event.pointerId)
      element.classList.add('is-held')
      this.handlers.drive?.()
    })

    element.addEventListener('pointermove', (event) => {
      if (event.pointerId !== wheel.pointer) return
      const grip = gripAt(event)
      if (grip !== null && wheel.grip !== null) {
        wheel.angle = clamp(wheel.angle + wrapAngle(grip - wheel.grip), -WHEEL_LOCK, WHEEL_LOCK)
      }
      wheel.grip = grip
    })

    const letGo = (event) => {
      if (event.pointerId !== wheel.pointer) return
      wheel.pointer = null
      wheel.grip = null
      element.classList.remove('is-held')
    }
    element.addEventListener('pointerup', letGo)
    element.addEventListener('pointercancel', letGo)
    element.addEventListener('lostpointercapture', letGo)
    element.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  // Gas, Brake and Drift work while they're held down.
  setupPedal(button, set) {
    const down = (event) => {
      event.preventDefault()
      // so it's let go wherever the finger lifts, even after sliding off the pedal
      button.setPointerCapture(event.pointerId)
      set(true)
      button.classList.add('is-down')
      this.handlers.drive?.()
    }
    const up = () => {
      set(false)
      button.classList.remove('is-down')
    }
    button.addEventListener('pointerdown', down)
    button.addEventListener('pointerup', up)
    button.addEventListener('pointercancel', up)
    button.addEventListener('lostpointercapture', up)
    button.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  // Lets go of everything: keys, pedals and the wheel (the page lost focus, or the game paused).
  release() {
    this.pressed.clear()
    this.touchGas = this.touchBrake = this.touchDrift = false
    for (const pedal of document.querySelectorAll('.pedal.is-down')) pedal.classList.remove('is-down')
    const { wheel } = this
    if (wheel.pointer !== null && wheel.element.hasPointerCapture(wheel.pointer)) wheel.element.releasePointerCapture(wheel.pointer)
    wheel.pointer = null
    wheel.grip = null
    wheel.element.classList.remove('is-held')
  }

  // Turns the current keys, wheel and pedals into driving input for the car.
  getInput() {
    const now = performance.now()
    const dt = Math.min((now - this.lastInputTime) / 1000, 0.1)
    this.lastInputTime = now

    const input = this.input
    const { wheel } = this
    // a wheel that's let go turns itself back to the middle
    if (wheel.pointer === null && wheel.angle !== 0) {
      wheel.angle *= Math.exp(-WHEEL_RETURN * dt)
      if (Math.abs(wheel.angle) < 0.003) wheel.angle = 0
    }
    this.drawWheel()

    if (!this.enabled) {
      input.throttle = 0
      input.steer = 0
      input.handbrake = false
      input.boost = false
      return input
    }

    const held = (name) => BINDINGS[name].some((code) => this.pressed.has(code))
    input.throttle = (held('up') || this.touchGas ? 1 : 0) - (held('down') ? 1 : 0)
    // turning the wheel clockwise steers right, which is negative here
    input.steer = clamp((held('left') ? 1 : 0) - (held('right') ? 1 : 0) - wheel.angle / WHEEL_LOCK, -1, 1)
    input.handbrake = held('handbrake') || this.touchDrift
    input.boost = held('boost')
    // Brake beats Gas, and once the car has stopped it reverses
    if (this.touchBrake) input.throttle = -1

    return input
  }

  drawWheel() {
    const { wheel } = this
    if (wheel.drawn === wheel.angle) return
    wheel.drawn = wheel.angle
    wheel.rim.style.transform = `rotate(${wheel.angle.toFixed(4)}rad)`
    // the tests (and anyone curious) can read how far it's turned
    wheel.element.dataset.angle = String(Math.round((wheel.angle * 180) / Math.PI))
  }
}
