# Brahmanand Suryawanshi — 3D Portfolio

Portfolio of a **Backend Developer** (Python, Django, DRF, SQL) and **Software Tester** (Java, Selenium WebDriver, TestNG, Postman), built with **three.js** and tested end-to-end with **Playwright**. You drive a small car around a low-poly island; each area of the island is one section of the portfolio. Park in an area and an info panel slides in.

| Area | What's there |
|---|---|
| **Start plaza** | Your name in big pixel letters (the car can knock them over; 20 seconds later they fly back into place, like every area title), keyboard hints that press down as you type |
| **About** | Intro board and an interactive Stormtrooper on a round plinth. He dances while nobody's around, waves when you arrive, jumps when you honk, and the About panel has buttons for his **moves** (Wave, Yes, No, Bow, Punch, Jump, Spin, Dance) and **tricks** (Backflip, Frontflip, Windmill Spin, 360 Spin Jump), each with an emoji bubble over his head. A trick always finishes before the next move starts. Plus the summary, facts, and resume **View** and **Download** |
| **Test Lab** | The six STLC stages as a pipeline whose lights turn green one by one, the "How I test" panel, and red bugs that run from the car. Drive over them to fix them. The panel has a **bug radar**: the car is at its centre with north up, each bug still loose shows as a red blip, and beside it are how many are left and how far away the nearest one is, in which direction |
| **Skills** | Three stacks of crates, one skill per crate: Backend Development / Automation Testing / Manual & API Testing. Crash into a stack and 20 seconds later its crates fly back one by one and rebuild the pyramid |
| **Projects** | Four boards in a 2×2 grid: School Management, Ticket Booking, DayFlow and Banking. Each project is told in two steps: **1 · Built with** (Python, Django and SQL), then **2 · Tested with** (Selenium, TestNG, Postman, manual testing). Park on the glowing "PARK HERE" pad, or pick a project from the panel to jump straight to its board |
| **Experience** | Office building with water tanks: Development & Testing at Shubham Tanks And Liners |
| **Education** | Campus building, degree and certificate boards |
| **Contact** | GitHub, LinkedIn, Email and Resume pads. Park on one and press **Enter** to open it |
| **Bowling lane** | Just for fun: drive into the pins |
| **Garage** | North of the start plaza: nine car boards, each with a model of the car on a shelf and a pad in front. Park on a pad to switch to that car: Racer, Taxi, Police (its lights flash), Pickup, Camper Van, Jeep, Supercar, Bug and Limo. The car button in the top bar (or `C`) switches instantly from anywhere, and the choice is remembered |

The resume always comes with two options: **View** opens the PDF in a new tab, **Download** saves it as `Brahmanand_Suryawanshi_Resume.pdf`. They're in the About panel, the Resume pad, the Contact panel and the classic page.

Crash into a board and it breaks: the panel shatters into pieces that tumble away, its legs topple, and anything mounted on it (a Test Lab light, a Garage shelf and model car) falls too. 15–20 seconds later, once the car is clear, the pieces fly back together and the board stands where it was. A board also turns see-through while the car is behind it, where it would hide the car.

There is also a **Classic view**: the same content as a normal scrolling page, in this order: Experience, Projects, How I build & test, Skills, Education & certifications, Contact. A strip of section links sticks under the top bar. **How I build & test** puts the two sides of my work side by side: six development steps and six testing steps, lined up row by row, each with its toolkit as a loop of tool logos that scrolls past and stops while you hover it (with reduced motion it stays a plain list).

