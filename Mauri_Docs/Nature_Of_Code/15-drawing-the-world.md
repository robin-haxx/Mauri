# Chapter 15: Drawing the World

> He ao te rangi ka uhia, he huruhuru te manu ka tau.
>
> As clouds adorn the sky, so feathers adorn the bird.
> — whakataukī

*Builds on Chapters 1 to 4. You can read it without Chapters 5 to 14.*

Everything so far has been about `update`. This chapter is about `render`.

I've held it back until now on purpose. The simulation knows nothing about how it's drawn. A moa is a point at `(x, y)` on a flat map with a velocity and a hunger. Whether that point is shown as a circle, a sprite seen from above, or a bird standing on a tilted mountainside lit by a low sun is somebody else's business. You could delete the entire renderer and the ecosystem would run exactly as before. The game's headless test tools do precisely that.

This separation is the most important idea in the chapter, so I'll state it once as a rule and then spend the rest of the chapter exploiting it:

> The simulation decides what is true. The renderer decides how it looks. The renderer reads the simulation and never changes it.

Because of that rule, the game was able to change from a flat top-down view to a 3D-looking relief, and from p5's 2D canvas to WebGL, without touching a single line of animal behaviour. It's also why this chapter can teach rendering as a set of independent techniques. I'll go from the simple and essential to the advanced and optional: coordinate transforms, cameras, draw order, sprites, the fake-3D projection, and then the long list of things that were done to make it fast.

## World Space and Screen Space

A moa at world position `(200, 150)` is not drawn at pixel `(200, 150)`. The map is magnified, and it's offset to leave room for the interface. There are two coordinate systems.

**World space** is where the simulation lives. One unit is one cell of the unzoomed map. A map is roughly 550 by 300 units.

**Screen space** is the canvas, 1080 pixels on its short side.

Getting from one to the other takes a scale and a shift:

```
screenX = viewX + worldX * viewZoom
screenY = viewY + worldY * viewZoom
```

You could apply that formula by hand to every coordinate in every drawing call. p5.js, like every graphics system, lets you set it up once instead:

```javascript
push();
translate(CONFIG.viewX, CONFIG.viewY);
scale(CONFIG.viewZoom);

// Everything drawn in here uses WORLD coordinates.
this.simulation.render();

pop();
```

After `translate` and `scale`, a call like `circle(200, 150, 10)` is drawn at the transformed position and size. The moa's `render` method can say `translate(this.pos.x, this.pos.y)` with its plain world position, and it lands in the right place on screen.

`push()` and `pop()` bracket the change. `push` saves the current transform and drawing style; `pop` restores them. Everything between is drawn in world space. After the `pop`, drawing is back in screen space, which is what the HUD wants.

So `Game.render` has two halves, and you should always know which you're in:

```javascript
render() {
  // ... terrain ...

  push();
  translate(CONFIG.viewX, CONFIG.viewY);
  scale(CONFIG.viewZoom);
  this.simulation.render();          // WORLD space
  this.mauri.renderFloatingTexts();
  this.renderPlacementPreview();
  Lens.renderWorld(this);
  pop();

  this.ui.render();                  // SCREEN space
  this.tutorial.render();
}
```

A consequence that catches everyone once: inside the world transform, sizes are magnified too. A `strokeWeight(1)` line is two and a half pixels thick. Text at `textSize(12)` is huge. That's why the lens code in earlier chapters divided by `z`:

```javascript
strokeWeight(1.4 / z);    // 1.4 screen pixels, whatever the zoom
```

When you want something in the world to stay a constant size on screen, divide its size by the zoom.

### The inverse

Mouse clicks arrive in screen space. To find what was clicked in the world, run the transform backwards: undo the shift, then undo the scale.

```javascript
const worldX = (mx - CONFIG.viewX) / CONFIG.viewZoom;
const worldY = (my - CONFIG.viewY) / CONFIG.viewZoom;
```

Subtract what was added, divide by what was multiplied, in the opposite order. Every transform you apply for drawing needs its inverse for input, and it's worth writing the two next to each other so they can't drift apart. In the game the inverse lives in `Game._pointerWorld`.

### Fitting the map to the screen

Where do `viewX`, `viewY` and `viewZoom` come from? `Game._baseView` works them out. In fullscreen mode:

```javascript
const z = Math.max(CONFIG.canvasWidth / this.terrain.mapWidth,
                   CONFIG.canvasHeight / this.terrain.mapHeight);
return { z,
         x: Math.round((CONFIG.canvasWidth - this.terrain.mapWidth * z) / 2),
         y: Math.round((CONFIG.canvasHeight - this.terrain.mapHeight * z) / 2) };
```

There are two zoom levels that would make the map exactly as wide as the canvas, or exactly as tall. Taking the **larger** (`Math.max`) means the map covers the whole canvas and overflows on one axis: no empty bars, a little cropped. Taking the smaller (`Math.min`) would show the whole map with bars on two sides. These are called **cover** and **contain**, the same words CSS uses for background images, and choosing between them is a one-word change.

The offset centres the map: half of the leftover space on each side. `(container − content) / 2` is the centring formula, and you'll write it for ever.

### Exercise 15.1

Make a sketch with a "world" of 20 random dots in a 1000 × 600 space. Draw them through `translate` and `scale`. Add `+` and `−` keys to change the zoom and arrow keys to change the offset. Then make a click print the *world* position that was clicked, and draw a marker there. Check it stays under the cursor's click point at every zoom.

