# ESP32 3D Pinout Explorer

## Objective

A clean, polished, interactive **3D** pinout explorer for ESP32 development boards, built with
vanilla JS + Three.js. First release covers **ESP32 DevKit v1** and **ESP-32S / NodeMCU-32S**.
Every exposed pin must show its complete, source-verified capability set and its restrictions.

## Problem

Pinout references for the ESP32 are scattered across datasheets, community pinout images and blog
posts, and they frequently disagree. The two most common mistakes — inverting the ADC1/ADC2 channel
maps, and believing GPIO18 has a DAC3 — produce hardware that does not work. A single accurate,
interactive, visual reference removes the whole class of error.

## Why now

Verified pin data is resolved and traceable to primary Espressif sources (see **Data provenance**).
Implementation can start without further research.

## Scope

In scope:

- Procedural 3D board model (no external 3D assets): PCB, silkscreen, headers, ESP-WROOM-32 module
  with antenna, CP2102, regulator, EN/BOOT buttons, micro-USB, power LED, GPIO2 LED.
- Two boards sharing one pin dataset, differing by cosmetic skin + silkscreen convention.
- Full per-pin information panel: GPIO, silkscreen, Arduino alias, ADC, touch, DAC, UART, SPI,
  I2C, PWM, RTC, JTAG, and every restriction.
- Interactions: orbit/zoom/pan, hover highlight, click to select, board switch, flip to underside,
  explode view, capability filter, safe-pin highlight, Wi-Fi toggle (exposes the ADC2 conflict),
  power-rail coloring, 3D pin labels, search.
- Warnings engine driven by per-pin metadata (strapping, input-only, flash, ADC2/Wi-Fi, DAC, touch).

Out of scope (explicitly):

- Any board other than the two named, unless added as pure data.
- Flashing, code generation, wiring diagrams.

## Constraints

- Vanilla JS ES modules + Three.js. No framework, no TypeScript (explicit user request).
- Must run with `npm install && npm run dev`, and build to static output via `npm run build`.
- All generated artifacts (code, comments, UI copy) in **English**.
- No external 3D/model/texture downloads: geometry and textures generated procedurally in code.

## Route

Delegated direct (one writer). Triggers: touches many non-trivial files; requires broad reading of
the verified dataset before writing; exploration already completed and returned upstream.

## Data provenance (verified, not guessed)

Primary sources: ESP32 Series Datasheet, ESP32-WROOM-32 Datasheet v3.7, ESP-IDF ADC / GPIO /
DAC / cap_touch_sens references, ESP32-DevKitC V4 user guide + schematic, esptool boot-mode docs.
Corroborating: DOIT DevKit V1 schematic silkscreen layer.

Corrections applied after verification (all pre-implementation assumptions were wrong):

1. **ADC1 is GPIO32–GPIO39 only** (8 channels). **ADC2 is GPIO0, 2, 4, 12, 13, 14, 15, 25, 26, 27**
   (10 channels). The naive "ADC1 = even, ADC2 = odd" intuition is wrong.
2. **The ESP32 has exactly two DACs**: DAC1 = GPIO25, DAC2 = GPIO26. **There is no DAC3**;
   GPIO18 is not a DAC pin.
3. **GPIO34/35/36/39 have no touch function** (and no internal pull resistors, and are input-only).
   Touch CH0–CH9 = GPIO 4, 0, 2, 15, 13, 12, 14, 27, 33, 32.
4. **GPIO20 does not exist** on ESP32-WROOM-32 (PICO-V3 package only). 34 GPIOs total.
5. **The 30-pin board exposes 25 GPIOs, not 26 — GPIO0 is not broken out** on the standard
   30-pin DevKit V1 header, and neither are GPIO6–11 (flash) or GPIO37/38 (not bonded on WROOM).
   `GPIO0 = 25 GPIO + 3V3 + EN + VIN + 2 x GND = 30`, confirmed by two independent sources that
   agree character-for-character on the perimeter order. **GPIO0 is still modelled in the app and
   badged as not exposed on this header**, because it is a real, important, strapping pin.
6. The 30-pin board header order (locked, two agreeing sources):

   Left column, top to bottom:
   `EN, VP(36), VN(39), 34, 35, 32, 33, 25, 26, 27, 14, 12, 13, GND, VIN`

   Right column, top to bottom:
   `23, 22, TX0(1), RX0(3), 21, 19, 18, 5, 17, 16, 4, 2, 15, GND, 3V3`

7. **ESP-32S is not an Espressif board name.** No authoritative documentation exists. It is a
   community/market name for boards functionally identical to the DOIT DevKit V1 (same WROOM-32,
   same 30-pin layout). Modelled as a cosmetic skin over the shared pin dataset, with the
   difference disclosed in the UI. No electrical differences are claimed or invented.

Known unresolved, disclosed in-app rather than hidden: the column-to-physical-edge rotation could
not be machine-verified against a board photo, and PCB size sources conflict
(51.45x28.33 vs 51.8x28.2 vs 53.3x25.0 mm) — the model uses 51.6 x 28.4 mm.

## Acceptance criteria

- [x] `npm install` and `npm run dev` succeed with no console errors.
- [x] Both boards render, are selectable, and animate between each other.
- [x] All 30 header positions on each board are clickable and show correct data.
- [x] Pin hover highlights in 3D and updates a label; click opens a full info panel.
- [x] Capability filter (ADC / touch / DAC / SPI / I2C / UART / PWM / input-only / strapping /
      safe-only) highlights matching pins in 3D.
- [x] Wi-Fi toggle visually flags every ADC2 pin as contested.
- [x] Strapping, input-only and flash pins are visually distinct and explained.
- [x] Flip and explode views work.
- [x] Verified in a real headless browser: no console errors, WebGL canvas present, DOM
      assertions on board switch and pin selection, screenshot captured.
- [x] README documents run/build and the data provenance + known ambiguities.

## Tasks

- [x] T1 Verify pin data against primary sources — DONE
- [x] T2 Scaffold Vite + Three.js project (index.html, config, styles)
- [x] T3 Pin dataset module — all 34 GPIOs, every capability + restriction, source-linked
- [x] T4 Board definitions module — header order, silkscreen, cosmetics, per-board notes
- [x] T5 Procedural 3D board model (PCB, silkscreen texture, headers, module, components)
- [x] T6 Scene, lighting, environment, materials, render loop
- [x] T7 Interaction layer (raycast, hover, select, labels, controls, camera transitions)
- [x] T8 Board switch + flip + explode animations
- [x] T9 UI/HUD: board selector, info panel, filter bar, legend, search, warnings
- [x] T10 README + provenance notes
- [x] T11 Headless browser verification (console, DOM, screenshot) and fixes
- [x] T12 Browser verification pass: canvas resize, silkscreen, board defaults, labels, PCB colour,
      WROOM-32 module, label declutter, selection highlight
