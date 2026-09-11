// ============================================
// GL TERRAIN — height-field relief on the GPU  (opt-in: ?terrain=gl, needs ?render=gl)
// ============================================
// GL_PORT.md Phase 5. Renders the terrain as a lit, displaced height-field MESH in the
// SAME WebGL canvas as the sprite batch (mauri_glbatch.js), replacing the CPU-baked relief
// buffer. Three wins over the bake, all from the brief:
//   • Better shading — real normal-based hillshading from the heightmap, not a baked
//     cliff-face heuristic. A sun direction + ambient + a gentle distance haze.
//   • Continuous N–S scroll — the mesh re-projects from the CONTINUOUS world heightmap
//     every frame, so a year pan just moves the camera window (uScrollX/Y). The old bake
//     was per-ROW, which is why N–S traversal had to CROSSFADE; here it simply scrolls.
//   • Keeps the diorama tilt — same plan-oblique projection as Projection.groundY, so the
//     terrain and the billboarded cast still line up exactly.
//
// No depth buffer is needed (the GL context has none): a height-field seen from a fixed
// oblique angle is drawn FAR→NEAR (rows of increasing worldY), painter's-algorithm, so
// nearer ground correctly overpaints farther ground. Sprites draw after, always on top —
// exactly as the 2D path already billboards them over the terrain.
//
// Reversible + inert: only runs when Terrain-GL is on AND GLBatch is active AND relief is
// on; otherwise the untouched CPU bake + DOM-stacked bottom layer render as before.

