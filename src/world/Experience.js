import * as THREE from 'three'
import { Physics } from './Physics.js'
import { Environment } from './Environment.js'
import { Island } from './Island.js'
import { Props } from './Props.js'
import { Zones } from './Zones.js'
import { Car } from './Car.js'
import { Effects } from './Effects.js'
import { CameraRig } from './CameraRig.js'
import { BOWLING, GARAGE, SPAWN, ZONES } from './layout.js'
import { carById, DEFAULT_CAR } from '../data/cars.js'

const CAR_STORAGE_KEY = 'portfolio:car'
import { clamp, headingToward } from '../utils/math.js'

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))

// Owns the renderer and the game loop, and wires the 3D world to the HTML interface.
export class Experience {
  constructor({ canvas, ui, controls, sound, minimap }) {
    this.canvas = canvas
    this.ui = ui
    this.controls = controls
    this.sound = sound
    this.minimap = minimap
    this.driving = false
    this.paused = false
    this.activeTrigger = null
    this.bugRadar = null // see updateBugRadar()
    this.bugRadarHost = null
    this.distance = 0
    this.frameTimes = []
    this.qualityChecked = false
  }

  // Builds the world in a few steps so the loading bar can move in between.
  async init(onProgress) {
    const step = async (fraction) => {
      onProgress(fraction)
      await nextFrame()
    }

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 700)
    await step(0.1)

    this.physics = new Physics()
    this.environment = new Environment({ scene: this.scene })
    await step(0.2)

    this.island = new Island({ scene: this.scene, physics: this.physics })
    await step(0.45)

    this.props = new Props({ scene: this.scene, physics: this.physics })
    this.zones = new Zones({ scene: this.scene, physics: this.physics, props: this.props })
    await step(0.75)

    this.car = new Car({ scene: this.scene, physics: this.physics })
    this.car.reset(SPAWN)
    this.setCar(this.savedCar(), { announce: false })
    this.effects = new Effects(this.scene)
    this.cameraRig = new CameraRig(this.camera)
    this.applyAspect()

    this.environment.onNightChange((amount) => {
      this.island.setNight(amount)
      this.zones.setNight(amount)
      this.car.setNight(amount)
    })
    this.zones.bugHunt.onSquash = (fixed, total, position) => {
      for (let i = 0; i < 4; i++) this.effects.emitPuff(position.x, position.z, { x: 0, y: 0 })
      this.sound.impact(3)
      this.ui.toast(
        fixed === total ? `All ${total} bugs fixed — ready for release 🚀` : `Bug ${fixed}/${total} squashed — logged, fixed, retested ✓`,
        2400,
      )
    }
    // a crash shakes the camera; the canvas keeps count of broken boards (the tests read it)
    const boards = this.zones.boards
    this.canvas.dataset.brokenBoards = '0'
    boards.onBreak = (speed) => {
      this.cameraRig.addShake(clamp(0.25 + speed * 0.03, 0.25, 0.8))
      this.sound.crash(speed)
      this.canvas.dataset.brokenBoards = String(boards.brokenCount)
    }
    boards.onRebuilt = () => (this.canvas.dataset.brokenBoards = String(boards.brokenCount))
    // likewise for the skill crate stacks and the pixel-letter words
    this.canvas.dataset.knockedStacks = '0'
    this.canvas.dataset.knockedWords = '0'
    this.props.onGroupsChange = (kind, knocked) => {
      this.canvas.dataset[kind === 'crates' ? 'knockedStacks' : 'knockedWords'] = String(knocked)
    }
    this.props.onBowlingResult = (down, total) => {
      this.ui.toast(down === total ? 'STRIKE! 🎳' : `${down} / ${total} pins down`, 2600)
    }
    this.bindEvents()

    this.cameraRig.update(0, this.car)
    this.renderer.compile(this.scene, this.camera)
    await step(0.95)