- [x] T13 Spanish UI translation (explanations, warnings, panel, legend, filters, board notes) with
      the dataset verification script made language-independent
- [x] T14 Final fix pass: real top/bottom views, module flush to the PCB edge, filter labels,
      datasheet literals in the UI, selection beam, honest legend, camera fit and buffer rounding

## Applicable checks

- `npm run build` (must complete with no errors)
- `npm run verify:data` (95 dataset assertions against the source-verified reference)
- Headless browser smoke test: load page, assert no console errors, assert canvas, assert board
  switch updates the DOM, assert pin selection populates the panel, capture screenshot.
- Authored changed lines: ~5300 across 21 source files (T1-T13) plus ~450 across 10 files for the
  final fix pass. Over the ~400 advisory budget, so delivery is sliceable into work-unit commits
  if the user later wants a repo/PR flow. No git repo exists yet, so this is advisory only.

## Progress

T1–T11 complete. The explorer is implemented and verified.

T12 and T13 complete: a browser verification pass fixed the frozen-canvas resize, the mirrored
underside silkscreen, the dead `defaultStyle`, the dishonest Labels toggle, the stale `data-silk`,
the green PCB, the canless WROOM-32 module, the overlapping label stack, the dark selection slab
and the 60-label cross-fade; the UI and the dataset prose are now in Spanish with the verification
script made language-independent. Details and evidence in the section below.

T14 complete: a final fix pass made `Arriba` and `Abajo` real vertical views (the second one by
turning the board over and looking down at the bare underside, which no control could reach
before), moved the WROOM-32 carrier flush to the board edge, stopped the label declutter from
hiding pins the active filter matched, put the datasheet literals back into the UI, softened the
selection beam, made the legend honest about what pin colour means, and made the camera framing
and the drawing buffer aspect-aware. Details, measurements and the honest leftovers in
"Final fix pass (T14)".

Delivered: Vite + Three.js scaffold, the full pin dataset, two board skins over one dataset, a
procedural board model (PCB with beveled extruded edges, runtime silkscreen canvas textures for
top and underside, two 15-pin headers, ESP-WROOM-32 module with shield can and antenna, CP2102,
AMS1117, SS14, two S8050, EN/BOOT buttons, power and GPIO2 LEDs, 100 uF bulk cap, decoupling
caps, micro-USB), an IBL studio scene (RoomEnvironment + PMREMGenerator, soft area light, key +
rim lights, soft shadows), 30 pickable pin assemblies with state-coloured marker sleeves, CSS2D
pin labels, a full information panel, and a HUD with board/silkscreen selectors, view toggles,
16 capability filter chips, search, legend, board notes and a provenance panel.

Architecture is data-driven and data is strictly separated from rendering: `src/data/*` has no
Three.js import, and adding a board is a data-only change.

Scope note: power-rail colouring is represented by the rail state colour and glyph rather than a
separate scene-wide rail mode. Everything else in the in-scope list is implemented.

## Next step

None required for this slice. Optional follow-ups if the user wants them:

- Interactive pin dragging onto a schematic sheet (explicitly out of scope for this slice).
- A board that diverges from the shared 30-pin layout, to exercise the per-board header path
  that `isExposedOnBoard()` already anticipates.
- WebGPU / an SSAO pass for the component stack, if more depth is wanted.
- The two disclosures that are still disclosures, not defects: the underside silkscreen CONTENT is
  an approximation (its orientation is exact), and the module/USB edge orientation is a rendering
  approximation.

## Verification evidence

- T1: research task returned source-linked verification; contradictions resolved against the
  DOIT DevKit V1 schematic silkscreen and two independent 30-pin orderings.
- Build: `npm install` then `npm run build` on Node 24.14.1 / npm 11.11.0, three 0.180.0,
  vite 7.3.6. Completed in ~4 s with zero errors and zero warnings.
- Dataset invariants: `validateDataset()` returns `[]`. Measured directly: `HEADER_LEFT` = 15,
  `HEADER_RIGHT` = 15, total 30, 25 GPIO, rails `EN, GND, VIN, GND, 3V3`, 2 GND positions, 25
  unique GPIO, `buildBoardRecords()` returns 30 records all marked exposed.
- Pin dataset measured directly: ADC1 channels `[0,3,4,5,6,7]` on GPIO 32,33,34,35,36,37,38,39;
  ADC2 channels `[0..9]` on GPIO 0,2,4,12,13,14,15,25,26,27; DAC channels `[{1,25},{2,26}]`;
  touch on 34/35/36/39 all `null`; GPIO18 `dac = null`; GPIO20 `direction = absent`; strapping
  pins exactly 0, 2, 5, 12, 15; input-only exactly 34, 35, 36, 39; all 16 Arduino aliases and
  all 10 touch aliases resolve to matching GPIO numbers; 0 malformed entries.
- T11, real headless Chrome 153 (`--headless=new`, SwiftShader WebGL) driven over the Chrome
  DevTools Protocol against the production build: **0 console errors, 0 uncaught exceptions**
  after exercising board switch, silkscreen switch, Wi-Fi toggle, DAC filter, filter clear,
  search `A14`, search-result selection, hidden-pin search `GPIO0`, and the explode / labels /
  top / bottom toggles. The only console output is a SwiftShader `GPU stall due to ReadPixels`
  performance notice triggered by the screenshot call itself, not by the app.
- DOM assertions: `.pin-label` count = 30 and `#label-host` children = 30; still exactly 30 after
  a round-trip board switch (no stale duplicate label layer). Board switch updates
  `#board-name` to "ESP-32S / NodeMCU-32S" and `state.boardId` to `esp32s`, then back to
  `devkitv1`, with 30 pins on both. Silkscreen switch yields `VP/IN/ADC1:0/A0` labels under the
  DOIT convention and `D36/IN/ADC1:0/A0` under the clone convention. DAC filter matches exactly
  `gpio-25` and `gpio-26` and dims 28 labels. Wi-Fi toggle marks exactly 9 labels with the `~`
  glyph, which is the 9 ADC2 header pins. Selecting search result `A14` sets
  `#pin-panel[data-pin="gpio-13"]` and the panel contains "GPIO13" and "HSPID". Searching
  `GPIO0` sets `#pin-panel[data-pin="hidden-gpio0"]` and the panel explains "not broken out".
  16 filter chips, 9 legend entries and 8 provenance sections render.
