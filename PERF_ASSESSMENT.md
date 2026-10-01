# Performance Assessment: integrated graphics and tablets

Measured October 2026 on an Intel Iris Xe laptop (Chrome, ANGLE/D3D11). The earlier
assessment in this file (static plant/egg grids rebuilt every frame, per-moa `tint()`, plants
scanned twice in render, foraging re-queries) has been addressed. This replaces it.

## How it was measured

- Frames were driven by hand (`noLoop()`, then `redraw()`) and each one was synced to the GPU
  with a 1px `gl.readPixels`, plus a `texImage2D` of the main 2D canvas, so the time Chrome's
  GPU process spends rasterising the 2D canvas is counted too. A synced frame overstates the
  live frame time, because the CPU and GPU no longer overlap, but it ranks costs correctly.
- The laptop swings between a fast and a slow power state (2–3× on the same scene), so every
  comparison below is an interleaved A/B in the same run. "Slow state" numbers are the closest
  to a stressed integrated GPU or a tablet.
- `CONFIG.debugMode`'s Update/Render split misses most of this: the HUD's cost is not JS, it
  is the GPU process rasterising paths and text.

## Where a frame went (before these changes)

Early Free Play, slow state, synced frame ≈ 35 ms:

| Cost | ms | Why |
|---|---|---|
| HUD | ~12 | Every rounded rect, arc, stroke and vector icon is a separate canvas-2D draw, re-rasterised every frame. Toolbar 5.4, focus tiles 2.4, season ring 2.2, mauri ring 0.8, pop dial 0.8. |
| …of which FreckleFace text | ~3 | p5 draws `loadFont()` fonts as vector outlines (opentype.js paths). In isolation, 8 strings cost ~25 ms of GPU-process time, against ~1 ms as browser text. |
| Sprites + world-space indicators | ~9.5 | Moa indicators ~3 ms (four rounded-rect bars and a glyph per moa, all on the 2D canvas). |
| GPU terrain mesh | 3.5–5 | Free Play is culled to about a third of the mesh. Level 2 draws ~4M triangles, ~8–10 ms. |

Loading:

- `GLTerrain.build` ran on the first gameplay frame: a 2.5–5.6 s freeze after the loading
  bar had finished.
- The four flat 2D season buffers were baked on every load even though the GPU terrain never
  draws them: ~1.5 s and ~70 MB of canvas memory on Free Play. This also hit the mid-game
  regeneration at each Free Play loop. That memory matters on iPad, where Safari caps total
  canvas memory.
- The atlas edge bleed took 0.5–1.6 s at startup, and its 34 MB copy was kept forever.

## Changes that are always on (no visible change)

1. **FreckleFace drawn as browser text** (`useBrowserTextForFont`, mauri_sketch.js).
   `loadFont()` already registers the file as a CSS `@font-face`, so `p5.Font._renderPath`
   now uses `fillText` at the position p5's own alignment maths gives. The glyphs and their
   placement are the same. It falls back to p5's path rendering until the face has loaded.
2. **HUD element cache** (`HudCache`, mauri_UI.js). The toolbar, focus tiles, season ring,
   mauri ring and pop dial are each drawn into their own offscreen canvas and blitted. Each is
   redrawn only when its signature changes: hover/selection/affordability, counts, the clock
   string, and so on. The Storm recharge wedge, the hover tooltip and the season-progress
   notch are still drawn live. To compare against live drawing, add `?hudcache=0` to the URL.
3. **Highlight outlines batched** (`GLBatch.emitSilhouetteRing`). Each outline used 16
   `image()` calls, each paying for the shim, push/pop and a transform read. Now its 16 quads
   are emitted directly. The GL output is pixel-identical.
4. **The GPU terrain mesh is built under the loading bar** ("Raising the mountains"). The
   first gameplay frame dropped from 2.5–5.6 s to ~0.2 s. The build itself is ~45% faster
   (Level 1: 2.7 → 1.5 s):
   - The off-map skirt now samples noise at the gameplay grid's pitch and interpolates between
     samples. The world rows were already built that way. About 300 pixels differ, all at the
     far horizon and the bottom edge.
   - Skirt colours no longer allocate a `p5.Color` per cell. The new path does the same
     arithmetic and gives byte-identical colours.
5. **Flat season bakes are lazy** (`TerrainGenerator._flatBakesNeeded`). While the GPU relief
   draws the ground, they're skipped. They're baked on first use instead: the V top-down
   toggle, `?render=2d`, or the 2D fallback after a lost WebGL context.
6. **Atlas edge bleed**: each pass after the first only visits the frontier. The output is
   identical and it runs ~3× faster. The 34 MB bled copy is freed once it's uploaded.

Result, early Free Play, synced frame: slow state 34.6 → 22.6 ms; fast state 16.3 → 12.9 ms.
The HUD dropped from ~12 ms to ~2.5 ms.

## Performance mode (level-select toggle)

`setPerfMode` (mauri_sketch.js). Gameplay is untouched.

| Trade | Effect |
|---|---|
| GPU terrain mesh at the gameplay grid's resolution (`GLTerrain.decimate`), with colours averaged down so contour lines stay continuous | Level 1: 1.8M → 0.45M triangles. Level 2: 4.1M → 1.0M triangles, −8 ms/frame. Contours look slightly softer. |
| One caustic step in the water shader instead of two | Water fill cost |
| Terrain buffer capped at 0.75× (dynamic resolution can still drop it to 0.5×) | Terrain fill cost; the ground is slightly softer |
| No ground shadows under plants | One fewer sprite per plant, out of hundreds |
| 8-stamp highlight outlines instead of 16 | Half the outline quads; slightly lumpier corners |
| No soft glow on placed items' range rings | A canvas blur pass per ring (done on the CPU in Safari) |
| Square-cornered indicator bars | Each bar costs about half as much on the 2D canvas |

Early Free Play, fast state: 12.5 → 9.7 ms (−22%) on top of the always-on changes.

- **Saving:** the choice is saved in `localStorage` under `mauri_perfMode`.
- **URL override:** `?perf=1` or `?perf=0`.
- **Default:** with no saved choice, touch-first devices (`(pointer: coarse)`) start with
  performance mode on.
- **When it takes effect:** a mesh change takes effect at the next level load. The toggle
  only appears on level select, so that's always the case.

## Not done yet (largest first)

1. **Move world-space indicators into the GL batch.** The moa and kea bars could be solid
   quads: about 2–3 ms with 16 moa in the slow state. The ♀ ♂ ◆ glyphs would need a small
   glyph atlas.
2. **Remaining HUD.** The goals panel and the four control buttons aren't cached (cheap
   today), and neither is the docked layout's sidebar: event log and population panel. The
   sidebar only matters with fullscreen off.
3. **GL-layer render scale on very weak GPUs.** On fill-bound Android tablets, render the GL
   canvas at 0.75× its backing size and let the compositor scale it up. The HUD canvas stays
   at full resolution, so text stays sharp.
4. **Optional 30 fps cap in performance mode,** for heat and battery on tablets. The
   simulation already scales with `dt`.
5. **Terrain noise at load** (0.5–2.8 s depending on level and power state). A faster noise
   function would change the terrain. Instead, the heightmap generation could move to a Web
   Worker, since it's pure math.
6. `Object.entries(this.otherEntities)` runs in 7 per-frame loops in mauri_simulation.js.
   Minor GC pressure.
7. **Real-device checks.** iPad Safari rasterises canvas 2D on the CPU, so the HUD cache
   should matter even more there. Also check Android Chrome.
