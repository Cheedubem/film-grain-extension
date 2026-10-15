/*
 * fullscreen.js
 * Optional fix for video fullscreen. Runs in the page's own context
 * ("world": "MAIN" in manifest.json) so it can intercept the site's own
 * fullscreen requests. When a site tries to fullscreen a bare <video>, the
 * overlay would be hidden, so we fullscreen the video's parent container
 * instead and the grain stays visible.
 */
(() => {
  // content.js sets this attribute on the page to tell us if the option is on.
  const ATTR = 'data-fine-grain-fs';

  // Wraps a fullscreen method (e.g. requestFullscreen) with our own version.
  function wrap(name) {
    const orig = Element.prototype[name];
    if (!orig) return; // method does not exist in this browser
    Element.prototype[name] = function (...args) {
      let el = this; // by default, do exactly what the site asked
      // Only redirect for <video> elements, and only if the option is on.
      if (this.tagName === 'VIDEO' && document.documentElement.getAttribute(ATTR) === '1') {
        const p = this.parentElement;
        // Use the parent, unless it is the whole page.
        if (p && p !== document.body && p !== document.documentElement) el = p;
      }
      return orig.apply(el, args); // call the real fullscreen method
    };
  }
  wrap('requestFullscreen');       // standard name
  wrap('webkitRequestFullscreen'); // older Chrome-style name
})();