- Screenshot captured at 1600x1000 and stored as `docs/screenshot.png`.

### Bugs found by verification and fixed

1. `damp` was not imported in `pinMeshes.js` after a rewrite, so `updatePins()` threw a
   `ReferenceError` on every animation frame. Nothing rendered and no label ever reached the DOM.
2. `crossFade()` used the same tween tag `boardfade` for the outgoing and incoming tweens.
   `Tweener.to()` cancels same-tag tweens, so the outgoing fade was killed on the next line: the
   old board never faded out and both boards stayed stacked in the scene. Split into
   `boardfade-out` / `boardfade-in`.
3. `ExtrudeGeometry` places its bevel *outside* the `[0, depth]` range, so the PCB top surface
   sat at y = +0.14 mm and the silkscreen plane at y = +0.004 mm was buried inside the board. The
   extrude depth is now reduced by both bevels and the mesh offset so the finished top lands
   exactly on y = 0.
4. Both GND header positions resolved to the same record id `rail-gnd`, so the label map was
   keyed by a colliding id and one GND label never received its interaction classes. Records now
   carry a unique per-position `key` alongside the logical `id`.
5. `CSS2DRenderer` only ever appends a label element, never removes one, so a board switch left
   30 stale label elements in the DOM. Hidden boards now detach their labels explicitly.
6. `[...pin.notes]` threw for the pins that define no `notes` array, aborting the info panel.
7. The short ADC label mark `A1<channel>` collided visually with the Arduino alias `A10`; it is
   now `ADC1:0` / `ADC2:8`.

### Bugs found by independent data verification and fixed

The writer's own check passed, so the dataset was re-audited against the source-verified reference
by asserting the facts programmatically rather than by reading. Three real factual errors surfaced.

8. **UART1 TX/RX were inverted.** The dataset had `tx: 9, rx: 10`. Espressif IO_MUX assigns
   `U1RXD` to chip pad 28 = **GPIO9** (`SD_DATA_2`) and `U1TXD` to pad 29 = **GPIO10**
   (`SD_DATA_3`). Corrected to `rx: 9, tx: 10`. This matters because those are exactly the two
   flash pads that make `Serial1` unusable on a WROOM-32, so the direction is part of the trap
   users need explained.
9. **GPIO0 strapping role was `MTDI / boot mode`.** MTDI is **GPIO12 exclusively**. GPIO0 is the
   chip boot-mode select (HIGH = SPI-flash boot, LOW = serial download). Corrected.
10. **GPIO2 strapping role was `MTDI (shared with GPIO12)`.** Also wrong. GPIO2 is the boot-mode
    bit *paired with GPIO0*, not a JTAG pad. Corrected, and the HIGH/LOW consequences rewritten to
    match: HIGH together with a LOW GPIO0 selects an SDIO boot mode the WROOM-32 flash cannot
    satisfy, so the board fails to boot.

Root cause of 9 and 10: the JTAG pad names (`MTDI`, `MTDO`) were applied to strapping pins that
share the *behaviour* (boot configuration) with the real MTDI/MTDO pad, without checking whether
the pad name actually belongs to that pin.

Regression guard added: `scripts/verify-data.mjs`, wired as `npm run verify:data`. 76 assertions
covering the ADC1/ADC2 channel maps, the two-DAC rule, the touch map, input-only and flash pins,
the nonexistent vs not-bonded-out distinction, the strapping set with both boot states, the
Arduino alias set, the header order and rail set, and the peripheral default maps.

Critically it asserts **negative** invariants, which is what caught bug 9/10:
`only GPIO12 may be labelled MTDI` and `only GPIO15 may be labelled MTDO`. The positive assertions
`GPIO12 is MTDI` / `GPIO15 is MTDO` both passed while GPIO0 and GPIO2 were wrongly claiming MTDI.

Also corrected in the same pass: a garbled HSPI note claimed HSPI's pins are problematic *because*
they are strapping/JTAG, when the actual reason HSPI is the common bus is the opposite — unlike
VSPI, none of the four collides with a default peripheral function.

### Verification method lesson

Writing the assertion script produced 23 false failures on first run because it guessed property
names (`exists`, `inputOnly`, `flash`, `strapping.requirement`) instead of reading the real schema
(`direction: 'absent' | 'input-only' | 'internal-only'`, `reasons.notExposed`,
`strapping.high` / `strapping.low`). A verification script that assumes the schema it is checking
will "fix" correct data. The schema was read, and the two genuinely wrong results (the MTDI
misattributions) were separated from the twenty-one wrong expectations.

## Final state (T12-T13 verification passes)

Two further independent browser-verification passes ran against the production build. Net result:
**13 defects found and fixed, 2 disputed claims adjudicated, 1 false positive confirmed.**

### Fixed, with measured evidence

| Defect | Evidence |
| --- | --- |
| Canvas CSS size frozen after boot (`setSize(w,h,false)`) | Board aspect invariant 1.5158/1.5142/1.5122/1.5164/1.5158 across 5 viewport sizes (±0.14%); CSS box == client rect == host rect; buffer == `round(css·dpr)` |
| Silkscreen underside plane rotated +90° about X, v axis pointing at +Z | Underside now reads `ESP-WROOM-32` / `REV 1.0` / `ESP32 DevKit V1` upright from a true bottom pole |
| `Arriba` was a decoy at 42.9° off vertical | Now 0.60° off vertical, margin >= 48 px per edge; `minPolarAngle` 0.08 -> 0.004 rad |
| `Abajo` flip and camera cancelled, bottom silkscreen unreachable by any control | Board turns over and the camera looks straight down at the bare face; underside silk, 30 pads, keep-out and mounting rings visible |
| `setBoard()` ignored `silk.defaultStyle` | ESP-32S reads `D36`, DevKit reads `VP`; a manual override survives board switch, Wi-Fi, label toggles and filters |
| Labels toggle left 1 label visible | 14 -> 0 -> 14; 0 overlapping pairs; DOM converges to 30, never stacks (max 25 over 356 sampled frames) |
| `.pin-label[data-silk]` never updated | 0 mismatches across clone/doit/clone on both boards |
| DAC filter matched 2 pins but rendered 1 label | All 16 filters now render == matched: safe 17/17, strapping 4/4, input-only 4/4, adc1 6/6, adc2 9/9, dac 2/2, touch 9/9, uart 6/6, spi 14/14, i2c 2/2, pwm 21/21, jtag 4/4, rtc 21/21, recommended 7/7, alias-trap 2/2, power 5/5 (4 ids, 5 positions) |
| Datasheet literals paraphrased in the UI (`ADC2 canal 8`, `JTAG TDO`) | Now shows `ADC2_CH8`, `MTDI (JTAG TDI)`, `MTDO (JTAG TDO)`, `MTCK`, `HSPIWP` for GPIO2, `VSPICS0` for GPIO5 |
| Selected-pin beam was a wide opaque white shaft | Radius 0.70 -> 0.36 mm, height 22 -> 14 mm, peak opacity 0.85 -> 0.42; column 9 px vs ~2.1 mm before |
| Legend implied capability colours were pin colours | Chip swatches removed; both legend sections now state pin colour = state |
| WROOM-32 overhung the PCB edge by 2.0 mm | `module.x0` 2.3 -> 0.3; overhang -0.16 mm from world AABBs, 1 px rendered |
| `Math.floor` in three buffer-size paths; camera margin 4 px at 1024x769 | Buffer at DPR 1.5 = 1028x1064 = `round(css·dpr)`; margin 27 px at 1024x769, 14 px at 1400x420 |

