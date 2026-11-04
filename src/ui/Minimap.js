import { BOWLING, GARAGE, ISLAND_RADIUS, ROADS, ROAD_WIDTH, SPAWN_PLAZA, ZONES } from '../world/layout.js'

const VIEW_RADIUS = 134 // world metres from the centre to the edge of the map

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.visited = new Set()
    this.carColor = '#ff5a4e'
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  resize() {
    const size = this.canvas.clientWidth || 160
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.size = size
    this.scale = size / 2 / VIEW_RADIUS
    this.canvas.width = Math.round(size * this.dpr)
    this.canvas.height = Math.round(size * this.dpr)
    this.background = this.paintBackground()
  }

  toMap(x, z) {
    return [this.size / 2 + x * this.scale, this.size / 2 + z * this.scale]
  }

  paintBackground() {
    const canvas = document.createElement('canvas')
    canvas.width = this.canvas.width
    canvas.height = this.canvas.height
    const ctx = canvas.getContext('2d')
    ctx.scale(this.dpr, this.dpr)
    const s = this.scale
    const half = this.size / 2

    ctx.fillStyle = '#3aaed8'
    ctx.fillRect(0, 0, this.size, this.size)
    const circle = (x, z, r, fill) => {
      const [cx, cy] = this.toMap(x, z)
      ctx.beginPath()
      ctx.arc(cx, cy, r * s, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
    }
    circle(0, 0, 128, '#f0d9a6')
    circle(0, 0, ISLAND_RADIUS, '#86b75a')

    ctx.strokeStyle = '#4a4d63'
    ctx.lineWidth = ROAD_WIDTH * s
    ctx.lineCap = 'round'
    for (const [ax, az, bx, bz] of ROADS) {
      ctx.beginPath()
      ctx.moveTo(half + ax * s, half + az * s)
      ctx.lineTo(half + bx * s, half + bz * s)
      ctx.stroke()
    }

    const [lx, lz] = this.toMap(BOWLING.x - BOWLING.width / 2, BOWLING.zPins - 4)
    ctx.fillStyle = '#d9a86c'
    ctx.fillRect(lx, lz, BOWLING.width * s, (BOWLING.zStart - BOWLING.zPins + 4) * s)

    for (const zone of [SPAWN_PLAZA, ...ZONES, GARAGE]) {
      ctx.fillStyle = '#efe6d2'
      ctx.strokeStyle = zone.color
      ctx.lineWidth = 2
      ctx.beginPath()
      if (zone.shape === 'rect') {
        const [x, z] = this.toMap(zone.x - zone.w / 2, zone.z - zone.d / 2)
        ctx.rect(x, z, zone.w * s, zone.d * s)
      } else {
        const [x, z] = this.toMap(zone.x, zone.z)
        ctx.arc(x, z, zone.r * s, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.stroke()
    }
    return canvas
  }

  draw(car) {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.size, this.size)
    ctx.drawImage(this.background, 0, 0, this.size, this.size)

    ctx.font = '700 8px "Inter Variable", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const compact = this.size < 140
    for (const zone of ZONES) {
      const [x, y] = this.toMap(zone.x, zone.z)
      const seen = this.visited.has(zone.id)
      if (compact) {
        ctx.beginPath()
        ctx.arc(x, y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = seen ? zone.color : '#ffffff'
        ctx.strokeStyle = zone.color
        ctx.lineWidth = 1.5
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.fillStyle = seen ? zone.color : 'rgba(43, 45, 66, 0.75)'
        ctx.fillText(zone.mapLabel, x, y)
      }
    }

    const [cx, cy] = this.toMap(car.position.x, car.position.z)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-car.heading)
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.lineTo(5, 5.5)
    ctx.lineTo(0, 3)
    ctx.lineTo(-5, 5.5)
    ctx.closePath()
    ctx.fillStyle = this.carColor
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.6
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}
