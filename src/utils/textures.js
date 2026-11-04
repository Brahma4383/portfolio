import * as THREE from 'three'

// All text in the 3D world is painted onto canvases and used as textures.
// The fonts are the same ones the HTML overlay uses (loaded in main.js before
// the world is built, so the canvases never fall back to a system font).

export const HEADING_FONT = '"Space Grotesk Variable", "Segoe UI", system-ui, sans-serif'
export const BODY_FONT = '"Inter Variable", "Segoe UI", system-ui, sans-serif'

export const INK = '#2b2d42'
const INK_SOFT = '#4a4e69'
const PAPER = '#fffaf2'

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return { canvas, ctx: canvas.getContext('2d') }
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Shrinks the font until `text` fits in `maxWidth`. Returns the size used.
function fitFont(ctx, text, { size, weight, family, maxWidth, min = 12 }) {
  let current = size
  ctx.font = `${weight} ${current}px ${family}`
  while (ctx.measureText(text).width > maxWidth && current > min) {
    current -= 2
    ctx.font = `${weight} ${current}px ${family}`
  }
  return current
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = attempt
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawChips(ctx, tags, { x, y, height, color, background, font, maxX = Infinity }) {
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  let cursor = x
  for (const tag of tags) {
    const width = ctx.measureText(tag).width + height * 0.9
    if (cursor + width > maxX) break
    ctx.fillStyle = background
    ctx.beginPath()
    ctx.roundRect(cursor, y, width, height, height / 2)
    ctx.fill()
    ctx.fillStyle = color
    ctx.fillText(tag, cursor + height * 0.45, y + height / 2 + 1)
    cursor += width + 14
  }
}

function withAlpha(hex, alpha) {
  const color = new THREE.Color(hex)
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`
}

// The angled info boards: projects, the About board and the certificates.
// Smaller boards use a lower `resolution` so their text comes out relatively bigger.
export function createBoardTexture({ eyebrow, title, body, tags = [], accent, index, aspect, resolution = 1024 }) {
  const width = resolution
  const height = Math.round(width / aspect)
  const { canvas, ctx } = makeCanvas(width, height)
  const pad = 58

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, width, 18)

  if (index) {
    ctx.font = `700 150px ${HEADING_FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = withAlpha(accent, 0.16)
    ctx.fillText(index, width - pad + 10, 170)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.letterSpacing = '4px'
  ctx.font = `700 30px ${BODY_FONT}`
  ctx.fillStyle = accent
  ctx.fillText(eyebrow.toUpperCase(), pad, 96)
  ctx.letterSpacing = '0px'

  const titleSize = fitFont(ctx, title, {
    size: 86,
    weight: 700,
    family: HEADING_FONT,
    maxWidth: width - pad * 2 - (index ? 120 : 0),
  })
  ctx.fillStyle = INK
  const titleY = 96 + 24 + titleSize * 0.92
  ctx.fillText(title, pad, titleY)

  ctx.font = `500 40px ${BODY_FONT}`
  ctx.fillStyle = INK_SOFT
  const lines = wrapLines(ctx, body, width - pad * 2).slice(0, 4)
  lines.forEach((line, i) => ctx.fillText(line, pad, titleY + 74 + i * 54))

  if (tags.length) {
    drawChips(ctx, tags, {
      x: pad,
      y: height - pad - 58,
      height: 58,
      color: '#ffffff',
      background: accent,
      font: `600 30px ${BODY_FONT}`,
    })
  }

  return toTexture(canvas)
}

const TESTED_GREEN = '#3f9b5a'

// Project boards: what the project is, then two rows of chips,
// first what it was built with and then what it was tested with.
export function createProjectBoardTexture({ eyebrow, title, built, tested, accent, index, aspect }) {
  const width = 1024
  const height = Math.round(width / aspect)
  const { canvas, ctx } = makeCanvas(width, height)
  const pad = 58

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, width, 18)

  ctx.font = `700 150px ${HEADING_FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = withAlpha(accent, 0.16)
  ctx.fillText(index, width - pad + 10, 170)

  ctx.textAlign = 'left'
  ctx.letterSpacing = '4px'
  ctx.font = `700 30px ${BODY_FONT}`
  ctx.fillStyle = accent
  ctx.fillText(eyebrow.toUpperCase(), pad, 96)
  ctx.letterSpacing = '0px'

  const titleSize = fitFont(ctx, title, { size: 80, weight: 700, family: HEADING_FONT, maxWidth: width - pad * 2 - 120 })
  ctx.fillStyle = INK
  const titleY = 96 + 22 + titleSize * 0.92
  ctx.fillText(title, pad, titleY)

  const row = (label, color, tags, y) => {
    ctx.beginPath()
    ctx.arc(pad + 17, y - 10, 17, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 22px ${BODY_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label[0], pad + 17, y - 9)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.letterSpacing = '4px'
    ctx.font = `700 28px ${BODY_FONT}`
    ctx.fillStyle = color
    ctx.fillText(label.slice(1).trim(), pad + 48, y)
    ctx.letterSpacing = '0px'

    drawChips(ctx, tags, {
      x: pad,
      y: y + 18,
      height: 60,
      color: '#ffffff',
      background: color,
      font: `600 32px ${BODY_FONT}`,
      maxX: width - pad,
    })
  }
  row('1 BUILT WITH', INK, built, titleY + 66)
  row('2 TESTED WITH', TESTED_GREEN, tested, titleY + 66 + 140)

  return toTexture(canvas)
}

// Direction signs on the start plaza. `direction` is a ground vector (x, z);
// on screen +x is right and +z is down, which matches canvas coordinates.
export function createSignTexture({ label, color, direction }) {
  const { canvas, ctx } = makeCanvas(512, 160)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(0, 0, 512, 160, 26)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  fitFont(ctx, label, { size: 58, weight: 700, family: HEADING_FONT, maxWidth: 330 })
  ctx.fillText(label, 34, 84)

  // arrow
  const angle = Math.atan2(direction.z, direction.x)
  ctx.save()
  ctx.translate(436, 80)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(-38, -10)
  ctx.lineTo(8, -10)
  ctx.lineTo(8, -28)
  ctx.lineTo(42, 0)
  ctx.lineTo(8, 28)
  ctx.lineTo(8, 10)
  ctx.lineTo(-38, 10)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  return toTexture(canvas)
}

// A skill crate: wooden frame in the group's colour with a cream label plate across
// the middle, so the skill reads clearly even when the crate is small on screen.
// Labels of two or more words that are long go on two lines; long single words are
// narrowed a little (as on road signs) rather than shrunk.
export function createCrateTexture({ label, color }) {
  const size = 512
  const { canvas, ctx } = makeCanvas(size, size)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)

  // plank frame
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.lineWidth = 32
  ctx.strokeRect(16, 16, size - 32, size - 32)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 6
  ctx.strokeRect(40, 40, size - 80, size - 80)

  const words = label.split(' ')
  const lines = words.length > 1 && label.length > 8 ? words : [label]

  // label plate
  const plate = { x: 40, width: size - 80, height: lines.length > 1 ? 300 : 210 }
  plate.y = (size - plate.height) / 2
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
  ctx.beginPath()
  ctx.roundRect(plate.x, plate.y + 8, plate.width, plate.height, 28)
  ctx.fill()
  ctx.fillStyle = PAPER
  ctx.beginPath()
  ctx.roundRect(plate.x, plate.y, plate.width, plate.height, 28)
  ctx.fill()

  // Fit the widest line to the plate: up to 30% of the way by narrowing the letters,
  // the rest by making them smaller.
  const maxWidth = plate.width - 48
  const target = lines.length > 1 ? 112 : 124
  ctx.font = `700 ${target}px ${HEADING_FONT}`
  const fit = Math.min(1, maxWidth / Math.max(...lines.map((line) => ctx.measureText(line).width)))
  const squeeze = Math.max(0.7, fit)
  const fontSize = (target * fit) / squeeze
  ctx.font = `700 ${fontSize}px ${HEADING_FONT}`
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lineHeight = fontSize * 1.05
  lines.forEach((line, i) => {
    ctx.save()
    ctx.translate(size / 2, size / 2 + 4 + (i - (lines.length - 1) / 2) * lineHeight)
    ctx.scale(squeeze, 1)
    ctx.fillText(line, 0, 0)
    ctx.restore()
  })

  return toTexture(canvas)
}

// Text painted flat on the ground. Returns the texture and its width/height ratio
// so the plane it goes on can keep the right proportions.
export function createDecalTexture({ text, color = INK, size = 96, weight = 700, font = HEADING_FONT, letterSpacing = 6 }) {
  const probe = makeCanvas(8, 8).ctx
  probe.font = `${weight} ${size}px ${font}`
  probe.letterSpacing = `${letterSpacing}px`
  const width = Math.ceil(probe.measureText(text).width + size)
  const height = Math.ceil(size * 1.5)

  const { canvas, ctx } = makeCanvas(width, height)
  ctx.font = `${weight} ${size}px ${font}`
  ctx.letterSpacing = `${letterSpacing}px`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2 + size * 0.06)

  return { texture: toTexture(canvas), aspect: width / height }
}

export function createKeyTexture(label, { width = 128 } = {}) {
  const { canvas, ctx } = makeCanvas(width, 128)
  ctx.fillStyle = '#fbfaf7'
  ctx.fillRect(0, 0, width, 128)
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  fitFont(ctx, label, { size: label.length > 1 ? 40 : 64, weight: 700, family: HEADING_FONT, maxWidth: width - 24 })
  ctx.fillText(label, width / 2, 68)
  return toTexture(canvas)
}

const PAD_ICONS = {
  github(ctx) {
    // a code glyph: </>
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(-26, -34)
    ctx.lineTo(-60, 0)
    ctx.lineTo(-26, 34)
    ctx.moveTo(26, -34)
    ctx.lineTo(60, 0)
    ctx.lineTo(26, 34)
    ctx.moveTo(10, -46)
    ctx.lineTo(-10, 46)
    ctx.stroke()
  },
  linkedin(ctx, color) {
    ctx.beginPath()
    ctx.roundRect(-56, -56, 112, 112, 22)
    ctx.fill()
    ctx.fillStyle = color
    ctx.font = `800 82px ${BODY_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('in', 2, 4)
  },
  email(ctx) {
    ctx.lineWidth = 12
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.roundRect(-64, -44, 128, 88, 12)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-58, -36)
    ctx.lineTo(0, 10)
    ctx.lineTo(58, -36)
    ctx.stroke()
  },
  resume(ctx) {
    ctx.lineWidth = 12
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(-42, -60)
    ctx.lineTo(18, -60)
    ctx.lineTo(44, -34)
    ctx.lineTo(44, 60)
    ctx.lineTo(-42, 60)
    ctx.closePath()
    ctx.stroke()
    ctx.lineWidth = 9
    ctx.beginPath()
    for (const y of [-18, 6, 30]) {
      ctx.moveTo(-22, y)
      ctx.lineTo(24, y)
    }
    ctx.stroke()
  },
}