### Adjudicated disputes

- **Top silkscreen was NOT 180° rotated.** The first verifier's claim was a false positive read from
  an oblique frame. Adjudicated with a genuine straight-down frame: silhouette aspect 1.8259 vs
  theoretical 1.8169, title reads `ESP32 DevKit V1` with `E` leftmost and no mirroring, and the far
  row reads `A6 A7 A4 A5 A8 A9` in exact dataset index order. Both faces correct. The fix author's
  refusal to "fix" correct code was the right call, and the false comment was replaced with a
  checkable one.
- **WROOM-32 proportions were always correct.** Measured 25.1 x 17.4 mm against 25.5 x 18.0, can
  covering 14 of 25.5 mm with the antenna end exposed. The orchestrator twice misjudged this from
  oblique screenshots before measurement settled it.

### Disclosed limitations (not fixed)

- 5 filters still end with 1-2 matched label pairs touching at 684 px viewport width; both labels
  stay visible, which is the deliberate trade against hiding a matched pin.
- Header pins are not clickable in the underside view.
- Underside silkscreen *content* and module/USB edge orientation remain approximations.
- The topbar scrolls horizontally below 1000 px by design.
- Header column-to-physical-edge rotation and exact PCB size remain unverified (see Provenance).

## Git repository

Initialised on branch `main` at the user's explicit request. Single initial commit:

- `1056c05 feat: add interactive 3D pinout explorer` — 36 files, 9,240 insertions.

`.gitignore` excludes `node_modules/`, `dist/` and editor/OS noise. `.gitattributes` pins
`* text=auto eol=lf` because this machine has `core.autocrlf=true`, which would otherwise rewrite
every file's line endings for anyone cloning on Linux or macOS.

**This initial commit is one large work unit (~9,240 lines) and sits far above the ~400-line
advisory review budget.** That is a deliberate, disclosed exception rather than an accident: the
feature was built as a single delegated unit and the fixes that followed were interleaved in the
same files, so any split into synthetic history would produce commits that do not build
independently. If the user later wants PRs, the honest options are to accept a `size:exception` or
to treat the first commit as a squashed base and review subsequent changes as normal slices.

## Verification method notes

- Playwright `page.evaluate` runs in an **isolated world** and cannot see `window.__esp32Explorer`.
  A previous verifier mistook this for an app bug. Reach app state by injecting a `<script>` that
  copies a value into a DOM attribute, then reading the attribute.
- `readPixels` returns zeros unless called inside a double-`requestAnimationFrame`
  (`preserveDrawingBuffer:false`). This produces a convincing false "WebGL did not render" result.
- A mouse drag starting in the canvas bottom-left hits the "Procedencia" disclosure bar and silently
  never reaches OrbitControls. Start drags in the upper-middle of the canvas.
- A screenshot named "top view" is not evidence of a top view. Verify the camera axis numerically
  (angle off vertical) and read the glyphs, rather than trusting the label or the button.
- A real GPU is available (ANGLE / NVIDIA RTX 4060 Ti, D3D11); SwiftShader is not required.

---

## Browser verification pass (T12) and Spanish UI (T13)

A second, independent pass in a real headless Chrome against the production build, driven over
Playwright, with the dataset left untouched apart from prose. Scope: the ten reported bugs, then
the Spanish translation of the UI and the dataset prose. The pin data was **not** modified: a
structural snapshot (every key, every numeric value, every channel map, header order, alias set
and peripheral default, with prose fields masked) was taken before the translation and diffed
after; the only differences are the translated parentheticals inside `roles` and one peripheral
display name.

### Bugs found and fixed

11. **The canvas froze at its boot size after a window resize.** `resize()` called
    `renderer.setSize(w, h, false)`. The `false` is `updateStyle`, so `canvas.style.width` /
    `height` were never written after the first call, and the first call used the default
    `updateStyle=true`, which is why boot looked correct and the bug hid. At 1600x1000 a
    1204x940 buffer was squashed into the 884x660 boot box (wrong aspect, dead space); at 900x700
    it overflowed and clipped. `setSize` is now called with `updateStyle` enabled, and the pixel
    ratio is re-read on every resize instead of only at construction, so the buffer stays
    DPR-crisp when the window moves to a display with a different `devicePixelRatio`.
12. **The underside silkscreen was mirrored along Z.** The bottom overlay plane is rotated
    `+90` degrees about X, so its texture v axis points at world **+Z** — the opposite direction
    to the top layer. `drawBottomSilk` used the top layer's `Z(z) = (z + d/2) * s`, so the title
    block landed on the wrong side of the board and the three lines came out in reverse order.
    `Z` is now mirrored about the canvas centre. Verified by orbiting under a non-flipped board
    and reading it: the board name reads left to right with the USB on the left, and the block
    reads ESP-WROOM-32 / REV 1.0 / ESP32 DevKit V1 top to bottom as drawn
    (`docs/07-underside-silkscreen.png`).
13. **`silk.defaultStyle` was dead data.** `setBoard()` never applied it, so switching to the
    ESP-32S kept the DOIT convention and GPIO36 still read `VP`. Board switches now apply the
    target board's `defaultStyle`, and a convention chosen by hand is remembered per board, so a
    later board switch does not silently undo a deliberate choice.
