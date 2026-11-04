// The nine cars you can drive. Each one is a recipe for `buildCarBody` in Car.js:
// `shape` picks the body style, `paint` and `trim` the colours, and the rest are
// optional extras. Handling is the same for every car; only the look changes.
//
// `tagline` is painted on the car's board in the Garage.

export const cars = [
  {
    id: 'racer',
    name: 'Racer',
    tagline: 'The original. Quick, red, stripes for luck.',
    shape: 'coupe',
    paint: '#ff5a4e',
    trim: '#f7f3ea',
    stripes: true,
    spoiler: true,
  },
  {
    id: 'taxi',
    name: 'Taxi',
    tagline: 'Checkered band, roof sign, always on duty.',
    shape: 'sedan',
    paint: '#f5c518',
    trim: '#1d1d1d',
    roofSign: 'TAXI',
    checkers: true,
  },
  {
    id: 'police',
    name: 'Police',
    tagline: 'Blue and red lights that really flash.',
    shape: 'sedan',
    paint: '#f4f4f4',
    trim: '#1d3a8a',
    lightBar: true,
    sideBand: '#1d3a8a',
  },
  {
    id: 'pickup',
    name: 'Pickup',
    tagline: 'An open bed and room for the crates.',
    shape: 'pickup',
    paint: '#3f6fb5',
    trim: '#2b2d42',
    chunkyTyres: true,
  },
  {
    id: 'van',
    name: 'Camper Van',
    tagline: 'Two-tone, roof rack, zero hurry.',
    shape: 'van',
    paint: '#8fd3c8',
    trim: '#fff8ec',
    roofRack: true,
    twoTone: true,
  },
  {
    id: 'jeep',
    name: 'Jeep',
    tagline: 'Roll cage, spare wheel, off-road tyres.',
    shape: 'jeep',
    paint: '#6b8e4e',
    trim: '#2b2d42',
    chunkyTyres: true,
    spareWheel: true,
  },
  {
    id: 'supercar',
    name: 'Supercar',
    tagline: 'Low, wide and very, very orange.',
    shape: 'supercar',
    paint: '#ff8c1a',
    trim: '#1d1d1d',
    spoiler: true,
  },
  {
    id: 'bug',
    name: 'Bug',
    tagline: 'Round, cheerful and purple.',
    shape: 'bug',
    paint: '#b57bee',
    trim: '#fff8ec',
  },
  {
    id: 'limo',
    name: 'Limo',
    tagline: 'Stretched, black and far too long for the pads.',
    shape: 'limo',
    paint: '#1d1d1d',
    trim: '#c9c9c9',
  },
]

export const DEFAULT_CAR = 'racer'

export const carById = Object.fromEntries(cars.map((car) => [car.id, car]))
