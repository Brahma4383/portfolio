import * as THREE from 'three'
import { BOWLING, GARAGE, SPAWN_PLAZA, ZONES } from './layout.js'
import { profile, projects, skillGroups, contacts, experience, education, certifications, testing } from '../data/portfolio.js'
import { cars } from '../data/cars.js'
import { buildCarBody } from './CarBody.js'
import {
  INK,
  createBoardTexture,
  createDecalTexture,
  createFacadeTextures,
  createKeyTexture,
  createPadTexture,
  createProjectBoardTexture,
  createSignTexture,
  createStageTextures,
  createStripTexture,
  createCarBoardTexture,
} from '../utils/textures.js'
import { damp } from '../utils/math.js'
import { BugHunt } from './BugHunt.js'
import { Stormtrooper } from './Stormtrooper.js'
import { Boards } from './Boards.js'

const zone = Object.fromEntries(ZONES.map((z) => [z.id, z]))

// Info boards lean back so they face the camera, which keeps them readable
// and low enough not to hide what stands behind them.
const BOARD_TILT = THREE.MathUtils.degToRad(62)
// The Test Lab's stage cards lean back 45°, standing at 135° to the ground in front of
// them. The camera looks down at about 41°, so that turns them to face it almost
// squarely and their text isn't squashed.
const CARD_TILT = THREE.MathUtils.degToRad(45)
const TITLE_PIXEL = 0.42

const STONE = '#efe6d2'

const PEDESTAL_HEIGHT = 1

// The keys painted on the start plaza press down along with your keyboard.
const KEYCAPS = [
  { label: 'W', codes: ['KeyW', 'ArrowUp'], x: -10, z: 7.1, w: 1.4 },
  { label: 'A', codes: ['KeyA', 'ArrowLeft'], x: -11.6, z: 8.7, w: 1.4 },
  { label: 'S', codes: ['KeyS', 'ArrowDown'], x: -10, z: 8.7, w: 1.4 },
  { label: 'D', codes: ['KeyD', 'ArrowRight'], x: -8.4, z: 8.7, w: 1.4 },
  { label: 'SHIFT', codes: ['ShiftLeft', 'ShiftRight'], x: 8.6, z: 7.1, w: 2.6 },
  { label: 'R', codes: ['KeyR'], x: 11.1, z: 7.1, w: 1.4 },
  { label: 'SPACE', codes: ['Space'], x: 9.85, z: 8.7, w: 5.1 },
]

const SIGNS = [
  { label: 'ABOUT', to: 'about', x: -18.5, z: -7 },
  { label: 'SKILLS', to: 'skills', x: 19.5, z: -8.5 },
  { label: 'TEST LAB', to: 'testing', x: 19, z: 4.5 },
  { label: 'PROJECTS', to: 'projects', x: 13, z: 16 },
  { label: 'CONTACT', to: 'contact', x: -19, z: 5.5 },
  { label: 'EXPERIENCE', to: 'experience', x: 5.5, z: 19 },
  { label: 'EDUCATION', to: 'education', x: -5.5, z: 19 },
  { label: 'GARAGE', to: 'garage', x: 7, z: -16, color: GARAGE.color, target: GARAGE },
]

// Builds every area of the portfolio and keeps track of the "trigger" spots
// that open an info panel when the car drives onto them.
export class Zones {
  constructor({ scene, physics, props }) {
    this.scene = scene
    this.physics = physics
    this.props = props
    this.triggers = [] // checked in order: small pads first, whole zones last
    this.zoneTriggers = []
    this.pads = []
    this.keycaps = []
    this.nightMaterials = []
    this.boards = new Boards({ scene, physics }) // they break when the car crashes into them

    this.buildPlazas()
    this.buildStart()
    this.buildAbout()
    this.buildTestLab()
    this.buildSkills()
    this.buildProjects()
    this.buildExperience()
    this.buildEducation()
    this.buildContact()
    this.buildGarage()
    this.props.addBowlingPins(BOWLING.x, BOWLING.zPins)

    this.triggers.push(...this.zoneTriggers)
  }

  // ---------- small builders ----------