14. **The Labels toggle lied.** `applyState` set `object.visible = group.visible && (visible ||
    isSelected || isHovered)`, so a selected pin kept a label with the toggle read off. The
    toggle is now authoritative: labels off means no labels. Selection stays discoverable
    through the pin itself (glow, lift, highlight beam) and through the information panel, which
    always shows the selected pin — verified with labels off.
15. **`data-silk` went stale.** It was written once in `createLabel` and never updated, so after a
    convention change the visible text said `D36` while the attribute still said `VP`.
    `updateLabel` now writes it.
16. **The DevKit V1 PCB was bright green.** Green is the load-bearing legend colour for "safe pin:
    no restrictions", so a green board made the whole object read as a safety signal, and the
    colour is factually wrong. The DevKit V1 is now a deep desaturated blue (`0x0f2c56`), far
    from the bright `#0072b2` that marks input-only pins; the ESP-32S skin is a near-black
    indigo (`0x141c2e`) so the two boards stay distinct. No PCB colour now collides with the
    state palette.
17. **The WROOM-32 had no shield can and the antenna read as a slab.** The model drew a dark green
    carrier with a flat grey box over 19.5 of the 25.5 mm and a coarse scribble at the far end.
    Rebuilt to the real part: a cream laminate carrier, a metal shield can covering the chip
    section only (14 mm, with a proud skirt and a lid plate, `metalness: 1`, `roughness: 0.19`,
    `envMapIntensity: 1.9` and a crown-to-skirt gradient tint so it reads as metal under the
    RoomEnvironment IBL rather than as grey plastic), the 40 MHz crystal in the exposed strip, and
    a printed meander antenna on an aspect-matched texture over the outer 11.5 mm.
18. **Labels overlapped into an unreadable stack.** Thirty labels on a 50 mm board collide badly.
    There is now a per-frame declutter pass: candidates are placed in priority order (selected >
    hovered > filter match > header order, left column before right) and any label whose box
    overlaps one already placed is hidden, so the labels the user is working with always win and
    the set re-resolves as the camera orbits. Label geometry is measured once per content change
    (with a text-length estimate for labels the declutter has hidden, whose `offsetWidth` is 0);
    `controls.update()` now runs before the updaters so the pass projects against the current
    frame's camera.
19. **The selection highlight read as an opaque dark box.** The beam was an untapered cylinder at
    the pin's state colour, additively blended and tone-mapped, so a safe (green) pin got a dim
    green column with a hard elliptical top. It is now a cone that is wide at the pin and tapers
    upward, additively blended with a vertical falloff texture, `toneMapped: false` and a
    near-white colour lightly tinted by the state colour, so it reads as emitted light. A stray
    `ctx.restore()` with no matching `save()` in `drawBottomSilk` was removed on the way past.
20. **Both boards' labels stacked during a cross-fade.** The outgoing board's label elements stayed
    in the CSS2D layer for the whole 620 ms fade, so 60 labels were on screen at once. Detaching
    the elements was not enough on its own — the renderer re-appends any visible object on the
    next frame — so the outgoing board's labels are now *suppressed*: they leave the DOM
    immediately and stay invisible until that board becomes active again. Verified by sampling
    the label count on every frame of a board switch: the maximum is 30, never 60.
21. **The verification script asserted English prose.** Four assertions matched English wording
    (`/not bonded out/i`, `/will not boot|brownout/i`, `/NOT to the ESP32/i`,
    `/timeout|arbitrat|one of them/i`), which a translation would have broken. They are now
    structural or keyed to language-independent tokens: the not-bonded guard asserts
    `flags.notBonded`, the `absent` direction, a non-empty reason and the `WROOM-32` token; the
    GPIO12 boot-failure guard asserts the 1.8 V / 3.3 V figures that make it a failure; the I2C
    guard asserts `LEDC`, `ESP32-S2` and `ESP32-C3`; the ADC2 guard asserts `ESP_ERR_TIMEOUT`
    and `adc2_get_raw`. No assertion was deleted, and two were added (every restriction has a
    non-empty title and detail; every strapping pin has all four fields). 76 -> 90 assertions.
    The MTDI/MTDO exclusivity assertions are English-token based on datasheet pad names and are
    unchanged.

### The silkscreen orientation claim, and what the evidence actually shows

The brief stated that the top silkscreen renders 180 degrees rotated, glyph order reversed *and*
inverted, and that the comment claiming a rendered-frame confirmation was therefore wrong. The
comment was indeed unverifiable and has been replaced with a checkable statement, but the
rotation **could not be reproduced**, and the accumulated evidence says the top layer is already
correctly oriented. Four independent checks, all against rendered frames:

1. Corner markers drawn at the four canvas corners land on the four expected board corners in
   every camera position (canvas top-left on the far/USB-left corner, and so on).
2. A triangle drawn with its apex toward canvas +x has its apex toward world +X on screen, so the
   texture's x axis is not reversed.
3. Large diagnostic glyphs `PbdF` (chosen because a 180 degree rotation maps them to `Ⅎ q b d`,
   a completely different reading) render as `P b d F`, in the right order and with the bowls in
   the right halves, in the app's real default view, its real three-quarter top view and its real
   underside view.
4. A frame rendered from directly above reads "ESP32 DevKit V1" upright with the USB on the left
   and the pin labels in header order (`A6 A7 A4 A5 A8 A9` along the top row).

The reported symptom is reproducible only in *oblique* views, where the board is foreshortened to
roughly 40% and the glyphs are sheared hard enough to look inverted at small sizes; that is a
reading artefact, not a mapping error, and the same frames show the CSS2D labels (always
screen-upright) reading correctly side by side with the printing
(`docs/08-silkscreen-vs-dom-labels.png`). Reported as **not reproduced** rather than "fixed",
because claiming a fix would mean changing a mapping that is already right.

One genuine orientation bug did exist and was fixed: the underside (item 12).

### Not changed, deliberately (T12/T13) - both later fixed in T14

These two were disclosed rather than fixed in the T12 pass, and are **no longer true**: see
"Final fix pass (T14)" below. The original wording is kept so the history of the pass is not
rewritten.

- **The "Abajo" (Bottom) button showed the component side from below, not the bare underside.**
  `flipBoard` rotated the board 180 degrees about X AND the camera moved below, so the face turned
  towards the camera was the original top face. The underside was reachable only by orbiting under
  a non-flipped board (which is how item 12 was found and verified). Left alone as a behaviour
  change, not a bug fix.
