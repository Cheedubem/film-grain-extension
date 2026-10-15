/*
 * content.js
 * Runs on every web page. Draws a full-screen, click-through grain overlay
 * and keeps it in sync with the settings saved by the popup.
 */
(() => {
  // Guard: make sure this script only runs once per page.
  if (window.__fineGrain) return;
  window.__fineGrain = true;

  // ---------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------

  // Default settings. Saved values from chrome.storage override these.
  const DEFAULTS = {
    enabled: true,          // master on/off
    intensity: 35,          // overlay opacity, 0-100
    size: 1.5,              // grain size (higher = chunkier)
    animated: true,         // move the grain or keep it still
    fps: 18,                // animation speed (grain "frames" per second)
    mono: true,             // true = gray grain, false = colored grain
    blend: 'soft-light',    // CSS blend mode used to mix grain with the page
    disabledSites: [],      // hostnames where grain is turned off
    fullscreenFix: false,   // keep grain visible in video fullscreen
    softness: 0,            // blur applied to the grain, 0-3
    contrast: 100           // how harsh the grain is, in percent
  };

  // Current settings, plus working variables.
  let s = { ...DEFAULTS };
  let canvas, ctx;            // the visible overlay canvas and its drawing context
  let anim = null;            // the running animation, if any
  let ct, rt;                 // timers used to delay updates (settings / resize)
  let noise = null;           // canvas holding the raw noise image
  let noiseKey = '';          // remembers what the noise was made with
  let drawKey = '';           // remembers what the overlay was last drawn with

  // ---------------------------------------------------------------
  // Noise generation
  // ---------------------------------------------------------------

  // Averaging 3 random numbers gives a bell-curve distribution,
  // which looks closer to real film grain than flat random noise.
  const gauss = () => (Math.random() + Math.random() + Math.random()) / 3;

  // One gray level (0-255) for one grain pixel. Contrast stretches the spread.
  const level = () => Math.max(0, Math.min(255, 128 + (gauss() - 0.5) * 400 * (s.contrast / 100))) | 0;

  // Extra space around the screen. The animated grain slides around inside
  // this margin so the screen edges never show a gap.
  function pad() {
    if (s.animated) return Math.ceil(Math.max(innerWidth, innerHeight) * 0.2);
    return s.softness > 0 ? 12 : 0; // static grain only needs room for the blur edge
  }

  // Builds the raw noise image (w x h pixels) in a hidden canvas.
  function makeNoise(w, h) {
    noise = document.createElement('canvas');
    noise.width = w;
    noise.height = h;
    const nctx = noise.getContext('2d');
    const img = nctx.createImageData(w, h);
    // View the pixel buffer as 32-bit numbers so each pixel is one write.
    const d = new Uint32Array(img.data.buffer);
    for (let i = 0; i < d.length; i++) {
      if (s.mono) {
        const v = level(); // same level for red, green, blue = gray
        d[i] = (0xff000000 | (v << 16) | (v << 8) | v) >>> 0;
      } else {
        // separate level per channel = colored grain
        d[i] = (0xff000000 | (level() << 16) | (level() << 8) | level()) >>> 0;
      }
    }
    nctx.putImageData(img, 0, 0);
  }

  // ---------------------------------------------------------------
  // Drawing and animation
  // ---------------------------------------------------------------

  // Draws the grain onto the overlay canvas. This runs only when settings
  // or window size change. The animation below does not redraw anything.
  function draw(P) {
    // Canvas is smaller than the screen by the grain size, then scaled up by CSS.
    const w = Math.max(1, Math.ceil((innerWidth + 2 * P) / s.size));
    const h = Math.max(1, Math.ceil((innerHeight + 2 * P) / s.size));
    // Only regenerate the noise if something that affects it changed.
    const nk = [s.size, s.mono, s.contrast, w, h].join('|');
    if (nk !== noiseKey || !noise) { noiseKey = nk; makeNoise(w, h); }
    canvas.width = w;   // setting width/height also clears the canvas
    canvas.height = h;
    // Softness is baked in by blurring while copying the noise over.
    ctx.filter = s.softness > 0 ? `blur(${s.softness / s.size}px)` : 'none';
    ctx.drawImage(noise, 0, 0);
    ctx.filter = 'none';
  }

  // Stops the current animation.
  function stopAnim() { if (anim) { anim.cancel(); anim = null; } }

  // Starts the animation: the canvas jumps between random positions,
  // which looks like the grain changing every frame. It is moved by the
  // GPU, so there is no JavaScript work per frame.
  function startAnim(P) {
    stopAnim();
    if (!s.animated) return;
    const R = Math.max(0, P - 16);  // how far it may jump (stays inside the margin)
    const K = 12;                   // number of different positions in the loop
    const kf = [];                  // keyframes
    const rnd = () => ((Math.random() * 2 - 1) * R).toFixed(1);
    for (let i = 0; i < K; i++) {
      // 'step-end' makes it jump instantly instead of sliding smoothly
      kf.push({ transform: `translate(${rnd()}px, ${rnd()}px)`, easing: 'step-end' });
    }
    kf.push({ ...kf[0] }); // end where it started so the loop is seamless
    anim = canvas.animate(kf, { duration: (K * 1000) / s.fps, iterations: Infinity });
  }

  // ---------------------------------------------------------------
  // Overlay element
  // ---------------------------------------------------------------

  // Puts the canvas in the right place in the page. Normally on the root
  // element; in fullscreen it must sit inside the fullscreen element to be seen.
  function mount() {
    const fs = document.fullscreenElement;
    const host = fs && fs.tagName !== 'VIDEO' && fs.tagName !== 'IFRAME' ? fs : document.documentElement;
    if (canvas.parentNode !== host) host.appendChild(canvas);
  }

  // Creates the overlay canvas once, with styles that keep it on top
  // of the page without blocking clicks.
  function create() {
    canvas = document.createElement('canvas');
    canvas.id = '__fine_grain__';
    const st = {
      position: 'fixed',          // stays put while the page scrolls
      'pointer-events': 'none',   // clicks pass through to the page
      'z-index': '2147483647',    // highest possible, always on top
      margin: '0', padding: '0', border: '0',
      'image-rendering': 'auto',  // smooth scaling for larger grain
      'will-change': 'transform'  // tells the browser to give it its own GPU layer
    };
    // '!important' stops page styles from overriding ours.
    for (const k in st) canvas.style.setProperty(k, st[k], 'important');
    ctx = canvas.getContext('2d');
    mount();
  }

  // Shares the fullscreen setting with fullscreen.js through an attribute,
  // because the two scripts run in separate worlds and cannot share variables.
  function syncFs() {
    if (document.documentElement)
      document.documentElement.setAttribute('data-fine-grain-fs', s.fullscreenFix ? '1' : '0');
  }

  // ---------------------------------------------------------------
  // Main update function
  // ---------------------------------------------------------------

  // Brings the overlay in line with the current settings.
  function apply() {
    syncFs();
    // Hide everything if grain is off globally or for this site.
    const off = !s.enabled || s.disabledSites.includes(location.hostname);
    if (off) {
      stopAnim();
      if (canvas) canvas.style.setProperty('display', 'none', 'important');
      return;
    }
    if (!document.documentElement) return;
    if (document.hidden) return; // background tabs do no work; apply() runs when shown
    if (!canvas) create();
    mount();
    const P = pad();
    const set = (k, v) => canvas.style.setProperty(k, v, 'important');
    set('display', 'block');
    set('opacity', String(s.intensity / 100));
    set('mix-blend-mode', s.blend);
    // Overlay is larger than the screen by P on every side.
    set('top', -P + 'px');
    set('left', -P + 'px');
    set('width', innerWidth + 2 * P + 'px');
    set('height', innerHeight + 2 * P + 'px');
    // Redraw only if something that changes the picture changed.
    const dk = [s.size, s.mono, s.contrast, s.softness, P, innerWidth, innerHeight].join('|');
    if (dk !== drawKey) { drawKey = dk; draw(P); }
    startAnim(P);
  }

  // ---------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------

  // Load saved settings. Wait for the page to finish parsing before the
  // first draw so grain never slows down page loading.
  const first = () => apply();
  chrome.storage.local.get(DEFAULTS, (items) => {
    s = { ...DEFAULTS, ...items };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', first, { once: true });
    else first();
  });

  // When a background tab becomes visible, catch it up.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });

  // When the popup changes a setting, update it here. The short delay means
  // dragging a slider triggers one update, not dozens.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const k in changes) s[k] = changes[k].newValue;
    clearTimeout(ct);
    ct = setTimeout(apply, 100);
  });

  // Resize the overlay after the window stops being resized.
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(apply, 200); });

  // Move the overlay into (or out of) the fullscreen element.
  document.addEventListener('fullscreenchange', () => { if (canvas) { mount(); apply(); } });

  // The popup asks which site this tab is on, for the "disable on this site" option.
  chrome.runtime.onMessage.addListener((m, _, send) => {
    if (m && m.type === 'host') send({ host: location.hostname });
  });
})();
