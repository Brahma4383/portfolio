import { createRadar } from './Radar.js'

// Metres from the car to the radar's outer ring. The Test Lab's bugs roam within
// about 8 m of its middle, so from anywhere in the lab most of them are in range.
const RANGE = 22
const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

// The bug radar in the Test Lab's info panel: the car is at the centre and north is
// up (the camera always looks north, so up on the radar is up on the screen). Every
// bug still loose shows as a red blip once the sweep passes over it; one that's been
// squashed fades away. Next to it: how many are left and where the nearest one is.
// One radar is made the first time the panel opens and moved into the panel each
// time it opens again, so the page never piles up WebGL contexts.
export class BugRadar {
  constructor() {
    this.radar = createRadar({
      color: '#4cbb6c',
      contactColor: '#ff5a4e',
      speed: 1.6,
      trail: 0.4,
      scale: 0.92,
      ringCount: 4,
      spokeCount: 8,
      clutter: 0.12,
      grain: 0.02,
      fade: 0.3, // the glow would otherwise stop in a hard square at the canvas edges
      mouseInteraction: false,
    })
    this.host = null
    this.shown = {}
  }

  // `host` is the panel's [data-bug-radar] block (a new one each time the panel opens).
  mount(host) {
    this.host = host
    this.shown = {}
    host.querySelector('.bug-radar__screen').append(this.radar.element)
    host.dataset.state = this.radar.ready ? 'ready' : 'error'
    this.radar.replayIntro()
  }

  update(bugHunt, car) {
    const contacts = []
    let nearest = null
    bugHunt.bugs.forEach((bug, id) => {
      if (bug.state !== 'alive') return
      const dx = bug.group.position.x - car.position.x
      const dz = bug.group.position.z - car.position.z
      const distance = Math.hypot(dx, dz)
      if (!nearest || distance < nearest.distance) nearest = { dx, dz, distance }
      // east is +x and north is -z in the world; right and up on the radar
      if (distance < RANGE * 0.96) contacts.push({ id, x: dx / RANGE, y: -dz / RANGE })
    })
    this.radar.setContacts(contacts)

    const total = bugHunt.bugs.length
    const left = total - bugHunt.fixed
    this.show('left', String(left), (value) => (this.host.dataset.left = value))
    this.show('count', left ? `${left} of ${total} bugs left` : `All ${total} bugs fixed ✓`)
    this.show('nearest', left ? describe(nearest) : 'Ready for release. A new batch turns up once you leave the lab.')
  }

  // Writes to the page only when something changed (update() runs every frame).
  show(key, value, write = (text) => (this.host.querySelector(`.bug-radar__${key}`).textContent = text)) {
    if (this.shown[key] === value) return
    this.shown[key] = value
    write(value)
  }
}

// "Nearest: 6 m north-east", from the car to the closest bug.
function describe({ dx, dz, distance }) {
  if (distance < 3) return 'Nearest: right under your wheels!'
  const bearing = Math.atan2(dx, -dz) // 0 is north, turning towards east
  const direction = DIRECTIONS[((Math.round(bearing / (Math.PI / 4)) % 8) + 8) % 8]
  return `Nearest: ${Math.round(distance)} m ${direction}`
}