- **The WROOM-32 carrier overhung the board's right edge by about 2 mm** (`LAYOUT.module.x0`
  2.3 + 25.5 against a 25.8 mm half-width). Pre-existing, and disclosed as an approximation.

### T13 translation

`index.html`, `src/ui/hud.js`, `src/ui/pinPanel.js`, the filter chip labels and hints in
`src/interaction/filters.js`, the hover readout in `src/main.js`, and the prose fields of the
three data files (`restrictions[].title` / `.detail`, `strapping.high` / `.low` / `.role` /
`.boardDefault`, `reasons.notExposed`, `notes[]`, `flags.onboardLed`, the rail descriptions, the
board subtitles, notes and silkscreen-convention labels, and the peripheral notes) are now in
neutral, professional Spanish. Datasheet pad names (`MTDI`, `VDD_SDIO`, `SENSOR_VN`, `HS2_DATA0`,
`EMAC_TXD0`, `RTC_GPIO9`, `VSPICLK`, `CLK_OUT1`...), the technical terms kept in English by
decision (`GPIO`, `ADC1`/`ADC2`, `DAC`, `PWM`, `SPI`, `I2C`, `I2S`, `UART`, `CAN`, `JTAG`, `SDIO`,
`RTC`, `strapping`, `touch`, `input-only`, `pull-up`, `bootloader`, `Wi-Fi`, `esptool`,
`arduino-esp32`, `MicroPython`, `ESP-IDF`, the API names, the pin names and silkscreen text, the
source citations and the datasheet titles), the code, comments, identifiers, CSS class names and
all data keys are unchanged. `index.html` now declares `lang="es"`.

### T12/T13 verification

- `npm run build`: clean, no errors or warnings.
- `npm run verify:data`: 90 assertions, all pass (95 after T14 added five role-literal guards).
- Structural snapshot diff across the translation: identical except the translated parentheticals
  in `roles` and one peripheral display name.
- Headless Chrome (Playwright, `--no-sandbox --disable-dev-shm-usage --enable-unsafe-swiftshader`,
  real ANGLE/GPU WebGL) against `npm run preview` of the production build: **0 console errors, 0
  uncaught exceptions**, 18 automated DOM/viewport assertions, all pass:
  - canvas CSS box equals `clientWidth/Height` equals the host rect at 1600x1000 **and** at
    900x700 after a real `setViewportSize`, aspect matches, and the buffer is exactly
    `client * devicePixelRatio` (1204x940 CSS / 2408x1880 buffer at DPR 2).
  - switching to the ESP-32S applies the `clone` default; a hand-picked convention survives a
    round trip to the DevKit V1 and back; clearing the override returns the board default.
  - selecting a pin and switching labels off hides **all** labels (0 visible, including the
    selected one) while the panel still shows `GPIO13` and `HSPID`.
  - `data-silk` matches the dataset's expected silkscreen text for every label in the DOM, before
    and after a convention change, and each label's text starts with its `data-silk` value.
  - zero overlapping pairs among the visible labels; the label count during a board switch never
    exceeds 30 across 24 consecutive animation frames.
  - the DAC filter matches exactly `gpio-25` and `gpio-26`.
- Screenshots in `docs/`: `01-default-view.png`, `02-top-view.png`,
  `03-silkscreen-top-view.png`, `04-selected-pin.png`, `05-dac-filter.png`, `06-exploded.png`,
  `07-underside-silkscreen.png`, `08-silkscreen-vs-dom-labels.png`. **All of these were
  regenerated by T14**, and `07-underside-silkscreen.png` was replaced by
  `07-underside-view.png`: the old one showed the underside reached by orbiting under a non-flipped
  board, which is no longer how the underside is reached, and it predated the module move.
- One consequence to note: with decluttering, the number of `.pin-label` elements in the DOM is
  no longer a fixed 30. Culled labels are not in the layer, so the earlier "exactly 30 elements"
  acceptance check no longer holds and was replaced by the no-overlap and count-never-exceeds-30
  checks above.

---

## Final fix pass (T14)

Eight reported defects, fixed and verified against the production build in a real headless
Chrome. The T12/T13 work (canvas resize, silkscreen orientation, board default convention, the
Labels toggle, `data-silk`, the PCB colour) was re-checked, not rewritten, and still passes.

### What changed, per defect

**1. `Arriba` was a decoy (42.9 degrees off vertical).** `viewTop` moved the camera to a fixed
`(20, 60, 50)`, which is 42.9 degrees off the vertical, and `controls.minPolarAngle = 0.08`
(4.6 degrees) meant a straight-down view could not be reached by dragging either - which is why
the T12 pass had to fight the clamp to verify the silkscreen. Both are fixed:

- `AXIAL_DIR` in `scene.js` is a unit vector 0.6 degrees off the vertical. Not zero on purpose:
  with the camera exactly on the vertical axis the orbit basis is degenerate (the world up vector
  is parallel to the view direction) and the screen-up direction stops being defined. 0.6 degrees
  is a genuine pole view and three orders of magnitude inside "top view".
- The hair of tilt points along **+Z**, not +X. That is not cosmetic: OrbitControls derives the
  screen basis from `cross(worldUp, viewDirection)`, so a tilt toward +X renders the board
  portrait with the silkscreen running up the side. Tilting toward +Z keeps the reading the
  default view already uses - +X right (USB left, antenna end right), -Z up, left header column on
  the top row. This was found by looking at the first straight-down screenshot.
- `minPolarAngle` is now 0.004 rad (0.23 degrees): still out of the degenerate poles, and a real
  top view is now reachable by dragging.
- The distance is no longer a literal. It is solved per viewport (see 8).

Measured: `offVerticalDeg = 0.60` for `Arriba`, at 1024x769 and at 1600x1000, read from the
camera pose after the tween settles.

**2. `Abajo` cancelled its own flip.** The board was rotated 180 degrees about X *and* the camera
was moved below it, so the two transforms cancelled and the user got the component side seen from
underneath; the modelled `drawBottomSilk` underside had no control that could reach it. The
behaviour is now: **`Abajo` turns the board over and looks straight down at the face now facing
up.** That is the only self-consistent reading of the button, and it has a second benefit - the
underside is lit by the key light instead of only by its own emissive silkscreen. `viewBottom`
delegates to `viewTop` and the reason is in the code comment.

One consequence, deliberate: the pin labels live on the face that is now buried, and CSS2D has no
depth test, so they would print straight over the visible underside. The label layer is emptied
while the board is flipped (`layoutArgs.faceUp`), asserted as "0 labels shown in the Abajo view".

