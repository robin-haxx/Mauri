// ============================================
// GL TERRAIN; height-field relief on the GPU  (opt-in: ?terrain=gl, needs ?render=gl)
// ============================================
// Renders the terrain as a lit, displaced height-field mesh in the same WebGL canvas as
// the sprite batch, replacing the CPU-baked relief buffer. Wins over the bake:
//   • real normal-based hillshading from the heightmap (sun + ambient + distance haze).
//   • continuous N–S scroll: the mesh re-projects from the world heightmap every frame,
//     so a year pan just moves the camera window (the old per-row bake had to crossfade).
//   • same plan-oblique projection as Projection.groundY, so terrain and cast line up.
// No depth buffer: the height-field is drawn far→near (painter's algorithm); sprites draw
// after, on top. Only runs when Terrain-GL and GLBatch are active and relief is on.

const GLTerrain = {
  requested: false,     // ?terrain=gl on the URL
  enabled: false,       // requested AND GLBatch has a live context
  _prog: null,
  _buffers: null,       // { pos, nrm, colCur, colNext, idx, count }
  _dims: null,          // { cols, rows, worldW, worldH, key }  (rebuild trigger)
  _colKeyCur: null, _colKeyNext: null,
  _loc: {},

  // ---- terrain-resolution cap (offscreen) ------------------------------------
  // A smooth shaded height-field gains far less from supersampling than pixel-art
  // sprites, so render it into an offscreen buffer capped at CONFIG.terrainMaxSS and
  // blit up with a linear filter. Only engages when the live SS exceeds the cap; any
  // GL failure falls back to a direct draw permanently.
  _fbo: null, _fboTex: null, _fboW: 0, _fboH: 0, _fboFailed: false,
  _blitProg: null, _blitBuf: null, _aBlitPos: 0, _uBlitTex: null,

  available() {
    return this.enabled && typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch.gl;
  },

  // ---- program -----------------------------------------------------------------
  _buildProgram(gl) {
    const vs =
      'attribute vec4 aWorld;attribute vec3 aNormal;attribute vec3 aColCur;attribute vec3 aColNext;' +
      'uniform float uK,uLIFT,uScrollX,uScrollY,uViewX,uViewY,uViewZoom,uSS,uW,uH,uSeasonBlend,uWorldH;' +
      'varying vec3 vN;varying vec3 vCol;varying float vHaze;varying float vWater;varying vec2 vWorld;varying vec2 vPaint;varying float vElev;varying float vDown;' +
      'void main(){' +
      '  float lx=aWorld.x-uScrollX; float ly=aWorld.y-uScrollY;' +
      '  float paintX=lx; float paintY=ly*uK - aWorld.z*uLIFT + uLIFT;' +   // Projection.groundY, relief on
      '  float sx=uSS*(uViewX+paintX*uViewZoom);' +
      '  float sy=uSS*(uViewY+paintY*uViewZoom);' +
      '  gl_Position=vec4(sx/uW*2.0-1.0, 1.0 - sy/uH*2.0, 0.0, 1.0);' +
      '  vN=aNormal; vCol=mix(aColCur,aColNext,uSeasonBlend);' +
      '  vHaze=clamp(1.0 - aWorld.y/uWorldH, 0.0, 1.0);' +               // far (small worldY) → 1
      '  vDown=clamp(0.5 - 0.5*gl_Position.y, 0.0, 1.0);' +             // SCREEN Y: 0 at top (far), 1 at bottom (near)
      '  vWater=aWorld.w; vWorld=aWorld.xy; vPaint=vec2(paintX,paintY); vElev=aWorld.z;' +
      '}';
    // Lighting: two-tone daylight; a warm sun key + a cool sky fill for the ambient.
    // Water (vWater=1) rides the same light with a ripple normal. Then, in order:
    //   • CLIMATE SNOW above uSnowLine, which drops with the glacial (flatter ground holds more).
    //   • aerial haze on the far ridge, • seasonal frost tint,
    //   • GLACIAL GRADE; desaturate + cool + darken by uCold (0..1 severity).
    const fs =
      'precision mediump float;' +
      'varying vec3 vN;varying vec3 vCol;varying float vHaze;varying float vWater;varying vec2 vWorld;varying vec2 vPaint;varying float vElev;varying float vDown;' +
      'uniform vec3 uSun;uniform float uAmbient;uniform float uFrost;uniform vec3 uFrostCol;' +
      'uniform vec3 uHazeCol;uniform float uHazeAmt;uniform float uTime;uniform vec3 uWaterCol;' +
      'uniform vec3 uSunCol;uniform vec3 uSkyCol;uniform float uCold;uniform vec3 uColdTint;' +
      'uniform float uSnowLine;uniform vec3 uSnowCol;' +
      'void main(){' +
      '  vec3 sun=normalize(uSun); vec3 N=normalize(vN); vec3 col;' +
      '  if(vWater>0.5){' +
      // Caustic water-turbulence effect (after David Hoskins / joltz0r). Sampled in the terrain
      // paint space (vPaint), so the ripple field lies in the same tilted plane as the terrain.
      '    float time=uTime*0.1+23.0;' +
      // Anisotropic: tight across the swell (paintX), stretched along the crest (paintY), so
      // ripples read as long wave lines. Rolled in +X over time so the swell washes shoreward.
      '    vec2 uvw=vPaint*vec2(0.0090,0.0026);' +
      '    uvw.x+=uTime*0.030;' +
      '    vec2 p=mod(uvw*6.28318530718,6.28318530718)-250.0;' +
      '    vec2 iq=p; float c=1.0; float inten=0.005;' +
      // PERF: this loop runs per water fragment every frame; the most expensive thing on the
      // terrain. Each step trades against water fill cost; 2 keeps the long-wave character
      // (the output is banded to 4 levels below, so a 3rd step is barely visible).
      '    const int WATER_STEPS=2;' +
      '    for(int n=0;n<WATER_STEPS;n++){' +
      '      float t=time*(1.0-(3.5/float(n+1)));' +
      '      iq=p+vec2(cos(t-iq.x)+sin(t+iq.y), sin(t-iq.y)+cos(t+iq.x));' +
      '      c+=1.0/length(vec2(p.x/(sin(iq.x+t)/inten), p.y/(cos(iq.y+t)/inten)));' +
      '    }' +
      '    c/=float(WATER_STEPS); c=1.17-pow(c,1.4);' +
      '    float c2=c*c; float h=c2*c2*c2*c2;' +   // c^8 without an exp/log pow

      // Posterize the highlight into a few bands so the foam reads stepped.
      '    h=floor(h*16.0+0.5)/16.0;' +
      '    vec3 caustic=clamp(vec3(h)+vec3(0.0,0.42,0.5),0.0,1.0);' +
      // Deep cells stay darker & bluer (toward uWaterCol); shallows lift to the bright ripples.
      '    float depth=clamp(vElev*6.0,0.0,1.0);' +
      '    caustic=mix(mix(uWaterCol,caustic,0.55), caustic, depth);' +
      // Ride the scene light so the sea dims at dusk/night with the rest of the land.
      '    vec3 sceneLit=uSkyCol*uAmbient+uSunCol*(1.0-uAmbient);' +
      '    col=caustic*mix(vec3(1.0),sceneLit,0.6);' +
      '  } else {' +
      // Foreground contrast: drop the ambient fill toward the camera (vDown→1), so near slopes
      // fall to a deeper shadow and the sun reads with real relief up close.
      '    float amb=uAmbient*(1.0 - 0.34*vDown);' +
      '    float d=max(0.0,dot(N,sun));' +
      '    col=vCol*(uSkyCol*amb + uSunCol*(1.0-amb)*d);' +
      '    float flatness=clamp(N.z,0.0,1.0);' +
      '    float snow=smoothstep(uSnowLine, uSnowLine+0.14, vElev)*(0.35+0.65*flatness);' +
      '    vec3 snowLit=uSnowCol*(uSkyCol*amb + uSunCol*(1.0-amb)*d);' +
      '    col=mix(col, snowLit, snow);' +
      '  }' +
      // Screen-space light gradient: dim the up-screen distance, lift the down-screen foreground.
      '  col*=mix(0.90, 1.12, vDown);' +
      '  col=mix(col,uHazeCol, uHazeAmt*vHaze*vHaze);' +                  // atmospheric depth on the far ridge
      '  col=mix(col,uFrostCol, uFrost*0.30);' +                          // winter frost tint (was a 2D overlay)
      '  float g=dot(col, vec3(0.299,0.587,0.114));' +                    // luminance for the glacial desaturate
      '  col=mix(col, vec3(g), uCold*0.50*(1.0 - 0.5*vDown));' +          // ease the grey wash near the camera (keep foreground colour)
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

    // FAR/NEAR over-scan skirt; real receding terrain past the world's edges, so the tilted
    // plane fills the frame. Sample fresh terrain for a band of rows above (worldY<0) and
    // below (worldY>worldH) the world, sized off the visible window depth.
    const _cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const overFar = Math.max(0, _cfg.view3DOverscan != null ? _cfg.view3DOverscan : 0.45);
    const overNear = Math.max(0, _cfg.view3DOverscanNear != null ? _cfg.view3DOverscanNear : 0.28);
    const winWorldH = (terrain.hasWorldGrid && terrain.worldGridRows) ? worldH / terrain.worldGridRows : worldH;
    const marginFar = overFar * winWorldH, marginNear = overNear * winWorldH;
    const dyMesh = worldH / Math.max(1, rows - 1);        // world units between world mesh rows
    // Skirt rows at the world's row pitch, coarsened by SKIRT_STEP (invisible in the hazed
    // distance, keeps the added mesh modest). Full column width, so no side seam.
    const SKIRT_STEP = 2;
    const farRows  = marginFar  > 0 ? Math.max(1, Math.round(marginFar  / (dyMesh * SKIRT_STEP))) : 0;
    const nearRows = marginNear > 0 ? Math.max(1, Math.round(marginNear / (dyMesh * SKIRT_STEP))) : 0;
    const extRows = farRows + rows + nearRows;
    this._meshRows = rows; this._extRows = extRows; this._farRows = farRows; this._nearRows = nearRows;

    // Build an extended source (world rows verbatim + sampled skirt rows). Per-season vertex
    // colours come from terrain._computeSeasonCellColors, the same logic the 2D relief uses.
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
    // 32-bit indices are core in WebGL2; only WebGL1 needs OES_element_index_uint.
    const uintOK = (typeof GLBatch !== 'undefined' && GLBatch._gl2) || gl.getExtension('OES_element_index_uint');
    if (this._idxType === gl.UNSIGNED_INT && !uintOK) {
      // No 32-bit indices available; fall back so we never draw garbage.
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
    const idxB = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxB);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    // Free the previous land's GL buffers (runs only on an actual rebuild) so the per-season
    // colour buffers don't leak a full set each year.
    if (this._buffers) { const ob = this._buffers;
      [ob.pos, ob.nrm, ob.idx].forEach(x => x && gl.deleteBuffer(x));
      if (ob.colByKey) for (const kk in ob.colByKey) gl.deleteBuffer(ob.colByKey[kk]);
    }

    this._buffers = { pos: posB, nrm: nrmB, idx: idxB, count: k, colByKey: {} };
    this._dims = { cols, rows, worldW, worldH, key };

    // Per-season vertex colours: compute each season once and upload it to its own static GPU
    // buffer, so a season change is just a buffer bind in draw() (no re-upload). The JS colour
    // cache is released once uploaded.
    this._seasonColorCache = null;
    for (const _k of ['summer', 'autumn', 'winter', 'spring']) {
      try {
        const c3 = this._seasonColors(terrain, _k);
        const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb);
        gl.bufferData(gl.ARRAY_BUFFER, c3, gl.STATIC_DRAW);
        this._buffers.colByKey[_k] = cb;
      } catch (_) {}
    }
    this._seasonColorCache = null;   // GPU holds the colours now; free the JS Float32 copies
    return true;
  },

  // Per-vertex RGB (0..1) for a season, over the extended source via the same
  // _computeSeasonCellColors the 2D relief uses. Cached per season key (colours are static
  // per season), removing an ~80ms-per-season-change hitch.
  _seasonColors(terrain, seasonKey) {
    const cache = this._seasonColorCache || (this._seasonColorCache = {});
    if (cache[seasonKey]) return cache[seasonKey];
    const rgb = terrain._computeSeasonCellColors(seasonKey, this._extSrc);   // Uint8, cols*extRows*3
    const out = new Float32Array(rgb.length);
    for (let i = 0; i < rgb.length; i++) out[i] = rgb[i] / 255;
    cache[seasonKey] = out;
    return out;
  },

  // ---- draw (called each frame in GL mode, after GLBatch.begin() clears) --------
  // clip rect (logical px) matches the 2D game-area clip. When the resolution cap engages,
  // the mesh renders into a smaller offscreen buffer and blits up; else it draws direct.
  draw(game, clipX, clipY, clipW, clipH) {
    if (!this.available() || !this._buffers) return;
    const gl = GLBatch.gl;
    const ss = (typeof spriteSS === 'function') ? spriteSS() : 1;
    const cap = (typeof CONFIG !== 'undefined' && CONFIG.terrainMaxSS != null) ? CONFIG.terrainMaxSS : ss;
    const terrainSS = Math.min(ss, cap);
    const useFBO = !this._fboFailed && terrainSS < ss - 1e-3 && this._prepareFBO(gl, terrainSS);

    if (useFBO) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
      gl.viewport(0, 0, this._fboW, this._fboH);
      this._renderMesh(gl, game, clipX, clipY, clipW, clipH, terrainSS, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, GLBatch.W, GLBatch.H);
      this._blit(gl, clipX, clipY, clipW, clipH, ss);
    } else {
      gl.viewport(0, 0, GLBatch.W, GLBatch.H);
      this._renderMesh(gl, game, clipX, clipY, clipW, clipH, ss, false);
    }

    // Restore the sprite batch's program so its quads draw next.
    if (GLBatch._prog) gl.useProgram(GLBatch._prog);
  },

  // Render sky + the lit height-field mesh into the current framebuffer. targetSS scales
  // only the scissor rect (the vertex projection is resolution-independent). isFBO clears
  // the whole target to sky first so the blit's linear edge samples sky.
  _renderMesh(gl, game, clipX, clipY, clipW, clipH, targetSS, isFBO) {
    const t = game.terrain, P = Projection;
    const ss = (typeof spriteSS === 'function') ? spriteSS() : 1;

    gl.useProgram(this._prog);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Scissor to the game area, in the current target's pixels, GL origin bottom-left.
    const targetH = isFBO ? this._fboH : GLBatch.H;
    const bx = Math.max(0, Math.round(clipX * targetSS)), bw = Math.round(clipW * targetSS);
    const bh = Math.round(clipH * targetSS);
    const byTop = Math.round(clipY * targetSS);

    // Eased glacial severity + snow line: game.coldIndex jumps at year rollover, so ease the
    // rendered value toward it so the grade and snow line stay smooth.
    const coldT = (typeof game.coldIndex === 'number') ? game.coldIndex : 0;
    this._coldEased = (this._coldEased == null) ? coldT : this._coldEased + (coldT - this._coldEased) * 0.04;
    const _sm = game.seasonManager;
    const snowT = (_sm && _sm.getSnowLineElevation) ? _sm.getSnowLineElevation() : 1.0;
    this._snowEased = (this._snowEased == null) ? snowT : this._snowEased + (snowT - this._snowEased) * 0.06;
    // Modulate the glacial grade by winterness: full-strength in a glacial winter, gentle in
    // its summer, so the seasonal swing stays legible.
    const _winter = (_sm && _sm.getWinterness) ? _sm.getWinterness() : 0;
    const cold = this._coldEased * (0.32 + 0.68 * _winter);
    // Publish the graded cold to the sprite batch so plants/animals share the terrain's mood.
    if (typeof GLBatch !== 'undefined') GLBatch._cold = cold;

    // Sky fill: paint the game area with the haze colour first, so the gap above the far ridge
    // reads as sky. Cooled as the glacial deepens.
    const _hzB = (CONFIG.view3DHaze) || [206, 220, 230];
    const _hz = [_hzB[0] * (1 - 0.16 * cold), _hzB[1] * (1 - 0.06 * cold), Math.min(255, _hzB[2] * (1 + 0.05 * cold))];
    gl.clearColor(_hz[0] / 255, _hz[1] / 255, _hz[2] / 255, 1);
    // Offscreen: clear the whole buffer to sky (so an upscaled edge samples sky), then scissor
    // the mesh. Direct: clear only the game area (scissored).
    if (isFBO) { gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(bx, targetH - (byTop + bh), bw, bh);
    if (!isFBO) gl.clear(gl.COLOR_BUFFER_BIT);

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
    // Sun from the upper-left on a grazing angle so slope faces separate into lit/shadow.
    gl.uniform3f(L.uSun, -0.48, -0.62, 0.54);
    gl.uniform1f(L.uAmbient, 0.52);
    const frost = (game.seasonManager && game.seasonManager.getWinterness) ? game.seasonManager.getWinterness() : 0;
    gl.uniform1f(L.uFrost, frost);
    gl.uniform3f(L.uFrostCol, 216 / 255, 232 / 255, 245 / 255);
    gl.uniform3f(L.uHazeCol, _hz[0] / 255, _hz[1] / 255, _hz[2] / 255);   // match the cooled sky fill
    gl.uniform1f(L.uHazeAmt, 0.55);
    // Water: scroll the ripples in real time; deep blue-green sea tint.
    gl.uniform1f(L.uTime, ((typeof millis === 'function') ? millis() : (Date.now())) * 0.001);
    gl.uniform3f(L.uWaterCol, 24 / 255, 64 / 255, 92 / 255);
    // Two-tone daylight; a warm sun key + a cool sky fill for the ambient.
    gl.uniform3f(L.uSunCol, 1.15, 1.06, 0.90);
    gl.uniform3f(L.uSkyCol, 0.74, 0.82, 0.98);
    // Glacial grade + creeping snow line (both eased above; snow line matches where the sim snows).
    gl.uniform1f(L.uCold, cold);
    gl.uniform3f(L.uColdTint, 0.82, 0.90, 1.08);
    gl.uniform1f(L.uSnowLine, this._snowEased);
    gl.uniform3f(L.uSnowCol, 0.93, 0.96, 1.0);

    const b = this._buffers;
    const bindAttr = (buf, loc, size) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    bindAttr(b.pos, this._aWorld, 4);
    bindAttr(b.nrm, this._aNormal, 3);
    // Seasonal colour = bind the persistent per-season buffers for the current/next pair;
    // uSeasonBlend crossfades them. No per-season upload (see build()).
    const _sm2 = game.seasonManager;
    const curKey = _sm2 ? _sm2.currentKey : 'summer';
    const nextKey = _sm2 ? (_sm2.nextKey || curKey) : curKey;
    const ck = b.colByKey || {};
    bindAttr(ck[curKey] || ck.summer, this._aColCur, 3);
    bindAttr(ck[nextKey] || ck[curKey] || ck.summer, this._aColNext, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
    gl.drawElements(gl.TRIANGLES, b.count, this._idxType, 0);

    // Leave scissor off + mesh attribs disabled so the sprite batch draws clean.
    gl.disable(gl.SCISSOR_TEST);
    gl.disableVertexAttribArray(this._aWorld);
    gl.disableVertexAttribArray(this._aNormal);
    gl.disableVertexAttribArray(this._aColCur);
    gl.disableVertexAttribArray(this._aColNext);
  },

  // ---- offscreen terrain buffer (resolution cap) -----------------------------
  // Ensure a colour-only framebuffer sized to the canvas × terrainSS exists. Returns false
  // (latching _fboFailed) on any GL failure so draw() falls back to a direct render.
  _prepareFBO(gl, terrainSS) {
    const w = Math.max(1, Math.round(CONFIG.canvasWidth * terrainSS));
    const h = Math.max(1, Math.round(CONFIG.canvasHeight * terrainSS));
    if (!this._blitProg && !this._buildBlitProgram(gl)) { this._fboFailed = true; return false; }
    if (this._fbo && this._fboW === w && this._fboH === h) return true;
    try {
      if (this._fboTex) gl.deleteTexture(this._fboTex);
      if (this._fbo) gl.deleteFramebuffer(this._fbo);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);   // soft upscale
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); this._fboFailed = true;
        console.warn('[glterrain] offscreen FBO incomplete; terrain cap disabled'); return false; }
      this._fbo = fbo; this._fboTex = tex; this._fboW = w; this._fboH = h;
      return true;
    } catch (e) {
      this._fboFailed = true;
      console.warn('[glterrain] FBO setup failed; terrain cap disabled:', e && e.message);
      return false;
    }
  },

  // Full-screen textured-quad program that copies the offscreen terrain onto the GL canvas.
  // UV is derived from clip position, so the only attribute is a 2D clip-space position.
  _buildBlitProgram(gl) {
    try {
      const vs = 'attribute vec2 aPos;varying vec2 vUV;' +
        'void main(){vUV=(aPos+1.0)*0.5;gl_Position=vec4(aPos,0.0,1.0);}';
      const fs = 'precision mediump float;varying vec2 vUV;uniform sampler2D uTex;' +
        'void main(){gl_FragColor=texture2D(uTex,vUV);}';
      const co = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, co(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, co(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this._blitProg = p; this._aBlitPos = 0;
      this._uBlitTex = gl.getUniformLocation(p, 'uTex');
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
      this._blitBuf = buf;
      return true;
    } catch (e) {
      console.warn('[glterrain] blit program build failed:', e && e.message);
      return false;
    }
  },

  // Copy the offscreen terrain onto the GL canvas, scissored to the game area (canvas px),
  // as an opaque blit (blend off); the offscreen game area is fully painted (sky + mesh).
  _blit(gl, clipX, clipY, clipW, clipH, ss) {
    gl.useProgram(this._blitProg);
    gl.enable(gl.SCISSOR_TEST);
    const bx = Math.max(0, Math.round(clipX * ss)), bw = Math.round(clipW * ss);
    const bh = Math.round(clipH * ss), byTop = Math.round(clipY * ss);
    gl.scissor(bx, GLBatch.H - (byTop + bh), bw, bh);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._blitBuf);
    gl.enableVertexAttribArray(this._aBlitPos);
    gl.vertexAttribPointer(this._aBlitPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._fboTex);
    gl.uniform1i(this._uBlitTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(this._aBlitPos);
    gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);   // sprite batch expects blend on
  }
};
