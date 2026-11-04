import { GARAGE, ZONES } from '../world/layout.js'
import { cars, carById } from '../data/cars.js'
import { EMOTES } from '../world/Stormtrooper.js'
import {
  certifications,
  contacts,
  development,
  education,
  experience,
  phone,
  profile,
  projects,
  resume,
  skillGroups,
  testing,
} from '../data/portfolio.js'

const zoneColor = Object.fromEntries([...ZONES, GARAGE].map((zone) => [zone.id, zone.uiColor ?? zone.color]))

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

const chips = (items, attributes = '') =>
  `<ul class="chips"${attributes}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`

// The requests the classic page's 3D character answers: [method, path, action in HeroRobot.js].
const ROBOT_REQUESTS = [
  ['GET', '/salute', 'salute'],
  ['POST', '/pushups', 'pushups'],
  ['PUT', '/march', 'march'],
  ['DELETE', '/bug', 'bug'],
  ['GET', '/coffee', 'teapot'],
  ['POST', '/deploy', 'deploy'],
]

const NEW_TAB = 'target="_blank" rel="noopener noreferrer"'
const linkAttrs = (href) => (href.startsWith('mailto:') || href.startsWith('tel:') ? '' : NEW_TAB)

// Two ways to get the resume: open it in the browser, or save the PDF.
const resumeButtons = (viewClass = 'button--accent', downloadClass = 'button--quiet') => `
  <a class="button ${viewClass}" href="${resume.file}" ${NEW_TAB} data-resume="view">View resume</a>
  <a class="button ${downloadClass}" href="${resume.file}" download="${resume.fileName}" data-resume="download">Download PDF</a>`

// Contact rows; the resume row gets its own Download button next to it.
const contactRows = () =>
  contacts
    .map((c) =>
      c.id === 'resume'
        ? `<li class="links__row">
            <a href="${resume.file}" ${NEW_TAB} data-resume="view"><strong>Resume</strong><span>View PDF</span></a>
            <a class="links__aside" href="${resume.file}" download="${resume.fileName}" data-resume="download">Download</a>
          </li>`
        : `<li><a href="${c.href}" ${linkAttrs(c.href)}><strong>${escapeHtml(c.label)}</strong><span>${escapeHtml(c.value)}</span></a></li>`,
    )
    .join('') + `<li><a href="${phone.href}"><strong>Phone</strong><span>${escapeHtml(phone.label)}</span></a></li>`

// A project told in two steps: how it was built, then how it was tested.
const projectPhases = (project) => `
  <div class="phases">
    <div class="phase">
      <p class="phase__label"><span aria-hidden="true">1</span>Built with</p>
      <p>${escapeHtml(project.built.text)}</p>
      ${chips(project.built.stack)}
    </div>
    <span class="phases__arrow" aria-hidden="true">→</span>
    <div class="phase phase--tested">
      <p class="phase__label"><span aria-hidden="true">2</span>Tested with</p>
      <p>${escapeHtml(project.tested.text)}</p>
      ${chips(project.tested.stack)}
    </div>
  </div>`

// The two roles with their tools (About panel and classic page).
const trackList = () =>
  `<ul class="tracks">${profile.tracks
    .map(
      (track) => `<li class="track track--${track.id}">
        <span class="track__icon" aria-hidden="true">${track.id === 'backend' ? '&lt;/&gt;' : '✓'}</span>
        <span class="track__text"><strong>${escapeHtml(track.title)}</strong><span>${track.stack.map(escapeHtml).join(' · ')}</span></span>
      </li>`,
    )
    .join('')}</ul>`

const stepList = (steps) =>
  `<ol class="steps">${steps
    .map((step) => `<li><strong>${escapeHtml(step.name)}</strong><span>${escapeHtml(step.text)}</span></li>`)
    .join('')}</ol>`