Measured: `flipped === true`, `offVerticalDeg = 0.60`, 0 labels visible, and the frame reads as
the bare PCB with the underside silkscreen upright (`ESP-WROOM-32` / `REV 1.0` /
`ESP32 DevKit V1` top to bottom, USB on the left), 25 gold through-hole pads in two rows, the two
mounting rings and the antenna keep-out line. The underside orientation claim from T12 is
preserved by this view, not by orbiting under a flipped board.

**3. The WROOM-32 overhung the PCB by 2.0 mm.** `LAYOUT.module.x0` was 2.3, so the carrier ran
2.3..27.8 against a PCB half-width of 25.8. It is now 0.3, so the carrier runs 0.3..25.8: the
antenna tip is flush with the board edge, which is what the antenna needs (the board edge is its
ground reference). Only the placement changed - the carrier is still 25.5 x 18.0 mm, the can still
covers 14 mm of the 25.5, and everything on the other half is at a negative x, so nothing
collides.

Measured two ways: the world AABB of the carrier against the board group gives an overhang of
**-0.16 mm** (0.16 mm inside the 0.16 mm PCB bevel, i.e. exactly flush with the nominal edge), and
a rendered-frame scan of the straight-down view finds the cream carrier's right edge at x = 1027
px against the board's right edge at 1028 px - **1 px, about 0.06 mm**.

**4. The DAC filter matched 2 pins and rendered 1 label.** `gpio-25` and `gpio-26` are header
positions 9 and 10, so their labels collide and the declutter culled one. Two changes in
`labels.js`:

- A label that cannot be placed at its own anchor now searches a ladder of screen-vertical offsets
  (`0, ±8, ±16, ±24, ±40, ±56` px) for a slot that is inside the canvas and clear of everything
  already placed. The ladder is dense on purpose: the two header rows are about 25 px apart at a
  narrow viewport, so a coarse ladder puts a shifted label straight onto the label in the next
  row. The offset is applied through the CSS2DObject's own `center`, so the label still points at
  its pin.
- A label the **active filter matched** is never hidden. Priority is now selected > hovered >
  matched-by-the-active-filter > header order, and anything at priority 2 or better keeps its slot
  even when nothing is clear, taking the least-bad offset instead of disappearing. Plain
  header-order labels are still culled, which is what decluttering is for.

The `filterActive` test in the priority is load-bearing and easy to get wrong: with no filter
every pin "matches", so treating them all as protected leaves the declutter with nothing to cull.
That regressed the T12 "zero overlapping pairs" check until it was fixed, and it is called out in
the code comment.

Per filter, matched positions vs rendered labels, all from one headless run at 1024x769
(16 filters, `bad: []`):

| filter | matched | rendered | | filter | matched | rendered |
| --- | --- | --- | --- | --- | --- | --- |
| safe | 17 | 17 | | jtag | 4 | 4 |
| strapping | 4 | 4 | | rtc | 21 | 21 |
| input-only | 4 | 4 | | recommended | 7 | 7 |
| adc1 | 6 | 6 | | alias-trap | 2 | 2 |
| adc2 | 9 | 9 | | i2c | 2 | 2 |
| dac | 2 | 2 | | pwm | 21 | 21 |
| touch | 9 | 9 | | uart | 6 | 6 |
| spi | 14 | 14 | | power | 5 | 5 |

(`power` matches 4 ids but 5 header positions, because both GND pads share the id `rail-gnd`;
the label count is compared against positions.) At 1600x1000 the same table holds and there are
**zero** overlapping label pairs in every filter. At 1024x769, where the canvas is 684 px wide and
thirty labels do not physically fit, five filters (`safe`, `adc1`, `adc2`, `pwm`, `rtc`) end with
1-2 pairs of *matched* labels touching each other. That is the deliberate trade: both labels stay
readable and the count is exact, instead of a matched pin silently losing its label. The
unfiltered view still has zero overlapping pairs at both sizes.

**5. Datasheet literals were paraphrased away.** The user asked for Spanish explanations with
datasheet literals in English. What the UI showed and what it should show:

| shown before | now | where |
| --- | --- | --- |
| `ADC2 canal 8` | `ADC2_CH8` | panel ADC row, hidden-pin panel, hover readout, 3D label mark |
| `Canal touch capacitivo 8` | `T8 (canal touch capacitivo)` | panel Touch row |
| `Salida DAC1` | `DAC1 (salida analógica)` | panel DAC row |
| `JTAG TDO` (GPIO15) | `MTDO (JTAG TDO)` | stored `roles.jtag`, shown in the panel |
| `JTAG TDI` (GPIO12) | `MTDI (JTAG TDI)` | stored `roles.jtag`, shown in the panel |

GPIO13/GPIO14 already stored `MTCK (JTAG TCK)` and `MTMS (JTAG TMS)`; GPIO12 and GPIO15 were the
two that stored a paraphrase, so the stored strings were corrected rather than the display path
rewriting them. No numeric fact, channel map, header order, id, key, `direction` or state string
was touched, and nothing was deleted. `roleGroups()` in `pinPanel.js` already passed the stored
strings through untouched, and the `roles` groups it reads (`uart`, `spi`, `clkOut`, `emac`,
`jtag`, `sdio`, `rtc`) are all seven groups the dataset defines, so every stored role reaches the
UI.

`npm run verify:data` gained five guards for this (90 -> 95 assertions): GPIO12 carries `MTDI`,
GPIO15 carries `MTDO`, GPIO2 carries `HSPIWP` and not the VSPI chip select, GPIO5 carries
`VSPICS0`, and all four JTAG pads of GPIO12-15 lead with the datasheet name. The existing
negative guards (`only GPIO12 is MTDI`, `only GPIO15 is MTDO`) still pass: they key on
`strapping.role`, which was not changed.

**6. The selection beam read as an opaque white shaft.** A cone of radius 0.70 mm (1.05 mm at the
wide end), 22 mm tall, at 0.85 peak opacity with a gentle falloff. Now: radius **0.36 mm**, height
**14 mm**, peak opacity **0.42**, and a steeper gradient that is already at 0.34 by a fifth of the
height and at 0.1 halfway up, so it dissolves instead of ending in a hard cap. Additive blending,
`toneMapped: false` and the slight state-colour tint are unchanged, so it still carries the pin's
colour to anyone who cannot see the state glyph.