## A Camera

A camera is a view transform that changes over time. The game's is `Game.camera`:

```javascript
this.camera = { zoom: 1, cx: 0, cy: 0, ax: 0.5, ay: 0.5, tween: null };
```

`zoom` is how much to magnify beyond the base view. `(cx, cy)` is the world point being looked at. `(ax, ay)` is where on screen that point should sit, as fractions (0.5, 0.5 is the centre).

Turning that into a transform:

```javascript
const z = b.z * cam.zoom;
const x = v.x + v.w * cam.ax - cam.cx * z;
const y = v.y + v.h * cam.ay - cam.cy * z;
```

Read the second line as an equation. I want world point `cx` to land at screen position `v.x + v.w * ax`. The transform says `screen = x + world * z`. So `x = screen − world * z`. A camera is one line of algebra: decide where a world point should appear, and solve for the offset.

The result is then clamped so the camera can't show past the map's edges.

### Moving it smoothly

To move the camera, `cameraTo(target, frames)` records where it is now and where it's going:

```javascript
c.tween = { from, to, t: 0, frames: Math.max(1, frames) };
```

and each frame `_updateCamera` advances it:

```javascript
tw.t = Math.min(1, tw.t + 1 / tw.frames);
const e = tw.t * tw.t * (3 - 2 * tw.t);   // smoothstep
const lerpK = (k) => tw.from[k] + (tw.to[k] - tw.from[k]) * e;
// Zoom eases in log space so the scale changes at an even rate.
c.zoom = Math.exp(Math.log(tw.from.zoom) + (Math.log(tw.to.zoom) - Math.log(tw.from.zoom)) * e);
c.cx = lerpK('cx'); c.cy = lerpK('cy'); c.ax = lerpK('ax'); c.ay = lerpK('ay');
if (tw.t >= 1) c.tween = null;
```

This is a **tween**, short for in-between: a start value, an end value, a duration, and a number `t` that runs from 0 to 1. Each frame, `t` advances by `1 / frames`, is bent through smoothstep (Chapter 5) so the motion eases in and out, and feeds a lerp for each property.

That's a different tool from the easing of Chapter 2 (`current += (target − current) × rate`). Easing chases a target that may keep moving, and never quite arrives. A tween goes from A to B in exactly N frames and stops. Use easing for things that follow; use a tween for a move with a definite beginning and end.

The zoom line is worth a second look. It lerps the *logarithm* of the zoom, not the zoom itself. Why? Going from zoom 1 to zoom 4 by ordinary lerp passes through 2.5 at the halfway point. But zoom is felt as a ratio: 1 to 2 is a doubling, and 2 to 4 is another doubling, so the perceptual midpoint is 2. Lerping in log space gives exactly that. Anything you perceive as a ratio, such as zoom, pitch or volume, should be interpolated this way.

Notice where `_updateCamera` is called from: `render`, not `update`. The camera is advanced by real frames. So it keeps moving while the game is paused for a tutorial tip, and while a story moment has frozen the simulation (Chapter 14). The camera belongs to the presentation, not the world, and it runs on the presentation's clock.

## Draw Order

On a 2D canvas, whatever is drawn later covers what was drawn earlier. There's no depth. So the order of drawing *is* the layering. This is the **painter's algorithm**: paint the background first and work forward.

In the flat view, `Simulation.render` is a list of layers:

```javascript
// Layer 0: Nesting sites (ground scrapes, under everything else).
this._renderFiltered(this.nestingSites, 0, null, true, inView);
// Layer 1: Ground plants
this._renderFiltered(this.groundPlants, 0, null, true, inView);
// Layer 2: Placeables (not Storms)
this._renderFiltered(placeables, 50, p => p.type !== 'Storm', true, inView);
// Layer 3: Eggs
this._renderFiltered(eggs, 0, null, true, inView);
// Layer 4: Moas (body)
this._renderFiltered(moas, 0, null, true, inView, 'render');
// Layer 5: Trees (rimu, beech, fern)
this._renderFiltered(this.treePlants, 30, null, true, inView);
// Layer 6: Eagles
this._renderFiltered(eagles, 30, null, true, inView);
// Layer 7: Storms
this._renderFiltered(placeables, 80, p => p.type === 'Storm', true, inView);
// Layer 8: Moa indicators
this._renderFiltered(moas, 0, null, true, inView, 'renderIndicators');
```

Ground, then low plants, then things on the ground, then animals, then tall trees, then things in the air, then weather, then the information that must never be hidden. It's a statement about height above the ground, expressed as a sequence.

Three details.

**Plants are split into two lists.** Tussock goes under the moa; trees go over. Chapter 3's `addPlant` put each new plant into `groundPlants` or `treePlants` as it was created. The alternative, one list filtered by type on every frame, would test a thousand plants twice. Sorting things into the right bucket once, when they're made, saves doing it sixty times a second.

**Moa are drawn twice.** Their bodies are on layer 4, under the trees. Their hunger bars and hearts are on layer 8, over everything. `_renderFiltered` takes the name of the method to call, so the same list can be walked with `'render'` and again with `'renderIndicators'`. Splitting one object's drawing into passes lets its parts sit at different depths.

**`_renderFiltered` culls.**

