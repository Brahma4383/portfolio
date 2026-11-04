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

const JOYSTICK_RADIUS = 56

// Keyboard on desktop; a floating joystick plus two buttons on touch screens.
export class Controls {
  constructor({ joystickZone, joystick, joystickKnob, driftButton, brakeButton }) {
    this.enabled = false
    this.pressed = new Set()
    this.handlers = {}
    this.stick = { pointer: null, originX: 0, originY: 0, x: 0, y: 0 }
    this.touchDrift = false
    this.touchBrake = false
    this.input = { throttle: 0, steer: 0, handbrake: false, boost: false }

    window.addEventListener('keydown', (event) => this.onKeyDown(event))
    window.addEventListener('keyup', (event) => {
      this.pressed.delete(event.code)
      if (this.enabled && DRIVING_KEYS.has(event.code)) event.preventDefault()
    })
    window.addEventListener('blur', () => this.pressed.clear())

    this.setupJoystick(joystickZone, joystick, joystickKnob)
    this.setupHoldButton(driftButton, (down) => (this.touchDrift = down))
    this.setupHoldButton(brakeButton, (down) => (this.touchBrake = down))
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

  setupJoystick(zone, base, knob) {
    const stick = this.stick

    zone.addEventListener('pointerdown', (event) => {
      if (stick.pointer !== null || !this.enabled) return
      stick.pointer = event.pointerId
      stick.originX = event.clientX
      stick.originY = event.clientY
      zone.setPointerCapture(event.pointerId)
      base.style.left = `${event.clientX}px`
      base.style.top = `${event.clientY}px`
      base.classList.add('is-active')
      knob.style.transform = 'translate(-50%, -50%)'
      this.handlers.drive?.()
    })

    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== stick.pointer) return
      let dx = event.clientX - stick.originX
      let dy = event.clientY - stick.originY
      const length = Math.hypot(dx, dy)
      if (length > JOYSTICK_RADIUS) {
        dx *= JOYSTICK_RADIUS / length
        dy *= JOYSTICK_RADIUS / length
      }
      stick.x = dx / JOYSTICK_RADIUS
      stick.y = -dy / JOYSTICK_RADIUS
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    })

    const release = (event) => {
      if (event.pointerId !== stick.pointer) return
      stick.pointer = null
      stick.x = 0
      stick.y = 0
      base.classList.remove('is-active')
    }
    zone.addEventListener('pointerup', release)
    zone.addEventListener('pointercancel', release)
  }

  setupHoldButton(button, set) {
    const down = (event) => {
      event.preventDefault()
      set(true)
      this.handlers.drive?.()
    }
    const up = () => set(false)
    button.addEventListener('pointerdown', down)
    button.addEventListener('pointerup', up)
    button.addEventListener('pointerleave', up)
    button.addEventListener('pointercancel', up)
    button.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  // Turns the current keys / joystick into driving input for the car.
  getInput(heading) {
    const input = this.input
    if (!this.enabled) {
      input.throttle = 0
      input.steer = 0
      input.handbrake = false
      input.boost = false
      return input
    }

    const held = (name) => BINDINGS[name].some((code) => this.pressed.has(code))
    input.throttle = (held('up') ? 1 : 0) - (held('down') ? 1 : 0)
    input.steer = (held('left') ? 1 : 0) - (held('right') ? 1 : 0)
    input.handbrake = held('handbrake') || this.touchDrift
    input.boost = held('boost')

    // The joystick points where you want to go on screen (up = north);
    // the car steers toward that direction.
    const magnitude = Math.min(1, Math.hypot(this.stick.x, this.stick.y))
    if (this.stick.pointer !== null && magnitude > 0.18) {
      const target = Math.atan2(-this.stick.x, this.stick.y)
      input.throttle = magnitude
      input.steer = clamp(wrapAngle(target - heading) * 2.2, -1, 1)
    }
    if (this.touchBrake) input.throttle = -1

    return input
  }
}