// One side of the classic page's "How I build & test": development or testing,
// coloured like its role card in the intro.
const workSide = (track, label, title, { intro, steps, toolkit }) => `
  <article class="work__side work__side--${track}" aria-labelledby="c-work-${track}">
    <header class="work__head">
      <span class="track__icon" aria-hidden="true">${track === 'backend' ? '&lt;/&gt;' : '✓'}</span>
      <div>
        <p class="work__label">${label}</p>
        <h3 id="c-work-${track}">${title}</h3>
      </div>
    </header>
    <p class="work__intro">${escapeHtml(intro)}</p>
    ${stepList(steps)}
    <p class="work__label">Toolkit</p>
    ${chips(toolkit, ` data-toolkit="${label} toolkit"`)}
  </article>`

// Everything in the HTML layer: the start screen, the HUD, info panels,
// toasts and the classic (non-3D) version of the portfolio.
export class Interface {
  constructor() {
    const $ = (id) => document.getElementById(id)
    this.el = {
      intro: $('intro'),
      progress: document.querySelector('.progress'),
      progressBar: document.querySelector('.progress__bar'),
      start: $('start-button'),
      introClassic: $('intro-classic'),
      hud: $('hud'),
      explored: $('explored'),
      menuButton: $('menu-button'),
      menu: $('menu'),
      menuList: $('menu-list'),
      carButton: $('car-button'),
      cars: $('cars'),
      carsList: $('cars-list'),
      night: $('night-button'),
      sound: $('sound-button'),
      classicButton: $('classic-button'),
      panel: $('panel'),
      panelBody: $('panel-body'),
      panelClose: $('panel-close'),
      toast: $('toast'),
      hint: $('hint'),
      speed: $('speed'),
      classic: $('classic'),
    }
    this.handlers = {}
    this.trigger = null
    this.dismissed = null
    this.bugRadarHost = null // the bug radar's block, while the Test Lab panel is open
    this.visited = new Set()
    this.webgl = true
    this.trooperReady = false
    this.trooperAction = null

    this.el.explored.textContent = `0 / ${ZONES.length} explored`
    this.renderMenu()
    this.renderCars()
    this.renderClassic()
    this.bindEvents()
  }

  on(event, handler) {
    this.handlers[event] = handler
  }

  // ---------- motion ----------

  // Shows `element` and lets its CSS play the entrance (the `is-open` class).
  reveal(element) {
    clearTimeout(element._concealTimer)
    element.hidden = false
    element.classList.remove('is-closing')
    // two frames, so the browser paints the hidden state before transitioning out of it
    requestAnimationFrame(() => requestAnimationFrame(() => element.classList.add('is-open')))
  }

  // Plays the exit (the `is-closing` class), then hides `element` for real.
  conceal(element, ms = 260) {
    if (element.hidden) return
    element.classList.remove('is-open')
    element.classList.add('is-closing')
    clearTimeout(element._concealTimer)
    element._concealTimer = setTimeout(() => {
      element.hidden = true
      element.classList.remove('is-closing')
    }, ms)
  }

  emit(event, ...args) {
    this.handlers[event]?.(...args)
  }