const GLTerrain = {
  requested: false,     // ?terrain=gl on the URL
  enabled: false,       // requested AND GLBatch has a live context
  _prog: null,
  _buffers: null,       // { pos, nrm, colCur, colNext, idx, count }
  _dims: null,          // { cols, rows, worldW, worldH, key }  (rebuild trigger)
  _colKeyCur: null, _colKeyNext: null,
  _loc: {},

  available() {
    return this.enabled && typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch.gl;
  },

  // ---- program -----------------------------------------------------------------
  _buildProgram(gl) {
    const vs =
      'attribute vec4 aWorld;attribute vec3 aNormal;attribute vec3 aColCur;attribute vec3 aColNext;' +
      'uniform float uK,uLIFT,uScrollX,uScrollY,uViewX,uViewY,uViewZoom,uSS,uW,uH,uSeasonBlend,uWorldH;' +
      'varying vec3 vN;varying vec3 vCol;varying float vHaze;varying float vWater;varying vec2 vWorld;varying float vElev;' +
      'void main(){' +
      '  float lx=aWorld.x-uScrollX; float ly=aWorld.y-uScrollY;' +
      '  float paintX=lx; float paintY=ly*uK - aWorld.z*uLIFT + uLIFT;' +   // Projection.groundY, relief on
      '  float sx=uSS*(uViewX+paintX*uViewZoom);' +
      '  float sy=uSS*(uViewY+paintY*uViewZoom);' +
      '  gl_Position=vec4(sx/uW*2.0-1.0, 1.0 - sy/uH*2.0, 0.0, 1.0);' +
      '  vN=aNormal; vCol=mix(aColCur,aColNext,uSeasonBlend);' +
      '  vHaze=clamp(1.0 - aWorld.y/uWorldH, 0.0, 1.0);' +               // far (small worldY) → 1
      '  vWater=aWorld.w; vWorld=aWorld.xy; vElev=aWorld.z;' +
      '}';
    // Lighting: two-tone daylight — a warm sun key (uSunCol) plus a cool sky fill
    // (uSkyCol) for the ambient, so lit faces read warm and hollows fall to a natural
    // cool shadow instead of a flat grey darkening. Phase 6 water (vWater=1) rides the
    // same light with an animated ripple normal + a sharp sun glint. Then, in order:
    //   • CLIMATE SNOW — snow above uSnowLine, which DROPS with the glacial (the real
    //     seasons snow line incl. coldIndex), so a deepening glacial visibly creeps the
    //     white down the slopes. Flatter ground holds more.
    //   • aerial haze on the far ridge, • seasonal frost tint,
    //   • GLACIAL GRADE — desaturate + cool + slightly darken by uCold (0..1 severity),
    //     so the whole land goes wan and blue as the ice tightens and warms back in a thaw.
    const fs =
      'precision mediump float;' +
      'varying vec3 vN;varying vec3 vCol;varying float vHaze;varying float vWater;varying vec2 vWorld;varying float vElev;' +
      'uniform vec3 uSun;uniform float uAmbient;uniform float uFrost;uniform vec3 uFrostCol;' +
      'uniform vec3 uHazeCol;uniform float uHazeAmt;uniform float uTime;uniform vec3 uWaterCol;' +
      'uniform vec3 uSunCol;uniform vec3 uSkyCol;uniform float uCold;uniform vec3 uColdTint;' +
      'uniform float uSnowLine;uniform vec3 uSnowCol;' +
      'void main(){' +
      '  vec3 sun=normalize(uSun); vec3 N=normalize(vN); vec3 col;' +
      '  if(vWater>0.5){' +
      '    float t=uTime;' +
      // Three directional wave trains (dominant swell + cross swell + fine chop) summed as
      // SLOPES → one smooth, coherent surface normal. Low-frequency + directional reads as
      // water; the old crossing high-freq cosines read as noise.
      '    vec2 d1=vec2(0.86,0.50), d2=vec2(-0.50,0.86), d3=vec2(0.22,-0.97);' +
      '    float p1=dot(vWorld,d1)*0.042 + t*0.70;' +
      '    float p2=dot(vWorld,d2)*0.080 - t*0.95;' +
      '    float p3=dot(vWorld,d3)*0.185 + t*1.55;' +
      '    vec2 slope=(0.95*cos(p1)*0.042)*d1 + (0.55*cos(p2)*0.080)*d2 + (0.30*cos(p3)*0.185)*d3;' +
      '    slope*=4.2;' +
      '    vec3 wn=normalize(vec3(-slope.x,-slope.y,1.0));' +
      '    vec3 viewDir=vec3(0.0,0.0,1.0);' +
      // Fresnel: wave faces tilted from straight-down catch more SKY reflection — the sparkle
      // that reads as a real surface rather than a tinted texture.
      '    float fres=pow(1.0-max(0.0,dot(wn,viewDir)),3.0);' +
      // Depth colour: deep cells stay dark blue; shallows (higher water elevation) lift to teal.
      '    vec3 shallow=mix(uWaterCol, vec3(0.34,0.60,0.60), 0.6);' +
      '    vec3 wcol=mix(uWaterCol, shallow, clamp(vElev*3.0,0.0,1.0));' +
      // Lit body, then blend the sky (haze) reflection in by Fresnel.
      '    float dw=max(0.0,dot(wn,sun));' +
      '    vec3 body=wcol*(uSkyCol*uAmbient + uSunCol*(1.0-uAmbient)*dw);' +
      '    col=mix(body, uHazeCol*1.06, fres*0.45);' +
      // Sharp, moving sun glint sliding over the swell.
      '    vec3 hlf=normalize(sun+viewDir);' +
      '    float spec=pow(max(0.0,dot(wn,hlf)),90.0);' +
      '    col+=uSunCol*spec*1.10;' +
      '  } else {' +
      '    float d=max(0.0,dot(N,sun));' +
      '    col=vCol*(uSkyCol*uAmbient + uSunCol*(1.0-uAmbient)*d);' +
      '    float flatness=clamp(N.z,0.0,1.0);' +
      '    float snow=smoothstep(uSnowLine, uSnowLine+0.14, vElev)*(0.35+0.65*flatness);' +
      '    vec3 snowLit=uSnowCol*(uSkyCol*uAmbient + uSunCol*(1.0-uAmbient)*d);' +
      '    col=mix(col, snowLit, snow);' +
      '  }' +
      '  col=mix(col,uHazeCol, uHazeAmt*vHaze*vHaze);' +                  // atmospheric depth on the far ridge
      '  col=mix(col,uFrostCol, uFrost*0.30);' +                          // winter frost tint (was a 2D overlay)
      '  float g=dot(col, vec3(0.299,0.587,0.114));' +                    // luminance for the glacial desaturate
      '  col=mix(col, vec3(g), uCold*0.50);' +
      '  col*=mix(vec3(1.0), uColdTint, uCold);' +
      '  col*=(1.0 - uCold*0.10);' +
      '  gl_FragColor=vec4(col,1.0);' +
      '}';
    const co = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, co(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, co(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this._prog = p;
    const U = ['uK','uLIFT','uScrollX','uScrollY','uViewX','uViewY','uViewZoom','uSS','uW','uH',
               'uSeasonBlend','uWorldH','uSun','uAmbient','uFrost','uFrostCol','uHazeCol','uHazeAmt',
               'uTime','uWaterCol','uSunCol','uSkyCol','uCold','uColdTint','uSnowLine','uSnowCol'];
    this._loc = {};
    for (const u of U) this._loc[u] = gl.getUniformLocation(p, u);
    this._aWorld = gl.getAttribLocation(p, 'aWorld');
    this._aNormal = gl.getAttribLocation(p, 'aNormal');
    this._aColCur = gl.getAttribLocation(p, 'aColCur');
    this._aColNext = gl.getAttribLocation(p, 'aColNext');
  },

  // ---- geometry (static; rebuilt only when the terrain grid changes) -----------
  build(terrain) {
    if (!this.available() || !terrain || !terrain.renderHeightMap) return false;
    const gl = GLBatch.gl;
    const cols = terrain.renderCols, rows = terrain.renderRows;
    const worldW = terrain.worldW, worldH = terrain.worldH;
    const H = terrain.renderHeightMap;
    const key = cols + 'x' + rows + '@' + worldW + 'x' + worldH + '#' + (terrain.glacialAdvance || 0) + ':' + (terrain.seed || 0);
    if (this._dims && this._dims.key === key && this._buffers) return true;   // already built for this land

    if (!this._prog) this._buildProgram(gl);

    // FAR/NEAR over-scan SKIRT — real receding terrain past the world's edges, so the
    // tilted plane FILLS the frame instead of cutting off. The old scheme used a SINGLE
    // over-scan row that copied the world's edge row and sat marginFar/Near away in Y, so
    // that one quad-row stretched the edge colours into VERTICAL STREAKS up to the top of
    // the frame (and down the low-elevation coast). Instead we SAMPLE fresh terrain for a
    // BAND of rows above (worldY<0) and below (worldY>worldH) the world — exactly as the
    // 2D relief does in _buildReliefSource — so the distance recedes as genuine terrain.
    // Sized off the VISIBLE window depth (one window for a world-grid level, else the map).
    const _cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const overFar = Math.max(0, _cfg.view3DOverscan != null ? _cfg.view3DOverscan : 0.45);
    const overNear = Math.max(0, _cfg.view3DOverscanNear != null ? _cfg.view3DOverscanNear : 0.28);
    const winWorldH = (terrain.hasWorldGrid && terrain.worldGridRows) ? worldH / terrain.worldGridRows : worldH;
    const marginFar = overFar * winWorldH, marginNear = overNear * winWorldH;
    const dyMesh = worldH / Math.max(1, rows - 1);        // world units between world mesh rows
    // Skirt rows at the world's own row pitch, coarsened by SKIRT_STEP (the far distance is
    // hazed + compressed, so a coarser pitch there is invisible and keeps the added mesh
    // modest — the perf/quality knob). Full COLUMN width, so the quad grid stays uniform
    // (no side seam).
    const SKIRT_STEP = 2;
    const farRows  = marginFar  > 0 ? Math.max(1, Math.round(marginFar  / (dyMesh * SKIRT_STEP))) : 0;
    const nearRows = marginNear > 0 ? Math.max(1, Math.round(marginNear / (dyMesh * SKIRT_STEP))) : 0;
    const extRows = farRows + rows + nearRows;
    this._meshRows = rows; this._extRows = extRows; this._farRows = farRows; this._nearRows = nearRows;

    // Build an EXTENDED source (world rows verbatim + freshly-sampled skirt rows). The
    // per-season vertex colours then come straight from terrain._computeSeasonCellColors on
    // this source — the SAME snow-line/contour logic the 2D relief uses, now covering the
    // skirt too (so distant snow, sea and forest all read correctly).
    const B = terrain.renderBiomeIndexMap;
    const base = terrain._baseCellColors;
    const extHeight = new Float32Array(cols * extRows);
    const extBiome  = new Uint8Array(cols * extRows);
    const extBase   = new Uint8Array(cols * extRows * 4);
    const worldYs   = new Float32Array(extRows);
    const _tc = terrain.config || {};
    const showContours = _tc.showContours;
    const contourInterval = _tc.contourInterval || 1;
    const contourWidth = (_tc.contourWidth != null) ? _tc.contourWidth : 0.008;

    for (let er = 0; er < extRows; er++) {
      // ext-row → world render-row (may be <0 far or >=rows near) and its world Y.
      let worldRow, worldY;
      if (er < farRows) {                 // far skirt: -marginFar (farthest) → toward 0
        worldRow = -1;
        worldY = -marginFar * (farRows - er) / farRows;
      } else if (er >= farRows + rows) {  // near skirt: worldH → worldH+marginNear
        worldRow = rows;
        worldY = worldH + marginNear * (er - farRows - rows + 1) / nearRows;
      } else {                            // in-world row (copied verbatim)
        worldRow = er - farRows;
        worldY = (worldRow / Math.max(1, rows - 1)) * worldH;
      }
      worldYs[er] = worldY;
      const dst = er * cols;
      if (worldRow >= 0 && worldRow < rows) {
        const srcRow = worldRow * cols;
        for (let c = 0; c < cols; c++) {
          extHeight[dst + c] = H[srcRow + c];
          extBiome[dst + c] = B ? B[srcRow + c] : 0;
          const s4 = (srcRow + c) * 4, d4 = (dst + c) * 4;
          extBase[d4] = base[s4]; extBase[d4 + 1] = base[s4 + 1];
          extBase[d4 + 2] = base[s4 + 2]; extBase[d4 + 3] = base[s4 + 3];
        }
      } else {
        for (let c = 0; c < cols; c++) {                     // fresh sample past the edge
          const wx = (c / Math.max(1, cols - 1)) * worldW;
          const elev = terrain.getElevation(wx, worldY);
          const biome = terrain.getBiomeFromElevation(elev);
          const col = terrain.getColor(elev, biome);
          const d4 = (dst + c) * 4;
          extHeight[dst + c] = elev;
          extBiome[dst + c] = terrain.biomeIndexByKey[biome.key];
          extBase[d4] = red(col); extBase[d4 + 1] = green(col); extBase[d4 + 2] = blue(col);
          let isC = 0;
          if (showContours) { const m = elev % contourInterval; isC = (m < contourWidth || m > contourInterval - contourWidth) ? 1 : 0; }
          extBase[d4 + 3] = isC;
        }
      }
    }
    this._extSrc = { cols, rows: extRows, heightMap: extHeight, biomeMap: extBiome, baseColors: extBase };

    const n = cols * extRows;
    const pos = new Float32Array(n * 4);   // x, y, elev, waterFlag
    const nrm = new Float32Array(n * 3);
    // Sea cells (biome index 0 / _waterBiome) get the animated water path in the shader.
    const waterIdx = (terrain._waterBiome && terrain.biomeIndexByKey)
      ? terrain.biomeIndexByKey[terrain._waterBiome.key] : -1;
    // Hillshade contrast: heights are 0..1; scale their gradient up so slopes read.
    const SLOPE = 6.5;
    for (let er = 0; er < extRows; er++) {
      for (let c = 0; c < cols; c++) {
        const i = er * cols + c, o = i * 4, o3 = i * 3;
        pos[o] = (c / Math.max(1, cols - 1)) * worldW;
        pos[o + 1] = worldYs[er];
        pos[o + 2] = extHeight[i];                           // elevation 0..1
        pos[o + 3] = (extBiome[i] === waterIdx) ? 1 : 0;     // water flag
        // central-difference normal from the EXTENDED heightmap (continuous across the skirt)
        const hl = extHeight[er * cols + Math.max(0, c - 1)], hr = extHeight[er * cols + Math.min(cols - 1, c + 1)];
        const hu = extHeight[Math.max(0, er - 1) * cols + c], hd = extHeight[Math.min(extRows - 1, er + 1) * cols + c];
        const nx = -(hr - hl) * SLOPE, ny = -(hd - hu) * SLOPE, nz = 1.0;
        const inv = 1 / Math.hypot(nx, ny, nz);
        nrm[o3] = nx * inv; nrm[o3 + 1] = ny * inv; nrm[o3 + 2] = nz * inv;
      }
    }
    // Indices: one quad per cell over the EXTENDED rows, FAR→NEAR (er ascending) for
    // painter's occlusion. (extRows-1)*(cols-1)*6 indices; Uint32 when the mesh is large.
    const quads = (cols - 1) * (extRows - 1);
    const idx = (n > 65535) ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
    this._idxType = (n > 65535) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    if (this._idxType === gl.UNSIGNED_INT && !gl.getExtension('OES_element_index_uint')) {
      // No 32-bit indices available — fall back so we never draw garbage.
      console.warn('[glterrain] mesh too large for 16-bit indices and no uint index ext; disabling');
      this.enabled = false; return false;
    }
    let k = 0;
    for (let er = 0; er < extRows - 1; er++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = er * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx[k++] = a; idx[k++] = d; idx[k++] = b;
        idx[k++] = b; idx[k++] = d; idx[k++] = e;
      }
    }

    const mk = (data, drawType) => { const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, drawType || gl.STATIC_DRAW); return buf; };
    const posB = mk(pos), nrmB = mk(nrm);
    const colCurB = gl.createBuffer(), colNextB = gl.createBuffer();
    const idxB = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxB);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    this._buffers = { pos: posB, nrm: nrmB, colCur: colCurB, colNext: colNextB, idx: idxB, count: k };
    this._dims = { cols, rows, worldW, worldH, key };
    this._colKeyCur = this._colKeyNext = null;   // force a colour upload next draw

    // Pre-warm the per-season vertex colours (clear the old land's cache first) so no
    // season change — winter especially — pays the ~80ms compute at runtime. Done here,
    // once per land build (part of the visible "preparing" work), not on the hot path.
    this._seasonColorCache = null;
    for (const _k of ['summer', 'autumn', 'winter', 'spring']) {
      try { this._seasonColors(terrain, _k); } catch (_) {}
    }
    return true;
  },

  // Per-vertex RGB (0..1) for a season, computed over the EXTENDED source (world rows +
  // freshly-sampled over-scan skirt) via the SAME _computeSeasonCellColors the 2D relief
  // uses — so distant snow/sea/forest colour exactly like the play area. CACHED per season
  // key: the colours are static per season (coldIndex/snow-line live in the shader), so
  // computing once removes the ~80ms-per-season-change hitch (a ~500k-cell loop).
  _seasonColors(terrain, seasonKey) {
    const cache = this._seasonColorCache || (this._seasonColorCache = {});
    if (cache[seasonKey]) return cache[seasonKey];
    const rgb = terrain._computeSeasonCellColors(seasonKey, this._extSrc);   // Uint8, cols*extRows*3
    const out = new Float32Array(rgb.length);
    for (let i = 0; i < rgb.length; i++) out[i] = rgb[i] / 255;
    cache[seasonKey] = out;
    return out;
  },

  _uploadColors(terrain, seasonManager) {
    const gl = GLBatch.gl;
    const curKey = seasonManager ? seasonManager.currentKey : 'summer';
    const nextKey = seasonManager ? (seasonManager.nextKey || curKey) : curKey;
    if (curKey !== this._colKeyCur) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.colCur);
      gl.bufferData(gl.ARRAY_BUFFER, this._seasonColors(terrain, curKey), gl.STATIC_DRAW);
      this._colKeyCur = curKey;
    }
    if (nextKey !== this._colKeyNext) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.colNext);
      gl.bufferData(gl.ARRAY_BUFFER, this._seasonColors(terrain, nextKey), gl.STATIC_DRAW);
      this._colKeyNext = nextKey;
    }
  },

  // ---- draw (called each frame in GL mode, after GLBatch.begin() clears) --------
  // clip rect (logical px) matches the 2D game-area clip so terrain never spills onto HUD.
  draw(game, clipX, clipY, clipW, clipH) {
    if (!this.available() || !this._buffers) return;
    const gl = GLBatch.gl, t = game.terrain, P = Projection;
    const ss = (typeof spriteSS === 'function') ? spriteSS() : 1;

    this._uploadColors(t, game.seasonManager);

    gl.useProgram(this._prog);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Scissor to the game area (backing px, GL origin bottom-left) — mirrors the 2D clip.
    gl.enable(gl.SCISSOR_TEST);
    const bx = Math.max(0, Math.round(clipX * ss)), bw = Math.round(clipW * ss);
    const bh = Math.round(clipH * ss);
    const byTop = Math.round(clipY * ss);
    gl.scissor(bx, GLBatch.H - (byTop + bh), bw, bh);

    // Eased glacial severity + snow line: game.coldIndex jumps at each year rollover, so
    // ease the RENDERED value toward it (~1s) — the grade and the creeping snow line stay
    // smooth through the year pan instead of popping. One source, shared with the sprites.
    const coldT = (typeof game.coldIndex === 'number') ? game.coldIndex : 0;
    this._coldEased = (this._coldEased == null) ? coldT : this._coldEased + (coldT - this._coldEased) * 0.04;
    const _sm = game.seasonManager;
    const snowT = (_sm && _sm.getSnowLineElevation) ? _sm.getSnowLineElevation() : 1.0;
    this._snowEased = (this._snowEased == null) ? snowT : this._snowEased + (snowT - this._snowEased) * 0.06;
    // Modulate the glacial grade by WINTERNESS: a glacial year is defined by its brutal
    // WINTER, but its summer is the rebuild "breathing room" and should stay largely green.
    // So the wan cold look is full-strength in a glacial winter and gentle in its summer —
    // natural, and it keeps the seasonal swing legible. (The snow line already folds in
    // winterness on its own.)
    const _winter = (_sm && _sm.getWinterness) ? _sm.getWinterness() : 0;
    const cold = this._coldEased * (0.32 + 0.68 * _winter);
    // Publish the graded cold to the sprite batch so plants/animals share the terrain's mood.
    if (typeof GLBatch !== 'undefined') GLBatch._cold = cold;

    // Sky fill: paint the game area with the haze colour first, so the gap ABOVE the far
    // ridge (where the tilted mesh doesn't reach the top) reads as atmospheric sky rather
    // than the transparent page behind. Cooled as the glacial deepens (a colder sky).
    const _hzB = (CONFIG.view3DHaze) || [206, 220, 230];
    const _hz = [_hzB[0] * (1 - 0.16 * cold), _hzB[1] * (1 - 0.06 * cold), Math.min(255, _hzB[2] * (1 + 0.05 * cold))];
    gl.clearColor(_hz[0] / 255, _hz[1] / 255, _hz[2] / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const L = this._loc;
    gl.uniform1f(L.uK, P.K);
    gl.uniform1f(L.uLIFT, P.LIFT);
    gl.uniform1f(L.uScrollX, t.scrollX || 0);
    gl.uniform1f(L.uScrollY, t.scrollY || 0);
    gl.uniform1f(L.uViewX, CONFIG.viewX);
    gl.uniform1f(L.uViewY, CONFIG.viewY);
    gl.uniform1f(L.uViewZoom, CONFIG.viewZoom);
    gl.uniform1f(L.uSS, ss);
    gl.uniform1f(L.uW, GLBatch.W);
    gl.uniform1f(L.uH, GLBatch.H);
    gl.uniform1f(L.uWorldH, t.worldH || t.mapHeight || 1);
    gl.uniform1f(L.uSeasonBlend, game.seasonManager ? (game.seasonManager.transitionProgress || 0) : 0);
    // Sun from the upper-left, fairly high.
    gl.uniform3f(L.uSun, -0.45, -0.62, 0.64);
    gl.uniform1f(L.uAmbient, 0.52);
    const frost = (game.seasonManager && game.seasonManager.getWinterness) ? game.seasonManager.getWinterness() : 0;
    gl.uniform1f(L.uFrost, frost);
    gl.uniform3f(L.uFrostCol, 216 / 255, 232 / 255, 245 / 255);
    gl.uniform3f(L.uHazeCol, _hz[0] / 255, _hz[1] / 255, _hz[2] / 255);   // match the cooled sky fill
    gl.uniform1f(L.uHazeAmt, 0.55);
    // Phase 6 water: scroll the ripples in real time (seconds); deep blue-green sea tint.
    gl.uniform1f(L.uTime, ((typeof millis === 'function') ? millis() : (Date.now())) * 0.001);
    gl.uniform3f(L.uWaterCol, 24 / 255, 64 / 255, 92 / 255);
    // Two-tone daylight — a warm sun key + a cool sky fill for the ambient.
    gl.uniform3f(L.uSunCol, 1.15, 1.06, 0.90);
    gl.uniform3f(L.uSkyCol, 0.74, 0.82, 0.98);
    // Glacial grade + creeping snow line (both eased above; snow line is the real
    // seasons value incl. the coldIndex drop, so the white matches where the sim snows).
    gl.uniform1f(L.uCold, cold);
    gl.uniform3f(L.uColdTint, 0.82, 0.90, 1.08);
    gl.uniform1f(L.uSnowLine, this._snowEased);
    gl.uniform3f(L.uSnowCol, 0.93, 0.96, 1.0);

    const b = this._buffers;
    const bindAttr = (buf, loc, size) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    bindAttr(b.pos, this._aWorld, 4);
    bindAttr(b.nrm, this._aNormal, 3);
    bindAttr(b.colCur, this._aColCur, 3);
    bindAttr(b.colNext, this._aColNext, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
    gl.drawElements(gl.TRIANGLES, b.count, this._idxType, 0);

    // Restore state for the sprite batch: its program + no scissor. (blend already matches.)
    gl.disable(gl.SCISSOR_TEST);
    gl.disableVertexAttribArray(this._aWorld);
    gl.disableVertexAttribArray(this._aNormal);
    gl.disableVertexAttribArray(this._aColCur);
    gl.disableVertexAttribArray(this._aColNext);
    if (GLBatch._prog) gl.useProgram(GLBatch._prog);
  }
};
