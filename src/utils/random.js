// Small seeded random generator (mulberry32), so trees and rocks land in
// the same places on every visit.
export function createRandom(seed = 1) {
  let state = seed >>> 0

  const next = () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    pick: (list) => list[Math.floor(next() * list.length)],
  }
}
