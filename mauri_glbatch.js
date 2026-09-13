// ============================================
// GL BATCH — DOM-stacked WebGL entity layer  (opt-in: ?render=gl)
// ============================================
// The world is drawn on p5's 2D canvas. At 4K (spriteSupersample 2) the frame is
// fill-rate bound and every sprite is a separate Canvas2D drawImage with real
// per-call overhead — the ~20fps cap the perf review found. This module draws the
// ENTITY SPRITES (and their shadow/halo ellipses) as batched textured quads on a
// WebGL canvas that is STACKED in the DOM between two 2D canvases, so the browser's
// compositor blends the three layers on the GPU with no per-frame readback:
//
//   bottom  (p5 _terrainLayer canvas) : terrain + water + seasonal washes
//   middle  (this GL canvas)          : entity sprites + shadows/halos
//   top     (p5 main canvas)          : hearts/rings indicators + GEO + HUD
//
// An earlier build composited the GL canvas into the 2D frame with drawImage; that
// worked and was pixel-correct but the GL→2D blit forced a context sync each frame
// that gave the batch win back (measured ≈break-even). DOM-stacking removes the
// drawImage entirely — the compositor does the blend — which is what captures the
// batch's speed. See md / the perf memory.
//
// OPT-IN and reversible: without ?render=gl (or if GL init fails) none of this runs
// and the engine renders the unchanged single-canvas 2D atlas path.
//
// How entity code stays untouched:
//   • The atlas already wrapped global image() (mauri_spriteatlas.js); in GL mode
//     that wrapper calls tryCapture() first — reading the live 2D transform, image
//     mode, tint and alpha — so a sprite draw becomes a quad with no code change.
//   • ellipse()/circle() are wrapped here so the per-entity shadow and species-halo
//     draws in render() are captured to the GL layer too (a baked soft-disc texture,
//     tinted by the live fill), keeping them correctly UNDER the sprites.
//   • The capture span is open only across the sprite passes; Simulation.render()
//     ends it (GLBatch.composite → endSpan) before the indicator over-pass, so
//     hearts/rings and the HUD draw on the top 2D canvas, above everything.

