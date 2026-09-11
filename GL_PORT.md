# GL_PORT — WebGL renderer port for Mauri

**Goal:** move Mauri off pure Canvas2D onto a GPU rendering path, porting the
**proven DOM‑stacked WebGL layer** already shipping in the `Te_Manawa_Prototype`
fork, then going **deeper than the fork** by moving terrain and water onto the
GPU as well.

**Status:** Phases 0–6 complete and validated. Entity layer + atlas + shader outline/tint
(0–4), GPU height‑field terrain + animated water (5–6), and an **ecology‑driven lighting/
colour pass** (§12: two‑tone light, winterness‑modulated glacial grade, creeping snow,
food‑value plant fade, smooth year pan) behind a single **"Enhanced graphics" toggle on the
gamemode‑select screen** (§14; URL flags still override), which is now the **default**. Classic
2D stays pixel‑correct. Terrain resolution defaults to 2×. §14 also fixes the 3D↔2D toggle, the
terrain edge cutoff, the winter‑start lag, tree‑sprite flicker, and the water shader. A
heavy‑scene fps gate is still the main thing outstanding (heavier now at 2× default).
**Owner:** Robbie + Claude (orchestrated).
**Last updated:** 2026‑09‑11.

---

## 1. Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| **Direction** | Port GL **into Mauri**; `Te_Manawa_Prototype` is a read‑only reference. | Mauri holds features the fork lacks (endless mode, field‑guide outline). We bring the fork's renderer to Mauri, not the reverse. |
| **Scope** | **Go deeper**: entity layer *and* terrain/water on GPU. | More perf headroom on the 4K/supersampled frame than the entity layer alone. |
| **Safety model** | Opt‑in + reversible via a `?render=` URL flag (default GL, `?render=2d` disables everything). | Matches the fork. A bad frame or a context loss falls back to the untouched 2D path. |
| **Entity code** | **Unchanged.** No `render()` edits. | The port intercepts global `image()`/`ellipse()` and reads the live 2D transform/tint/alpha — entity draw code never learns GL exists. |

> The reversibility is the whole risk story: at every phase the 2D path must
> still render pixel‑identically with `?render=2d`. If it doesn't, the phase
> isn't done.

---

## 2. The two codebases

- **`D:\ac.coding\Mauri`** — target (primary). Pure Canvas2D. `createCanvas(W*ss, H*ss)`
  with no `WEBGL`. Manual supersample (`CONFIG.spriteSupersample = 2`). Terrain
  rasterised into a `Game._terrainLayer` p5.Graphics buffer and blitted; entities
  drawn straight onto the supersampled main canvas inside a `drawingContext.clip()`.
  No atlas, no GL. **Has:** endless mode, field‑guide green outline, kākā/kea/kākāpō.
- **`D:\ac.coding\Te_Manawa_Prototype`** — reference fork (v0.9.6). Same render
  ancestry, but further along: a `Projection` 3/4‑view, animated water, more species
  (goose, huia, kiwi, takahē), 24 design docs. **Ships a complete GL layer** we mine:
  - `TeManawa_spriteatlas.js` — runtime atlas + global `image()` wrapper.
  - `TeManawa_glbatch.js` — DOM‑stacked GL entity layer (the core).
  - `TeManawa_atlas.js` — sprite‑strip loader the atlas anticipates.
  - `TeManawa_water.js` — animated water (Canvas2D today).
  - `TeManawa_projection.js` — projection maths.

---

## 3. Target architecture — DOM‑stacked layers

The browser compositor blends three stacked canvases on the GPU with **no
per‑frame readback** (an earlier fork build blitted GL→2D with `drawImage` and
measured ≈break‑even; DOM‑stacking is what captures the batch win).

```
 z=2  main p5 canvas      → indicators (hearts/rings), GEO overlay, HUD, tutorial   [transparent: clear()]
 z=1  GL canvas (glbatch) → entity sprites + shadow/halo discs, as batched quads
 z=0  terrain buffer      → terrain + seasonal washes + (Phase 6) water            [was blitted; becomes the bottom DOM layer]
```