```javascript
_renderFiltered(list, extraMargin, filter, aliveCheck, inView, method = 'render') {
  for (let i = 0, len = list.length; i < len; i++) {
    const e = list[i];
    if (aliveCheck && !e.alive) continue;
    if (filter && !filter(e)) continue;
    const q = e._dragPos || e.pos;
    if (inView(q.x, q.y, extraMargin)) {
      e[method]();
    }
  }
}
```

`e[method]()` calls a method whose name is held in a variable: `e['render']()` is the same as `e.render()`. And `inView` tests whether the thing is inside the visible rectangle, plus a margin so that a tall tree whose base is just off-screen still gets drawn. Skipping things that can't be seen is called **culling**, and it's the first optimisation any renderer should have.

## Sprites

A moa is drawn from images. `EntitySprites` in `mauri_entity_sprites.js` holds them and chooses which to show.

### Animation is an index

A walk cycle is a handful of images shown in turn.

```javascript
getMoaSprite(animTime, isMoving, isJuvenile = false, variant = null, isMating = false) {
  const set = (variant && this.moaVariants[variant]) || this.moa;

  if (isMating && this.isValid(set.mating)) return set.mating;

  if (isMoving && set.walk.length > 0) {
    const speed = this.animation.moaWalkSpeed * (set.walkSpeedMul || 1);
    const frameIndex = Math.floor(animTime * speed) % set.walk.length;
    if (this.isValid(set.walk[frameIndex])) return set.walk[frameIndex];
  }

  if (this.isValid(set.idle)) return set.idle;
  // ...
  return null;
}
```

The whole of sprite animation is this line:

```javascript
const frameIndex = Math.floor(animTime * speed) % set.walk.length;
```

`animTime` is a number that goes up by `dt` every frame. Multiply by a speed, drop the fraction, and wrap with `%` (Chapter 5): you get 0, 1, 2, 3, 0, 1, 2, 3. That's which image to draw.

Each moa's `animTime` starts at a random value, so a herd doesn't march in step. It's the `noiseOffset` idea again.

Notice the chain of fallbacks. No mating pose? Use the walk. No walk frames? Use the idle image. This variant's art missing? Use the generic moa's. Still nothing? Return `null`, and the caller draws nothing. A game in development always has art that isn't finished. Code that degrades gracefully at each step means missing art is a visual gap, not a crash.

### Facing

A moa's sprite is drawn in side view. Chapter 2 covered the logic of which way it faces. Here's the drawing:

```javascript
const flip = this._flip;
const faceSign = EntitySprites.getMoaFaceSign(variant);
scale(flip * faceSign, 1 + (1 - Math.abs(flip)) * 0.18);
```

`scale(-1, 1)` mirrors everything drawn after it left-to-right. Since `_flip` eases from +1 to −1, the horizontal scale passes through zero: the sprite narrows to a line and widens again facing the other way. The second argument adds a slight vertical stretch at the midpoint. It's a turn-around animation made from one image and two multiplications.

The eagle is drawn from above and *rotates* to face its heading, since a top-down sprite can point any way. Its art is pixel art, and pixel art looks bad at arbitrary angles, so the angle is snapped to one of twelve directions:

```javascript
snap(angle) {
  return Math.round(angle / this.INCREMENT) * this.INCREMENT;
}
```

`Math.round(value / step) * step` snaps any number to the nearest multiple of `step`. It works for angles, for grid positions, for anything. And `snapWithHysteresis` only changes the displayed angle when the true heading has moved well past the boundary, so an eagle flying near the border between two directions doesn't flicker between them. Hysteresis, for the fourth time in this guide.

### Tint

Most moa species share one set of sprites and are told apart by colour:

```javascript
tint(_tint[0], _tint[1], _tint[2]);
image(sprite, 0, 0, _drawSize, _drawSize);
noTint();
```

`tint` multiplies the image's colours by a colour. One piece of art, nine species. It's the visual counterpart of Chapter 12's data-driven design: the art is shared, and a three-number entry in the species table makes each kind look different.

## Fake 3D

The game looks three-dimensional: mountains stand up, and animals walk across them. The simulation is flat. How?

The answer is in `mauri_projection.js`, which is 90 lines long, and the heart of it is one formula:

```javascript
// Plan-oblique, not isometric (no shear, no rotation):
//     screenX = worldX
//     screenY = worldY · K − elev · LIFT
```

Take each point of the flat map and move it **up the screen in proportion to its elevation**. That's all. High ground is drawn higher. A ridge at elevation 0.8 is shifted up by `0.8 × LIFT` pixels; the valley floor beside it at 0.2 by a quarter of that. The ridge now stands above the valley on screen, and overlaps the ground behind it.