const GLBatch = {
  enabled: false,        // ?render=gl asked for it AND init succeeded
  requested: false,      // ?render=gl was on the URL
  domStack: false,       // layered-canvas mode active
  _open: false,          // a capture span is active (image()/ellipse() should batch)
  _mounted: false,
  gl: null,
  canvas: null,          // the GL (middle) canvas
  W: 0, H: 0,

  // ---- edge fade --------------------------------------------------------------
  // Sprites (and their shadow/halo discs) fade toward transparent as they approach
  // the canvas edge, so the cast dissolves off-screen instead of hard-clipping at
  // the frame. Computed PER VERTEX from the vertex's distance to the nearest edge,
  // so a large sprite straddling the edge gradates smoothly across its own quad.
  // marginFrac is the share of the SHORTER canvas dimension the fade spans (so the
  // band is the same pixel width top/bottom as left/right). Console-tunable.
  edgeFade: { on: true, marginFrac: 0.08 },
  _edgeMarginPx: 0,      // marginFrac × min(W,H), recomputed each begin()

  // GL objects
  _prog: null, _aPos: 0, _aUV: 1, _aCol: 2, _aSil: 3, _uSampler: null,
  _vbo: null,
  _tex: new Map(),       // source HTMLCanvasElement -> { tex, w, h }
  _discTex: null,        // baked soft-disc texture for captured ellipses (shadows/halos)

  // Silhouette mode (GL_PORT.md Phase 3): while true, captured sprite quads output
  // the per-quad COLOUR wherever the texture is opaque (ignoring texel rgb) — a
  // pure-colour cut-out of the sprite shape. Used to draw the field-guide outline
  // as a ring of tinted silhouette quads with no baked halo. Off = normal texturing.
  _silhouette: false,

  // Batch buffer: interleaved [x, y, u, v, r, g, b, a, sil] per vertex, 6 verts / quad.
  // sil is 1 for a silhouette (pure-colour) quad, 0 for a normal textured one.
  FLOATS_PER_VERT: 9,
  _cap: 0, _verts: null, _n: 0,
  _curTex: null,

  // ---- URL flag + init --------------------------------------------------------
  // During the Mauri GL port (GL_PORT.md) GL is OPT-IN: enable it with ?render=gl
  // (or =webgl / =on). Anything else — including no flag — stays on the proven 2D
  // path. Flip this default to on only once Phase 4 validation passes. If the
  // context can't be created init() returns false and 2D is used regardless.
  applyURLFlag() {
    if (typeof window === 'undefined' || !window.location) { this.requested = false; return; }
    const q = new URLSearchParams(window.location.search).get('render');
    this.requested = (q === 'gl' || q === 'webgl' || q === 'on');
  },

  // Drop to the 2D path for the rest of the session. Used by the WebGL
  // context-lost handler: an unattended kiosk must degrade, not go black. The 2D
  // render() paints an opaque background over the now-stale GL/terrain DOM layers,
  // so nothing more is needed than flipping these flags.
  _fallbackTo2D(reason) {
    if (!this.enabled && !this.domStack) return;
    this.enabled = false; this.domStack = false; this._open = false;
    console.warn('[glbatch] falling back to 2D renderer:', reason);
  },

  init(width, height) {
    if (!this.requested) return false;
    try {
      const cnv = (typeof document !== 'undefined' && document.createElement)
        ? document.createElement('canvas') : null;
      if (!cnv) return false;
      cnv.width = width; cnv.height = height;
      const opts = { premultipliedAlpha: false, antialias: false, alpha: true, depth: false };
      const gl = cnv.getContext('webgl', opts) || cnv.getContext('experimental-webgl', opts);
      if (!gl) { console.warn('[glbatch] no WebGL context; staying on 2D'); return false; }

      this.canvas = cnv; this.gl = gl; this.W = width; this.H = height;
      this._buildProgram();
      this._buildDiscTexture();
      this._cap = 8192 * 6;
      this._verts = new Float32Array(this._cap * this.FLOATS_PER_VERT);
      this._vbo = gl.createBuffer();

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

      // Unattended-kiosk safety: if the GPU drops the context, degrade to 2D for the
      // rest of the session rather than going black (the nightly reload recovers it).
      if (cnv.addEventListener) {
        cnv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this._fallbackTo2D('context lost'); }, false);
      }

      this.enabled = true;
      this.domStack = true;
      this._wrapShapes();
      console.log(`[glbatch] DOM-stacked WebGL entity layer active (${width}x${height})`);
      return true;
    } catch (e) {
      console.warn('[glbatch] init failed, staying on 2D:', e && e.message);
      this.enabled = false; this.gl = null; this.canvas = null;
      return false;
    }
  },

  // Stack the three canvases: bottom (terrain), middle (this GL canvas), top (main).
  // Called once the p5 main canvas and the terrain buffer exist. Positions are set
  // to match the p5 main canvas each layout (see layout()).
  mount(mainEl, bottomEl) {
    if (!this.enabled || !mainEl) return;
    this._mainEl = mainEl; this._bottomEl = bottomEl || this._bottomEl;
    const gc = this.canvas;
    for (const el of [this._bottomEl, gc, mainEl]) {
      if (!el) continue;
      el.style.position = 'absolute';
      el.style.margin = '0';
    }
    // z-order: bottom terrain < GL sprites < main (indicators + HUD)
    if (this._bottomEl) this._bottomEl.style.zIndex = '0';
    gc.style.zIndex = '1';
    mainEl.style.zIndex = '2';
    // Insert the GL canvas into the DOM next to the main canvas.
    if (gc.parentNode == null && mainEl.parentNode) mainEl.parentNode.insertBefore(gc, mainEl);
    this._mounted = true;
    this.layout();
  },

  // Point the bottom layer at the terrain buffer's canvas. The buffer is a detached
  // p5.Graphics, so its canvas is inserted into the DOM ahead of the GL canvas; when
  // the buffer is rebuilt on resize this is called with the new canvas and the old
  // one is removed. A no-op when the canvas is unchanged (called every frame).
  setBottom(bottomEl) {
    if (!this.enabled || !bottomEl) return;
    if (bottomEl === this._bottomEl) {
      // Same terrain buffer as last frame. The GPU-terrain (3D) path HIDES this bottom
      // layer (display:none) while it draws the mesh into the GL canvas instead; toggling
      // back to the flat 2D view calls setBottom again with the SAME canvas, so we must
      // re-show it here or the flat terrain stays invisible (the "3D↔2D breaks 2D" bug).
      if (bottomEl.style && bottomEl.style.display === 'none') bottomEl.style.display = 'block';
      return;
    }
    const prev = this._bottomEl;
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    this._bottomEl = bottomEl;
    bottomEl.style.position = 'absolute';
    bottomEl.style.margin = '0';
    bottomEl.style.display = 'block';
    bottomEl.style.zIndex = '0';
    const glc = this.canvas;
    if (glc && glc.parentNode) glc.parentNode.insertBefore(bottomEl, glc);
    this.layout();
  },

  // Copy the main canvas's on-screen CSS box onto the other two layers so they
  // register pixel-for-pixel. Called from scaleCanvasToFit / on resize.
  layout() {
    if (!this._mounted || !this._mainEl) return;
    const s = this._mainEl.style;
    for (const el of [this._bottomEl, this.canvas]) {
      if (!el) continue;
      el.style.left = s.left; el.style.top = s.top;
      el.style.width = s.width; el.style.height = s.height;
    }
  },

  resize(width, height) {
    if (!this.enabled || !this.canvas) return;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
      this.W = width; this.H = height;
      this.gl.viewport(0, 0, width, height);
    }
    this.layout();
  },

  _buildProgram() {
    const gl = this.gl;
    const vs = 'attribute vec2 aPos;attribute vec2 aUV;attribute vec4 aCol;attribute float aSil;' +
      'varying vec2 vUV;varying vec4 vCol;varying float vSil;' +
      'void main(){vUV=aUV;vCol=aCol;vSil=aSil;gl_Position=vec4(aPos,0.0,1.0);}';
    // Normal: texel.rgb × colour. Silhouette (vSil=1): the colour alone wherever the
    // texel is opaque — a pure-colour cut-out of the sprite (the highlight outline).
    // Silhouette alpha is HARDENED (smoothstep) so soft, anti-aliased sprite edges —
    // e.g. the birds' feathered art — still cut a SOLID outline instead of a faint,
    // washed-out one. Crisp pixel-art (moa) is already ~1.0, so it's unaffected. This
    // is the "non-moa highlight is weak" fix (GL path).
    // uCold (0..1) applies the SAME glacial grade the terrain uses — desaturate + cool +
    // slightly darken — so plants/animals share the cold mood as the ice deepens. It's
    // skipped for silhouette highlights (vSil=1) so a field-guide/selection outline keeps
    // its pure colour, and it is 0 unless the GPU terrain publishes it (GLBatch._cold).
    const fs = 'precision mediump float;varying vec2 vUV;varying vec4 vCol;varying float vSil;' +
      'uniform sampler2D uTex;uniform float uCold;uniform vec3 uColdTint;' +
      'void main(){vec4 t=texture2D(uTex,vUV);' +
      'float a=mix(t.a, smoothstep(0.06,0.30,t.a), vSil)*vCol.a;' +
      'vec3 rgb=mix(t.rgb*vCol.rgb,vCol.rgb,vSil);' +
      'float grd=uCold*(1.0-vSil);' +
      'float g=dot(rgb, vec3(0.299,0.587,0.114));' +
      'rgb=mix(rgb, vec3(g), grd*0.5);' +
      'rgb*=mix(vec3(1.0), uColdTint, grd);' +
      'rgb*=(1.0 - grd*0.10);' +
      'gl_FragColor=vec4(rgb,a);}';
    const co = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, co(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, co(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aUV');
    gl.bindAttribLocation(p, 2, 'aCol'); gl.bindAttribLocation(p, 3, 'aSil');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this._prog = p; this._uSampler = gl.getUniformLocation(p, 'uTex');
    this._uCold = gl.getUniformLocation(p, 'uCold');
    this._uColdTint = gl.getUniformLocation(p, 'uColdTint');
  },

  // A white filled disc with a 1px-soft edge — the stand-in for a p5 ellipse().
  // Tinted per-quad by the captured fill, it reproduces the soft shadow / halo look.
  _buildDiscTexture() {
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    x.clearRect(0, 0, S, S);
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); x.fill();
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    this._discTex = { tex, w: S, h: S };
  },

  _textureFor(src) {
    if (!src) return null;
    let e = this._tex.get(src);
    if (e) return e;
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
    catch (err) { console.warn('[glbatch] texImage2D failed:', err && err.message); return null; }
    e = { tex, w: src.width, h: src.height };
    this._tex.set(src, e);
    return e;
  },

  _canvasOf(o) {
    if (!o) return null;
    if (o.canvas) return o.canvas;
    if (o.drawingContext && o.drawingContext.canvas) return o.drawingContext.canvas;
    if (o.elt && o.elt.getContext) return o.elt;
    return null;
  },

  // ---- capture span -----------------------------------------------------------
  begin() {
    if (!this.enabled) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this._prog);
    this._n = 0; this._curTex = null;
    this._open = true;
    // Recompute the edge-fade band each frame so a live tweak to edgeFade takes hold.
    this._edgeMarginPx = (this.edgeFade && this.edgeFade.on)
      ? this.edgeFade.marginFrac * Math.min(this.W, this.H) : 0;
  },

  // Renderer state, read live each capture (push/pop restore _imageMode/_tint
  // internally, so a wrapper would go stale — read from the renderer instead).
  _renderer: null,
  _R() { return this._renderer || (this._renderer =
    (typeof window !== 'undefined' && window._renderer) ? window._renderer : null); },
  _ctx() { const R = this._R(); return (R && R.drawingContext) ? R.drawingContext
    : (typeof drawingContext !== 'undefined' ? drawingContext : null); },
  _ctm(ctx) { const m = (ctx && ctx.getTransform) ? ctx.getTransform() : null;
    return m ? m : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },

  // Capture one image() call. Returns true if consumed.
  tryCapture(img, a, b, c, d) {
    if (!this.enabled || !this._open || !img) return false;
    let src, sx, sy, sw, sh, iw, ih;
    if (img.__atlas) {
      src = this._canvasOf(img.__page);
      sx = img.sx; sy = img.sy; sw = img.sw; sh = img.sh; iw = img.width; ih = img.height;
    } else {
      src = this._canvasOf(img);
      if (!src) return false;
      sx = 0; sy = 0; sw = src.width; sh = src.height; iw = img.width || src.width; ih = img.height || src.height;
    }
    const te = this._textureFor(src);
    if (!te) return false;

    const R = this._R(), ctx = this._ctx(), im = R ? R._imageMode : undefined;
    const CEN = (typeof CENTER !== 'undefined') ? CENTER : 'center';
    const CRS = (typeof CORNERS !== 'undefined') ? CORNERS : 'corners';
    const dw = (c === undefined) ? iw : c, dh = (d === undefined) ? ih : d;
    let lx0, ly0, lx1, ly1;
    if (im === CRS) { lx0 = a; ly0 = b; lx1 = c; ly1 = d; }
    else if (im === CEN) { lx0 = a - dw * 0.5; ly0 = b - dh * 0.5; lx1 = lx0 + dw; ly1 = ly0 + dh; }
    else { lx0 = a; ly0 = b; lx1 = a + dw; ly1 = b + dh; }

    const tn = R ? R._tint : null;
    const r = tn ? tn[0] / 255 : 1, g = tn ? tn[1] / 255 : 1, bl = tn ? tn[2] / 255 : 1;
    const ta = (tn && tn.length > 3) ? tn[3] / 255 : 1;
    const alpha = (ctx ? ctx.globalAlpha : 1) * ta;

    const u0 = sx / te.w, v0 = sy / te.h, u1 = (sx + sw) / te.w, v1 = (sy + sh) / te.h;
    this._emit(te, this._ctm(ctx), lx0, ly0, lx1, ly1, u0, v0, u1, v1, r, g, bl, alpha,
      this._silhouette ? 1 : 0);
    return true;
  },

  // Capture one ellipse()/circle() as a tinted disc quad. (x,y) is the centre in
  // the default ellipseMode(CENTER); w,h the diameters. Returns true if consumed.
  tryCaptureEllipse(x, y, w, h) {
    if (!this.enabled || !this._open || !this._discTex) return false;
    // Only FILLED ellipses are discs (shadows, halos, icon dots). A no-fill stroke
    // (an effect-radius ring / border) would otherwise be stamped as a solid disc
    // tinted by the STALE last fill — a filled blob where a ring belongs. Let those
    // fall through to the 2D path (they land on the top canvas in GL mode, where
    // their stroke + shadow-blur glow render correctly).
    const R = this._R();
    if (R && R._doFill === false) return false;
    const ctx = this._ctx();
    const col = this._parseFill(ctx ? ctx.fillStyle : null);
    const ga = ctx ? ctx.globalAlpha : 1;
    const lx0 = x - w * 0.5, ly0 = y - h * 0.5, lx1 = x + w * 0.5, ly1 = y + h * 0.5;
    this._emit(this._discTex, this._ctm(ctx), lx0, ly0, lx1, ly1, 0, 0, 1, 1,
      col.r, col.g, col.b, col.a * ga, 0);
    return true;
  },

  // Edge fade: 1 in the interior, smoothstep down to 0 at the very edge across the
  // outer _edgeMarginPx px. Nearest of the four screen edges wins. A method (not a
  // per-_emit closure) so the hot capture path allocates nothing — see _emit.
  _edgeAlpha(sx, sy, a) {
    const mp = this._edgeMarginPx;
    if (mp <= 0) return a;
    const W = this.W, H = this.H;
    let d = sx; const rr = W - sx; if (rr < d) d = rr;
    if (sy < d) d = sy; const bb = H - sy; if (bb < d) d = bb;
    if (d >= mp) return a;
    if (d <= 0) return 0;
    const t = d / mp;
    return a * t * t * (3 - 2 * t);
  },

  // Map a local rect through the CTM to clip space and push two triangles.
  // sil: 1 = silhouette (pure-colour) quad, 0 = normal textured quad.
  // Fully inlined (no per-call closures): this runs once per sprite AND once per shadow
  // disc — hundreds of times a frame — so any allocation here becomes GC-pause churn.
  _emit(te, m, lx0, ly0, lx1, ly1, u0, v0, u1, v1, r, g, b, a, sil) {
    if (te.tex !== this._curTex) { this._flush(); this._curTex = te.tex; }
    if (this._n + 6 > this._cap) this._flush();
    const W = this.W, H = this.H;
    const ma = m.a, mb = m.b, mc = m.c, md = m.d, me = m.e, mf = m.f;
    // Four corners → screen px (for both clip position and edge-fade alpha).
    const sxTL = ma * lx0 + mc * ly0 + me, syTL = mb * lx0 + md * ly0 + mf;
    const sxTR = ma * lx1 + mc * ly0 + me, syTR = mb * lx1 + md * ly0 + mf;
    const sxBR = ma * lx1 + mc * ly1 + me, syBR = mb * lx1 + md * ly1 + mf;
    const sxBL = ma * lx0 + mc * ly1 + me, syBL = mb * lx0 + md * ly1 + mf;
    // → clip space + per-corner edge alpha.
    const cxTL = (sxTL / W) * 2 - 1, cyTL = 1 - (syTL / H) * 2, aTL = this._edgeAlpha(sxTL, syTL, a);
    const cxTR = (sxTR / W) * 2 - 1, cyTR = 1 - (syTR / H) * 2, aTR = this._edgeAlpha(sxTR, syTR, a);
    const cxBR = (sxBR / W) * 2 - 1, cyBR = 1 - (syBR / H) * 2, aBR = this._edgeAlpha(sxBR, syBR, a);
    const cxBL = (sxBL / W) * 2 - 1, cyBL = 1 - (syBL / H) * 2, aBL = this._edgeAlpha(sxBL, syBL, a);
    const V = this._verts, FP = this.FLOATS_PER_VERT; let o = this._n * FP;
    // 6 verts: TL, TR, BR, TL, BR, BL.
    V[o]=cxTL;V[o+1]=cyTL;V[o+2]=u0;V[o+3]=v0;V[o+4]=r;V[o+5]=g;V[o+6]=b;V[o+7]=aTL;V[o+8]=sil;o+=FP;
    V[o]=cxTR;V[o+1]=cyTR;V[o+2]=u1;V[o+3]=v0;V[o+4]=r;V[o+5]=g;V[o+6]=b;V[o+7]=aTR;V[o+8]=sil;o+=FP;
    V[o]=cxBR;V[o+1]=cyBR;V[o+2]=u1;V[o+3]=v1;V[o+4]=r;V[o+5]=g;V[o+6]=b;V[o+7]=aBR;V[o+8]=sil;o+=FP;
    V[o]=cxTL;V[o+1]=cyTL;V[o+2]=u0;V[o+3]=v0;V[o+4]=r;V[o+5]=g;V[o+6]=b;V[o+7]=aTL;V[o+8]=sil;o+=FP;
    V[o]=cxBR;V[o+1]=cyBR;V[o+2]=u1;V[o+3]=v1;V[o+4]=r;V[o+5]=g;V[o+6]=b;V[o+7]=aBR;V[o+8]=sil;o+=FP;
    V[o]=cxBL;V[o+1]=cyBL;V[o+2]=u0;V[o+3]=v1;V[o+4]=r;V[o+5]=g;V[o+6]=b;V[o+7]=aBL;V[o+8]=sil;o+=FP;
    this._n += 6;
  },

  _flush() {
    const gl = this.gl;
    if (!this._n || !this._curTex) { this._n = 0; return; }
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this._verts.subarray(0, this._n * this.FLOATS_PER_VERT), gl.DYNAMIC_DRAW);
    const F = 4, stride = this.FLOATS_PER_VERT * F;
    gl.enableVertexAttribArray(this._aPos); gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this._aUV);  gl.vertexAttribPointer(this._aUV,  2, gl.FLOAT, false, stride, 2 * F);
    gl.enableVertexAttribArray(this._aCol); gl.vertexAttribPointer(this._aCol, 4, gl.FLOAT, false, stride, 4 * F);
    gl.enableVertexAttribArray(this._aSil); gl.vertexAttribPointer(this._aSil, 1, gl.FLOAT, false, stride, 8 * F);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._curTex);
    gl.uniform1i(this._uSampler, 0);
    // Glacial grade, published by GLTerrain (0 when the GPU terrain isn't grading).
    if (this._uCold) gl.uniform1f(this._uCold, this._cold || 0);
    if (this._uColdTint) gl.uniform3f(this._uColdTint, 0.82, 0.90, 1.08);
    gl.drawArrays(gl.TRIANGLES, 0, this._n);
    this._n = 0;
  },

  // End the capture span. In DOM-stack mode the GL canvas IS a layer, so there is
  // no drawImage — just flush the batch to it. Named composite() for the call site
  // in Simulation.render() shared with the old blit build. ctx2d is ignored here.
  composite(/* ctx2d */) {
    if (!this.enabled || !this._open) return;
    this._flush();
    this._open = false;
  },
  endSpan() { this.composite(); },

  // ---- fill parsing -----------------------------------------------------------
  // Read the disc colour from the live fillStyle p5 set with fill(). p5 emits
  // 'rgba(r,g,b,a)' / 'rgb(r,g,b)' / '#rrggbb'. Cached on the exact string.
  // MULTI-ENTRY cache: a single entry thrashed in the real mixed render order (plant
  // shadows at alpha 20, moa shadows at 25, dormant at 10, UI dots…), re-parsing — and
  // re-allocating — a colour object every frame. Keyed on the exact fillStyle string,
  // each distinct colour is parsed once; steady state allocates nothing. Bounded so an
  // unusual spread of colours can't grow it without limit.
  _fillCache: null, _fillCacheN: 0, _fillCacheVal: { r: 0, g: 0, b: 0, a: 1 },
  _parseFill(style) {
    if (typeof style !== 'string') return this._fillCacheVal;
    let cache = this._fillCache || (this._fillCache = {});
    const hit = cache[style];
    if (hit) { this._fillCacheVal = hit; return hit; }
    let r = 0, g = 0, b = 0, a = 1;
    const m = style.match(/rgba?\(([^)]+)\)/i);
    if (m) { const p = m[1].split(',').map(s => parseFloat(s));
      r = (p[0] || 0) / 255; g = (p[1] || 0) / 255; b = (p[2] || 0) / 255; a = (p.length > 3) ? p[3] : 1; }
    else if (style[0] === '#') {
      let h = style.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('');
      r = parseInt(h.slice(0, 2), 16) / 255; g = parseInt(h.slice(2, 4), 16) / 255; b = parseInt(h.slice(4, 6), 16) / 255;
    }
    if (this._fillCacheN >= 64) { cache = this._fillCache = {}; this._fillCacheN = 0; }  // bound it
    const val = { r, g, b, a };
    cache[style] = val; this._fillCacheN++;
    this._fillCacheVal = val;
    return val;
  },

  // Wrap ellipse()/circle() so a captured shadow/halo becomes a disc quad while the
  // span is open; otherwise pass through to normal 2D drawing.
  _wrapShapes() {
    const self = this;
    if (typeof ellipse === 'function') {
      const orig = ellipse;
      const wrap = function (x, y, w, h) {
        if (self._open && self.tryCaptureEllipse(x, y, (w === undefined ? 0 : w), (h === undefined ? w : h))) return;
        return orig.apply(this, arguments);
      };
      if (typeof window !== 'undefined') window.ellipse = wrap;
      try { ellipse = wrap; } catch (_) {}
    }
    if (typeof circle === 'function') {
      const orig = circle;
      const wrap = function (x, y, d) {
        if (self._open && self.tryCaptureEllipse(x, y, d, d)) return;
        return orig.apply(this, arguments);
      };
      if (typeof window !== 'undefined') window.circle = wrap;
      try { circle = wrap; } catch (_) {}
    }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = GLBatch;
