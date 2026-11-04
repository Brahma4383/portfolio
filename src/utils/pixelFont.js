import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// A tiny 7-row pixel font. Every '#' becomes one cube, which gives the big
// letters in the world their chunky, toy-like look (and lets the car knock them over).
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
}

const ROWS = 7

const glyphFor = (char) => GLYPHS[char.toUpperCase()] ?? GLYPHS[' ']

// Positions each character of `text` along the x axis, centred on 0.
export function layoutText(text, pixel, spacing) {
  const letters = []
  let cursor = 0
  for (const char of text) {
    const width = glyphFor(char)[0].length * pixel
    letters.push({ char, x: cursor + width / 2, width })
    cursor += width + spacing
  }
  const total = cursor - spacing
  letters.forEach((letter) => (letter.x -= total / 2))
  return { letters, width: total, height: ROWS * pixel }
}

// Builds one merged geometry for a character, centred on its own middle,
// or returns null for characters with no pixels (spaces).
export function createGlyphGeometry(char, pixel, depth) {
  const rows = glyphFor(char)
  const cols = rows[0].length
  const width = cols * pixel
  const height = ROWS * pixel
  const size = pixel * 0.94
  const cubes = []

  rows.forEach((row, r) => {
    for (let c = 0; c < cols; c++) {
      if (row[c] !== '#') continue
      const cube = new THREE.BoxGeometry(size, size, depth)
      cube.translate(-width / 2 + (c + 0.5) * pixel, height / 2 - (r + 0.5) * pixel, 0)
      cubes.push(cube)
    }
  })

  if (!cubes.length) return null
  const geometry = mergeGeometries(cubes)
  cubes.forEach((cube) => cube.dispose())
  return geometry
}
