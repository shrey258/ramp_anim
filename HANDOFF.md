# Handoff: ramp_anim (2026-10-22)

Repo: /Users/shrey/Documents/personal/ramp_anim (Vite 8 + React 19 + three.js), branch `main`.

## Where things stand (verified)

- The dunes animation is finished and pushed in commit `1714514`. It's a port of Ramp's ramp.com/glass intro, split into small modules under `src/dunes/`:
  - `shaders.ts`: the GLSL
  - `grains.ts`: the point cloud
  - `screenPasses.ts`: the blur layers and the composite
  - `startDunes.ts`: the renderer and the animation loop

  `src/App.tsx` only mounts it.
- **Decision: keep Ramp's sand animation as it is.** The user turned down three prototype rounds meant to "make it ours":
  - recoloured "quiet / expensive / screensaver" looks (Dawn, Night, Mist)
  - new patterns (Chladni plate, zen raked garden, eroding sphere)

  They then said "Let it be ramp IG that's better". Don't reopen this unless they bring it up. The prototype files (`proto.html`, `src/proto/`) are deleted. `tsc -b` passes.
- **Don't commit or push the "learning part".** The user explicitly said to keep it local and uncommitted:
  - `public/learn.html`
  - `server/askClaude.ts`
  - the tutor plugin changes in `vite.config.ts` and `tsconfig.node.json`

  When committing, stage only the specific files.

## Next task: text reveal

What the user said: "translate Y -102% -> 0%, with opacity 0->1".

Still open, and needs the user's answer before building (I asked; no reply yet):
- What the text says.
- When it comes in: during the dunes' dark→light fade, or after the dunes settle. The fade runs from about 2.4 to 3.2 s of wall time: `darkToneAt` in `src/dunes/startDunes.ts` fades between 2.7 and 3.55 s on a 1.12× clock.

Implementation notes (unverified, my suggestion only):
- Use CSS or WAAPI on a DOM overlay above the canvas, not WebGL.
- Wrap the text in an `overflow: hidden` mask, so the -102% start sits fully below the mask edge.
- Respect `prefers-reduced-motion`, e.g. opacity only.

## Environment

- Dev server: the last one ran at http://localhost:5199. It may no longer be running; restart with `npm run dev -- --port 5199`.
- Preview tooling: the hidden preview tab throttles rAF. Load pages with `preview_navigate` and check them with `preview_snapshot`; click and setInterval-based evaluate calls time out.

## User preferences seen this session

- Short replies (Concise style). Ponytail mode is on: minimal code.
- Keep the code as small "lego block" modules.
- own-the-decision skill: the user said "skip" to the four-line goal/approach prompt this session. Don't push it again for small steps.

## Suggested skills

- `emil-animations`: easing and duration for the reveal.
- `emil-typography`: if the text needs a typeface or scale.
- `emil-marketing-pages`: intro or hero text over a canvas, motion restraint.
- `animation-accessibility`: reduced-motion handling.
- `ponytail:ponytail`: already active and should stay on.
- `emil-unslop-code`: run before committing.
