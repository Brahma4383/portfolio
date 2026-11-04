import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createRandom } from '../utils/random.js'
import { distanceToSegment } from '../utils/math.js'
import { createDecalTexture } from '../utils/textures.js'
import { BOWLING, ISLAND_RADIUS, ROADS, ROAD_WIDTH, isInsideZone } from './layout.js'

const GRASS = new THREE.Color('#86b75a')
const GRASS_DARK = new THREE.Color('#6fa04c')
const SAND = new THREE.Color('#f0d9a6')
const SAND_WET = new THREE.Color('#d8b47c')
const WATER_LEVEL = -0.9

// Wobble for the shoreline so the island isn't a perfect circle.
const shoreWobble = (angle) => Math.sin(angle * 5) * 1.6 + Math.sin(angle * 11 + 1.3) * 0.8

// Ground height by distance from the centre: flat inland, sloping into the sea.
const heightAt = (radius) => (radius <= 127 ? 0 : -Math.pow((radius - 127) / 33, 1.2) * 7)

export class Island {
  constructor({ scene, physics }) {
    this.scene = scene
    this.physics = physics
    this.random = createRandom(7)
    this.placed = []
    this.waterUniforms = { uTime: { value: 0 } }

    this.buildGround()
    this.buildWater()
    this.buildRoads()
    this.buildBowlingLane()
    this.buildLamps()
    this.buildTrees()
    this.buildRocks()
    this.buildGroundCover()
    this.buildBoats()
  }

  buildGround() {
    const rings = [0, 15, 30, 45, 60, 75, 90, 104, 112, 116.5, 118.5, 122, 126, 129, 133, 138, 146, 160]
    const segments = 160
    const positions = []
    const colors = []
    const indices = []
    const color = new THREE.Color()

    rings.forEach((baseRadius) => {
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2
        const radius = baseRadius >= 112 ? baseRadius + shoreWobble(angle) : baseRadius
        positions.push(Math.cos(angle) * radius, heightAt(baseRadius), Math.sin(angle) * radius)

        if (baseRadius <= 116.5) {
          color.copy(GRASS).lerp(GRASS_DARK, this.random.next() * 0.8)
        } else if (baseRadius <= 127) {
          color.copy(SAND)
        } else {
          color.copy(SAND_WET)
        }
        colors.push(color.r, color.g, color.b)
      }
    })

