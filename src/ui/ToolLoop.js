import { createLogoLoop } from './LogoLoop.js'
import { toolIcons } from '../data/toolIcons.js'

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

// The tool's icon (see toolIcons.js), sized by the loop's logo height.
const iconFor = (tool) => {
  const icon = toolIcons[tool]
  const svg = (attributes, inner) => `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" ${attributes}>${inner}</svg>`
  if (icon?.path) return svg('fill="currentColor"', `<path d="${icon.path}"/>`)
  if (icon?.line)
    return svg('fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"', icon.line)
  return svg('fill="currentColor"', '<circle cx="12" cy="12" r="4"/>')
}

// Turns a toolkit, a plain list of chips (<ul class="chips"> with one tool per item),
// into a loop of the tools' logos and names that scrolls past and stops while you
// hover it; each one takes on its brand's colour (or `accent`) under the pointer.
// With reduced motion the plain list stays, so every tool can still be seen.
export function loopToolkit(list, { accent, ariaLabel, speed = 34 }) {
  if (REDUCED_MOTION.matches) return null
  const tools = [...list.children].map((item) => item.textContent)
  const loop = createLogoLoop({
    logos: tools.map((tool) => ({ node: iconFor(tool), title: tool, hoverColor: toolIcons[tool]?.color ?? accent })),
    labels: 'inline',
    logoHeight: 16,
    gap: 8,
    speed,
    hoverSpeed: 0,
    fadeOutWidth: 0.1,
    ariaLabel,
    className: 'tool-loop',
  })
  list.replaceWith(loop.element)
  return loop
}
