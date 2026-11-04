import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './style.css'

import { Interface } from './ui/Interface.js'
import { Controls } from './ui/Controls.js'
import { Sound } from './ui/Sound.js'
import { Minimap } from './ui/Minimap.js'
import { Experience } from './world/Experience.js'

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

async function boot() {
  const ui = new Interface()

  if (!hasWebGL()) {
    ui.disable3D()
    return
  }

  // The 3D signs are painted with these fonts, so wait for them first.
  await Promise.all([
    document.fonts.load('700 64px "Space Grotesk Variable"'),
    document.fonts.load('500 32px "Inter Variable"'),
    document.fonts.load('700 32px "Inter Variable"'),
  ]).catch(() => {})

  const controls = new Controls({
    joystickZone: document.getElementById('joystick-zone'),
    joystick: document.getElementById('joystick'),
    joystickKnob: document.getElementById('joystick-knob'),
    driftButton: document.getElementById('drift-button'),
    brakeButton: document.getElementById('brake-button'),
  })
  const sound = new Sound()
  const minimap = new Minimap(document.getElementById('minimap'))
  const experience = new Experience({
    canvas: document.querySelector('canvas.webgl'),
    ui,
    controls,
    sound,
    minimap,
  })

  ui.setSound(sound.enabled)

  ui.on('start', () => {
    sound.start()
    ui.showHud()
    minimap.resize()
    experience.start()
  })
  ui.on('teleport', (id) => experience.teleport(id))
  ui.on('car', (id) => experience.setCar(id))
  ui.on('jump', (id) => experience.jumpTo(id))
  ui.on('emote', (id) => experience.playEmote(id))
  ui.on('night', () => ui.setNight(experience.toggleNight()))
  ui.on('sound', () => {
    sound.setEnabled(!sound.enabled)
    ui.setSound(sound.enabled)
  })
  // The animated character on the classic page loads the first time that page opens.
  let heroRobot = null
  ui.on('classic', async (open) => {
    experience.setPaused(open)
    const figure = document.querySelector('.robot') // removed when the page falls back to 2D
    if (open && !heroRobot && figure) {
      const { HeroRobot } = await import('./ui/HeroRobot.js')
      heroRobot ??= new HeroRobot(figure)
    }
    heroRobot?.setActive(ui.classicOpen)
  })
  ui.on('panel', () => experience.updateFraming())

  controls.on('reset', () => experience.teleport('spawn'))
  controls.on('horn', () => {
    sound.horn()
    experience.honk()
  })
  controls.on('night', () => ui.setNight(experience.toggleNight()))
  controls.on('cars', () => ui.toggleCars())
  controls.on('sound', () => {
    sound.setEnabled(!sound.enabled)
    ui.setSound(sound.enabled)
  })
  controls.on('interact', () => ui.openActiveLink())
  controls.on('escape', () => {
    if (ui.classicOpen) ui.closeClassic()
    else if (!ui.el.menu.hidden) ui.toggleMenu(false)
    else if (!ui.el.cars.hidden) ui.toggleCars(false)
    else ui.dismissPanel()
  })

  try {
    await experience.init((fraction) => ui.setProgress(fraction))
    ui.ready()
  } catch (error) {
    console.error(error)
    ui.disable3D()
  }
}

boot()