  add(geometry, material, { x = 0, y = 0, z = 0, shadow = true } = {}) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    this.scene.add(mesh)
    return mesh
  }

  decal(text, { x, z, width, color = INK, size = 96, weight = 700, rotation = 0, y = 0.14 }) {
    const { texture, aspect } = createDecalTexture({ text, color, size, weight })
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width / aspect),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    )
    mesh.rotation.set(-Math.PI / 2, 0, rotation)
    mesh.position.set(x, y, z)
    mesh.renderOrder = 1
    this.scene.add(mesh)
    return mesh
  }

  // A board on two legs, leaning back by `tilt` (radians from upright), with the
  // texture on its front face. Crash into it and it breaks (see Boards.js).
  board({ frame = '#3d405b', tilt = BOARD_TILT, ...options }) {
    return this.boards.add({ frame, tilt, ...options })
  }

  title(text, x, z, color) {
    this.props.addText(text, { x, z, pixel: TITLE_PIXEL, color, mass: 1.5 })
  }

  zoneTrigger(id) {
    const z = zone[id]
    const base = { kind: 'zone', id, x: z.x, z: z.z }
    this.zoneTriggers.push(z.shape === 'rect' ? { ...base, shape: 'rect', hw: z.w / 2, hd: z.d / 2 } : { ...base, shape: 'circle', r: z.r })
  }

  // ---------- areas ----------

  buildPlazas() {
    const stone = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.9 })

    for (const plaza of [SPAWN_PLAZA, ...ZONES, GARAGE]) {
      const accent = new THREE.MeshStandardMaterial({ color: plaza.color, roughness: 0.7 })
      if (plaza.shape === 'rect') {
        this.add(new THREE.BoxGeometry(plaza.w, 0.12, plaza.d), stone, { x: plaza.x, y: 0.06, z: plaza.z, shadow: false })
        const inset = 1
        const edges = [
          [plaza.w - inset * 2, 0.6, 0, -(plaza.d / 2 - inset)],
          [plaza.w - inset * 2, 0.6, 0, plaza.d / 2 - inset],
          [0.6, plaza.d - inset * 2, -(plaza.w / 2 - inset), 0],
          [0.6, plaza.d - inset * 2, plaza.w / 2 - inset, 0],
        ]
        for (const [w, d, dx, dz] of edges) {
          this.add(new THREE.BoxGeometry(w, 0.02, d), accent, { x: plaza.x + dx, y: 0.13, z: plaza.z + dz, shadow: false })
        }
      } else {
        this.add(new THREE.CylinderGeometry(plaza.r, plaza.r, 0.12, 72), stone, { x: plaza.x, y: 0.06, z: plaza.z, shadow: false })
        const ring = this.add(new THREE.RingGeometry(plaza.r - 1.3, plaza.r - 0.6, 72).rotateX(-Math.PI / 2), accent, {
          x: plaza.x,
          y: 0.125,
          z: plaza.z,
          shadow: false,
        })
        ring.receiveShadow = true
      }
    }
  }

  buildStart() {
    this.props.addText(profile.firstName.toUpperCase(), { x: 0, z: -12, pixel: 0.55, color: INK, mass: 2 })
    this.decal('SURYAWANSHI', { x: 0, z: -7.4, width: 17, size: 120 })
    profile.tracks.forEach((track, i) => {
      this.decal(`${track.title}  —  ${track.tools}`.toUpperCase(), {
        x: 0,
        z: -4.7 + i * 1.6,
        width: 15,
        size: 80,
        weight: 600,
        color: i === 0 ? INK : '#2f7d45',
      })
    })

    // keycaps
    const side = new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.6 })
    for (const key of KEYCAPS) {
      const top = new THREE.MeshStandardMaterial({ map: createKeyTexture(key.label, { width: Math.round(128 * (key.w / 1.4)) }), roughness: 0.6 })
      const mesh = this.add(new THREE.BoxGeometry(key.w, 0.5, 1.4), [side, side, top, side, side, side], { x: key.x, y: 0.3, z: key.z })
      this.keycaps.push({ mesh, codes: key.codes })
    }
    this.decal('DRIVE', { x: -10, z: 10.4, width: 3.2, size: 90 })
    this.decal('BOOST  ·  RESET  ·  DRIFT', { x: 9.85, z: 10.4, width: 6.4, size: 80 })

    // direction signs
    const post = new THREE.MeshStandardMaterial({ color: '#3d405b', roughness: 0.6 })
    for (const sign of SIGNS) {
      const target = sign.target ?? zone[sign.to]
      const length = Math.hypot(target.x - sign.x, target.z - sign.z)
      const texture = createSignTexture({
        label: sign.label,
        color: target.color,
        direction: { x: (target.x - sign.x) / length, z: (target.z - sign.z) / length },
      })
      const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 })
      const back = new THREE.MeshStandardMaterial({ color: target.color, roughness: 0.6 })
      this.add(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8), post, { x: sign.x, y: 1.7, z: sign.z })
      this.add(new THREE.BoxGeometry(3.4, 1.06, 0.12), [back, back, back, back, face, back], { x: sign.x, y: 3, z: sign.z + 0.12 })
      this.physics.addCircle(sign.x, sign.z, 0.3, 3.4)
    }
  }

  buildAbout() {
    const z = zone.about
    this.title('ABOUT', z.x, z.z - 12.5, z.color)
    this.board({
      x: z.x + 3,
      z: z.z - 3,
      width: 12,
      height: 6.6,
      texture: createBoardTexture({
        eyebrow: 'Hello, I’m',
        title: profile.name,
        body: profile.boardLine,
        tags: profile.boardTags,
        accent: z.color,
        aspect: 12 / 6.6,
      }),
    })
    // The Stormtrooper stands on the left of the board. While the car is in the About
    // area the camera keeps him in view (see Experience), so his emotes can be watched
    // with the panel open.
    const spot = { x: z.x - 7.5, z: z.z - 1 }
    this.plinth(spot.x, spot.z, z.color)
    this.stormtrooper = new Stormtrooper({ scene: this.scene, x: spot.x, z: spot.z, baseY: PEDESTAL_HEIGHT })
    this.zoneTrigger('about')
  }

  // A round stone plinth with a band in the zone's colour. The character that
  // stands on it is loaded later, in the background.
  plinth(x, z, color) {
    const stone = new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.8 })
    this.add(new THREE.CylinderGeometry(1.55, 1.75, PEDESTAL_HEIGHT, 40), stone, { x, y: PEDESTAL_HEIGHT / 2, z })
    this.add(new THREE.CylinderGeometry(1.61, 1.61, 0.14, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), {
      x,
      y: PEDESTAL_HEIGHT - 0.22,
      z,
      shadow: false,
    })
    this.physics.addCircle(x, z, 1.75, PEDESTAL_HEIGHT)
  }

  // The six STLC stages as a row of cards leaning back at 135° to the ground, with
  // arrows between them and a light on each that turns green in turn; plus a batch of
  // bugs to squash.
  buildTestLab() {
    const z = zone.testing
    this.title('TEST LAB', z.x, z.z - 13, z.color)

    const accent = new THREE.MeshStandardMaterial({ color: z.color, roughness: 0.6 })
    const arrowGeometry = new THREE.ConeGeometry(0.24, 0.42, 3).rotateZ(-Math.PI / 2)
    const lightGeometry = new THREE.SphereGeometry(0.28, 14, 10)
    // as wide as the plaza's green ring allows: six cards across, 28.6 m in all
    const card = { width: 4.3, height: 2.15 }
    const count = testing.steps.length
    const spacing = 4.85
    const rowZ = z.z - 6.5
    const textures = createStageTextures(
      testing.steps.map((step) => step.name),
      { color: z.color, aspect: card.width / card.height },
    )
    const topEdge = new THREE.Vector3()

    this.pipelineLights = testing.steps.map((step, i) => {
      const x = z.x + (i - (count - 1) / 2) * spacing
      const panel = this.board({ x, z: rowZ, ...card, tilt: CARD_TILT, frame: INK, texture: textures[i] })

      // an arrow to the next stage, lying on the cards' slope
      if (i < count - 1) {
        const arrow = this.add(arrowGeometry, accent, { x: x + spacing / 2, y: panel.position.y, z: rowZ })
        arrow.rotation.x = -CARD_TILT
        this.boards.attach(panel, arrow)
      }

      // a status light just above the card's top edge
      panel.updateMatrixWorld()
      panel.localToWorld(topEdge.set(0, card.height / 2, 0))
      const light = new THREE.MeshStandardMaterial({ color: '#c9ccd1', emissive: '#4cd964', emissiveIntensity: 0, roughness: 0.4 })
      const lamp = this.add(lightGeometry, light, { x, y: topEdge.y + 0.3, z: topEdge.z })
      this.boards.attach(panel, lamp)
      return light
    })

    this.bugHunt = new BugHunt({ scene: this.scene, x: z.x, z: z.z + 4, radius: 7.5 })
    this.decal('DRIVE OVER THE BUGS', { x: z.x, z: z.z + 13, width: 11, size: 80 })
    this.zoneTrigger('testing')
  }

  buildSkills() {
    const z = zone.skills
    this.title('SKILLS', z.x, z.z - 14.5, z.color)
    const ink = new THREE.Color(INK)
    skillGroups.forEach((group, i) => {
      const x = z.x + (i - 1) * 12
      this.props.addCrateStack(group.crates, { x, z: z.z - 1.5, size: 2.1, color: group.color })
      // the group's name in a darker shade of its colour, so it stands out on the pale plaza
      const shade = `#${new THREE.Color(group.color).lerp(ink, 0.35).getHexString()}`
      this.decal(group.name.toUpperCase(), { x, z: z.z + 3.6, width: 10, color: shade, size: 96 })
    })
    this.decal('GO ON — CRASH INTO THEM', { x: z.x, z: z.z + 10.5, width: 11, size: 80, weight: 600 })
    this.zoneTrigger('skills')
  }

  buildProjects() {
    const z = zone.projects
    this.title('PROJECTS', z.x, z.z - 21, z.color)

    const padMaterial = new THREE.MeshStandardMaterial({ color: z.color, roughness: 0.6, emissive: z.color, emissiveIntensity: 0 })
    // Up to four projects sit in a 2×2 grid; more than that go three to a row.
    const columns = projects.length <= 4 ? 2 : 3
    const spacing = columns === 2 ? 24 : 19
    projects.forEach((project, i) => {
      const x = z.x + ((i % columns) - (columns - 1) / 2) * spacing
      const boardZ = z.z - 10 + Math.floor(i / columns) * 20
      this.board({
        x,
        z: boardZ,
        width: 14,
        height: 8,
        texture: createProjectBoardTexture({
          eyebrow: project.kind,
          title: project.name,
          built: project.built.stack,
          tested: project.tested.stack,
          accent: z.color,
          index: String(i + 1).padStart(2, '0'),
          aspect: 14 / 8,
        }),
      })

      const padZ = boardZ + 7.5
      const material = padMaterial.clone()
      const mesh = this.add(new THREE.BoxGeometry(8, 0.06, 4), material, { x, y: 0.15, z: padZ, shadow: false })
      this.decal('PARK HERE', { x, z: padZ, width: 5, color: '#ffffff', size: 90, y: 0.2 })
      this.pads.push({ mesh, material, baseY: 0.15, trigger: `project:${i}` })
      this.triggers.push({ kind: 'project', id: `project:${i}`, index: i, shape: 'rect', x, z: padZ, hw: 5, hd: 3.4 })
    })
    this.zoneTrigger('projects')
  }

  buildExperience() {
    const z = zone.experience
    const job = experience[0]
    this.title('EXPERIENCE', z.x, z.z + 6.5, z.color)

    // office building
    const { map, emissiveMap } = createFacadeTextures({ company: job.company.toUpperCase(), line: `${job.role} · ${job.period}` })
    const wall = new THREE.MeshStandardMaterial({ color: '#f3ede2', roughness: 0.85 })
    const facade = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.7 })
    this.nightMaterials.push(facade)
    const bx = z.x - 5
    const bz = z.z - 11.5
    this.add(new THREE.BoxGeometry(13, 6.5, 6), [wall, wall, wall, wall, facade, wall], { x: bx, y: 3.25, z: bz })
    this.add(new THREE.BoxGeometry(13.4, 0.4, 6.4), new THREE.MeshStandardMaterial({ color: INK, roughness: 0.7 }), { x: bx, y: 6.7, z: bz })
    this.physics.addBox(bx, bz, 13, 6, 0, 6.5)

    // water tanks next to it
    const tankMaterial = new THREE.MeshStandardMaterial({ color: '#2f6fb5', roughness: 0.5 })
    const ringMaterial = new THREE.MeshStandardMaterial({ color: '#1f4f86', roughness: 0.5 })
    for (const [tx, tz, radius, height] of [[z.x + 8, z.z - 13.5, 2.4, 6], [z.x + 13, z.z - 9, 1.8, 4.4]]) {
      this.add(new THREE.CylinderGeometry(radius, radius, height, 20), tankMaterial, { x: tx, y: height / 2, z: tz })
      this.add(new THREE.SphereGeometry(radius, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), tankMaterial, { x: tx, y: height, z: tz })
      for (let k = 1; k < 4; k++) {
        const ring = this.add(new THREE.TorusGeometry(radius + 0.04, 0.08, 6, 28).rotateX(Math.PI / 2), ringMaterial, {
          x: tx,
          y: (height / 4) * k,
          z: tz,
        })
        ring.castShadow = false
      }
      this.physics.addCircle(tx, tz, radius, height)
    }

    this.decal(`${job.role.toUpperCase()}  ·  ${job.period.toUpperCase()}`, { x: bx, z: bz + 4.6, width: 12, size: 80 })
    this.zoneTrigger('experience')
  }

  buildEducation() {
    const z = zone.education
    this.title('EDUCATION', z.x, z.z + 6.5, z.color)

    const stone = new THREE.MeshStandardMaterial({ color: '#f4efe3', roughness: 0.85 })
    const trim = new THREE.MeshStandardMaterial({ color: '#e2d8c3', roughness: 0.85 })
    const cx = z.x
    const cz = z.z - 11.5
    this.add(new THREE.BoxGeometry(15, 0.8, 8), trim, { x: cx, y: 0.4, z: cz })
    this.add(new THREE.BoxGeometry(12, 4.6, 4.6), stone, { x: cx, y: 3.1, z: cz - 1.2 })
    for (let i = 0; i < 6; i++) {
      this.add(new THREE.CylinderGeometry(0.34, 0.38, 4.6, 12), stone, { x: cx - 5.5 + i * 2.2, y: 3.1, z: cz + 2.9 })
    }
    const frieze = new THREE.MeshStandardMaterial({
      map: createStripTexture({ text: education[0].place.toUpperCase(), color: '#ffffff', background: z.color }),
      roughness: 0.7,
    })
    this.add(new THREE.BoxGeometry(14, 0.9, 7.4), [trim, trim, trim, trim, frieze, trim], { x: cx, y: 5.85, z: cz })

    // triangular roof
    const roofShape = new THREE.Shape([new THREE.Vector2(-7.4, 0), new THREE.Vector2(7.4, 0), new THREE.Vector2(0, 2.3)])
    const roof = this.add(new THREE.ExtrudeGeometry(roofShape, { depth: 7.4, bevelEnabled: false }), trim, { x: cx, y: 6.3, z: cz - 3.7 })
    roof.castShadow = true
    this.physics.addBox(cx, cz, 15, 8, 0, 7)

    // a graduation cap floating above the roof
    this.cap = new THREE.Group()
    const capMaterial = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 })
    const board = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 3), capMaterial)
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.9, 16), capMaterial)
    crown.position.y = -0.5
    const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.4 }))
    tassel.position.set(1.3, -0.6, 1.3)
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7), tassel.material)
    cord.position.set(1.3, -0.25, 1.3)
    this.cap.add(board, crown, tassel, cord)
    this.cap.traverse((child) => (child.castShadow = true))
    this.cap.position.set(cx, 11.2, cz)
    this.scene.add(this.cap)

    certifications.forEach((cert, i) => {
      this.board({
        x: i === 0 ? z.x - 14.5 : z.x + 14.5,
        z: z.z - 7,
        width: 6.4,
        height: 4,
        texture: createBoardTexture({
          eyebrow: 'Certificate',
          title: cert.title,
          body: `${cert.place} · ${cert.period}`,
          accent: z.color,
          aspect: 6.4 / 4,
          resolution: 640,
        }),
      })
    })

    this.decal(`${education[0].title.toUpperCase()}  ·  ${education[0].period}`, { x: cx, z: cz + 5.3, width: 14, size: 76 })
    this.zoneTrigger('education')
  }

  buildContact() {
    const z = zone.contact
    this.title('CONTACT', z.x, z.z - 12, z.color)

    // The first row sits on the road's line, so driving straight in lands on a pad.
    contacts.forEach((contact, i) => {
      const x = z.x + (i % 2 === 0 ? -7 : 7)
      const padZ = z.z + (i < 2 ? 0 : 10)
      const side = new THREE.MeshStandardMaterial({ color: contact.color, roughness: 0.6 })
      const texture = createPadTexture(contact)
      const top = new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: '#ffffff',
        emissiveIntensity: 0,
        roughness: 0.6,
      })
      const mesh = this.add(new THREE.BoxGeometry(10, 0.1, 8), [side, side, top, side, side, side], { x, y: 0.17, z: padZ, shadow: false })
      this.pads.push({ mesh, material: top, baseY: 0.17, trigger: `contact:${i}` })
      this.triggers.push({ kind: 'contact', id: `contact:${i}`, index: i, shape: 'rect', x, z: padZ, hw: 5, hd: 4 })
    })
    this.zoneTrigger('contact')
  }

  // The Garage: a board for each car with a small model of it on top and a pad in
  // front. Driving onto a pad switches you to that car (Experience handles the swap).
  buildGarage() {
    const g = GARAGE
    this.title('GARAGE', g.x, g.z - 26, g.color)
    this.decal('PARK ON A PAD TO SWITCH CARS', { x: g.x, z: g.z + 22.5, width: 16, size: 80, weight: 600 })

    const padMaterial = new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.6, emissive: g.color, emissiveIntensity: 0 })
    // three rows, each with a board, the model on its shelf and a pad in front
    const columns = 3
    const spacing = 19
    const rowDepth = 15.5
    cars.forEach((design, i) => {
      const x = g.x + ((i % columns) - (columns - 1) / 2) * spacing
      const boardZ = g.z - 19 + Math.floor(i / columns) * rowDepth
      const panel = this.board({
        x,
        z: boardZ,
        width: 11,
        height: 4,
        frame: g.color,
        texture: createCarBoardTexture({ index: i + 1, name: design.name, tagline: design.tagline, paint: design.paint, accent: g.color }),
      })

      // a model of the car on a shelf above the board
      const { chassis, wheels } = buildCarBody(design)
      const model = new THREE.Group()
      model.add(chassis, ...wheels.map((wheel) => wheel.pivot))
      model.scale.setScalar(0.55)
      model.position.set(x, 3.05, boardZ - 0.8)
      model.rotation.y = Math.PI + 0.35
      this.scene.add(model)
      const shelf = this.add(new THREE.BoxGeometry(3.4, 0.16, 2.7), new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.8 }), {
        x,
        y: 2.97,
        z: boardZ - 0.8,
      })
      // the shelf and its model fall with the board
      this.boards.attach(panel, shelf)
      this.boards.attach(panel, model)

      const padZ = boardZ + 5.8
      const material = padMaterial.clone()
      const mesh = this.add(new THREE.BoxGeometry(8, 0.06, 4), material, { x, y: 0.15, z: padZ, shadow: false })
      this.decal(design.name.toUpperCase(), { x, z: padZ, width: 5.5, color: '#ffffff', size: 90, y: 0.2 })
      this.pads.push({ mesh, material, baseY: 0.15, trigger: `car:${design.id}` })
      this.triggers.push({ kind: 'car', id: `car:${design.id}`, carId: design.id, index: i, shape: 'rect', x, z: padZ, hw: 4.2, hd: 2.4 })
    })
    this.zoneTriggers.push({ kind: 'garage', id: 'garage', x: g.x, z: g.z, shape: 'rect', hw: g.w / 2, hd: g.d / 2 })
  }

  // ---------- runtime ----------

  findTrigger(x, z) {
    for (const t of this.triggers) {
      if (t.shape === 'rect' ? Math.abs(x - t.x) < t.hw && Math.abs(z - t.z) < t.hd : Math.hypot(x - t.x, z - t.z) < t.r) {
        return t
      }
    }
    return null
  }

  setNight(amount) {
    for (const material of this.nightMaterials) material.emissiveIntensity = amount * 1.2
  }

  update(dt, elapsed, { activeId, pressed, car }) {
    for (const key of this.keycaps) {
      const down = key.codes.some((code) => pressed.has(code))
      key.mesh.position.y = damp(key.mesh.position.y, down ? 0.12 : 0.3, 20, dt)
    }

    for (const pad of this.pads) {
      const active = pad.trigger === activeId
      pad.material.emissiveIntensity = damp(pad.material.emissiveIntensity, active ? 0.35 + Math.sin(elapsed * 6) * 0.1 : 0, 8, dt)
    }

    if (this.cap) {
      this.cap.rotation.y = elapsed * 0.6
      this.cap.position.y = 11.2 + Math.sin(elapsed * 1.4) * 0.35
    }

    // pipeline: stages pass one by one, hold all-green for a moment, then start again
    const passed = (elapsed * 1.3) % (this.pipelineLights.length + 3)
    this.pipelineLights.forEach((light, i) => {
      light.emissiveIntensity = damp(light.emissiveIntensity, i < passed ? 1.8 : 0, 10, dt)
    })

    this.bugHunt.update(dt, elapsed, car)

    this.stormtrooper.update(dt, car)
    this.boards.update(dt, car)
  }
}
