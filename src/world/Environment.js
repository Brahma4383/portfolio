import * as THREE from 'three'
import { damp } from '../utils/math.js'

const DAY = {
  sky: new THREE.Color('#a9dcf0'),
  hemiSky: new THREE.Color('#e4f4ff'),
  hemiGround: new THREE.Color('#7f9f58'),
  hemiIntensity: 1.25,
  sun: new THREE.Color('#fff0d4'),
  sunIntensity: 2.6,
}

const NIGHT = {
  sky: new THREE.Color('#0e1a2e'),
  hemiSky: new THREE.Color('#5b7bb5'),
  hemiGround: new THREE.Color('#1c2b26'),
  hemiIntensity: 0.55,
  sun: new THREE.Color('#a9bfff'),
  sunIntensity: 0.6,
}

// Sun offset from the car. The sun follows the car so its shadow map only has
// to cover what is on screen.
const SUN_OFFSET = new THREE.Vector3(-26, 48, 18)
const SHADOW_SPAN = 48

export class Environment {
  constructor({ scene }) {
    this.scene = scene
    this.night = 0
    this.nightTarget = 0
    this.listeners = []
    this.sunOffset = SUN_OFFSET.clone()

    scene.background = DAY.sky.clone()
    scene.fog = new THREE.Fog(DAY.sky.clone(), 90, 260)

    this.hemi = new THREE.HemisphereLight(DAY.hemiSky.clone(), DAY.hemiGround.clone(), DAY.hemiIntensity)
    scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(DAY.sun.clone(), DAY.sunIntensity)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.setShadowScale(1)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    scene.add(this.sun, this.sun.target)
  }

  // Calls fn(amount) whenever the day/night blend changes (0 = day, 1 = night).
  onNightChange(fn) {
    this.listeners.push(fn)
  }

  setNight(enabled) {
    this.nightTarget = enabled ? 1 : 0
  }

  get isNight() {
    return this.nightTarget === 1
  }

  // Grows the shadow-casting area (and pulls the sun back) when more of the island is on screen.
  setShadowScale(scale) {
    const camera = this.sun.shadow.camera
    camera.left = -SHADOW_SPAN * scale
    camera.right = SHADOW_SPAN * scale
    camera.top = SHADOW_SPAN * scale
    camera.bottom = -SHADOW_SPAN * scale
    camera.near = 1
    camera.far = 140 * scale
    camera.updateProjectionMatrix()
    this.sunOffset.copy(SUN_OFFSET).multiplyScalar(scale)
  }

  setShadowQuality(size) {
    this.sun.shadow.mapSize.set(size, size)
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
  }

  update(dt, focus) {
    this.sun.position.set(focus.x + this.sunOffset.x, this.sunOffset.y, focus.z + this.sunOffset.z)
    this.sun.target.position.set(focus.x, 0, focus.z)

    if (Math.abs(this.night - this.nightTarget) < 0.001) return
    this.night = damp(this.night, this.nightTarget, 2.2, dt)
    if (Math.abs(this.night - this.nightTarget) < 0.002) this.night = this.nightTarget

    const n = this.night
    this.scene.background.lerpColors(DAY.sky, NIGHT.sky, n)
    this.scene.fog.color.copy(this.scene.background)
    this.hemi.color.lerpColors(DAY.hemiSky, NIGHT.hemiSky, n)
    this.hemi.groundColor.lerpColors(DAY.hemiGround, NIGHT.hemiGround, n)
    this.hemi.intensity = DAY.hemiIntensity + (NIGHT.hemiIntensity - DAY.hemiIntensity) * n
    this.sun.color.lerpColors(DAY.sun, NIGHT.sun, n)
    this.sun.intensity = DAY.sunIntensity + (NIGHT.sunIntensity - DAY.sunIntensity) * n
    for (const fn of this.listeners) fn(n)
  }
}