Measured, not asserted: reading the WebGL canvas in a tight window around the selected pin, the
mean luma around the pin goes from 44.0 to 48.4 (1024x769) and from 44.4 to 53.4 (1600x1000), so
the glow is clearly there, and the column profile peaks at +15 luma with only **9 px** (1024x769) /
15 px (1600x1000) of width above half of that - about 0.7 mm on screen, versus roughly 2.1 mm
before. The previous build was not re-measured, so that last figure is the geometry, not a
rendered number.

**7. The legend claimed pin colours that no pin has.** The state legend was honest, but every
capability chip carried a swatch from `CAP_COLORS` - `dac` `#cc79a7`, `touch` `#f0e442` - and pin
colour encodes **state only**, so those two swatches described a colour that appears on no pin
anywhere. Fixed by making the legend state the division instead of implying it:

- The chips no longer have a colour at all. The marker is a neutral ring (`currentColor` at 50%),
  solid only while the chip is active. The `color` field is gone from every entry in `FILTERS`, so
  the dead data went with it.
- The legend has a lead line: "Colores de los pines: cada pin lleva el color de su **estado**.
  No hay ningún color por capacidad."
- The filter section says the same thing from the other side: "Estos chips son filtros, no
  colores... Al activar un chip, los pines que no coinciden se atenúan."
- No per-capability pin colour was invented. The state colour remains the load-bearing signal, and
  the filter still works by dimming, which is what it always did.

**8. Two smaller ones.** The buffer: `scene.js` no longer contains the `Math.floor` calls the
report describes - the current code delegates sizing to `renderer.setPixelRatio` +
`renderer.setSize`, and three's own `setSize` floors `width * pixelRatio` internally, which is
where the pixel was being lost. The fix rounds the target buffer size here and feeds the ratio
back as the effective one, so the buffer is exactly `round(css * dpr)` while the CSS box stays
exactly the host box. This was reasoned about, then actually measured: with
`deviceScaleFactor: 1.5` and a 685 px host the buffer is **1028 x 1064** (`round(685 * 1.5)`,
`round(709 * 1.5)`); the old path would have produced 1027 x 1063. The camera fit: distances are
now solved per viewport by `fitDistance()`, which projects the board's world AABB and iterates
until the board fills the viewport minus an 8% margin, and it re-solves on every resize while
keeping the viewing direction. `maxDistance` was raised from 190 to 420, because the fit has to be
allowed to ask for more than 190 on a short viewport or the board gets cropped exactly where the
fit was meant to save it. A bounding-sphere fit was rejected: it over-zooms a long thin board, and
the iterative box fit handles the short viewport case for free.

Measured: the 1024x769 margin that had collapsed to about 4 px is now **27 px on the tightest
edge** (28/29/180/184 in the top view, 27/28/81/132 in the default view), and 38-48 px at
1600x1000. After a real `setViewportSize` down to 1400x420 the margin is 14 px on the tightest
edge and the polar angle is 42.89 degrees both before and after, i.e. the resize moved the
distance and nothing else.

### T14 verification

- `npm run build`: clean, 26 modules, no errors, no warnings.
- `npm run verify:data`: **95 assertions, all pass** ("All data assertions passed.").
- Headless Chrome (patchright/Playwright, `channel: 'chromium'`, `--no-sandbox
  --disable-dev-shm-usage --enable-unsafe-swiftshader`, real ANGLE/NVIDIA WebGL, fresh
  `--user-data-dir` per run) against `npm run preview` of the production build:
  **45 automated checks, all pass, 0 console errors, 0 uncaught exceptions.** Run three times:
  1600x1000, 1024x769 (the viewport the margin defect was reported at), and 1025x769 at
  `deviceScaleFactor: 1.5`. All three are 45/45.
  - `Arriba`: 0.60 degrees off vertical, margin >= 48 px on every edge.
  - `Abajo`: board flipped, 0.60 degrees off vertical looking down at the up-facing side, 0 labels
    visible, margin >= 48 px.
  - module: overhang -0.16 mm geometrically, 1 px in the rendered frame, carrier still 25.5 x
    18.0 mm.
  - all 16 filters: rendered labels == matched positions (table above).
  - unfiltered default view: 0 overlapping label pairs, 30 labels in the DOM.
  - panel: `ADC2_CH8` for GPIO25, `ADC2_CH9` for GPIO26, `HSPIWP` for GPIO2, `VSPICS0` for GPIO5,
    `MTDO (JTAG TDO)` for GPIO15, `MTDI (JTAG TDI)` for GPIO12, `MTCK` and `A14` for GPIO13.
  - beam: mean luma rise 4.4 (1024x769) / 9.0 (1600x1000), 9-15 px column.
  - a real `setViewportSize` to 1400x420 keeps a 14 px margin and preserves the viewing angle
    (42.89 degrees before and after).
  - legend: no chip has an inline or computed background colour; both explanatory notes present;
    9 state swatches still rendered.
  - regressions from T12 still green: canvas CSS box == client box == host rect; buffer ==
    `round(css * dpr)`; `data-silk` matches the dataset for all 30 labels; labels off means 0
    labels including the selected one; the ESP-32S applies its own `clone` default; no stale label
    layer after a board switch.
- Screenshots in `docs/`, all from the production build and all with the camera measured first:
  `01-default-view.png` (the hero, also copied to `screenshot.png`), `02-top-view.png` (straight
  down via the real `Arriba` button), `03-silkscreen-top-view.png` (clipped straight-down frame,
  silkscreen legible), `04-selected-pin.png`, `05-dac-filter.png` (both DAC labels visible),
  `06-exploded.png`, `07-underside-view.png` (straight up onto the underside via the real `Abajo`
  button), `08-silkscreen-vs-dom-labels.png`, `09-module-closeup.png` (zoomed and panned onto the
  carrier, showing the antenna end against the board edge).

### Not fixed, and why

- **Five filters still end with 1-2 pairs of matched labels touching at 684 px wide.** Both labels
  of both pairs stay visible, which is what the defect asked for; the canvas is simply too narrow
  for thirty labels. Reported rather than papered over.
- **In the underside view the header pins are not clickable**, because they are on the buried face.
  That is correct for a bottom view - `Arriba` brings them back and the panel still shows the
  selected pin - but it is a behaviour change worth knowing about.
- **The underside silkscreen content is still an approximation** (orientation exact, content not
  verifiable against a photograph), and the module/USB edge orientation is still disclosed as a
  rendering approximation. Both were disclosed before and neither is fixable without a reference
  image.
- **The topbar scrolls horizontally below 1000 px** (`overflow-x: auto`, by design), so the last
  view buttons are off-viewport at 1024 px. The automation dispatches a click on them for that
  reason. Not a listed defect and not touched.

