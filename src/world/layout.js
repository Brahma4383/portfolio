// The map of the island. Ground, roads, decorations, zones and the minimap all
// read positions from here so they always agree with each other.
//
// Coordinates are metres on the ground plane: +x is east (right on screen),
// +z is south (towards the camera). The car starts in the middle, facing north.

export const ISLAND_RADIUS = 118 // where the grass ends and the beach begins
export const DRIVE_RADIUS = 124 // invisible wall on the beach

export const SPAWN = { x: 0, z: 6, heading: 0 }

export const ROAD_WIDTH = 7

// `dock` is where the car is placed when you jump to a zone from the menu:
// just inside the zone on its approach road, so the info panel opens straight away.
export const ZONES = [
  { id: 'about', mapLabel: 'ABOUT', label: 'About', color: '#e76f51', shape: 'circle', x: -56, z: -46, r: 17, dock: [-46, -38] },
  { id: 'testing', mapLabel: 'QA LAB', label: 'Test Lab', color: '#3f9b5a', shape: 'circle', x: 84, z: -14, r: 18, dock: [69, -11.5] },
  { id: 'skills', mapLabel: 'SKILLS', label: 'Skills', color: '#2b8fbd', shape: 'circle', x: 58, z: -46, r: 18, dock: [47, -37] },
  { id: 'projects', mapLabel: 'PROJECTS', label: 'Projects', color: '#f08a24', shape: 'rect', x: 68, z: 31, w: 60, d: 46, dock: [41, 28.5] },
  { id: 'experience', mapLabel: 'JOB', label: 'Experience', color: '#7b5ea7', shape: 'circle', x: 24, z: 78, r: 18, dock: [9, 78] },
  { id: 'education', mapLabel: 'STUDY', label: 'Education', color: '#d1495b', shape: 'circle', x: -28, z: 78, r: 18, dock: [-13, 78] },
  { id: 'contact', mapLabel: 'CONTACT', label: 'Contact', color: '#2a9d8f', shape: 'circle', x: -78, z: 0, r: 20, dock: [-61, 0] },
]

export const SPAWN_PLAZA = { id: 'spawn', shape: 'circle', x: 0, z: 0, r: 24, color: '#2b2d42' }

// Straight road segments [ax, az, bx, bz]. Plazas are drawn on top of the ends.
export const ROADS = [
  [0, 0, -56, -46],
  [0, 0, 58, -46],
  [0, 0, 40, 31],
  [0, 0, -78, 0],
  [0, 0, 84, -14],
  [0, 0, 0, 78],
  [-28, 78, 24, 78],
  [0, 0, 0, -56],
]

// A little bowling lane to the south-west, just for fun.
export const BOWLING = { x: -38, zStart: 54, zPins: 25, width: 6, dock: [-38, 60] }

// The Garage: nine car boards with a pad in front of each. Park on a pad to switch cars.
// It isn't one of the portfolio zones, so it doesn't count towards "explored".
// `uiColor` is a lighter shade for the dark info panel and menu, where the slate wouldn't show.
export const GARAGE = { id: 'garage', label: 'Garage', color: '#3d405b', uiColor: '#a3acd9', shape: 'rect', x: 0, z: -56, w: 58, d: 50, dock: [0, -35] }

// Areas where trees and rocks must not grow (plazas, roads and the lane are checked separately).
export function isInsideZone(x, z, margin = 0) {
  for (const zone of [SPAWN_PLAZA, ...ZONES, GARAGE]) {
    if (zone.shape === 'rect') {
      if (Math.abs(x - zone.x) < zone.w / 2 + margin && Math.abs(z - zone.z) < zone.d / 2 + margin) return true
    } else if (Math.hypot(x - zone.x, z - zone.z) < zone.r + margin) {
      return true
    }
  }
  return false
}
