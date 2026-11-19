// Phones drive the island sideways: the steering wheel under the left thumb, the
// pedals under the right. Where the browser allows it (Chrome on Android), the
// screen is put into full screen and locked sideways, so there's nothing to turn.
// Elsewhere (Safari on an iPhone) a prompt (#rotate) asks for the phone to be
// turned while it's held upright.
//
// The media queries here are repeated in style.css: keep them in step.

// a phone, either way up (a tablet is big enough to drive upright)
const PHONE = window.matchMedia('(pointer: coarse) and (max-width: 760px), (pointer: coarse) and (max-height: 540px)')
// a phone held upright: the island waits behind the prompt
export const UPRIGHT_PHONE = window.matchMedia('(pointer: coarse) and (max-width: 760px) and (orientation: portrait)')

// Whether this browser can lock the screen sideways (it can only from full screen).
export const canLock = () => Boolean(document.fullscreenEnabled && screen.orientation?.lock)

// Full screen, locked sideways. Must be called from a tap (browsers only allow
// full screen in answer to one). Resolves to whether the screen is now locked.
export async function lockLandscape() {
  if (!PHONE.matches || !canLock()) return false
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    await screen.orientation.lock('landscape')
    return true
  } catch {
    // not allowed here (or the user said no): the rotate prompt does the asking instead
    return false
  }
}

// Back to a normal page that turns with the phone (for the classic view, which reads upright).
export function unlockLandscape() {
  try {
    screen.orientation?.unlock?.()
  } catch {
    // never locked
  }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}
