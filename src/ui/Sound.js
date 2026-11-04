// Every sound is synthesised with the Web Audio API, so there are no audio files to load.
const STORAGE_KEY = 'portfolio:sound'

export class Sound {
  constructor() {
    this.enabled = true
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off'
    } catch {
      // storage unavailable (private mode): keep the default
    }
    this.context = null

    document.addEventListener('visibilitychange', () => {
      if (!this.context) return
      if (document.hidden) this.context.suspend()
      else if (this.enabled) this.context.resume()
    })
  }

  // Must be called from a click or key press: browsers only allow audio after one.
  start() {
    if (this.context) return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    this.context = ctx

    this.master = ctx.createGain()
    this.master.gain.value = this.enabled ? 0.55 : 0
    this.master.connect(ctx.destination)

    // engine: two detuned oscillators through a low-pass filter
    this.engineFilter = ctx.createBiquadFilter()
    this.engineFilter.type = 'lowpass'
    this.engineFilter.frequency.value = 300
    this.engineGain = ctx.createGain()
    this.engineGain.gain.value = 0
    this.engineFilter.connect(this.engineGain)
    this.engineGain.connect(this.master)

    this.engineA = ctx.createOscillator()
    this.engineA.type = 'sawtooth'
    this.engineB = ctx.createOscillator()
    this.engineB.type = 'square'
    for (const osc of [this.engineA, this.engineB]) {
      osc.connect(this.engineFilter)
      osc.start()
    }

    // a short noise buffer reused for bumps
    const length = ctx.sampleRate * 0.4
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  }

  setEnabled(enabled) {
    this.enabled = enabled
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
    } catch {
      // ignore
    }
    if (!this.context) return
    if (enabled) this.context.resume()
    this.master.gain.setTargetAtTime(enabled ? 0.55 : 0, this.context.currentTime, 0.05)
  }

  update(speed, throttle) {
    if (!this.context || !this.enabled) return
    const now = this.context.currentTime
    const base = 46 + speed * 3.4 + Math.max(0, throttle) * 12
    this.engineA.frequency.setTargetAtTime(base, now, 0.08)
    this.engineB.frequency.setTargetAtTime(base * 0.502, now, 0.08)
    this.engineFilter.frequency.setTargetAtTime(240 + speed * 26 + Math.abs(throttle) * 180, now, 0.1)
    this.engineGain.gain.setTargetAtTime(0.05 + Math.min(speed, 30) * 0.0025 + Math.abs(throttle) * 0.035, now, 0.1)
  }

  horn() {
    if (!this.context || !this.enabled) return
    const ctx = this.context
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02)
    gain.gain.setValueAtTime(0.12, now + 0.32)
    gain.gain.linearRampToValueAtTime(0, now + 0.4)
    gain.connect(this.master)
    for (const frequency of [392, 494]) {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = frequency
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + 0.42)
    }
  }

  impact(strength) {
    if (!this.context || !this.enabled) return
    const ctx = this.context
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 500 + strength * 40
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(Math.min(0.5, 0.08 + strength * 0.025), now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(now)
  }

  // A board smashing: a heavy thud, then the clatter of the pieces.
  crash(strength) {
    if (!this.context || !this.enabled) return
    this.impact(strength + 6)
    const ctx = this.context
    const start = ctx.currentTime + 0.04
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    source.playbackRate.value = 0.7
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 1800
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(Math.min(0.3, 0.1 + strength * 0.01), start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(start)
  }

  // Little two-note chime when a panel opens.
  chime() {
    if (!this.context || !this.enabled) return
    const ctx = this.context
    const now = ctx.currentTime
    ;[660, 990].forEach((frequency, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequency
      const gain = ctx.createGain()
      const start = now + i * 0.08
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.08, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(start)
      osc.stop(start + 0.32)
    })
  }
}