  bindEvents() {
    const { el } = this
    el.start.addEventListener('click', () => this.emit('start'))
    el.introClassic.addEventListener('click', () => this.openClassic())
    el.classicButton.addEventListener('click', () => this.openClassic())
    el.panelClose.addEventListener('click', () => this.dismissPanel())

    el.menuButton.addEventListener('click', () => this.toggleMenu())
    el.carButton.addEventListener('click', () => this.toggleCars())
    el.carsList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-car]')
      if (!button) return
      this.toggleCars(false)
      button.blur()
      this.emit('car', button.dataset.car)
    })
    el.menuList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-teleport]')
      if (!button) return
      this.toggleMenu(false)
      button.blur()
      this.emit('teleport', button.dataset.teleport)
    })

    // "Go to board" buttons in the Projects panel, emote buttons in the About panel
    el.panelBody.addEventListener('click', (event) => {
      const jump = event.target.closest('[data-jump]')
      const emote = event.target.closest('[data-emote]')
      if (jump) {
        jump.blur()
        this.emit('jump', jump.dataset.jump)
      } else if (emote) {
        emote.blur()
        this.emit('emote', emote.dataset.emote)
      }
    })

    // Toggle buttons give focus back to the game so Space/Enter keep driving.
    el.night.addEventListener('click', (event) => {
      event.currentTarget.blur()
      this.emit('night')
    })
    el.sound.addEventListener('click', (event) => {
      event.currentTarget.blur()
      this.emit('sound')
    })

    el.classic.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-classic]')) this.closeClassic()
    })
  }

  // ---------- start screen ----------

  setProgress(fraction) {
    const percent = Math.round(fraction * 100)
    this.el.progressBar.style.transform = `scaleX(${fraction})`
    this.el.progress.setAttribute('aria-valuenow', String(percent))
  }

  ready() {
    this.setProgress(1)
    this.el.start.disabled = false
    this.el.start.textContent = 'Start the engine'
    this.el.intro.classList.add('is-ready')
  }

  showHud() {
    this.el.intro.classList.add('is-leaving')
    setTimeout(() => (this.el.intro.hidden = true), 900)
    this.el.hud.hidden = false
    // the HUD's pieces glide in a moment after the intro starts to lift away
    setTimeout(() => this.el.hud.classList.add('is-open'), 350)
    // a first hint, unless something else is already being said (like a car switch)
    setTimeout(() => {
      if (!this.el.toast.classList.contains('is-visible')) this.toast('Drive into an area to read about it', 3600)
    }, 2600)
  }

  // Called when WebGL is missing: the classic page becomes the whole site.
  disable3D() {
    this.webgl = false
    this.el.intro.hidden = true
    this.el.hud.hidden = true
    this.el.classic.querySelector('[data-close-classic]').hidden = true
    this.el.classic.querySelector('.robot')?.remove()
    this.el.classic.dataset.static = '' // no 3D world to arrive from: shown at once, no entrance
    this.openClassic()
  }

  // ---------- HUD ----------

  renderMenu() {
    const items = [
      { id: 'spawn', label: 'Start', color: '#2b2d42' },
      ...ZONES.map((zone) => ({ id: zone.id, label: zone.label, color: zone.color })),
      { id: 'garage', label: 'Garage', color: GARAGE.uiColor },
      { id: 'bowling', label: 'Bowling lane', color: '#d9a86c' },
    ]
    this.el.menuList.innerHTML = items
      .map(
        (item) =>
          `<li><button type="button" data-teleport="${item.id}" style="--accent:${item.color}">
            <span class="menu__dot" aria-hidden="true"></span>${escapeHtml(item.label)}
            <span class="menu__check" data-check="${item.id}" aria-hidden="true">✓</span></button></li>`,
      )
      .join('')
  }

  toggleMenu(force) {
    const open = force ?? this.el.menu.hidden
    if (open) this.reveal(this.el.menu)
    else this.conceal(this.el.menu)
    this.el.menuButton.setAttribute('aria-expanded', String(open))
    if (open) {
      this.toggleCars(false)
      this.el.menu.querySelector('button')?.focus({ preventScroll: true })
    }
  }

  // ---------- the car picker ----------

  renderCars() {
    this.el.carsList.innerHTML = cars
      .map(
        (car) =>
          `<li><button type="button" data-car="${car.id}" aria-pressed="false" style="--accent:${car.paint}">
            <span class="cars__swatch" aria-hidden="true"></span>${escapeHtml(car.name)}</button></li>`,
      )
      .join('')
  }

  toggleCars(force) {
    const open = force ?? this.el.cars.hidden
    if (open) this.reveal(this.el.cars)
    else this.conceal(this.el.cars)
    this.el.carButton.setAttribute('aria-expanded', String(open))
    if (open) {
      this.toggleMenu(false)
      this.el.cars.querySelector('[aria-pressed="true"], button')?.focus({ preventScroll: true })
    }
  }

  // Marks the car being driven in the picker (and on any open car-pad panel).
  setCar(id) {
    this.carId = id
    this.el.carsList.querySelectorAll('[data-car]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.car === id))
    })
    if (this.trigger?.kind === 'car') this.el.panelBody.innerHTML = this.panelContent(this.trigger)
  }

  setNight(on) {
    this.el.night.setAttribute('aria-pressed', String(on))
  }

  setSound(on) {
    this.el.sound.setAttribute('aria-pressed', String(on))
  }

  setSpeed(kmh) {
    const value = String(Math.round(kmh))
    if (this.el.speed.textContent !== value) this.el.speed.textContent = value
  }

  hideHint() {
    this.el.hint.classList.add('is-hidden')
  }

  toast(message, duration = 2400) {
    const { toast } = this.el
    toast.textContent = message
    toast.classList.add('is-visible')
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration)
  }

  markVisited(zoneId) {
    if (this.visited.has(zoneId)) return false
    this.visited.add(zoneId)
    this.el.explored.textContent = `${this.visited.size} / ${ZONES.length} explored`
    this.el.menu.querySelector(`[data-check="${zoneId}"]`)?.classList.add('is-done')
    if (this.visited.size === ZONES.length) {
      setTimeout(() => this.toast('You’ve seen everything — thanks for driving by! 🎉', 4200), 1200)
    }
    return true
  }

  // ---------- info panel ----------

  // Shows the panel for a trigger spot (or hides it when `trigger` is null).
  showTrigger(trigger) {
    this.trigger = trigger
    if (!trigger) {
      this.dismissed = null
      this.hidePanel()
      return false
    }
    if (trigger.kind === 'zone') this.markVisited(trigger.id)
    if (this.dismissed === trigger.id) return false

    const zoneId = { zone: trigger.id, project: 'projects', contact: 'contact', car: 'garage', garage: 'garage' }[trigger.kind]
    this.el.panel.style.setProperty('--accent', zoneColor[zoneId])
    this.el.panel.dataset.trigger = trigger.id
    this.el.panelBody.innerHTML = this.panelContent(trigger)
    this.el.panelBody.scrollTop = 0
    // the Test Lab's bug radar; the 3D world fills it in (Experience.updateBugRadar())
    this.bugRadarHost = this.el.panelBody.querySelector('[data-bug-radar]')
    // each top-level block of the panel rises in a beat after the one before
    ;[...this.el.panelBody.children].forEach((child, i) => child.style.setProperty('--i', i))
    this.reveal(this.el.panel)
    return true
  }

  hidePanel() {
    this.bugRadarHost = null
    this.conceal(this.el.panel, 320)
  }

  dismissPanel() {
    if (this.trigger) this.dismissed = this.trigger.id
    this.hidePanel()
    this.emit('panel')
  }

  // Size of the open info panel in pixels, or null when it's closed.
  get panelSize() {
    const { panel } = this.el
    if (panel.hidden) return null
    return { width: panel.offsetWidth + 16, height: panel.offsetHeight + 12, bottomSheet: window.innerWidth <= 760 }
  }

  // ---------- the Stormtrooper in the About area ----------

  setTrooperReady() {
    this.trooperReady = true
    this.el.panelBody.querySelectorAll('[data-emote]').forEach((button) => (button.disabled = false))
  }

  // Highlights what he's doing: the emote while it plays, Dance while he dances.
  setTrooperAction(emote) {
    this.trooperAction = emote
    this.el.panelBody.querySelectorAll('[data-emote]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.emote === emote))
    })
  }

  emoteButtons() {
    const group = (title, emotes, modifier = '') => `
      <p class="emotes__group">${title}</p>
      <div class="emotes__grid ${modifier}" role="group" aria-label="Stormtrooper ${title.toLowerCase()}">
        ${emotes
          .map(
            (emote) => `<button type="button" data-emote="${emote.id}" aria-pressed="${this.trooperAction === emote.id}" ${this.trooperReady ? '' : 'disabled'}>
              <span class="emotes__icon" aria-hidden="true">${emote.icon}</span><span>${escapeHtml(emote.label)}</span></button>`,
          )
          .join('')}
      </div>`
    return `
      <div class="emotes">
        <h3 class="section-label">Make the Stormtrooper move</h3>
        ${group('Moves', EMOTES.filter((emote) => !emote.trick))}
        ${group('Tricks', EMOTES.filter((emote) => emote.trick), 'emotes__grid--tricks')}
        <p class="panel__note">He waves when you arrive, jumps when you honk with <kbd>H</kbd> and dances when you drive away.</p>
      </div>`
  }

  // The link Enter opens while parked on a pad (the resume pad opens the viewer).
  get activeLink() {
    if (!this.trigger) return null
    if (this.trigger.kind === 'contact') return contacts[this.trigger.index].href
    if (this.trigger.kind === 'project') return projects[this.trigger.index].link
    return null
  }

  openActiveLink() {
    const href = this.activeLink
    if (!href) return
    if (href.startsWith('mailto:')) window.location.href = href
    else window.open(href, '_blank', 'noopener')
  }

  panelContent(trigger) {
    if (trigger.kind === 'project') return this.projectPanel(trigger.index)
    if (trigger.kind === 'contact') return this.contactPadPanel(trigger.index)
    if (trigger.kind === 'car') return this.carPanel(trigger.carId)
    return this[`${trigger.id}Panel`]()
  }

  garagePanel() {
    return `
      <p class="eyebrow">Garage</p>
      <h2>Pick a car</h2>
      <p>Nine cars, one board each. Park on the pad in front of a board and you're driving that car. They all handle the same; only the looks change.</p>
      <ol class="list">${cars.map((car) => `<li><strong>${escapeHtml(car.name)}</strong> — ${escapeHtml(car.tagline)}</li>`).join('')}</ol>
      <p class="panel__note">In a hurry? The car button in the top bar (or <kbd>C</kbd>) switches from anywhere.</p>`
  }

  carPanel(id) {
    const car = carById[id]
    const driving = this.carId === id
    return `
      <p class="eyebrow">Garage · car ${String(cars.indexOf(car) + 1).padStart(2, '0')}</p>
      <h2>${escapeHtml(car.name)}</h2>
      <p>${escapeHtml(car.tagline)}</p>
      <p class="panel__sub">${driving ? 'You’re driving it now.' : 'Park here to switch to it.'}</p>`
  }

  aboutPanel() {
    return `
      <p class="eyebrow">About me</p>
      <h2>Hi, I’m ${escapeHtml(profile.firstName)}</h2>
      ${this.emoteButtons()}
      ${trackList()}
      <p>${escapeHtml(profile.summary)}</p>
      <dl class="facts">${profile.facts.map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`).join('')}</dl>
      <div class="panel__actions">${resumeButtons()}</div>`
  }

  testingPanel() {
    return `
      <p class="eyebrow">Test Lab</p>
      <h2>How I test</h2>
      <p>${escapeHtml(testing.intro)}</p>
      <div class="bug-radar" data-bug-radar data-state="loading">
        <div class="bug-radar__screen"></div>
        <div class="bug-radar__readout">
          <p class="bug-radar__title">Bug radar</p>
          <p class="bug-radar__count" aria-live="polite">Scanning for bugs…</p>
          <p class="bug-radar__nearest"></p>
          <p class="bug-radar__hint">The red blips are bugs: drive over them to fix them.</p>
        </div>
      </div>
      ${stepList(testing.steps)}
      <h3 class="section-label">Toolkit</h3>
      ${chips(testing.toolkit)}`
  }

  skillsPanel() {
    return `
      <p class="eyebrow">Skills</p>
      <h2>What I work with</h2>
      ${skillGroups
        .map(
          (group) => `
          <h3 style="--dot:${group.color}" class="dot-heading">${escapeHtml(group.name)}</h3>
          ${chips([...group.crates, ...group.more])}`,
        )
        .join('')}
      <p class="panel__note">Every crate is a skill. Knock them over — they tidy themselves up later.</p>`
  }

  projectsPanel() {
    return `
      <p class="eyebrow">Projects</p>
      <h2>Built first, then tested</h2>
      <p>I build each project (mostly with Python, Django and SQL) and then test it. Park on the glowing pad in front of a board to read more, or jump straight to one:</p>
      <ol class="jump-list">${projects
        .map(
          (p, i) => `<li><button type="button" data-jump="project:${i}">
            <span class="jump-list__index">${String(i + 1).padStart(2, '0')}</span>
            <span><strong>${escapeHtml(p.name)}</strong><small>Built: ${escapeHtml(p.built.stack.slice(0, 2).join(', '))} · Tested: ${escapeHtml(p.tested.stack[0])}</small></span></button></li>`,
        )
        .join('')}</ol>`
  }

  projectPanel(index) {
    const project = projects[index]
    return `
      <p class="eyebrow">Project ${String(index + 1).padStart(2, '0')} · ${escapeHtml(project.kind)}</p>
      <h2>${escapeHtml(project.name)}</h2>
      ${projectPhases(project)}
      <div class="panel__actions">
        <a class="button button--accent" href="${project.link}" ${NEW_TAB}>See my GitHub ↗</a>
        <span class="panel__key"><kbd>Enter</kbd> to open</span>
      </div>`
  }

  experiencePanel() {
    return experience
      .map(
        (job) => `
        <p class="eyebrow">Experience · ${escapeHtml(job.period)}</p>
        <h2>${escapeHtml(job.role)}</h2>
        <p class="panel__sub">${escapeHtml(job.company)} · ${escapeHtml(job.place)}</p>
        <ul class="list">${job.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
        ${chips(job.stack)}`,
      )
      .join('')
  }

  educationPanel() {
    const entry = (item) => `
      <div class="entry">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="panel__sub">${[item.place, item.period, item.detail].filter(Boolean).map(escapeHtml).join(' · ')}</p>
      </div>`
    return `
      <p class="eyebrow">Education</p>
      <h2>Where I studied</h2>
      ${education.map(entry).join('')}
      <h3 class="section-label">Certifications</h3>
      ${certifications.map(entry).join('')}`
  }

  contactPanel() {
    return `
      <p class="eyebrow">Contact</p>
      <h2>Let’s talk</h2>
      <p>I’m open to QA, test automation and backend roles. Park on a pad and press <kbd>Enter</kbd>, or use the links below.</p>
      <ul class="links">${contactRows()}</ul>`
  }

  contactPadPanel(index) {
    const contact = contacts[index]
    if (contact.id === 'resume') {
      return `
        <p class="eyebrow">Contact</p>
        <h2>Resume</h2>
        <p class="panel__sub">One page, PDF. Open it in the browser or save a copy.</p>
        <div class="panel__actions">${resumeButtons()}</div>
        <p class="panel__key"><kbd>Enter</kbd> opens the viewer</p>`
    }
    return `
      <p class="eyebrow">Contact</p>
      <h2>${escapeHtml(contact.label)}</h2>
      <p class="panel__sub">${escapeHtml(contact.value)}</p>
      <div class="panel__actions">
        <a class="button button--accent" href="${contact.href}" ${linkAttrs(contact.href)}>${escapeHtml(contact.action)}</a>
        <span class="panel__key"><kbd>Enter</kbd> to open</span>
      </div>`
  }

  // ---------- classic page ----------

  openClassic() {
    this.reveal(this.el.classic)
    this.el.classic.scrollTop = 0
    this.el.classic.focus({ preventScroll: true })
    document.body.classList.add('classic-open')
    this.watchClassic()
    this.loopToolkits()
    this.emit('classic', true)
  }

  // The two toolkits under "How I build & test" scroll past as loops of tool logos,
  // each lighting up in its brand's colour (or its side's) under the pointer. The
  // loop code is only downloaded the first time the classic page opens; until then
  // (or if it can't load) the plain lists of tools show.
  loopToolkits() {
    this.toolLoops ??= import('./ToolLoop.js')
      .then(({ loopToolkit }) => {
        for (const list of this.el.classic.querySelectorAll('[data-toolkit]')) {
          const accent = getComputedStyle(list.closest('.work__side')).getPropertyValue('--track').trim()
          loopToolkit(list, { accent, ariaLabel: list.dataset.toolkit })
        }
      })
      .catch((error) => console.warn('Could not load the toolkit loops', error))
  }

  closeClassic() {
    if (!this.webgl) return
    this.conceal(this.el.classic, 420)
    document.body.classList.remove('classic-open')
    this.emit('classic', false)
  }

  get classicOpen() {
    return !this.el.classic.hidden && !this.el.classic.classList.contains('is-closing')
  }

  // Sections fade up as they scroll into view, and the section menu tracks the one
  // you're reading. Set up once, the first time the page opens.
  watchClassic() {
    if (this.classicWatched) return
    this.classicWatched = true
    const sections = [...this.el.classic.querySelectorAll('.classic__section')]
    const links = [...this.el.classic.querySelectorAll('.classic__nav a')]

    const seen = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-seen')),
      { root: this.el.classic, rootMargin: '0px 0px -12% 0px' },
    )
    sections.forEach((section) => seen.observe(section))

    const current = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!top) return
        links.forEach((link) => link.setAttribute('aria-current', link.hash === `#${top.target.id}` ? 'true' : 'false'))
      },
      { root: this.el.classic, rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    sections.forEach((section) => current.observe(section))

    // smooth scroll to a section, inside the page's own scroller
    this.el.classic.addEventListener('click', (event) => {
      if (event.target.closest('[data-to-top]')) this.el.classic.scrollTo({ top: 0, behavior: 'smooth' })
      const link = event.target.closest('.classic__nav a')
      if (!link) return
      event.preventDefault()
      this.el.classic.querySelector(link.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  renderClassic() {
    const job = experience[0]
    const others = contacts.filter((c) => c.id !== 'resume')
    this.el.classic.innerHTML = `
      <div class="classic__bar">
        <span class="classic__brand"><span class="brand__mark">BS</span>${escapeHtml(profile.name)}</span>
        <button type="button" class="button button--small" data-close-classic>Back to the island</button>
      </div>

      <header class="classic__hero">
        <div class="classic__intro">
          <p class="eyebrow">${escapeHtml(profile.role)}</p>
          <h1>${escapeHtml(profile.name)}</h1>
          ${trackList()}
          <p class="classic__lead">${escapeHtml(profile.summary)}</p>
          <div class="classic__actions">
            ${resumeButtons('button--accent', 'button--outline')}
          </div>
          <ul class="classic__links" aria-label="Find me online">
            ${others
              .map((c) =>
                c.href.startsWith('mailto:')
                  ? `<li><a href="${c.href}">${escapeHtml(c.value)}</a></li>`
                  : `<li><a href="${c.href}" ${NEW_TAB}>${escapeHtml(c.label)} <span aria-hidden="true">↗</span></a></li>`,
              )
              .join('')}
          </ul>
        </div>

        <figure class="robot" data-state="idle">
          <canvas class="robot__canvas" aria-hidden="true"></canvas>
          <p class="robot__bubble" role="status"></p>
          <p class="robot__response" aria-hidden="true">Waiting for a request…</p>
          <p class="robot__status" data-loading>Loading the 3D character…</p>
          <p class="robot__status" data-error>The 3D character couldn’t be loaded.</p>
          <figcaption>
            <div class="robot__moves" role="group" aria-label="Character animation">
              <button type="button" data-move="idle" aria-pressed="true" disabled>Idle</button>
              <button type="button" data-move="walk" aria-pressed="false" disabled>Walk</button>
              <button type="button" data-move="run" aria-pressed="false" disabled>Run</button>
            </div>
            <div class="robot__api" role="group" aria-labelledby="robot-api-title">
              <p class="robot__api-title" id="robot-api-title">Send him a request</p>
              <div class="robot__requests">
                ${ROBOT_REQUESTS.map(
                  ([method, path, action]) =>
                    `<button type="button" data-action="${action}" aria-pressed="false" disabled><b data-method="${method}">${method}</b>${path}</button>`,
                ).join('')}
              </div>
            </div>
            <span class="robot__hint">Drag to turn him around · click him to poke him</span>
            <span class="robot__hint robot__hint--touch">Tap him to poke him</span>
          </figcaption>
        </figure>
      </header>

      <nav class="classic__nav" aria-label="Sections">
        <a href="#s-experience">Experience</a>
        <a href="#s-projects">Projects</a>
        <a href="#s-work">Build &amp; test</a>
        <a href="#s-skills">Skills</a>
        <a href="#s-education">Education</a>
        <a href="#s-contact">Contact</a>
      </nav>

      <section class="classic__section" id="s-experience" aria-labelledby="c-experience">
        <h2 id="c-experience">Experience</h2>
        <article class="classic__card">
          <div class="classic__row"><h3>${escapeHtml(job.role)}</h3><span>${escapeHtml(job.period)}</span></div>
          <p class="classic__muted">${escapeHtml(job.company)} · ${escapeHtml(job.place)}</p>
          <ul class="list">${job.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
          ${chips(job.stack)}
        </article>
      </section>

      <section class="classic__section" id="s-projects" aria-labelledby="c-projects">
        <h2 id="c-projects">Projects</h2>
        <p class="classic__muted">I build each project first, mostly with Python, Django and SQL, and then test it.</p>
        <div class="project-list">
          ${projects
            .map(
              (p, i) => `
              <article class="classic__card project-card">
                <header class="project-card__head">
                  <span class="project-card__index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
                  <div class="project-card__title">
                    <h3>${escapeHtml(p.name)}</h3>
                    <p>${escapeHtml(p.kind)}</p>
                  </div>
                  <a class="project-card__link" href="${p.link}" ${NEW_TAB}>GitHub ↗</a>
                </header>
                ${projectPhases(p)}
              </article>`,
            )
            .join('')}
        </div>
      </section>

      <section class="classic__section" id="s-work" aria-labelledby="c-work">
        <h2 id="c-work">How I build &amp; test</h2>
        <p class="classic__muted">Two sides of the same feature: first I build it, then I try to break it.</p>
        <div class="work">
          ${workSide('backend', 'Development', 'How I build', development)}
          ${workSide('testing', 'Testing', 'How I test', testing)}
        </div>
      </section>

      <section class="classic__section" id="s-skills" aria-labelledby="c-skills">
        <h2 id="c-skills">Skills</h2>
        <div class="classic__grid classic__grid--three">
          ${skillGroups
            .map(
              (group) => `
              <article class="classic__card">
                <h3 class="dot-heading" style="--dot:${group.color}">${escapeHtml(group.name)}</h3>
                ${chips([...group.crates, ...group.more])}
              </article>`,
            )
            .join('')}
        </div>
      </section>

      <section class="classic__section" id="s-education" aria-labelledby="c-education">
        <h2 id="c-education">Education & certifications</h2>
        <div class="classic__split">
          ${[
            ['Education', education],
            ['Certifications', certifications],
          ]
            .map(
              ([label, items]) => `
              <div class="classic__group">
                <p class="classic__group-label">${label}</p>
                ${items
                  .map(
                    (item) => `
                    <article class="classic__card">
                      <h3>${escapeHtml(item.title)}</h3>
                      <p class="classic__muted">${[item.place, item.period, item.detail].filter(Boolean).map(escapeHtml).join(' · ')}</p>
                    </article>`,
                  )
                  .join('')}
              </div>`,
            )
            .join('')}
        </div>
      </section>

      <section class="classic__section" id="s-contact" aria-labelledby="c-contact">
        <h2 id="c-contact">Contact</h2>
        <ul class="links links--light">${contactRows()}</ul>
      </section>

      <footer class="classic__footer">
        <div class="classic__footer-row">
          <p><strong>© ${new Date().getFullYear()} ${escapeHtml(profile.name)}</strong> · ${escapeHtml(profile.location)}</p>
          <button type="button" class="classic__top" data-to-top>Back to top <span aria-hidden="true">↑</span></button>
        </div>
        <p class="classic__credits">
          Built with three.js · Tested with Playwright · 3D models: Soldier from Mixamo, and the Stormtrooper by
          <a href="https://sketchfab.com/strykerdoesgames" ${NEW_TAB}>StrykerDoesAnimation</a>
          (<a href="https://creativecommons.org/licenses/by/4.0/" ${NEW_TAB}>CC BY 4.0</a>, extra moves added)
        </p>
      </footer>`
  }
}