Beside the intro stands an animated 3D character: the Soldier model from the three.js *skeletal animation blending* example. **Idle / Walk / Run** buttons cross-fade between his animations, and you can drag to turn him around. Under him is a little **API console**: send him a request and he acts out the response, with its status code in a speech bubble and on a status pill under his feet: `GET /salute` (200 OK, a salute and a nod), `POST /pushups` (201 Created, three push-ups), `PUT /march` (202 Accepted, he turns side-on and marches), `DELETE /bug` (204 No Content, a ladybird scuttles in and he stomps on it), `GET /coffee` (418 I'm a teapot, the "little teapot" pose, tipped over) and `POST /deploy` (500 Internal Server Error, a facepalm). Every pose eases in and out on springs, so his arms swing into place a moment after his body. Left alone he fidgets: he looks around, stretches, checks his watch or stands hands on hips. His head follows your mouse, and clicking him pokes him: he flinches and says something tester-ish, and five pokes in three seconds gets a **429 Too Many Requests** and a dizzy spin. The model (`public/models/Soldier.glb`, 2.1 MB), his code and the toolkit loops are only downloaded when the classic page is first opened. It's one click away from the start screen and the HUD, and it's shown automatically on devices without WebGL.

## Run it

Requires Node.js 20.19+ or 22.12+ (what Vite 8 needs).

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build and deploy

```bash
npm run build      # outputs a static site to dist/
npm run preview    # serve dist/ locally to check it
```

`dist/` is plain static files with relative paths (`base: './'` in `vite.config.js`), so it can be uploaded as-is to GitHub Pages, Netlify, Vercel or any static host, at the root or in a subfolder.

On GitHub it deploys itself: `.github/workflows/deploy.yml` builds the site and publishes it on GitHub Pages every time `main` is pushed (in the repository's **Settings → Pages**, **Source** must be **GitHub Actions**). It's live at **https://brahma4383.github.io/portfolio/**.

## Tests

The site has its own end-to-end test suite in `tests/`, written with **Playwright** using the **Page Object Model**:

```bash
npm test             # all 54 tests (builds the site and serves it automatically)
npm run test:smoke   # only the tests tagged @smoke
npm run test:report  # open the HTML report of the last run
```

| File | What it checks |
|---|---|
| `tests/pages/PortfolioPage.js` | Page object: every selector and action lives here |
| `tests/fixtures.js` | Shared setup: fails any test that logs a console error, stubs GitHub/LinkedIn so tests never depend on them |
| `e2e/start.spec.js` | Start screen, HUD, every button has an accessible name |
| `e2e/zones.spec.js` | Data-driven: each area opens the right panel; explored counter; closed panels stay closed; the Stormtrooper loads, plays emotes and every trick, and a move asked for mid-flip waits its turn; a knocked crate stack and knocked pixel letters rebuild 20 s later; Test Lab steps; the bug radar counts the bugs and points to the nearest, also after leaving the lab and coming back |
| `e2e/projects.spec.js` | Data-driven: each project's title, tags and link; crashing into a board breaks it and it rebuilds 15–20 s later; Enter opens the link in a new tab |
| `e2e/resume.spec.js` | PDF is served; **View** opens a new tab; **Download** saves the right file name, in every place it appears |
| `e2e/classic.spec.js` | Classic page sections; development and testing sides with all their steps and tools; the toolkit loops move and stop while hovered; the 3D character loads and switches idle → walk → run, acts out every API console request, answers pokes (429 when poked too fast) and fidgets when left alone; back to the island; every link loads and external links open safely |
| `e2e/controls.spec.js` | Night mode, sound setting survives a reload, Escape, R, driving with W |
| `e2e/mobile.spec.js` | Pixel 7 emulation: touch controls, bottom-sheet panels, joystick drives the car |
| `e2e/no-webgl.spec.js` | Chrome with WebGL turned off falls back to the classic page |
| `e2e/garage.spec.js` | The picker lists every car and switches instantly; `C` opens it and the choice survives a reload; the Garage has a board and pad per car and parking on a pad switches cars; the Garage doesn't count as explored |

The tests read their expected data from `src/data/portfolio.js` and `src/world/layout.js`, so adding a project or an area adds its test automatically. They run on the installed Google Chrome (`channel: 'chrome'`), so no extra browser download is needed. If Chrome isn't installed, remove `channel` in `playwright.config.js` and run `npx playwright install chromium`.

## Controls

| Keyboard | Action |
|---|---|
| `W A S D` / arrow keys | Drive |
| `Space` | Handbrake / drift |
| `Shift` | Boost |
| `Enter` | Open the link of the pad you're parked on |
| `R` | Back to the start |
| `N` | Day / night |
| `C` | Switch car |
| `M` | Sound on / off |
| `H` | Horn |
| `Esc` | Close the panel, menu or classic view |
| Mouse wheel | Zoom |

On touch screens, drag anywhere on the left half to steer (the car heads toward where you point), and hold **Drift** or **Brake** on the right. The pin button in the top bar jumps straight to any area.

## Editing the content

All text lives in **`src/data/portfolio.js`**: profile, experience, projects, skills, education, certifications and contact links. The 3D boards, info panels and classic page are all generated from it, so that's the only file to touch when something changes.

- Each project's `link` currently points to the GitHub profile. When a repository is public, replace it with the repo URL.
- Each project has `built` and `tested`, each with a `text` and a `stack`. The 3D board shows both stacks as chips; the panel and classic page show the full text.
- Each skill group shows its first six `crates` as crates (the first one goes on top); `more` only appears in the panel and classic page.
- `testing.steps` and `testing.toolkit` fill the Test Lab: the pipeline blocks, the "How I test" panel and the testing side of the classic page's "How I build & test". `development.steps` and `development.toolkit` fill its development side.
- Each tool in a toolkit gets its icon from `src/data/toolIcons.js`, by name: a brand logo and colour, or a simple line drawing. A new tool without an entry there shows a dot until one is added.
- The resume is `public/resume/Brahmanand_Suryawanshi_Resume.pdf`: a one-page resume written from this portfolio's content (same headline, skills, experience and projects). Replace that file to update both View and Download, and keep the two in step when either changes.

Positions of the areas, roads and the bowling lane are in `src/world/layout.js`.

## How it's put together

```
src/
  main.js               boot: fonts, WebGL check, wires the UI to the 3D world
  style.css             start screen, HUD, panels and classic page
  data/portfolio.js     all portfolio content
  data/cars.js          the nine car designs (shape, colours, extras)
  data/toolIcons.js     icons for the tools in the toolkits
  world/
    Experience.js       renderer + game loop
    layout.js           map of the island (zone positions, roads)
    Island.js           ground, sea, roads, trees, rocks, lamps, boats, bowling lane
    Zones.js            each portfolio area + the trigger spots that open panels
    BugHunt.js          the bugs in the Test Lab
    Boards.js           the info boards: they break when the car crashes into them and rebuild themselves
    Stormtrooper.js     the Stormtrooper in the About area: his moves and tricks are key poses baked into animation clips
    Car.js              arcade driving physics; swaps bodies with setDesign()
    CarBody.js          builds a car body from a design in data/cars.js
    Physics.js          cannon-es world for props + simple 2D collisions for the car
    Props.js            knock-over letters, skill crates, bowling pins
    CameraRig.js        intro orbit, follow camera, zoom, framing around the panel and the Stormtrooper
    Environment.js      lights, shadows, day/night
    Effects.js          dust puffs and tyre marks
  ui/
    Interface.js        DOM: start screen, HUD, info panels, toasts, classic page
    HeroRobot.js        the animated character on the classic page (loaded on demand)
    Radar.js            a WebGL radar screen, ported from React Bits (see Credits)
    BugRadar.js         the Test Lab panel's bug radar: the real bugs around the car on the radar
    LogoLoop.js         an endlessly scrolling row of logos, ported from React Bits (see Credits)
    ToolLoop.js         turns a toolkit list into a LogoLoop of tool logos
    Controls.js         keyboard, touch joystick and buttons
    Minimap.js          the round map
    Sound.js            engine, horn and bump sounds (Web Audio, no files)
  utils/
    textures.js         canvas-drawn textures for boards, signs, crates, pads
    pixelFont.js        the 7-row pixel font used for the big 3D letters
    math.js, random.js
```

- **Driving** uses hand-written arcade physics (grip, drift, steering that tightens at speed), not a full vehicle simulation, so it stays predictable and fun.
- **Props** (letters, crates, pins) are real rigid bodies in cannon-es. The car is a kinematic body there: it shoves props around but is never pushed back. A knocked-over word or crate stack waits 20 seconds (and for the car to move out of its spot), then its pieces fly back one by one; bowling pins reset a few seconds after the roll.
- **Almost everything is generated in code**: the island, cars, textures and sounds. Besides the JavaScript, two web fonts and the resume PDF, the only downloads are the two 3D characters (the Stormtrooper after the island is ready, the Soldier when the classic page opens).
- **Performance**: it keeps a steady 60 fps on an Intel UHD 630 integrated GPU. If the first few seconds of driving are slow, it drops to a lighter setting (pixel ratio 1, smaller shadow map).

## Credits

- Soldier model (classic page): [mixamo.com](https://www.mixamo.com/), from the three.js examples.
- Dancing Stormtrooper (About area): by [StrykerDoesAnimation](https://sketchfab.com/strykerdoesgames), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), from the three.js examples. It's loaded in the background after the island is ready (`public/models/stormtrooper/`, about 2.5 MB).
- Radar and LogoLoop: adapted from the [React Bits](https://reactbits.dev) components by David Haz (MIT + Commons Clause). Their licence notice is at the top of `src/ui/Radar.js` and `src/ui/LogoLoop.js` and is kept in the built files.
- Brand icons in the toolkits: [Simple Icons](https://simpleicons.org) 16.30.0 (CC0 1.0). Each logo belongs to its brand.
