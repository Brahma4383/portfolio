import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// Builds the look of a car from a design in data/cars.js. The driving code in Car.js
// doesn't care which design it's wearing: every body has the same footprint, the same
// wheel positions and the same headlight and taillight materials to switch at night.
//
// Coordinates: x is across (right is +), y is up, z runs along the car (front is -z).

export const WHEEL_RADIUS = 0.44

export const WHEEL_POSITIONS = [
  { x: -0.98, z: -1.32, front: true },
  { x: 0.98, z: -1.32, front: true },
  { x: -0.98, z: 1.32, front: false },
  { x: 0.98, z: 1.32, front: false },
]

const FRONT = -2.06
const BACK = 2.06

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra })

// A painted checkerboard band for the taxi.
function checkerTexture(dark, light) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? dark : light
      ctx.fillRect(i * 16, j * 16, 16, 16)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Text on a small sign (the taxi's roof light).
function signTexture(text, color, background) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 256, 96)
  ctx.fillStyle = color
  ctx.font = '700 60px "Space Grotesk Variable", "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 52)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Where the body pitches and rolls about: roughly the car's middle. Parts are
// placed in ground coordinates, then shifted down so the chassis group pivots here.
export const CHASSIS_PIVOT = 0.6

// Returns { chassis, wheels, headlights, headlightMaterial, taillightMaterial, flashers }.
// `chassis` is a Group positioned CHASSIS_PIVOT above the ground, so rotating it
// squats and leans the body about its middle rather than about the wheels.
export function buildCarBody(design) {
  const paint = material(design.paint, { roughness: 0.42, metalness: 0.1 })
  const trim = material(design.trim)
  const glass = material('#1d2433', { roughness: 0.15, metalness: 0.4 })
  const tint = material('#55657f', { roughness: 0.1, metalness: 0.5 }) // lighter glass for dark cars
  const black = material('#232323', { roughness: 0.9 })
  const chrome = material('#d9d9d9', { roughness: 0.35, metalness: 0.6 })
  const headlightMaterial = material('#fff6d6', { emissive: '#fff1c1', emissiveIntensity: 0.5 })
  const taillightMaterial = material('#7a0d0d', { emissive: '#ff2a2a', emissiveIntensity: 0.4 })

  const chassis = new THREE.Group()
  chassis.position.y = CHASSIS_PIVOT
  const part = (geometry, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.position.set(x, y - CHASSIS_PIVOT, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    chassis.add(mesh)
    return mesh
  }
  const box = (w, h, d, mat, x, y, z, radius = 0.12) => part(new RoundedBoxGeometry(w, h, d, 3, radius), mat, x, y, z)

  // ---------- body shapes ----------
  const shapes = {
    coupe() {
      box(2.0, 0.62, 4.1, paint, 0, 0.78, 0, 0.2)
      box(1.66, 0.58, 2.0, glass, 0, 1.34, 0.32, 0.18)
      box(1.78, 0.14, 2.08, paint, 0, 1.66, 0.32, 0.06)
      return { roofY: 1.73, roofZ: 0.32, cabinWidth: 1.78 }
    },
    sedan() {
      box(2.0, 0.66, 4.2, paint, 0, 0.8, 0, 0.16)
      box(1.7, 0.6, 2.2, glass, 0, 1.4, 0.1, 0.16)
      box(1.82, 0.14, 2.3, paint, 0, 1.74, 0.1, 0.06)
      return { roofY: 1.81, roofZ: 0.1, cabinWidth: 1.82 }
    },
    pickup() {
      box(2.0, 0.66, 4.2, paint, 0, 0.8, 0, 0.14)
      box(1.7, 0.66, 1.5, glass, 0, 1.44, -0.55, 0.14) // cab
      box(1.82, 0.14, 1.6, paint, 0, 1.8, -0.55, 0.06)
      // open bed: low walls
      box(0.12, 0.34, 1.9, paint, -0.94, 1.28, 1.05, 0.03)
      box(0.12, 0.34, 1.9, paint, 0.94, 1.28, 1.05, 0.03)
      box(1.9, 0.34, 0.12, paint, 0, 1.28, 2.0, 0.03)
      box(1.76, 0.04, 1.8, black, 0, 1.13, 1.05, 0.01)
      return { roofY: 1.87, roofZ: -0.55, cabinWidth: 1.82 }
    },
    van() {
      box(2.0, 1.0, 4.2, paint, 0, 0.98, 0, 0.22)
      if (design.twoTone) box(2.02, 0.42, 4.22, trim, 0, 1.32, 0, 0.1)
      box(1.74, 0.62, 3.3, glass, 0, 1.78, 0.2, 0.16)
      box(1.86, 0.14, 3.5, paint, 0, 2.14, 0.2, 0.06)
      return { roofY: 2.21, roofZ: 0.2, cabinWidth: 1.86 }
    },
    jeep() {
      box(2.0, 0.7, 3.9, paint, 0, 0.86, 0, 0.1)
      box(1.76, 0.46, 1.3, glass, 0, 1.44, -0.5, 0.08) // windscreen block
      // roll cage: four uprights and two rails
      for (const [x, z] of [[-0.82, -0.2], [0.82, -0.2], [-0.82, 1.5], [0.82, 1.5]]) {
        part(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), black, x, 1.6, z)
      }
      for (const x of [-0.82, 0.82]) {
        const rail = part(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), black, x, 2.0, 0.65)
        rail.rotation.x = Math.PI / 2
      }
      return { roofY: 2.05, roofZ: 0.65, cabinWidth: 1.7 }
    },
    supercar() {
      box(2.1, 0.46, 4.3, paint, 0, 0.66, 0, 0.2)
      box(2.14, 0.2, 1.4, paint, 0, 0.9, -1.2, 0.1) // flat nose
      box(1.5, 0.44, 1.9, glass, 0, 1.08, 0.2, 0.2)
      box(1.62, 0.1, 1.5, paint, 0, 1.32, 0.3, 0.05)
      // air intakes
      for (const x of [-0.98, 0.98]) box(0.16, 0.22, 0.6, black, x, 0.78, 0.6, 0.04)
      return { roofY: 1.37, roofZ: 0.3, cabinWidth: 1.62 }
    },
    bug() {
      box(1.9, 0.7, 3.9, paint, 0, 0.8, 0, 0.3)
      // a glass dome for the cabin, with a painted cap on top
      part(new THREE.SphereGeometry(1.0, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.9, 1.25), glass, 0, 1.08, 0.15)
      part(new THREE.SphereGeometry(1.0, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.92, 0.42, 1.27), paint, 0, 1.52, 0.15)
      // round bonnet
      part(new THREE.SphereGeometry(0.9, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.95, 0.4, 0.9), paint, 0, 1.08, -1.3)
      return { roofY: 1.9, roofZ: 0.15, cabinWidth: 1.6 }
    },
    limo() {
      // the same footprint as the others, but the cabin runs almost the whole length
      box(2.0, 0.64, 4.3, paint, 0, 0.78, 0, 0.14)
      box(1.72, 0.52, 3.6, tint, 0, 1.33, 0.15, 0.12)
      // window pillars and a chrome strip along the sills
      for (const z of [-0.95, -0.1, 0.75, 1.6]) box(1.76, 0.54, 0.08, paint, 0, 1.33, z, 0.02)
      box(1.84, 0.14, 3.7, paint, 0, 1.66, 0.15, 0.06)
      box(2.04, 0.06, 4.32, chrome, 0, 0.5, 0, 0.02)
      box(2.04, 0.04, 4.32, chrome, 0, 1.08, 0, 0.01)
      return { roofY: 1.73, roofZ: 0.15, cabinWidth: 1.84 }
    },
  }
  const { roofY, roofZ, cabinWidth } = (shapes[design.shape] ?? shapes.coupe)()

  // ---------- details every car shares ----------
  const bumper = design.shape === 'supercar' ? 0.44 : 0.52
  box(2.06, 0.26, 0.32, black, 0, bumper, FRONT, 0.08)
  box(2.06, 0.26, 0.32, black, 0, bumper, BACK, 0.08)
  for (const x of [-0.62, 0.62]) {
    part(new THREE.BoxGeometry(0.44, 0.2, 0.08), headlightMaterial, x, bumper + 0.34, FRONT)
    part(new THREE.BoxGeometry(0.44, 0.16, 0.08), taillightMaterial, x, bumper + 0.38, BACK)
    part(new THREE.BoxGeometry(0.16, 0.14, 0.24), paint, Math.sign(x) * (cabinWidth / 2 + 0.09), roofY - 0.5, roofZ - 1.0) // mirrors
  }
  const exhaust = part(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10), black, 0.5, 0.42, BACK + 0.09)
  exhaust.rotation.x = Math.PI / 2

  // ---------- optional extras ----------
  if (design.stripes) {
    for (const x of [-0.32, 0.32]) {
      part(new THREE.BoxGeometry(0.28, 0.02, 1.35), trim, x, 1.095, -1.3)
      part(new THREE.BoxGeometry(0.28, 0.02, 1.9), trim, x, roofY + 0.01, roofZ)
      part(new THREE.BoxGeometry(0.28, 0.02, 0.62), trim, x, 1.095, 1.72)
    }
  }
  if (design.spoiler) {
    part(new THREE.BoxGeometry(1.95, 0.08, 0.44), black, 0, 1.42, 1.86)
    for (const x of [-0.6, 0.6]) part(new THREE.BoxGeometry(0.1, 0.32, 0.1), black, x, 1.24, 1.82)
  }
  if (design.checkers) {
    const band = material('#ffffff', { map: checkerTexture('#1d1d1d', '#ffffff') })
    for (const x of [-1.005, 1.005]) part(new THREE.BoxGeometry(0.02, 0.26, 4.0), band, x, 0.95, 0)
  }
  if (design.sideBand) {
    const band = material(design.sideBand)
    for (const x of [-1.005, 1.005]) part(new THREE.BoxGeometry(0.02, 0.22, 4.0), band, x, 0.95, 0)
    box(1.1, 0.02, 1.4, band, 0, 1.12, -1.3, 0.01) // bonnet
  }
  if (design.roofSign) {
    const sign = material('#ffffff', { map: signTexture(design.roofSign, '#1d1d1d', '#ffd84d'), emissive: '#ffd84d', emissiveIntensity: 0.2 })
    part(new THREE.BoxGeometry(0.9, 0.28, 0.34), sign, 0, roofY + 0.18, roofZ)
  }
  if (design.roofRack) {
    for (const x of [-0.7, 0.7]) part(new THREE.BoxGeometry(0.06, 0.1, 2.6), black, x, roofY + 0.12, roofZ)
    for (const z of [-1.0, 0, 1.0]) part(new THREE.BoxGeometry(1.5, 0.06, 0.06), black, 0, roofY + 0.14, roofZ + z)
  }
  if (design.spareWheel) {
    const spare = part(new THREE.CylinderGeometry(WHEEL_RADIUS * 0.9, WHEEL_RADIUS * 0.9, 0.28, 18), black, 0, 1.25, BACK + 0.1)
    spare.rotation.x = Math.PI / 2
  }

  // Police light bar: two lamps whose emissive glow Car.js makes flash.
  let flashers = null
  if (design.lightBar) {
    box(1.4, 0.12, 0.32, black, 0, roofY + 0.06, roofZ - 0.1, 0.02)
    const blue = material('#4da3ff', { emissive: '#1a6dff', emissiveIntensity: 0.3 })
    const red = material('#ff5555', { emissive: '#ff1a1a', emissiveIntensity: 0.3 })
    part(new THREE.BoxGeometry(0.5, 0.2, 0.3), blue, -0.38, roofY + 0.22, roofZ - 0.1)
    part(new THREE.BoxGeometry(0.5, 0.2, 0.3), red, 0.38, roofY + 0.22, roofZ - 0.1)
    flashers = [blue, red]
  }

  // ---------- wheels: pivot (steers) > spinner (rolls) ----------
  const tyreWidth = design.chunkyTyres ? 0.46 : 0.34
  const tyreGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, tyreWidth, 18).rotateZ(Math.PI / 2)
  const rimGeometry = new THREE.CylinderGeometry(0.24, 0.24, tyreWidth + 0.02, 8).rotateZ(Math.PI / 2)
  const wheels = WHEEL_POSITIONS.map(({ x, z, front }) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, WHEEL_RADIUS, z)
    const spinner = new THREE.Group()
    const tyre = new THREE.Mesh(tyreGeometry, black)
    tyre.castShadow = true
    spinner.add(tyre, new THREE.Mesh(rimGeometry, chrome))
    pivot.add(spinner)
    return { pivot, spinner, front }
  })

  // Headlight beams, only switched on at night.
  const headlights = [-0.62, 0.62].map((x) => {
    const light = new THREE.SpotLight('#fff1d0', 0, 45, 0.5, 0.55, 1.2)
    light.position.set(x, bumper + 0.38, FRONT - 0.04)
    light.target.position.set(x * 2, 0, -16)
    return light
  })

  return { chassis, wheels, headlights, headlightMaterial, taillightMaterial, flashers }
}