**Per‑frame flow (GL mode):**
1. `clear()` the main canvas (it's the transparent top layer), not `background()`.
2. Compose terrain into `_terrainLayer`; `GLBatch.setBottom(tg.canvas)` instead of blitting it up.
3. `GLBatch.begin()` — open a capture span.
4. `simulation.render()` runs unchanged; every `image()`/`ellipse()` becomes a GPU quad.
5. `GLBatch.composite()` at the seam **after sprites, before the indicator over‑pass**.
6. Indicators + HUD draw normally on the main (top) canvas.

---

## 4. Reference map (fork → Mauri integration points)

| Concern | Fork reference | Mauri target site |
|---|---|---|
| URL flag + `init()` + `mount()` | `TeManawa_sketch.js:2074‑2076` | `setup()` — `mauri_sketch.js:3733`, right after `createCanvas` (`:3743`) |
| `resize()` | `TeManawa_sketch.js:2111` | Mauri resize path (near `scaleCanvasToFit`, `:3750/:3779`) |
| `layout()` (CSS box sync) | `TeManawa_sketch.js:2192` | inside `scaleCanvasToFit()` |
| `clear()` vs `background()` | `TeManawa_sketch.js:1748‑1749` | Mauri frame top (render method head, ~`:2594`) |
| terrain → bottom layer | `TeManawa_sketch.js:1769‑1780` | Mauri terrain blit `image(tg, …)` at `mauri_sketch.js:2602` |
| `begin()` before sprites | `TeManawa_sketch.js:1807` | just before `this.simulation.render()` at `mauri_sketch.js:2634` |
| `composite()` seam | `TeManawa_simulation.js:1909‑1911` | Mauri `Simulation.render()` — **locate the sprites→indicators seam** (Phase 2) |
| safety `composite()` | `TeManawa_sketch.js:1814` | right after `simulation.render()` returns (~`:2635`) |
| atlas `build()` | `TeManawa_spriteatlas.js:62` (called from `setup()`) | after preload resolves, in Mauri `setup()` |
| atlas roots | `TeManawa_spriteatlas.js:154 _collectRoots` | **adapt to Mauri's cast** (no huia; add kākā/kea/kākāpō) |

---

## 5. Phased plan

**Phases 0–4 are ✔ complete and validated** (see the progress log, §9). Phases 5–6
(terrain/water on GPU — the "deeper" scope) are not started.

Each phase is independently landable and independently reversible. Acceptance =
`?render=2d` still pixel‑matches main **and** the new path works.

### Phase 0 — Scaffolding & guardrails
- Vendor `mauri_glbatch.js` + `mauri_spriteatlas.js` (renamed copies of the fork
  files) and add `<script>` tags in `index.html` before `mauri_sketch.js`.
- Add the `?render=` flag plumbing; default nothing active until wired.
- Headless/kiosk parity: everything guarded by `typeof GLBatch !== 'undefined'`.
- **Acceptance:** game runs exactly as today; new files are inert.

### Phase 1 — Sprite atlas (foundation, valuable even on 2D)
- Port `spriteatlas.js`; rewrite `_collectRoots()` for Mauri's `EntitySprites`
  shape and `PLANT_SPRITES`/`plantSprites`/`placeableSprites`.
- Wire `SpriteAtlas.build()` into `setup()` after preload.
- Cover the two graphics‑method draw sites (`getTintedMoaFrame` bake in
  `mauri_entity_sprites.js`, plant gallery) with `SpriteAtlas.drawTo()`.
- **Acceptance:** `[atlas] packed N frames into P page(s)` logs; all sprites still
  draw; texture count collapses; no visual diff. Works with GL still off.
- **Risk:** low. Pure 2D optimisation; the outline/tint bakes still function.

### Phase 2 — DOM‑stacked GL entity layer (the core port)
- Port `glbatch.js` verbatim structure; adapt only canvas/element lookups.
- Wire `init/mount/layout/resize/setBottom/begin/composite` at the sites in §4.
- Find and mark the `composite()` seam in Mauri's `Simulation.render()`.
- Switch the main canvas to `clear()` and the terrain to `setBottom()` in GL mode.
- **Acceptance:** with GL on, entities + shadows/halos render correctly, in order,
  edge‑fade at frame borders; `?render=2d` unchanged; context‑loss falls back.
- **Risk:** medium. Ordering (shadows under sprites), tint/alpha capture, the
  transparent‑top‑canvas seam for indicators/HUD.

### Phase 3 — Field‑guide outline & tint as shaders (the "free win")
- Replace the baked green outline (`EntitySprites.getOutline`, added earlier) and
  the per‑genus tint bake (`getTintedMoaFrame`) with per‑quad colour / a small
  outline shader in the GL path. Keep the bakes as the `?render=2d` fallback.
- **Acceptance:** outline + tints identical on GL; arbitrary runtime colours now
  free (no cache). 2D path still uses the bakes.
- **Risk:** low‑medium. This is the capability the whole thread started from.

### Phase 4 — Validation & perf gate
- Headless preview harness (paused game, driven via `redraw()`; global `game`).
- Measure fps/frame‑time GL vs 2D at `spriteSupersample 2`; confirm the batch win.
- Verify: context‑loss fallback, resize/letterbox, fullscreen focus re‑pass,
  eruption/weather passes, tutorial overlay ordering.
- **Acceptance:** GL ≥ 2D fps everywhere; no visual regressions catalogued.

### Phase 5 — Terrain on GPU *(deeper scope; beyond the fork)*
- The fork keeps terrain as a 2D buffer (bottom DOM layer). Options to evaluate:
  (a) upload the terrain buffer as a GL texture and draw it as the bottom GL pass
  (removes one 2D canvas); (b) render terrain tiles/mesh directly in GL.
- Start with (a) — smallest step, keeps the 2D terrain rasteriser as source.
- **Acceptance:** terrain identical; one fewer 2D canvas; washes/health filter intact.
- **Risk:** high. Terrain carries clip, seasonal saturate() filter, health tint.

### Phase 6 — Water on GPU *(deeper scope)*
- Port `TeManawa_water.js` into Mauri first (Canvas2D parity), then move the water
  pass into a GL shader (animated normals/refraction) over the terrain pass.
- **Acceptance:** animated water renders in GL; degrades to static/2D on fallback.
- **Risk:** high, and net‑new content for Mauri (no water module today).

### Phase 7 — Cleanup & docs
- Retire now‑dead 2D‑only code paths guarded behind the flag; document the flag;
  update `PERF_ASSESSMENT.md`; final parity sweep.

**Recommended stopping points:** land **Phases 1–4** first (the proven, reversible
entity‑layer win + the shader outline). Treat **5–6** as a separate, gated effort —
they're where the real risk lives and where the fork gives no cover.

---

## 6. What GL unlocks (tracked so we actually cash it in)
- Field‑guide outline → 1 shader, **any** colour, zero bake/cache (Phase 3). **Cashed in
  further (2026‑09‑11): the same silhouette outline now drives EVERY species highlight
  (`SPECIES_HIGHLIGHT` toggle) — the old pulsing under‑sprite disc is gone.**
- Per‑genus moa tint → per‑quad colour, kills `getTintedMoaFrame` cache (Phase 3).
- Cheap global post: seasonal/glacial colour grading, vignette (post‑Phase 5).
- Additive lighting (eagle spotlight already uses `blendMode(ADD)`) becomes cheap.
- Headroom returned to the simulation (thousands of entities/plants per tick).

### Candidate next wins (offered for the balance/UI‑UX phase)
- **Additive glow pass** for highlights/interactables (per‑quad colour + ADD already in
  the batch) — legibility win; the silhouette outline is a touch thin at small sizes.
- **Cache‑free status tints** (Phase‑3 per‑quad colour): flash‑on‑attack, desaturate‑when‑
  hungry, brighten‑on‑hover — instant UX feedback, no bakes. Directly aids balance reads.
- **GPU data overlays** (food density / grazing pressure / starvation heatmap) as a single
  texture pass — a *balance‑tuning microscope*, and reusable as a player‑facing lens.
- **Dedicated outline/edge shader** to replace the 16‑stamp ring (cheaper, variable width +
  glow for free) — supersedes the current highlight draw.
- **Full‑frame post** (needs Phase 5 terrain‑on‑GPU): seasonal/day‑night grading, focus
  vignette, pause/defeat desaturate.
- **GPU particles** (rain/snow/pollen/eruption ash) via the batch — atmosphere at ~free cost.

---

## 7. Validation & rollback
- **Parity oracle:** every phase must keep `?render=2d` pixel‑identical to `main` today.
- **Headless testing:** paused game, `redraw()`‑driven, inspect via `javascript_tool`
  (global `game`), per the project's existing preview‑testing practice.
- **Rollback:** `?render=2d` at runtime; per‑phase git revert at rest. New files are
  additive and inert until wired.
- **Kiosk safety:** WebGL context‑loss handler degrades to 2D for the session.

---

## 8. Open questions / decision log
- [x] Exact `composite()` seam in Mauri `Simulation.render()`: **[mauri_simulation.js:1786]**,
      right before "Layer 8: Moa indicators" (after storms, all sprites done). *(Phase 2 ✔)*
- [x] Ground overlays that must move to the bottom layer in GL mode: only the **winter
      frost** haze — now drawn into the terrain buffer in `_composeTerrainLayer` and skipped
      on main when `_domGL`. (No water/wash modules in Mauri yet — those are Phase 5/6.) *(Phase 2 ✔)*
- [x] Mauri's `EntitySprites` container shape vs the fork's `_collectRoots`. → Mauri has
      `moa/moaVariants/eagle/flyers`; `PLANT_SPRITES` (state objects) + `PORTRAIT_PLANT_SPRITES`
      (arrays). `_collectRoots` rewritten; a generic `eachIn` handles both. *(Phase 1 ✔)*
- [ ] Keep `mauri_projection.js` as‑is, or adopt the fork's projection for terrain‑GPU? *(Phase 5)*
- [x] Atlas page budget at `spriteSupersample 2`: **76 frames → 1 page (4090×912)**. Comfortable. *(Phase 1 ✔)*
- Decision: GL is **opt‑in** in Mauri (`?render=gl`), default OFF during the port, unlike the
  fork's default‑ON. Flip the default only after Phase 4 validation.

## 9. Progress log
- 2026‑09‑11 — Plan written. Both codebases mapped; fork GL layer read in full.
- 2026‑09‑11 — **Phase 0 ✔** Vendored `mauri_glbatch.js` + `mauri_spriteatlas.js` (copied from
  fork, refs renamed); script tags added before `mauri_sketch.js`. Both globals define and stay
  inert; menu/game unchanged; no new errors.
- 2026‑09‑11 — **Phase 1 ✔** `_collectRoots` adapted to Mauri's cast; `SpriteAtlas.build()` wired
  into `setup()`; the tint‑bake and outline‑silhouette graphics‑method draws routed through
  `SpriteAtlas.drawTo()`. Verified: `[atlas] packed 76 frames into 1 page(s), 76 references
  rebound`; full scene (terrain, plants, palette, tutorial, HUD) renders identically; outline +
  tint bakes still work on atlas frames. No visual diff, no errors.
- **Testing note:** the preview tab is rAF‑throttled when backgrounded, so the loader (one plan
  step per drawn frame) stalls; pump `redraw()` to advance it. Not a code issue.
- 2026‑09‑11 — **Phase 2 ✔** DOM‑stacked GL entity layer wired: `init/mount/resize/layout` in
  `setup`/`windowResized`/`scaleCanvasToFit`; `clear()` vs `background()`, terrain→`setBottom()`
  vs blit, frost→terrain buffer, `begin()` before `simulation.render()`, `composite()` seam at
  `mauri_simulation.js:1786` + safety composite. GL is **opt‑in** (`?render=gl`). Verified with
  `?render=gl`: menu (transparent main) OK; gameplay composites terrain(bottom)/sprites(mid)/
  HUD(top); **all entity sprites batch from 1 atlas texture**; moa render with the field‑guide
  green outline (captured as a quad); no GL/JS errors. Default (2D) path provably inert
  (every hook guarded by `_domGL`/`GLBatch.enabled`).
- 2026‑09‑11 — **Phase 3 ✔** Outline + tint converted to bake‑free GL:
  - Added a per‑vertex **silhouette flag** to the batch shader (`aSil`, `FLOATS_PER_VERT` 8→9;
    fragment `mix(t.rgb*vCol.rgb, vCol.rgb, vSil)`). `drawSpriteOutline` now emits a ring of
    pure‑colour silhouette quads on GL (no bake, any colour) and keeps the baked halo for 2D.
  - Moa genus **tint** on GL uses a live `tint()` (batch multiplies per‑quad) instead of
    `getTintedMoaFrame`; 2D still uses the cached bake.
  - Verified: normal sprites unaffected by the new vertex format (shader compiles/links,
    trees render, 1 texture); field‑guide outline renders **pure bright green** with
    `glTex` staying **1** (was 3–4 with baked halos); forced pink genus tint renders with
    `glTex` still 1 (per‑quad path, not the bake). This is the capability the whole thread
    began from — arbitrary, cache‑free sprite tint/outline.
- 2026‑09‑11 — **Phase 4 ✔ (validation)** `?render=2d`/default provably unchanged; `?render=gl`
  full path healthy across menu → level → gameplay. Resize keeps the three layers pixel‑aligned
  (`layout()` — CSS boxes match). Render‑cost sanity: GL 2.52 ms vs 2D+atlas 2.53 ms per
  `render()` at ~6 moa — **parity** (the batch win needs high sprite counts / 4K fill‑rate, not
  visible at this scale; a real fps gate on a heavy scene is still worth doing). No GL/JS errors
  anywhere (only pre‑existing asset 404s). Context‑loss fallback handler retained from the fork
  (not force‑triggered in test).
- **Left for later:** flip the default to GL‑on only after a heavy‑scene fps gate; exercise the
  tinted‑species outline in a multi‑species level; Phases 5–6 (terrain/water on GPU).
- 2026‑09‑11 — **Highlights unified onto the silhouette shader + a latent GL ellipse bug fixed.**
  - **All species highlights are now the field‑guide sprite outline**, not the old pulsing disc.
    New `highlightOutlineColor(speciesKey, cfgColor)` (mauri_encyclopedia.js) folds the field‑guide
    selection and the `SPECIES_HIGHLIGHT` toggle into one colour; the moa/eagle/kererū render sites
    drop their `fill()+ellipse()` halo blocks and emit a single `drawSpriteOutline` (bake‑free ring
    on GL, cached halo on 2D — same call, both paths). An outline hugs the silhouette, so it never
    reads as an effect radius; pulse lives in the outline's **alpha**, never its size. Shared
    outline thickness nudged 5→6 for small‑sprite legibility. All flyers inherit `Kereru.render`, so
    three edits cover kōkako/kākā/kea/kākāpō too.
  - **Interactable radius rings** (`PlaceableObject`) no longer pulse in **diameter** (that hid the
    real reach). New `_drawRadiusRing()` draws a steady line at the TRUE radius with a soft
    shadow‑blur glow that only breathes in intensity; blur is scaled by the live CTM so it stays
    proportional at any supersample/zoom. Applied to standard + storm rings.
  - **GL fix:** `GLBatch.tryCaptureEllipse` now **skips no‑fill (stroked) ellipses** (`R._doFill===false`).
    Before, a stroked ring in the capture span was stamped as a solid disc tinted by the *stale*
    last fill — so every effect‑radius ring rendered as a filled white blob in `?render=gl` (see the
    pre‑fix screenshot). Now such strokes fall through to the 2D top canvas and render correctly.
    Only filled discs (shadows/halos/icon dots) are still captured. General correctness win.
  - Verified in BOTH paths: `?render=2d` (default) and `?render=gl` — silhouette outline identical
    across modes; radius ring is a crisp fixed circle + glow (GL blob gone); no JS errors (only the
    pre‑existing asset 404s); 90 live frames clean. Legibility caveat: at *normal* moa size the
    outline is thin, and the near‑white upland_moa highlight colour is low‑contrast on light terrain
    — flagged as a balance/UX tuning knob (thickness / per‑species colour / optional glow backing).
- 2026‑09‑11 — **Non‑moa outline legibility, level‑start fade‑in, and a debug LENS framework.**
  - **Weak bird outline fixed at the source:** the silhouette shader used the texel alpha, so
    soft/feathered bird art cut a faint outline while crisp moa were solid. The fragment shader now
    HARDENS the silhouette alpha (`smoothstep(0.06,0.30,t.a)`), so birds get a solid outline; moa
    (already ~1.0) unchanged. Eagle highlight colour now reads from `config.highlightColor` (ember).
    Verified: the highlighted eagle now has a strong, solid ember outline.
  - **Level‑start cast fade‑in:** the fauna/plants/placed items fade up out of the freshly‑drawn
    terrain instead of popping in. Reuses the year‑transition cast‑alpha path (`_castRenderAlpha`),
    which GL honours (tryCapture reads globalAlpha); frameCount‑based so it plays under the opening
    tutorial pause. Verified 0→1 ramp in BOTH 2d and gl.
  - **LENS framework (`mauri_lens.js`):** debug world‑space overlays that make invisible sim state
    tunable by eye — toggle with `L`, pick lenses from a clickable legend. First lens **"Kea ▸ Berry
    Cache pull"**: colour‑codes each cache (effect radius + faint attract reach + a core sized by its
    current draw + a `N kea · food` readout) and draws a line from every COMMITTED kea to the cache it
    chose, with moa nests/eggs marked for context. Makes the flock‑steering the brief called "nebulous"
    fully legible (e.g. 3 kea piling on the food‑rich cache while the empty one pulls none). Built to be
    promoted into real game UI. Verified: legend + toggle + pull lines render, no errors, inert unless on.

