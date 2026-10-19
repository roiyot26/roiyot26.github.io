# Spec

A portfolio site: one 3D room (a desk, a monitor, books, a duck) that a visitor can look around.
Each object opens a panel about Roi Yotvat's work. A plain HTML page has the same content for slow
devices, no-WebGL browsers and crawlers. The room is a personal project, not client work.

## Content

- Every word on the site is in `src/content/content.json`: panels, room labels, the guide's
  questions and answers, loader lines, toasts and the plain page.
- Experience lists years and roles only. No company names, phone number or email.
- Contact links: GitHub and LinkedIn.
- `src/content/static.ts` builds the `<title>`, meta tags and a `<noscript>` copy of the plain
  page from the same file at build time (`vite.config.ts`).

## Pages and views

- First screen: a still of the room (`public/poster.jpg`), the name, one line about the role,
  **Enter the room** and **Quick version (1 page)**. Both buttons work before the room has loaded.
- `?view=list` is the plain page. It is also the fallback when WebGL is missing, fails twice or
  the baked package fails to load.
- Deep links: `#stop-1` … `#stop-7` and aliases such as `#projects`, `#stack`, `#career`,
  `#contact`, `#project-<slug>` and `#skill-<id>`. They open after Enter.

## Room objects

| Object | Opens |
| --- | --- |
| Monitor | Projects (a card per project, with repo and live links) |
| Laptop and the framed render | 3D for the web: how the room was built |
| Books | Stack. Each book highlights one skill |
| Terrarium | Virtual Garden |
| Cork board | Experience and education |
| Mug | Contact |
| Duck | The scripted guide |
| Sticky note | What's being built now |
| Light switch, lamps, window latch, neon sign | Lights, rain and the neon blink |

Up to eight labels sit over the objects: at most 5 on desktop and 3 on phones, placed so that
their 44 px tap areas never overlap each other or the UI. A "What's here" list gives the same
targets to keyboard and screen-reader users.

## Scripted guide

- The duck is a scripted guide with buttons only. There is no text input and no AI model.
- Each button is one entry in `content.json → duck.intents`: a question, a written answer and a
  short list of actions (`fly_to`, `open`, `show_contact`, `set_lights`, `set_weather`,
  `set_mode`, `set_audio`, `quack`, `search_portfolio`). `src/duck/engine.ts` only accepts
  actions from that list.
- The header shows a "Scripted guide" label next to the name, on desktop and phones.
- Answers that point at an object draw a short beam to it and add a **Take me there** card.
- Desktop: the guide is a column on the right, and the camera framing shifts to keep the room
  visible beside it. Phones: a bottom sheet with peek, half and full heights.

## Mobile tier

`src/quality.ts` picks a tier once at startup:

- `high`: full post stack (AO, bloom, grade, grain, SMAA) and soft shadows.
- `medium`: phones and low-power devices. Light post and smaller shadows.
- `low`: software GL and the fallback after a shader or context failure. No post, no shadows.

The tier steps down at runtime if the frame rate stays low. `?quality=high|medium|low` forces one.

## Scene contract

The room is exported from Blender as `public/bake/desk.glb` (Draco geometry, KTX2 textures).

- Interactive objects are top-level empties named `CLICK_<Thing>`, with their meshes as children.
  A raycast hit walks up to the nearest registered node (`src/targets.ts`).
- Camera stops are empties `STOP_<n>_<Name>_Cam` with `fov_mm` and `target_gltf_yup` in extras.
  Horizontal FOV is `2·atan(18 / fov_mm)`.
- Keyboard keys are meshes `KEY_<Name>`. Typing presses the matching key.
- `src/content/scene_manifest.json` lists the exported names. Missing names are skipped.

## Baked lighting

- Six light groups (`DeskLamp`, `FloorLamp`, `Fill`, `Window`, `Neon`, `Pictures`) are baked in
  Cycles into KTX2 lightmaps on UV2 (`public/bake/lightmaps/`). `manifest.json` gives each group's
  file and scale.
- Blend: `irradiance = Σ srgb_to_linear(texel_g) · scale_g · intensity_g`. The sum is drawn into a
  half-float render target when an intensity changes, and used as `lightMap` with
  `lightMapIntensity = π`.
- Switches fade a group over about 250 ms:

| Click target | Groups | Emissive materials |
| --- | --- | --- |
| `CLICK_Switch_Lights` | `Fill`, `Pictures` | `ShelfLEDCyan` |
| `CLICK_Lamp_Desk` | `DeskLamp` | `Bulb` on `LampBulb` |
| `CLICK_Lamp_Floor` | `FloorLamp` | `Bulb` on `FloorLampBulb`, `MAT_Linen_Shade` |
| `CLICK_Neon_Sign` | `Neon` | `NeonCyan`, `NeonMagenta`, `RimMagenta` |
| (always on) | `Window` | `MAT_CityBackdrop` |

- Reflections come from `public/bake/env/room_env.ktx2` through PMREM.
- Tone mapping: AgX at exposure 2^0.72, to match the Cycles renders.

## Sound

Five short loops and clicks in `public/audio/`, made from scratch by `scripts/make-sounds.py`
(CC0). Nothing loads before Enter, and mute is remembered in `localStorage`.

## Tests

`npm test` (Vitest) covers the guide copy against the CV, the buttons-only guide, label layout and
tap areas, the loader and the plain page. CI runs the type check and tests on every push; the
Pages workflow tests, builds and deploys `main`.