    const row = segments + 1
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * row + j
        const b = (i + 1) * row + j
        const c = i * row + j + 1
        const d = (i + 1) * row + j + 1
        indices.push(a, c, b, c, d, b)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    const ground = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
    )
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  buildWater() {
    const geometry = new THREE.PlaneGeometry(900, 900, 140, 140).rotateX(-Math.PI / 2)
    const material = new THREE.MeshStandardMaterial({
      color: '#3aaed8',
      roughness: 0.2,
      metalness: 0.05,
      flatShading: true,
    })
    // Gentle waves, done on the GPU.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.waterUniforms.uTime
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 waveWorld = modelMatrix * vec4(position, 1.0);
          transformed.y += sin(waveWorld.x * 0.11 + uTime * 1.1) * 0.32 + cos(waveWorld.z * 0.09 + uTime * 0.8) * 0.28;`,
        )
    }
    const water = new THREE.Mesh(geometry, material)
    water.position.y = WATER_LEVEL
    water.receiveShadow = true
    this.scene.add(water)

    // White foam ring where the waves meet the beach.
    const segments = 160
    const positions = []
    const indices = []
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2
      const wobble = shoreWobble(angle)
      for (const radius of [130.5, 134]) {
        positions.push(Math.cos(angle) * (radius + wobble), 0, Math.sin(angle) * (radius + wobble))
      }
    }
    for (let j = 0; j < segments; j++) {
      const a = j * 2
      indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1)
    }
    const foamGeometry = new THREE.BufferGeometry()
    foamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    foamGeometry.setIndex(indices)
    this.foam = new THREE.Mesh(
      foamGeometry,
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }),
    )
    this.foam.position.y = WATER_LEVEL + 0.25
    this.scene.add(this.foam)
  }

  buildRoads() {
    const asphalt = []
    const paint = []

    const strip = (ax, az, bx, bz, width, height, offset, list) => {
      const dx = bx - ax
      const dz = bz - az
      const length = Math.hypot(dx, dz)
      const box = new THREE.BoxGeometry(width, height, length)
      // shift sideways (for edge lines), then align with the segment
      box.translate(offset, height / 2, 0)
      box.rotateY(Math.atan2(dx, dz))
      box.translate((ax + bx) / 2, 0, (az + bz) / 2)
      list.push(box)
    }

    for (const [ax, az, bx, bz] of ROADS) {
      strip(ax, az, bx, bz, ROAD_WIDTH, 0.04, 0, asphalt)
      strip(ax, az, bx, bz, 0.2, 0.06, ROAD_WIDTH / 2 - 0.45, paint)
      strip(ax, az, bx, bz, 0.2, 0.06, -(ROAD_WIDTH / 2 - 0.45), paint)

      // centre dashes
      const length = Math.hypot(bx - ax, bz - az)
      const count = Math.floor(length / 5)
      for (let i = 0; i < count; i++) {
        const t0 = (i * 5 + 1.4) / length
        const t1 = (i * 5 + 3.6) / length
        strip(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, 0.3, 0.06, 0, paint)
      }
    }

    const roads = new THREE.Mesh(mergeGeometries(asphalt), new THREE.MeshStandardMaterial({ color: '#4a4d63', roughness: 0.9 }))
    const lines = new THREE.Mesh(mergeGeometries(paint), new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 0.8 }))
    roads.receiveShadow = true
    lines.receiveShadow = true
    this.scene.add(roads, lines)
    asphalt.concat(paint).forEach((g) => g.dispose())
  }

  buildBowlingLane() {
    const { x, zStart, zPins, width } = BOWLING
    const length = zStart - zPins + 8
    const centreZ = (zStart + zPins - 8) / 2 + 2

    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.06, length),
      new THREE.MeshStandardMaterial({ color: '#d9a86c', roughness: 0.6 }),
    )
    lane.position.set(x, 0.03, centreZ)
    lane.receiveShadow = true
    this.scene.add(lane)

    const gutterMaterial = new THREE.MeshStandardMaterial({ color: '#3d405b', roughness: 0.8 })
    for (const side of [-1, 1]) {
      const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, length), gutterMaterial)
      gutter.position.set(x + side * (width / 2 + 0.45), 0.04, centreZ)
      gutter.receiveShadow = true
      this.scene.add(gutter)
    }

    // aiming arrows
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: '#8c5a2b', roughness: 0.6 })
    const arrowGeometry = new THREE.ConeGeometry(0.35, 1, 3).rotateX(-Math.PI / 2).scale(1, 0.05, 1)
    for (let i = -2; i <= 2; i++) {
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
      arrow.position.set(x + i * 1.05, 0.08, zPins + 12 + Math.abs(i) * 1.2)
      this.scene.add(arrow)
    }

    // back wall behind the pins, so they stay on the island
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width + 2.4, 1.4, 0.6), gutterMaterial)
    wall.position.set(x, 0.7, zPins - 5.5)
    wall.castShadow = true
    this.scene.add(wall)
    this.physics.addBox(x, zPins - 5.5, width + 2.4, 0.6, 0, 1.4)

    const { texture, aspect } = createDecalTexture({ text: 'BOWLING', color: '#ffffff', size: 110 })
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 5.4 / aspect).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    )
    label.position.set(x, 0.09, zStart - 2)
    this.scene.add(label)
  }

  // Is this spot clear of roads, plazas, the bowling lane and other scenery?
  isFree(x, z, spacing) {
    if (Math.hypot(x, z) > ISLAND_RADIUS - 1.5) return false
    if (isInsideZone(x, z, 3 + spacing)) return false
    for (const [ax, az, bx, bz] of ROADS) {
      if (distanceToSegment(x, z, ax, az, bx, bz) < ROAD_WIDTH / 2 + 2 + spacing) return false
    }
    const { x: lx, zStart, zPins, width } = BOWLING
    if (Math.abs(x - lx) < width / 2 + 3 + spacing && z > zPins - 8 && z < zStart + 9) return false
    for (const p of this.placed) {
      const min = p.spacing + spacing
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < min * min) return false
    }
    return true
  }

  scatter(count, spacing, { minRadius = 6, maxRadius = ISLAND_RADIUS, attempts = 40 } = {}) {
    const spots = []
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < attempts; tries++) {
        const angle = this.random.next() * Math.PI * 2
        const radius = Math.sqrt(this.random.range((minRadius / maxRadius) ** 2, 1)) * maxRadius
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        if (!this.isFree(x, z, spacing)) continue
        this.placed.push({ x, z, spacing })
        spots.push({ x, z })
        break
      }
    }
    return spots
  }

  buildLamps() {
    const spots = []
    for (const [ax, az, bx, bz] of ROADS) {
      const length = Math.hypot(bx - ax, bz - az)
      const nx = -(bz - az) / length
      const nz = (bx - ax) / length
      let side = 1
      for (let d = 10; d < length; d += 16) {
        const x = ax + ((bx - ax) * d) / length + nx * side * (ROAD_WIDTH / 2 + 1.1)
        const z = az + ((bz - az) * d) / length + nz * side * (ROAD_WIDTH / 2 + 1.1)
        side *= -1
        if (isInsideZone(x, z, 2)) continue
        spots.push({ x, z })
        this.placed.push({ x, z, spacing: 1 })
        this.physics.addCircle(x, z, 0.25, 4.5)
      }
    }

    const post = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.08, 0.12, 4.4, 6).translate(0, 2.2, 0),
      new THREE.MeshStandardMaterial({ color: '#3d405b', roughness: 0.6 }),
      spots.length,
    )
    const head = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.6, 0.22, 0.6).translate(0, 4.5, 0),
      new THREE.MeshStandardMaterial({ color: '#3d405b', roughness: 0.6 }),
      spots.length,
    )
    this.bulbMaterial = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffcf70', emissiveIntensity: 0.15 })
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8).translate(0, 4.3, 0), this.bulbMaterial, spots.length)
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: '#ffcf70',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const glow = new THREE.InstancedMesh(new THREE.ConeGeometry(2.3, 4.2, 18, 1, true).translate(0, 2.1, 0), this.glowMaterial, spots.length)
    glow.visible = false

    const matrix = new THREE.Matrix4()
    spots.forEach(({ x, z }, i) => {
      matrix.makeTranslation(x, 0, z)
      for (const mesh of [post, head, bulb, glow]) mesh.setMatrixAt(i, matrix)
    })
    post.castShadow = true
    head.castShadow = true
    this.glow = glow
    this.scene.add(post, head, bulb, glow)
  }

  buildTrees() {
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1.8, 6).translate(0, 0.9, 0)
    const roundGeometry = new THREE.IcosahedronGeometry(1.5, 0).scale(1, 1.12, 1).translate(0, 2.9, 0)
    const pineGeometry = mergeGeometries([
      new THREE.ConeGeometry(1.5, 2.6, 7).translate(0, 2.6, 0),
      new THREE.ConeGeometry(1.1, 2.1, 7).translate(0, 3.9, 0),
    ])

    const spots = [
      ...this.scatter(150, 2.4, { minRadius: 26 }),
      ...this.scatter(70, 2.2, { minRadius: 104 }), // a denser belt along the coast
    ]
    const leafMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true })
    const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.9 }), spots.length)
    const round = new THREE.InstancedMesh(roundGeometry, leafMaterial, spots.length)
    const pines = new THREE.InstancedMesh(pineGeometry, leafMaterial, spots.length)
    const palette = ['#4f9a4a', '#5fae4f', '#3f8a46', '#77b84f', '#2f7a45'].map((c) => new THREE.Color(c))

    const dummy = new THREE.Object3D()
    let roundCount = 0
    let pineCount = 0
    spots.forEach(({ x, z }, i) => {
      const scale = this.random.range(0.8, 1.35)
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, this.random.next() * Math.PI * 2, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      trunks.setMatrixAt(i, dummy.matrix)

      const isPine = this.random.next() < 0.4
      const target = isPine ? pines : round
      const index = isPine ? pineCount++ : roundCount++
      target.setMatrixAt(index, dummy.matrix)
      target.setColorAt(index, this.random.pick(palette))

      this.physics.addCircle(x, z, 0.4 * scale, 4)
    })
    round.count = roundCount
    pines.count = pineCount

    for (const mesh of [trunks, round, pines]) {
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }
  }

  buildRocks() {
    const spots = [
      ...this.scatter(34, 1.8, { minRadius: 30 }),
      ...this.scatter(18, 1.6, { minRadius: 119, maxRadius: 127 }),
    ]
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
      spots.length,
    )
    const palette = ['#9aa0a6', '#8a8f96', '#b0aca4'].map((c) => new THREE.Color(c))
    const dummy = new THREE.Object3D()
    spots.forEach(({ x, z }, i) => {
      const size = this.random.range(0.6, 1.5)
      dummy.position.set(x, size * 0.25, z)
      dummy.rotation.set(this.random.next(), this.random.next() * 6, this.random.next())
      dummy.scale.set(size * this.random.range(1, 1.5), size * this.random.range(0.6, 0.9), size)
      dummy.updateMatrix()
      rocks.setMatrixAt(i, dummy.matrix)
      rocks.setColorAt(i, this.random.pick(palette))
      this.physics.addCircle(x, z, size * 0.95, 2)
    })
    rocks.castShadow = true
    rocks.receiveShadow = true
    this.scene.add(rocks)
  }

  // Grass tufts and flowers: purely decorative, the car drives straight through them.
  buildGroundCover() {
    const dummy = new THREE.Object3D()
    const free = (x, z) => {
      if (Math.hypot(x, z) > ISLAND_RADIUS - 2 || isInsideZone(x, z, 1)) return false
      return ROADS.every(([ax, az, bx, bz]) => distanceToSegment(x, z, ax, az, bx, bz) > ROAD_WIDTH / 2 + 0.6)
    }
    const sample = (count) => {
      const spots = []
      while (spots.length < count) {
        const angle = this.random.next() * Math.PI * 2
        const radius = Math.sqrt(this.random.next()) * ISLAND_RADIUS
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        if (free(x, z)) spots.push({ x, z })
      }
      return spots
    }

    const tuftGeometry = mergeGeometries([
      new THREE.ConeGeometry(0.12, 0.7, 3).translate(0, 0.35, 0),
      new THREE.ConeGeometry(0.1, 0.55, 3).rotateZ(0.35).translate(0.16, 0.26, 0.05),
      new THREE.ConeGeometry(0.1, 0.5, 3).rotateZ(-0.35).translate(-0.15, 0.24, -0.05),
    ])
    const tuftSpots = sample(700)
    const tufts = new THREE.InstancedMesh(tuftGeometry, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), tuftSpots.length)
    const greens = ['#6ea548', '#7fb653', '#5b9440'].map((c) => new THREE.Color(c))
    tuftSpots.forEach(({ x, z }, i) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, this.random.next() * 6, 0)
      dummy.scale.setScalar(this.random.range(0.8, 1.5))
      dummy.updateMatrix()
      tufts.setMatrixAt(i, dummy.matrix)
      tufts.setColorAt(i, this.random.pick(greens))
    })
    this.scene.add(tufts)

    const flowerSpots = sample(320)
    const flowers = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.16, 0).translate(0, 0.32, 0),
      new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.7 }),
      flowerSpots.length,
    )
    const petals = ['#ffffff', '#ffd166', '#f78fb3', '#c3a6ff'].map((c) => new THREE.Color(c))
    flowerSpots.forEach(({ x, z }, i) => {
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(this.random.range(0.8, 1.3))
      dummy.updateMatrix()
      flowers.setMatrixAt(i, dummy.matrix)
      flowers.setColorAt(i, this.random.pick(petals))
    })
    this.scene.add(flowers)
  }

  buildBoats() {
    const hullMaterial = new THREE.MeshStandardMaterial({ color: '#f7f3ea', roughness: 0.5, flatShading: true })
    const trimMaterial = new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.5 })
    const sailMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide })
    const hullGeometry = new THREE.CylinderGeometry(1.1, 0.7, 0.9, 6, 1).scale(1, 1, 2.6)
    const sailShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(2.4, 0), new THREE.Vector2(0, 4.6)])

    this.boats = [0.4, 1.9, 3.3, 4.8].map((angle, i) => {
      const boat = new THREE.Group()
      const hull = new THREE.Mesh(hullGeometry, hullMaterial)
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 5.2), trimMaterial)
      trim.position.y = 0.36
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5), trimMaterial)
      mast.position.y = 2.6
      const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), sailMaterial)
      sail.position.set(0, 0.6, 0.1)
      sail.rotation.y = Math.PI / 2
      boat.add(hull, trim, mast, sail)
      boat.traverse((child) => (child.castShadow = true))
      const radius = 148 + i * 6
      boat.position.set(Math.cos(angle) * radius, WATER_LEVEL, Math.sin(angle) * radius)
      boat.rotation.y = -angle
      this.scene.add(boat)
      return { boat, phase: i * 1.7 }
    })
  }

  setNight(amount) {
    this.bulbMaterial.emissiveIntensity = 0.15 + amount * 3
    this.glowMaterial.opacity = amount * 0.16
    this.glow.visible = amount > 0.02
  }

  update(elapsed) {
    this.waterUniforms.uTime.value = elapsed
    this.foam.material.opacity = 0.35 + Math.sin(elapsed * 1.3) * 0.15
    for (const { boat, phase } of this.boats) {
      boat.position.y = WATER_LEVEL + Math.sin(elapsed * 1.2 + phase) * 0.25
      boat.rotation.z = Math.sin(elapsed * 0.9 + phase) * 0.06
    }
  }
}
