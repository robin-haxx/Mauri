# GL_PORT; Mauri's WebGL renderer

Mauri started as pure Canvas2D. Its GL layer was ported from the `Te_Manawa_Prototype` fork
(read-only reference) and then taken further: terrain, water and lighting on the GPU too.
The port is complete, and **GL is now the only renderer** (the Enhanced/Classic graphics
toggle was removed). This file is the reference for how it fits together. Frame costs and
remaining perf work are in `PERF_ASSESSMENT.md`.

**Last updated:** 2026-10-09.

---

## 1. Switches

- **Renderer:** `resolveUseGLPreference()` / `setRenderGL()` (`mauri_sketch.js`). Always GL
  (`GL_DEFAULT_ON = true`), except the dev override `?render=2d` or an automatic fallback when
  a WebGL context can't be created or is lost (`_fallbackTo2D`). The old saved menu choice
  (`localStorage` `mauri_useGL`) is deliberately ignored.
- **View:** the plan-oblique 3D view is GL-only and bound to the renderer (`CONFIG.view3D`).
  **V** toggles 3D ↔ top-down while playing. The CPU relief bake is no longer maintained, so
  the 2D fallback is always top-down.
- **Gamemode-select screen:** the terrain-resolution slider (`CONFIG.terrainDetail`, default
  2×) and the **Performance mode** switch (`setPerfMode`; see `PERF_ASSESSMENT.md`).
- Dev URL flags: `?render=2d`, `?sprites=1..3` (sprite supersample), `?perf=0|1`,
  `?hudcache=0`.

## 2. Architecture: DOM-stacked layers

The browser compositor blends stacked canvases on the GPU with no per-frame readback (an
earlier fork build blitted GL→2D with `drawImage` and measured ≈ break-even; stacking is what
captures the win).

```
 z=2  main p5 canvas  → indicators (hearts/rings), HUD, tutorial          [transparent: clear()]
 z=1  GL canvas       → GPU terrain mesh + water, then sprites as batched quads
 z=0  terrain buffer  → the 2D fallback's ground (hidden while the GPU terrain draws)
```

**Per frame:** `clear()` the main canvas; `GLBatch.begin()`; the terrain mesh draws first
into the GL canvas; `simulation.render()` runs **unchanged**: the global `image()`/`ellipse()`
are intercepted and become GPU quads (reading the live 2D transform, tint and alpha);
`GLBatch.composite()` at the seam after the sprites, before the indicator over-pass;
indicators and HUD then draw on the main canvas. Entity draw code never learns GL exists.

## 3. Files

- **`mauri_spriteatlas.js`**: packs every sprite into one atlas page at startup and wraps
  `image()`. The edge bleed visits only the frontier after its first pass, and its copy is
  freed once uploaded.
- **`mauri_glbatch.js`**: the sprite batch. Per-quad colour gives cache-free tints (the moa
  genus tint) and a per-vertex **silhouette** flag gives bake-free outlines in any colour:
  every species highlight is a silhouette outline (`drawSpriteOutline`), its alpha hardened
  in the shader so soft bird art still gets a solid ring. Stroked (no-fill) ellipses fall
  through to the 2D canvas; only filled discs are captured.
- **`mauri_glterrain.js`**: the terrain as a displaced mesh of the full continuous world.
  The vertex shader is `Projection.groundY` verbatim, so terrain and sprites stay aligned;
  a year pan just animates `terrain.scrollX/Y`, so both axes scroll smoothly. No depth buffer:
  rows draw far → near. Built under the loading bar ("Raising the mountains"), with a receding
  **skirt** of freshly sampled rows past the world's edges so the distance never streaks.
- **`mauri_projection.js`**: the one world → screen mapping everything shares.

## 4. What the GPU draws (all in `mauri_glterrain.js` unless noted)

- **Light:** a warm sun key and a cool sky fill over normal-based hillshade; distance haze.
- **Season colours:** cur + next vertex colours blended by `uSeasonBlend`; all four seasons
  are computed and cached at build, so a season change is a GPU upload (~2 ms), not a
  ~160 ms recompute.
- **Water:** sea cells take an animated path: three wave trains summed as slopes into one
  normal, Fresnel sky reflection, a depth colour ramp, and a moving sun glint.
- **Climate as light:** a desaturate + cool tint driven by `game.coldIndex`, scaled by
  winterness (`0.32 + 0.68 × winterness`), applied identically to the terrain and the sprite
  batch (`GLBatch._cold`), with highlight outlines exempt. Snow paints above the real
  `getSnowLineElevation()`, so a deepening glacial visibly creeps down the slopes. Cold and
  snow line are eased (~1 s) so a year rollover never pops.
- **Food value:** each plant dims toward drab by its absolute live `nutrition`
  (`GOOD_LO 1.5 … GOOD_HI 6.5`, `mauri_plant.js`), so winter beech stays green while rimu and
  tussock grey out.
- **Frost** is a shader tint (`uFrost`). Plant sprites crossfade (~0.5 s) on a sprite change
  instead of flicking.

**Tunables:** `SLOPE`, `uAmbient`, `uSunCol` / `uSkyCol`, `uHazeAmt`, `uWaterCol`, the ripple
frequencies, the grade strength and `uColdTint`, the snow band width, the food band, the ease
rates, and `view3DOverscan` for a deeper vista.

## 5. Lessons

- **Keep entity code renderer-blind.** Intercepting `image()`/`ellipse()` let the whole cast
  move to the GPU with no `render()` edits, and kept the 2D path working throughout.
- **An outline hugs the silhouette; pulse its alpha, never its size**, or it reads as an
  effect radius. Range rings likewise stay at their true radius and only breathe in glow.
- **Cache per-season data that doesn't change within a season** (vertex colours); live values
  (cold, snow line) belong in uniforms.
- A backgrounded preview tab is rAF-throttled, so the loader stalls; pump `redraw()` to
  advance it when testing headless.

## 6. Ideas not yet cashed in

- An additive glow pass for highlights and interactables (per-quad colour + ADD already exist).
- Status tints: flash on attack, desaturate when hungry, brighten on hover.
- GPU data overlays (food density, grazing pressure, starvation) as one texture pass: a
  balance-tuning lens that could become a player-facing one.
- A dedicated outline shader to replace the multi-stamp ring.
- GPU particles (rain, snow, pollen).