export function createPadTexture({ id, label, value, color }) {
  const { canvas, ctx } = makeCanvas(512, 400)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 512, 400)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.lineWidth = 10
  ctx.strokeRect(18, 18, 476, 364)

  ctx.save()
  ctx.translate(256, 140)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  PAD_ICONS[id]?.(ctx, color)
  ctx.restore()

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 64px ${HEADING_FONT}`
  ctx.fillText(label, 256, 286)
  fitFont(ctx, value, { size: 30, weight: 500, family: BODY_FONT, maxWidth: 440 })
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillText(value, 256, 336)

  return toTexture(canvas)
}

// Front of the office building. Returns a colour map and an emissive map where
// only the windows are bright, so they light up at night.
export function createFacadeTextures({ company, line }) {
  const width = 1024
  const height = 512
  const paint = (lit) => {
    const { canvas, ctx } = makeCanvas(width, height)
    ctx.fillStyle = lit ? '#000000' : '#f3ede2'
    ctx.fillRect(0, 0, width, height)

    if (!lit) {
      ctx.fillStyle = INK
      ctx.fillRect(0, 0, width, 118)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      fitFont(ctx, company, { size: 60, weight: 700, family: HEADING_FONT, maxWidth: width - 80 })
      ctx.fillText(company, width / 2, 52)
      ctx.font = `500 28px ${BODY_FONT}`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.fillText(line, width / 2, 96)
    }

    ctx.fillStyle = lit ? '#ffd88a' : '#8fc8e8'
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        if (row === 1 && (col === 2 || col === 3)) continue
        ctx.fillRect(56 + col * 156, 150 + row * 170, 132, 120)
      }
    }
    // door
    ctx.fillStyle = lit ? '#ffc56a' : '#5c4033'
    ctx.fillRect(width / 2 - 90, 370, 180, 142)
    return toTexture(canvas)
  }
  return { map: paint(false), emissiveMap: paint(true) }
}

// A plain line of text on a solid strip (the frieze of the campus building).
export function createStripTexture({ text, color, background, width = 1024, height = 96 }) {
  const { canvas, ctx } = makeCanvas(width, height)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = '6px'
  fitFont(ctx, text, { size: 54, weight: 700, family: HEADING_FONT, maxWidth: width - 60 })
  ctx.fillText(text, width / 2, height / 2 + 3)
  return toTexture(canvas)
}

// The Test Lab's stage cards, one texture per stage: a numbered badge and the stage's
// name across the whole card, both big enough to read from the driving camera. All the
// names share one size (the largest that fits the longest), so the row reads evenly.
// `aspect` is the cards' width / height.
export function createStageTextures(names, { color, aspect }) {
  const width = 1024
  const height = Math.round(width / aspect)
  const pad = 64
  const probe = makeCanvas(8, 8).ctx
  const nameSize = Math.min(
    ...names.map((name) => fitFont(probe, name, { size: 150, weight: 700, family: HEADING_FONT, maxWidth: width - pad * 2 })),
  )
  const badge = { x: pad + 86, y: Math.round(height * 0.31), r: 86 }

  return names.map((name, i) => {
    const { canvas, ctx } = makeCanvas(width, height)
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, 30)

    ctx.beginPath()
    ctx.arc(badge.x, badge.y, badge.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 112px ${HEADING_FONT}`
    ctx.fillText(String(i + 1), badge.x, badge.y + 7)

    // a thin outline in the same colour thickens the letters a little, so they stay
    // solid when the card is small on screen
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `700 ${nameSize}px ${HEADING_FONT}`
    ctx.fillStyle = INK
    ctx.strokeStyle = INK
    ctx.lineWidth = Math.round(nameSize * 0.04)
    ctx.lineJoin = 'round'
    const baseline = Math.round(height * 0.82)
    ctx.strokeText(name, pad, baseline)
    ctx.fillText(name, pad, baseline)
    return toTexture(canvas)
  })
}