The second term, `K`, squashes the map vertically (it's about 0.72). That's the tilt: as if you'd leaned the map away from you, so that distances up the screen are foreshortened.

```
top-down (flat):                 plan-oblique:

  +-----------+                    +-----------+   ← far edge, squashed by K
  | . . ^ . . |                    | .  /\  .  |
  | . ^ ^ ^ . |                    |  /\/  \   |   ← high ground lifted up
  | . . ^ . . |                    | /      \. |
  | . . . . . |                    | .  .  .  .|
  +-----------+                    +-----------+
```

This kind of view is called **plan oblique**. It's what old hand-drawn relief maps use, and it has a wonderful property for a game: `screenX = worldX`. Nothing moves sideways. East is still exactly to the right. That keeps the map readable and keeps the maths trivial.

The code:

```javascript
groundY(worldY, elev) {
  return this.relief
    ? worldY * this.K - (elev || 0) * this.LIFT + this.LIFT
    : worldY;
}
```

When `relief` is off, it returns `worldY` unchanged and the game is flat. One boolean switches the whole world between 2D and 3D. (The `+ LIFT` at the end shifts everything down so the lifted peaks don't go off the top.)

The file's comment explains the two numbers: *with K + liftFrac ≈ 1.0 the standing terrain fills the flat map's rect*. Squashing the map to 72% of its height frees 28% of the space, and that's exactly how tall the highest peak is allowed to stand. The tilted world occupies the same screen rectangle as the flat one, so nothing else about the layout had to change.

### Standing things on the ground

Each animal's `render` draws at its flat world position. To stand it on the relief, the simulation shifts the drawing vertically before calling it:

```javascript
const elev = this.terrain.getElevationAt(q.x, q.y);
this._drawLifted(e, P.groundY(q.y, elev) - q.y, method);
```

```javascript
_drawLifted(e, dy, method) {
  push(); translate(0, dy); e[method](); pop();
}
```

(The real one uses a faster hand-rolled push and pop.) Look up the elevation under the animal, work out how far up the screen that ground has been moved, and translate by the difference. The moa's own drawing code has no idea. It draws at `pos` as it always did, and arrives standing on the mountainside.

The sprites themselves aren't tilted. They stay upright, facing the viewer, like cardboard cut-outs standing on a model. That's called **billboarding**, and it's how sprites are shown in 3D-looking worlds from Doom onwards.

### Depth sorting

In the flat view, layers were enough: all trees over all moa. Standing up, that's wrong. A moa in front of a tree should cover the tree's trunk. A moa behind it should be hidden by it. What's "in front" now depends on where things are.

The rule is simple. Things lower on the screen are nearer the viewer. So draw from the top of the screen to the bottom:

```javascript
const cast = this._cast || (this._cast = []);
cast.length = 0;
this._collectCast(this.placeables, cast, inView, lift, p => p.type !== 'Storm');
this._collectCast(this.eggs, cast, inView, lift, null);
this._collectCast(this.moas, cast, inView, lift, null);
// ... birds, trees, eagles ...
cast.sort(Simulation._castCmp);
for (let i = 0; i < cast.length; i++) {
  const e = cast[i];
  this._drawLifted(e, e._py - e.pos.y, 'render');
}
```

```javascript
Simulation._castCmp = (a, b) => a._py - b._py;
```

Gather everything that has height into one array. For each, compute `_py`, its projected ground position on screen. Sort by it. Draw in that order. Far things first, near things over them. This is the painter's algorithm with the order worked out fresh each frame, and it's called **depth sorting** or y-sorting.

`array.sort(compare)` takes a function that's given two items and returns a negative number if the first should come first, positive if the second should. `a._py - b._py` does that for ascending order. It's the standard idiom for sorting objects by a numeric property.

Two economies. The array `this._cast` is reused every frame (`length = 0`, then refill) instead of being created anew. And the low ground plants aren't sorted at all. The comment explains: *it is low and dense; sorting ~1000 tussocks each frame buys nothing visible*. Sort what needs sorting.

### Clicking in a tilted world

The inverse is harder now. The player clicks a screen point. Which world point is that? The forward formula was:

```
screenY = worldY * K − elev(worldX, worldY) * LIFT + LIFT
```

To solve for `worldY` you need the elevation at the answer, which you don't have until you know `worldY`. It's circular, and there's no formula for it, because the elevation comes from a noise-built height map.

The game solves it by guessing and correcting:

```javascript
screenToWorld(screenX, screenY, elevAt) {
  const x = screenX;
  if (!this.relief || this.LIFT === 0) return { x, y: screenY };
  let y = (screenY - this.LIFT) / this.K;   // flat first guess
  if (typeof elevAt === 'function') {
    for (let i = 0; i < 6; i++) {
      const e = elevAt(x, y) || 0;
      y = (screenY + e * this.LIFT - this.LIFT) / this.K;
    }
  }
  return { x, y };
}
```

Guess that the ground is flat and solve for `y`. Look up the elevation at that guess. Solve again using that elevation. Look up the elevation at the new answer. Repeat. Each round the guess moves closer to a point that's consistent with itself, and after six rounds it's close enough to be under the cursor.

This is **fixed-point iteration**, and it's a general way to solve an equation you can't rearrange: turn it into "new guess = some function of old guess" and repeat until it settles. It doesn't always settle, and on a cliff face it can wobble, but for gentle terrain six rounds do it. It's also only run on a click or once per frame for the placement preview, so its cost doesn't matter.

### Exercise 15.2

Generate a small height map with noise. Draw it as rows of dots, top-down. Then add a `relief` toggle that draws each dot at `y * 0.7 − elev * 80 + 80` instead of `y`. Colour by elevation. Then put twenty "trees" (tall thin rectangles) on it, standing at their ground position, and depth-sort them. Toggle the sort off and see what goes wrong.

## Making It Fast

Everything above is enough to draw the game. It would run at perhaps ten frames a second. The rest of this chapter is about why, and what was done. It's a long section, and you don't need all of it to work on the game. I'd read it for the *ideas*, each of which you'll want again, and come back for the details when you need them.

A principle first, because without it optimisation is guesswork:

> **Measure before you change anything.**

Press **D** in the game. The debug overlay shows:

```
Update: 2.1ms  (CPU sim)
Render: 6.4ms  (CPU submit)
Frame:  16.9ms (59fps)
Hidden: 8.4ms  (GPU+composite)
```

`Update` and `Render` are measured by taking the time before and after each call. `Frame` is the real time between frames. `Hidden` is what's left: `Frame − Update − Render`.

That last number is the lesson. JavaScript finishes issuing its drawing commands in 6 milliseconds, and the frame takes 17. The other 8 are spent by the browser and the graphics card actually putting pixels on the screen, after your code has returned. You cannot see that time by timing your own functions. The game's notes on performance record that for a long while the measurements pointed at the wrong culprit for exactly this reason. If `Frame` is much bigger than `Update + Render`, the cost is in how much you're asking to be drawn, not in your JavaScript.

These numbers are smoothed with the easing formula (`perfFrameMs += (raw − perfFrameMs) * 0.1`), which here goes by the name **exponential moving average**. A raw frame time jumps around too much to read. The smoothed one shows the trend.

Now the techniques, roughly in the order the game adopted them.

### Don't draw it again: baking

The terrain is hundreds of thousands of cells, each with a colour. Drawing that many rectangles every frame is hopeless. But the terrain doesn't change. So draw it **once**, into an off-screen image, and from then on draw that image.

```javascript
const buffer = createGraphics(w, h);   // an off-screen canvas
// ... draw every cell into buffer, once ...

// every frame:
image(buffer, 0, 0);                   // one call
```

`createGraphics` makes an invisible canvas you can draw on with all the usual functions (`buffer.fill`, `buffer.rect`) and then stamp onto the main canvas with `image`. Hundreds of thousands of draw calls become one.

This is the baking idea from Chapter 4 applied to pictures, and it's the single most effective rendering optimisation there is. Whenever something is expensive to draw and rarely changes, draw it once into a buffer.

"Rarely" needs care. The terrain changes with the seasons: snow comes down. The game bakes *four* buffers, one per season, and during the transition window draws the current season's image and then the next season's over it, partly transparent, with the alpha set by `transitionProgress`. A **cross-fade**. The snow line appears to creep down the mountain, and all that's happening is one image fading in over another. It's Chapter 5's lerp, applied to two pictures.

### Don't draw it again: caching with a signature

The HUD has dials, a toolbar and tiles, each built from dozens of rounded rectangles, arcs and icons. They change, but only now and then: when mauri ticks over, when a tool's state changes. `HudCache` in `mauri_UI.js` bakes each element and re-bakes it only when it would look different:

```javascript
draw(key, x, y, w, h, sig, drawFn) {
  // ...
  let e = this._entries.get(key);
  if (!e || e.sig !== fullSig) {
    // The signature changed: redraw into the element's own off-screen canvas.
    e.g.clear();
    drawIntoGraphics(e.g, () => { /* ... */ drawFn(); });
    e.sig = fullSig;
  }
  image(e.g, bx, by, bw, bh);
  // Every frame: just stamp the cached picture.
}
```

The caller passes a **signature**: a string made of everything that affects how the element looks.

```javascript
HudCache.draw('mauriRing', cx - r - 4, cy - r - 4, r * 2 + 8, r * 2 + 8, sig, () => this._drawMauriRing(...));
```

If the signature is the same as last time, the cached picture is still right, and it's stamped. If it's different, the element is redrawn into its buffer. For the mauri ring the signature is its two displayed numbers. It's redrawn when a number changes, perhaps once a second, and stamped the other 59 frames.

This is **memoisation**: remember the result of an expensive computation along with the inputs that produced it, and reuse the result while the inputs are unchanged. It's the dirty flag of Chapter 3 in a more general form. Instead of someone setting a flag, the cache compares inputs.

The risk is leaving something out of the signature. Then the element changes and the cache doesn't notice. There's a nice example in the code: the cache includes a "font generation" counter in every signature, bumped when a web font finishes loading, because an element baked before the font arrived would otherwise keep its fallback lettering for ever. When a cached thing looks stale, ask what the signature forgot.

### One texture instead of many: the atlas

Each sprite image, loaded separately, becomes a separate texture on the graphics card. Drawing a moa, then a tree, then an egg means switching textures each time, and switching is slow.

`SpriteAtlas` in `mauri_spriteatlas.js` packs every sprite into a few large images, called **atlas pages**, at startup. Drawing a sprite then means drawing a *rectangle cut out of* a big page. Many different sprites, one texture.

Packing rectangles into a bigger rectangle is a puzzle with a simple good-enough solution called **shelf packing**:

```javascript
// Shelf bin-pack the unique images into pages, tallest-first so shelves stay tight.
const order = uniq.slice().sort((a, b) => b.height - a.height);
let pageIdx = 0, x = G, y = G, shelfH = 0;
for (const img of order) {
  const w = img.width, h = img.height;
  if (x + w + G > MAX) { x = G; y += shelfH + G; shelfH = 0; }   // wrap to next shelf
  if (y + h + G > MAX) { newPage(); }                            // shelf overflows page
  placements.push({ img, page: pageIdx, x, y });
  x += w + G;
  if (h > shelfH) shelfH = h;
}
```

Sort the images tallest first. Place them left to right in a row, like books on a shelf. When the row is full, start a new shelf below, as tall as the tallest book on the one just finished. When the page is full, start a new page. Sorting by height first means each shelf holds books of similar height and little space is wasted.

`G` is a **gutter**: a transparent gap between sprites, so that when the graphics card blurs slightly at a sprite's edge it doesn't pick up a sliver of its neighbour.

### Wrapping a function

Here's the clever part. After packing, every call to `image(sprite, x, y)` in the game needs to become "draw this sub-rectangle of that page". There are hundreds of such calls. The atlas changes none of them. It replaces `image` itself:

```javascript
_installShim() {
  const orig = image;
  const shim = function (img, a, b, c, d) {
    if (img && img.__atlas) {
      // An atlas frame: draw its sub-rectangle of the page.
      return orig.call(this, img.__page, a, b, dw, dh, img.sx, img.sy, img.sw, img.sh);
    }
    return orig.apply(this, arguments);
    // Anything else: behave exactly as before.
  };
  window.image = shim;
}
```

It saves the real `image` function in `orig`, and installs a new function under the same name. The new one checks whether it's been handed an atlas frame. If so, it calls the original with the page and the sub-rectangle. If not, it passes the call straight through.

Every existing `image(...)` call in the codebase now goes through the shim without knowing. This is called **wrapping** a function (or, less politely, monkey-patching). In JavaScript a global function is just a variable holding a function, and you can put a different function in the variable.

It's powerful and it deserves caution. It changes the behaviour of code far from where the change is made, and someone reading `image(sprite, 0, 0)` has no way to see that it's been intercepted. The game uses it sparingly and for one purpose: to change *how* drawing happens without touching the *callers*. That was the right call here. Rewriting hundreds of draw sites would have been slower and riskier. Know that the trick exists, and reach for it rarely.

### The GPU: batching quads

Even with an atlas, p5's 2D canvas draws each sprite as a separate operation. With a thousand plants and dozens of animals, each with a shadow, that's too many.

A graphics card works differently. Its natural operation is: here's a long list of triangles and one texture; draw them all at once. One instruction, called a **draw call**, can draw ten thousand sprites as fast as one. The cost is per call, not per sprite. So the game's WebGL layer, `GLBatch` in `mauri_glbatch.js`, collects every sprite of the frame into one big list and sends it in one go. That's **batching**.

A sprite is a rectangle, and a rectangle is two triangles: a **quad**. Each corner (a **vertex**) needs a position on screen, a position in the texture to sample from, and a colour:

```javascript
// Batch buffer: interleaved [x, y, u, v, r, g, b, a, sil] per vertex, 6 verts / quad.
this._verts = new Float32Array(this._cap * this.FLOATS_PER_VERT);
```

Nine numbers per vertex, six vertices per sprite, all packed into one enormous typed array. `x, y` is where on screen. `u, v` is where in the texture, from 0 to 1 across the atlas page. `r, g, b, a` is the tint. The array is allocated once and refilled every frame.

Now, how do the sprites get in there? The game's drawing code is all `translate`, `scale`, `image`. `GLBatch` uses the shim again. While a batch is open, `image()` calls are **captured**:

```javascript
const shim = function (img, a, b, c, d) {
  if (GLBatch.enabled && GLBatch._open && GLBatch.tryCapture(img, a, b, c, d)) return;
  // ... otherwise the 2D path ...
};
```

Instead of drawing, `tryCapture` works out where the sprite *would* have been drawn, and adds a quad to the buffer. To know where, it asks the 2D canvas for its current transform:

```javascript
_ctm(ctx) { const m = ctx.getTransform(); return m; }
```

Every `translate`, `scale` and `rotate` since the last `push` has been accumulated by the canvas into one **matrix**, six numbers (`a, b, c, d, e, f`) that together say how to turn a local point into a screen point:

```javascript
const sxTL = ma * lx0 + mc * ly0 + me, syTL = mb * lx0 + md * ly0 + mf;
```

```
screenX = a * x + c * y + e
screenY = b * x + d * y + f
```

That's what a transform *is*, underneath. `e` and `f` are the translation. `a` and `d` are the scale. `b` and `c` come in with rotation. When you write `translate(100, 50); scale(2);`, p5 multiplies those into the matrix, and every later drawing call runs its coordinates through these two lines. `GLBatch` does the same arithmetic itself for each corner of the sprite and writes the results into the buffer.

So the moa's `render` still says `translate(this.pos.x, this.pos.y); scale(flip, 1); image(sprite, 0, 0, size, size);`. With the GL layer on, nothing is drawn by those lines. The transform is read, four corners are computed, and six vertices are appended to an array. At the end of the sprite pass, `composite()` sends the whole array to the graphics card:

```javascript
gl.bufferData(gl.ARRAY_BUFFER, this._verts.subarray(0, this._n * this.FLOATS_PER_VERT), gl.DYNAMIC_DRAW);
// ...
gl.drawArrays(gl.TRIANGLES, 0, this._n);
```

One upload, one draw call, every sprite on screen.

I think this is a beautiful piece of engineering, and the reason is what *didn't* change. Not one entity's drawing code was touched. The same `render` methods work on the 2D canvas and on the GPU. If WebGL isn't available, or the graphics card's context is lost mid-game, a flag flips and the same calls draw in 2D as they always did. That's possible only because the capture happens at one narrow point that every draw passes through.

### Shaders

A graphics card runs two small programs that you supply, called **shaders**. They're written in a C-like language, GLSL, and in the game they live as strings inside the JavaScript.

The **vertex shader** runs once per vertex and says where it goes on screen. The **fragment shader** runs once per pixel covered and says what colour it is. Here's the sprite batch's fragment shader, with the extras removed:

```glsl
precision mediump float;
varying vec2 vUV;
varying vec4 vCol;
uniform sampler2D uTex;

void main() {
  vec4 t = texture2D(uTex, vUV);
  // Look up this pixel's colour in the atlas.
  gl_FragColor = vec4(t.rgb * vCol.rgb, t.a * vCol.a);
  // Multiply by the tint, and output.
}
```

Two lines of work. Sample the texture; multiply by the tint. That `t.rgb * vCol.rgb` is the `tint()` function, done per pixel on the graphics card for free.

What makes shaders different from ordinary code is that this function runs for every pixel of every sprite, millions of times a frame, all at once, on hardware built for it. You don't loop over pixels. You write what happens to *one* pixel and the card does the rest. It takes a while to get used to, and it's worth the effort. The Book of Shaders (thebookofshaders.com) is the place to start.

### The terrain on the GPU

The last step moved the terrain itself onto the graphics card. `GLTerrain` in `mauri_glterrain.js` builds a **mesh**: a grid of vertices, one per cell of the height map, joined into triangles. Each vertex carries its world position, its elevation, and a colour.

The vertex shader does the projection. Here's its key line:

```glsl
float paintY = ly*uK - aWorld.z*uLIFT + uLIFT;   // Projection.groundY, relief on
```

It's the formula from `mauri_projection.js`, written again in GLSL, with the elevation in `aWorld.z`. The mountains stand up because the graphics card moves each vertex up the screen by its height. The comment says which JavaScript function it mirrors, which matters: the terrain and the sprites standing on it must use exactly the same projection, or the animals would float above the ground or sink into it. When the same formula has to live in two languages, mark each copy with a pointer to the other.

**Lighting.** A flat-coloured relief looks like a cut-out. What gives it form is shading: slopes facing the sun are bright, slopes facing away are dark. For that you need to know which way each bit of ground faces, a direction called the **normal**. It's computed from the height map when the mesh is built:

```javascript
// central-difference normal between neighbouring mesh vertices
const nx = -(hr - hl) * SLOPE, ny = -(hd - hu) * SLOPE;
const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
nrm[o3] = nx * inv; nrm[o3 + 1] = ny * inv; nrm[o3 + 2] = inv;
```

`hr - hl` is the height to the right minus the height to the left: the slope in x, exactly the subtraction the moa used in Chapter 4 to feel a hill. Likewise in y. A surface that rises to the east faces west, hence the minus signs. The third component is "up". Dividing by the length makes it a unit vector.

Then, in the fragment shader:

```glsl
float d = max(0.0, dot(N, sun));
col = vCol * (uSkyCol * amb + uSunCol * (1.0 - amb) * d);
```

`dot(N, sun)` is the **dot product** of the surface's normal and the direction to the sun. For two unit vectors it's the cosine of the angle between them: 1 when the surface faces the sun squarely, 0 when it's edge-on, negative when it faces away (clamped to 0 by `max`). So `d` is "how much is this ground facing the sun?", and the colour is the ground's own colour times some ambient sky light plus sunlight scaled by `d`.

That one line is the foundation of all 3D lighting. It's called Lambertian or diffuse shading, and it's why the relief has shape.

**Seasons on the GPU.** Each vertex carries *two* colours: this season's and next season's. The shader blends them:

```glsl
vCol = mix(aColCur, aColNext, uSeasonBlend);
```

`mix` is GLSL's `lerp`. `uSeasonBlend` is `transitionProgress`, sent from JavaScript once per frame as a **uniform** (a value that's the same for every vertex). The cross-fade between seasons, which the 2D path did by blending two baked images, is here one multiplication per vertex.

The same shader paints snow above a snow line that slides (`uSnowLine`, from the season manager), fades distant ridges toward a haze colour, and draws the sea with an animated ripple. Each is a few lines, each driven by one number from the simulation. It's the "move a threshold" idea of Chapter 4, running on the graphics card.

### Layers of canvases

One more structural trick. The game doesn't draw everything onto one canvas. With the GL layer on, there are up to three canvases stacked on top of each other in the page:

```
top     (p5's main 2D canvas)   indicators, HUD, text          transparent background
middle  (the WebGL canvas)      sprite batch, and the terrain mesh when the GPU draws it
bottom  (a p5 off-screen layer) the baked terrain, only when the GPU isn't drawing it
```

and the browser composites them. The 2D canvas is cleared to transparent each frame (`clear()` instead of `background()`), so the GL layer shows through wherever the HUD isn't.

Why? Because each kind of drawing goes to the technology that's best at it. Thousands of sprites and a lit mesh go to WebGL. Text, rounded panels and vector icons, which 2D canvas does well and WebGL does badly, stay in 2D. And nothing has to be copied between them, because the browser blends stacked canvases on the graphics card for free.

### Adapting to the machine

Finally, the game adjusts itself to the computer it's running on.

```javascript
function updateDynamicResolution() {
  // ...
  if (perfFrameMs > DYNRES_DOWN_MS && cur > DYNRES_TERRAIN_MIN) {
    target = Math.max(DYNRES_TERRAIN_MIN, cur - 0.25);       // shrink the terrain buffer
  } else if (perfFrameMs < DYNRES_UP_MS && cur < ceil) {
    target = Math.min(ceil, cur + 0.25);                     // grow it back
  }

  if (target !== cur) {
    CONFIG.terrainMaxSS = target;
    dynResCooldownUntil = now + DYNRES_COOLDOWN;
    // ...
  }
}
```

If frames are taking longer than 20 ms, render the terrain at a lower resolution and stretch it up. If they're comfortably under 13.5 ms, raise it again. This is **dynamic resolution**, and it's a control loop: measure, compare with a target, adjust.

You'll recognise its safeguards from Chapter 13. It's a balancing loop, so it could oscillate. It has a **dead band** (between 13.5 and 20 ms it does nothing), which is hysteresis. It has a **cooldown** of 1.2 seconds between changes, so it waits to see the effect of one adjustment before making another. That's the cure for a delayed loop. The comment even says so: *a cooldown + wide dead-band stop it oscillating*.

The terrain was chosen as the thing to degrade because a smooth shaded landscape loses little when blurred, while sprites and text look bad at once. When you have to give something up for speed, give up what the eye will miss least.

There's also a manual **performance mode** that turns off plant shadows, simplifies the water, halves the mesh density and squares off the corners of hunger bars. Each of those was found by measurement to cost more than it was worth on weak hardware.

## Summary

- The simulation decides what's true; the renderer decides how it looks, and never writes to the simulation.
- World space becomes screen space by `translate` then `scale`. Input needs the inverse. Divide by the zoom to keep a constant on-screen size.
- A camera solves for the offset that puts a chosen world point at a chosen screen point. A tween moves it from A to B in N frames; zoom is lerped in log space.
- Draw order is depth. The flat view uses fixed layers; objects can be drawn in more than one pass.
- Cull what's off-screen.
- Sprite animation is `floor(time × speed) % frameCount`. Fall back gracefully when art is missing.
- Plan-oblique projection: `screenY = worldY × K − elevation × LIFT`. Sprites stay upright (billboards) and are shifted onto the lifted ground.
- Standing things are depth-sorted by projected ground position each frame.
- Screen-to-world in the tilted view is solved by iterating a guess.
- Measure first. Frame time minus your own code's time is the hidden cost of drawing.
- Bake static pictures into off-screen buffers. Cross-fade between baked seasons.
- Cache changing elements with a signature of everything that affects their look.
- An atlas packs sprites into shared textures (shelf packing).
- Wrapping a global function changes how every call behaves without editing the callers. Use sparingly.
- Batching sends all sprites as one array of quads in one draw call. The capture reads the canvas's transform matrix.
- A vertex shader positions vertices; a fragment shader colours pixels. `dot(normal, sun)` is diffuse lighting. `mix` with a uniform blends the seasons.
- Stack canvases so each technology draws what it's good at.
- Dynamic resolution is a control loop with a dead band and a cooldown.

## The Mauri Project

Add something to see, at each level of the renderer.

1. **A world-space overlay.** Write a lens that draws a compass rose in the world at the map's centre, and a scale bar 100 world units long, both staying a constant size on screen as the view zoom changes. Then make the scale bar's *length* follow the zoom while its line thickness and label don't.
2. **An entity pass.** Give moa footprints. In `Moa`, keep an array of the last 12 positions, adding one every 20 frames while moving (reuse objects; don't allocate each time). Add a method `renderTrail()` that draws them as small fading dots. In `Simulation.render` (the flat layers) and `_render3D`, add a pass that calls `'renderTrail'` on the moa, *under* their bodies. In the 3D view, each footprint needs lifting to the ground at *its own* position, not the moa's. How will you do that? (Look at how `_billboardList` computes its lift, and consider calling `Projection.groundY` per footprint inside `renderTrail`.)
3. **A camera move.** When a moa egg hatches, ease the camera in on it and back out. Find where `EGG_HATCHED` is fired, and from a listener call `game.cameraTo({ zoom: 2, cx: egg.pos.x, cy: game._groundPaintY(egg.pos.x, egg.pos.y) }, 60)`. A couple of seconds later, call `game.cameraTo({ zoom: 1 }, 90)`. Why is `cy` given as a paint-space y and not the egg's world y?
4. **Measure something.** Press **D** and note `Update`, `Render`, `Frame` and `Hidden` in a busy scene. Turn on performance mode from the level select and note them again. Then load the game with `?render=2d` and compare. Which number changed most between GPU and 2D? What does that tell you about where the 2D path spends its time?
5. **A cached HUD element.** Add a small panel to the HUD showing the current number of eagles and their average hunger, rounded to the nearest 10. Draw it first without the cache. Then wrap it in `HudCache.draw` with a signature made from those two values. Add a `console.log` inside the draw function to count how often it really runs.
6. Stretch, for the brave: in `GLTerrain._buildProgram`, the fragment shader has the line that applies the frost tint. Add a uniform `uPulse` that your code sets each frame to `0.5 + 0.5 * sin(time)`, and use it to tint the terrain very slightly warmer and cooler. You'll need to add the name to the list of uniforms, find where the other uniforms are set (`_bindScene`), and set yours there with `gl.uniform1f`. If the screen goes black, open the browser console: a shader that fails to compile says why.