    // not awaited: the island is usable while the Stormtrooper downloads
    const trooper = this.zones.stormtrooper
    trooper.onAction = (emote) => this.ui.setTrooperAction(emote)
    trooper.load().then(
      () => this.ui.setTrooperReady(),
      (error) => console.warn('Could not load the Stormtrooper', error),
    )

    this.timer = new THREE.Timer()
    this.timer.connect(document)
    this.renderer.setAnimationLoop((time) => this.tick(time))
    onProgress(1)
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.applyAspect()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.updateFraming()
    })

    this.canvas.addEventListener(
      'wheel',
      (event) => {
        if (!this.driving) return
        event.preventDefault()
        this.cameraRig.zoomBy(event.deltaY > 0 ? 1.08 : 0.92)
      },
      { passive: false },
    )
  }

  applyAspect() {
    this.cameraRig.setAspect(this.camera.aspect)
    this.environment.setShadowScale(Math.max(1, this.cameraRig.baseZoom * 0.75))
  }

  start() {
    if (this.driving) return
    this.driving = true
    this.controls.enabled = true
    this.cameraRig.startFollowing()
  }

  setPaused(paused) {
    this.paused = paused
    this.controls.enabled = !paused && this.driving
    this.controls.pressed.clear()
    // the bug radar runs its own animation loop; stop it with the world
    this.bugRadar?.radar.set({ paused })
  }

  // Jump to a zone (or 'spawn' / 'bowling') from the menu.
  // A quick dip to black over a jump, so the cut between two places reads as a transition.
  blink(move) {
    const veil = document.getElementById('veil')
    if (!veil) return move()
    veil.classList.add('is-on')
    setTimeout(() => {
      move()
      requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-on')))
    }, 180)
  }

  teleport(id) {
    this.blink(() => this.place(id))
  }

  place(id) {
    let spot = SPAWN
    if (id === 'bowling') {
      const [x, z] = BOWLING.dock
      spot = { x, z, heading: 0 }
    } else if (id === 'garage') {
      const [x, z] = GARAGE.dock
      spot = { x, z, heading: headingToward(GARAGE.x - x, GARAGE.z - z) }
    } else {
      const zone = ZONES.find((item) => item.id === id)
      if (zone) {
        const [x, z] = zone.dock
        spot = { x, z, heading: headingToward(zone.x - x, zone.z - z) }
      }
    }
    this.car.reset(spot)
    this.effects.lastMarks.fill(null)
    this.cameraRig.snap(this.car)
  }

  // Place the car on a pad, facing its board (e.g. 'project:2').
  jumpTo(triggerId) {
    const trigger = this.zones.triggers.find((t) => t.id === triggerId)
    if (!trigger) return
    this.blink(() => {
      this.car.reset({ x: trigger.x, z: trigger.z + 1, heading: 0 })
      this.effects.lastMarks.fill(null)
      this.cameraRig.snap(this.car)
    })
  }

  // Switches to one of the cars in data/cars.js, mid-drive, and remembers the choice.
  setCar(id, { announce = true } = {}) {
    const design = carById[id] ?? carById[DEFAULT_CAR]
    const changed = design.id !== this.car.designId
    this.car.setDesign(design.id)
    this.minimap.carColor = design.paint
    this.ui.setCar(design.id)
    if (!changed) return
    try {
      localStorage.setItem(CAR_STORAGE_KEY, design.id)
    } catch {
      // storage unavailable (private mode): the choice just isn't remembered
    }
    if (announce) {
      this.sound.chime()
      this.ui.toast(`Now driving the ${design.name}`, 2200)
    }
  }

  savedCar() {
    try {
      return localStorage.getItem(CAR_STORAGE_KEY) ?? DEFAULT_CAR
    } catch {
      return DEFAULT_CAR
    }
  }

  // Honking near the Stormtrooper makes him jump.
  honk() {
    this.zones.stormtrooper.hearHorn(this.car.position)
  }

  playEmote(id) {
    this.zones.stormtrooper.play(id)
  }

  toggleNight() {
    const night = !this.environment.isNight
    this.environment.setNight(night)
    return night
  }

  tick(time) {
    this.timer.update(time)
    if (this.paused) return
    const dt = Math.min(this.timer.getDelta(), 1 / 20)
    const elapsed = this.timer.getElapsed()

    const input = this.controls.getInput(this.car.heading)
    const bump = this.car.update(dt, input)
    this.physics.step(dt)

    const hit = Math.max(bump, this.car.consumePropImpact())
    if (hit > 4) {
      this.cameraRig.addShake(Math.min(0.7, hit * 0.035))
      this.sound.impact(hit)
    }

    this.props.update(dt, this.car)

    if (this.driving) {
      const trigger = this.zones.findTrigger(this.car.position.x, this.car.position.z)
      if (trigger?.id !== this.activeTrigger?.id) {
        this.activeTrigger = trigger
        if (trigger?.kind === 'zone') this.minimap.visited.add(trigger.id)
        if (trigger?.id === 'about') this.zones.stormtrooper.greet()
        if (trigger?.kind === 'car') this.setCar(trigger.carId)
        // keep the Stormtrooper in view while the car is in the About area
        this.cameraRig.setInterest(trigger?.id === 'about' ? this.zones.stormtrooper.position : null)
        if (this.ui.showTrigger(trigger)) this.sound.chime()
        this.updateFraming()
      }

      this.distance += this.car.speed * dt
      if (this.distance > 40) this.ui.hideHint()
    }

    this.zones.update(dt, elapsed, { activeId: this.activeTrigger?.id, pressed: this.controls.pressed, car: this.car })
    this.updateBugRadar()
    this.effects.update(dt, this.car, input)
    this.environment.update(dt, this.car.position)
    this.island.update(elapsed)
    this.cameraRig.update(dt, this.car)
    this.sound.update(this.car.speed, input.throttle)

    if (this.driving) {
      this.minimap.draw(this.car)
      this.ui.setSpeed(this.car.speed * 3.6)
      this.adaptQuality(dt)
    }

    this.renderer.render(this.scene, this.camera)
  }

  // While the Test Lab's panel is open, its bug radar shows where the bugs are around
  // the car. The radar (src/ui/BugRadar.js) is only downloaded the first time.
  updateBugRadar() {
    const host = this.ui.bugRadarHost
    if (host !== this.bugRadarHost) {
      this.bugRadarHost = host
      if (host) {
        this.bugRadarLoad ??= import('../ui/BugRadar.js').then(({ BugRadar }) => (this.bugRadar = new BugRadar()))
        this.bugRadarLoad
          .then((radar) => this.bugRadarHost === host && radar.mount(host))
          .catch((error) => {
            console.warn('Could not load the bug radar', error)
            host.dataset.state = 'error'
          })
      }
    }
    if (host && this.bugRadar?.host === host) this.bugRadar.update(this.zones.bugHunt, this.car)
  }

  // Slide the view so the car isn't hidden behind the info panel:
  // sideways when the panel sits on the right, upwards when it's a bottom sheet.
  updateFraming() {
    const panel = this.ui.panelSize
    if (!panel) {
      this.cameraRig.setFraming(0, 0)
      return
    }
    const metresPerPixel = (2 * this.cameraRig.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / window.innerHeight
    if (panel.bottomSheet) this.cameraRig.setFraming(0, (panel.height / 2) * metresPerPixel * 1.3)
    else this.cameraRig.setFraming((panel.width / 2) * metresPerPixel, 0)
  }

  // If the first few seconds of driving run slowly, drop to a lighter setting.
  adaptQuality(dt) {
    if (this.qualityChecked) return
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 150) return
    this.qualityChecked = true
    const average = this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length
    if (average > 1 / 40) {
      this.renderer.setPixelRatio(1)
      this.environment.setShadowQuality(1024)
    }
  }
}