// A round speech bubble holding an emoji, shown above the Stormtrooper during an emote.
export function createEmoteBubbleTexture(icon, ring) {
  const { canvas, ctx } = makeCanvas(256, 256)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = ring
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(128, 112, 92, 0.62 * Math.PI, 0.38 * Math.PI) // leave a gap at the bottom for the tail
  ctx.lineTo(128, 236)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.font = '108px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(icon, 128, 120)
  return toTexture(canvas)
}

// Garage boards: number, the car's name in its own paint colour, and a tagline.
export function createCarBoardTexture({ index, name, tagline, paint, accent }) {
  const width = 1024
  const height = Math.round(width / (11 / 4))
  const { canvas, ctx } = makeCanvas(width, height)
  const pad = 54

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = paint
  ctx.fillRect(0, 0, width, 18)

  ctx.font = `700 150px ${HEADING_FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = withAlpha(accent, 0.14)
  ctx.fillText(String(index).padStart(2, '0'), width - pad + 10, 160)

  ctx.textAlign = 'left'
  ctx.letterSpacing = '4px'
  ctx.font = `700 30px ${BODY_FONT}`
  ctx.fillStyle = accent
  ctx.fillText('PARK HERE TO DRIVE THE', pad, 96)
  ctx.letterSpacing = '0px'

  fitFont(ctx, name, { size: 112, weight: 700, family: HEADING_FONT, maxWidth: width - pad * 2 - 140 })
  ctx.fillStyle = INK
  ctx.fillText(name, pad, 218)

  ctx.font = `500 40px ${BODY_FONT}`
  ctx.fillStyle = INK_SOFT
  for (const [i, line] of wrapLines(ctx, tagline, width - pad * 2).slice(0, 2).entries()) ctx.fillText(line, pad, 290 + i * 52)

  return toTexture(canvas)
}
