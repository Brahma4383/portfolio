import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './style.css'

import { Interface } from './ui/Interface.js'
import { Controls } from './ui/Controls.js'
import { Sound } from './ui/Sound.js'
import { Minimap } from './ui/Minimap.js'
import { lockLandscape, unlockLandscape } from './ui/Landscape.js'
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
    wheel: document.getElementById('wheel'),
    wheelRim: document.getElementById('wheel-rim'),
    gasButton: document.getElementById('gas-button'),
    brakeButton: document.getElementById('brake-button'),
    driftButton: document.getElementById('drift-button'),
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

  // The world stands still behind the classic page, and behind the prompt to turn
  // a phone sideways.
  const syncPause = () => experience.setPaused(ui.classicOpen || ui.mustRotate)

  ui.on('start', () => {
    // phones: full screen and sideways, where the browser allows it (the tap allows it)
    lockLandscape()
    sound.start()
    ui.showHud()
    minimap.resize()
    experience.start()
    syncPause()
  })
  ui.on('rotate', syncPause)
  ui.on('landscape', async () => {
    // the prompt's "Turn it for me": if it can't, the button goes
    if (!(await lockLandscape())) ui.el.rotateLock.hidden = true
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
    syncPause()
    // the classic page reads upright; going back to the island turns sideways again
    if (open) unlockLandscape()
    else if (experience.driving) lockLandscape()
    const figure = document.querySelector('.robot') // removed when the page falls back to 2D
    if (open && !heroRobot && figure) {
      const { HeroRobot } = await import('./ui/HeroRobot.js')
      heroRobot ??= new HeroRobot(figure)
    }
    heroRobot?.setActive(ui.classicOpen)
  })
  ui.on('panel', () => experience.updateFraming())

  // on small screens, driving folds an open panel back into its card so the car stays in view
  controls.on('drive', () => ui.collapsePanel())
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
    else if (!ui.collapsePanel()) ui.dismissPanel()
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