## 10. Phase 5 — GPU height‑field terrain ✔  (`mauri_glterrain.js`, opt‑in `?terrain=gl`)
Decision (Robbie): **keep the 3D tilt** — a displaced‑mesh relief. Built and validated.
- A static mesh of the FULL continuous world (`renderCols×renderRows`, e.g. 735×456 = 335k verts) is drawn
  into the SAME GL canvas as the sprite batch, BEFORE the sprite quads (after `GLBatch.begin()`'s clear), so
  sprites composite on top exactly as they billboard over the 2D terrain today.
- **Vertex shader = `Projection.groundY`** verbatim (`paintY = ly·K − elev·LIFT + LIFT`, `paintX = lx`) then
  the same view transform sprites use (`uSS·(viewX+paint·viewZoom)` → clip). So terrain + cast stay aligned.
- **Continuous N–S scroll (the crossfade fix):** the mesh re‑projects from the continuous heightmap every
  frame; a year pan just animates `terrain.scrollX/scrollY`, which the shader reads → smooth scroll in both
  axes. Verified at a mid‑row `scrollY` that the per‑row bake could only cross‑fade. (Cast is unloaded during
  the pan, so no entity‑alignment concern mid‑scroll; at settle `scroll == activeOrigin`, matching entities.)
- **Better shading:** real **normal‑based hillshade** (central‑difference normals, `SLOPE=6.5`, sun + `uAmbient`
  0.5) replaces the baked cliff heuristic; a **haze sky** fill + a per‑vertex distance‑haze fade give real depth;
  winter **frost** moved from a 2D overlay into a shader tint (`uFrost`). Season colours come from the SAME
  `_computeSeasonCellColors`, uploaded as cur+next vertex‑colour buffers and blended by `uSeasonBlend`.
- **No depth buffer needed** (context is `depth:false`): rows are indexed FAR→NEAR (ascending worldY),
  painter's‑algorithm. Scissor clips terrain to the game area (mirrors the 2D clip).
- **Reversible:** off ⇒ untouched CPU relief + DOM bottom layer. On requires `?render=gl` + view3D/relief.
  Verified `?render=gl` (CPU relief) and `?render=2d` still render correctly; no GL/JS errors.

## 11. Phase 6 — animated water on GPU ✔  (folded into the terrain shader)
- Sea cells (biome index 0 / `_waterBiome`) carry a per‑vertex water flag (`aWorld.w`). In the fragment shader
  those cells take an ANIMATED path: two crossing sine ripples (scrolled by `uTime` seconds) perturb a surface
  normal for a soft moving shimmer + a sharp sun **specular glint**, over a deep‑blue tint (`uWaterCol`); land
  keeps the plain hillshade. Verified rendering on the shore quadrant (~27% sea), no shader errors.
- **Left for polish (next session):** water is subtle under dense forest over‑scan — could deepen the tint /
  raise specular, add a shoreline foam band, and a slight vertical bob. Tunables live in `mauri_glterrain.js`
  (`SLOPE`, `uAmbient`, `uSun`, `uHazeAmt`, `uWaterCol`, ripple freqs). Also: a heavy‑scene fps gate for the
  mesh (335k verts) before considering GL‑on by default.

## 12. Ecology‑driven lighting, colour & atmosphere ✔  (`?render=gl&terrain=gl`)
The rendering now surfaces the sim's hidden ecological state as the *look* of the world — the climate you
fight and the food value you steward become light and colour, not just text/graphs. All reversible: gated to
GL/terrain‑gl, every hook `typeof`‑guarded; `?render=2d` and `?render=gl`(no terrain) are provably untouched
(verified: no grade, sprites normal, 0 GL errors). Year‑pan re‑validated end‑to‑end (below).

- **Two‑tone daylight (natural relief).** The flat ambient‑darken hillshade became a warm sun key
  (`uSunCol`) + cool sky fill (`uSkyCol`): lit faces read warm, hollows fall to a natural cool shadow. Water
  rides the same light. This is the biggest "more natural, still delineable" win — biome base colours (the
  habitat zones) are unchanged; the light unifies them.
- **Climate as light — the glacial grade.** A single desaturate + cool‑tint + slight‑darken driven by
  `game.coldIndex` (0 interglacial → 1 full glacial), applied identically in the **terrain shader AND the
  sprite batch** (`GLBatch._cold`, new `uCold`/`uColdTint`) so the whole world — land, plants, animals —
  shares one cold mood. **Modulated by winterness** (`0.32 + 0.68·winterness`): full‑wan in a glacial
  *winter*, gentle in its *summer* (the rebuild breathing room stays green) — natural, and it keeps the
  seasonal swing legible. Highlights (silhouette `vSil=1`) are exempt so selection outlines stay pure.
- **The habitable squeeze — creeping snow.** The baked terrain colours only carried *seasonal* snow; the
  glacial snow‑drop was invisible. The shader now paints snow above `uSnowLine` = the **real**
  `seasonManager.getSnowLineElevation()` (which drops with `coldIndex`), flatter ground holding more — so a
  deepening glacial visibly creeps the white down the slopes. Cooler `uHazeCol`/sky in the cold, too.
- **The larder empties — food‑value plant fade.** Each plant dims toward drab by its **absolute** live
  `nutrition` against a worthwhile‑browse band (`GOOD_LO 1.5 … GOOD_HI 6.5`, `winterInedible` pushes harder) —
  so **beech holds its winter value and stays green while rimu/tussock grey out**, and healthy summer plants
  stay vivid. `mauri_plant.js` render, GL path only (2D's `tint()` is the slow path).
- **Smooth year pan (validated).** A year rollover jumps `coldIndex` per‑cycle, which would POP the grade — so
  the rendered cold + snow line are **eased** (`_coldEased`/`_snowEased`, ~1 s). Ran a real
  `panToArea` to the next N–S zone *with* a 0→0.85 glacial jump and sampled 110 frames: scroll is a
  continuous smoothstep lerp (no discontinuity), the grade eases at ≤0.034/frame (no pop), pan completes
  clean, 0 GL errors.
- **Files:** `mauri_glterrain.js` (lighting/grade/snow/haze + eased cold/snow, publishes `GLBatch._cold`),
  `mauri_glbatch.js` (batch `uCold`/`uColdTint` grade, exempts silhouettes), `mauri_plant.js` (food fade).
  **Tunables:** grade strength (`uCold` mix 0.5 / winterness split `0.32+0.68`), `uColdTint`, `uSunCol`/
  `uSkyCol`, `uSnowLine` band width (`+0.14`), food band (`GOOD_LO/HI`), ease rates (`0.04`/`0.06`).
- **Left to do:** exercise a real winter *visually* end‑to‑end (mechanism proven by data; a live winter needs
  the season timer, not just a forced flag); consider a true per‑quad desaturate attribute if the multiply‑
  dim food fade wants more punch; the same `uCold` grade could extend to `?render=gl` (no terrain‑gl) via a
  cheap 2D wash on the CPU terrain buffer if desired.

## 14. Menu placement + a batch of GL fixes ✔  (2026‑09‑12)
- **Settings moved to the gamemode‑select screen.** The terrain‑resolution slider AND the
  Enhanced/Classic graphics toggle now sit below the habitat cards on `renderLevelSelect`
  (shared `_renderRenderSettings` + `_handleRenderSettingsClick`); the level‑intro splash
  (`renderMenu`) keeps just Start/Back. **Enhanced is now the default** (`GL_DEFAULT_ON=true`).
- **3D↔2D toggle no longer breaks the flat view.** `GLBatch.setBottom` early‑returned when the
  terrain buffer was unchanged, but the GPU‑terrain (3D) path hides that buffer (`display:none`);
  toggling back to flat 2D re‑called `setBottom` with the same canvas → it stayed hidden and the
  terrain vanished. Fixed: `setBottom` re‑shows the buffer on the same‑canvas path. Verified over
  many 3D↔2D cycles.
- **Terrain side/edge cutoff fixed.** The GPU mesh spanned exactly the world, so the tilted plane
  left gaps at the frame edges. Added far/near **over‑scan rows** (matching the 2D relief's
  `view3DOverscan` 0.45 / `view3DOverscanNear` 0.28, sized off the window depth) that hold the edge
  terrain past the world in Y. Fill now matches the 2D relief.
- **Winter‑start lag gone.** `_uploadColors` recomputed `_computeSeasonCellColors` (~500k‑cell loop,
  **~164 ms** for cur+next) on every season change — the hitch at winter. Season vertex colours are
  static per season (coldIndex/snow live in the shader), so they're **cached per key and pre‑warmed
  for all four seasons at build**. A season change is now **~1.7 ms** (GPU upload only).
- **Tree sprites crossfade instead of flicking.** `_renderSprite` keeps the outgoing sprite on a
  `_getSpriteState` change (mature↔wilting↔thriving) and blends it out under the incoming one over
  ~0.5 s (frameCount‑based). Verified 100/123 sprite‑plants crossfaded on a forced state change.
- **Water no longer looks like animated noise.** Rewrote the water branch: three directional wave
  trains summed as SLOPES → one coherent surface normal; **Fresnel sky (haze) reflection** for the
  sparkle; a depth colour ramp (deep blue → teal shallows); a sharp moving sun glint; deeper base
  tint. Reads as calm water with swell + reflection.
- Verified across `?render=2d` (default is Enhanced now, but Classic still pixel‑correct), Enhanced
  3D, and Enhanced flat‑2D; 0 GL/JS errors. **Note:** the 2× terrain default makes the GPU mesh
  ~1 M triangles and world‑gen ~2–3× slower (build also pre‑warms 4 season colours, ~330 ms once) —
  still smooth here, but the heavy‑scene fps gate matters more now. The GPU snowfield reads a touch
  greyer than the flat‑baked 2D (the two‑tone light dims it) — minor, flagged for tuning.

## 13. Renderer switch is now a MAIN‑MENU setting; terrain resolution defaults to 2× ✔
- **One switch, in the menu.** The whole GPU path (entity batch + GPU terrain/water + ecology lighting) is a
  single **"Graphics: Enhanced 3D / Classic 2D"** toggle on the level‑intro screen (`renderMenu`), beside the
  terrain‑resolution slider. Replaces the `?render=` / `?terrain=` URL flags for players (the flags still work
  as a dev override, highest priority). New in `mauri_sketch.js`: `resolveUseGLPreference()` (URL → saved →
  `GL_DEFAULT_ON`), `setRenderGL(on, persist)` (applies live), `CONFIG.useGL`. `setup()` now just calls
  `setRenderGL(resolveUseGLPreference(), false)`.
- **Live + persistent + lazy.** Toggling flips the enable flags instantly and **lazily creates + mounts the GL
  context on first enable** (a Classic‑2D session never spins one up); the choice is saved to `localStorage`
  (`mauri_useGL`) so it survives reloads. GPU terrain rides the same switch. `_fallbackTo2D` (context‑loss)
  still works. Verified: menu toggle → GL renders end‑to‑end on a plain URL; persists across reload; toggle
  off → clean Classic 2D; 0 GL/JS errors.
- **Default unchanged (Classic 2D).** Faithful to the ask ("*move* the switch" ≠ change its default). Flip the
  one constant `GL_DEFAULT_ON = true` to ship Enhanced out‑of‑box (do the heavy‑scene fps gate first).
- **Terrain resolution now defaults to 2×.** `CONFIG.terrainDetail 1 → 2` (the '2x' end of the slider) —
  double‑res terrain bake, crisper ground; ~2–3× slower world‑gen but viable. Applies to BOTH 2D and GL.
  Verified: 2D default now builds an 816×608 terrain grid (was 408×304) and renders correctly.
