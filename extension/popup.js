/*
 * popup.js
 * Logic for the control panel that opens when you click the extension icon.
 * It only reads and writes settings in chrome.storage; content.js on each
 * page listens for those changes and updates the grain.
 */

// Default settings. Must match DEFAULTS in content.js.
const D = { enabled: true, intensity: 35, size: 1.5, animated: true, fps: 18,
            mono: true, blend: 'soft-light', disabledSites: [], fullscreenFix: false,
            softness: 0, contrast: 100 };

// Built-in presets: [name, settings]. Picking one writes all its values at once.
const BUILTIN = [
  ['VGA anti-banding', { intensity: 40, size: 1.5, softness: 0.5, contrast: 110, fps: 18, animated: true, mono: true, blend: 'soft-light' }],
  ['Film look', { intensity: 30, size: 2.5, softness: 0.8, contrast: 100, fps: 12, animated: true, mono: true, blend: 'soft-light' }],
  ['Subtle', { intensity: 18, size: 1.5, softness: 0.3, contrast: 100, fps: 18, animated: true, mono: true, blend: 'soft-light' }],
  ['Lightest (static)', { intensity: 35, size: 1.5, softness: 0.5, contrast: 105, fps: 18, animated: false, mono: true, blend: 'soft-light' }]
];

// The settings that make up a preset (the on/off switch and site list are not part of it).
const PKEYS = ['intensity', 'size', 'softness', 'contrast', 'fps', 'animated', 'mono', 'blend'];

const $ = (id) => document.getElementById(id);       // shortcut for finding an element
const sliders = ['intensity', 'size', 'softness', 'contrast', 'fps'];
const unit = { contrast: '%' };                       // text shown after a slider value
const checks = ['enabled', 'animated', 'mono', 'fullscreenFix'];
let host = null;     // hostname of the current tab (for "disable on this site")
let customs = [];    // the user's saved presets: [{name, values}]

// All presets together: built-in first, then the user's own.
const allPresets = () => [...BUILTIN.map(([name, values]) => ({ name, values, builtin: true })), ...customs];

// Reads the current preset-related values from the controls.
function readValues() {
  const v = {};
  sliders.forEach((k) => { v[k] = Number($(k).value); });
  v.animated = $('animated').checked;
  v.mono = $('mono').checked;
  v.blend = $('blend').value;
  return v;
}

// Updates the preset dropdown: shows the matching preset's name, or "Custom"
// if the current values do not match any. Also enables Delete for user presets only.
function matchPreset() {
  const cur = readValues();
  const hit = allPresets().find((p) => PKEYS.every((k) => p.values[k] === cur[k]));
  $('preset').value = hit ? hit.name : '';
  $('pdel').disabled = !hit || !!hit.builtin;
}

// Fills the preset dropdown with "Custom" plus every preset.
function buildPresetMenu() {
  const sel = $('preset');
  sel.textContent = '';
  const add = (value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; sel.appendChild(o); };
  add('', 'Custom');
  allPresets().forEach((p) => add(p.name, p.builtin ? p.name : p.name + ' (mine)'));
}

// Puts a settings object into the controls.
function fill(s) {
  sliders.forEach((k) => { $(k).value = s[k]; $('o-' + k).textContent = s[k] + (unit[k] || ''); });
  checks.forEach((k) => { $(k).checked = s[k]; });
  $('blend').value = s.blend;
  $('fps').disabled = !s.animated;   // speed does nothing when grain is static
  if (host) $('site').checked = s.disabledSites.includes(host);
  matchPreset();
}

// ---------------------------------------------------------------
// Startup: load saved settings and find out which site this tab is on
// ---------------------------------------------------------------
chrome.storage.local.get({ ...D, customPresets: [] }, (s) => {
  s = { ...D, ...s };
  customs = Array.isArray(s.customPresets) ? s.customPresets : [];
  buildPresetMenu();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const id = tabs[0] && tabs[0].id;
    const done = () => fill(s);
    if (id == null) { $('site').disabled = true; return done(); }
    // Ask content.js in the current tab for its hostname.
    chrome.tabs.sendMessage(id, { type: 'host' }, (r) => {
      if (chrome.runtime.lastError || !r) {
        // No content script here (e.g. chrome:// pages), so the per-site option is unavailable.
        $('site').disabled = true;
        $('site-label').textContent = 'Not available on this page';
      } else {
        host = r.host;
        $('site-label').textContent = 'Disable on ' + host;
      }
      done();
    });
  });
});

// ---------------------------------------------------------------
// Controls: each change is saved right away
// ---------------------------------------------------------------

// Sliders: update the number shown, save, and refresh the preset dropdown.
sliders.forEach((k) => $(k).addEventListener('input', () => {
  const v = Number($(k).value);
  $('o-' + k).textContent = v + (unit[k] || '');
  chrome.storage.local.set({ [k]: v });
  matchPreset();
}));

// Checkboxes (on, animated, monochrome, fullscreen fix).
checks.forEach((k) => $(k).addEventListener('change', () => {
  chrome.storage.local.set({ [k]: $(k).checked });
  if (k === 'animated') $('fps').disabled = !$(k).checked;
  matchPreset();
}));

// Blend mode dropdown.
$('blend').addEventListener('change', () => {
  chrome.storage.local.set({ blend: $('blend').value });
  matchPreset();
});

// ---------------------------------------------------------------
// Presets
// ---------------------------------------------------------------

// Choosing a preset writes all its values, then refreshes the controls.
$('preset').addEventListener('change', () => {
  const p = allPresets().find((x) => x.name === $('preset').value);
  if (!p) return; // "Custom" selected, nothing to apply
  chrome.storage.local.set(p.values, () => {
    chrome.storage.local.get(D, (s) => fill({ ...D, ...s }));
  });
});

// Save the current values as a new preset under the typed name.
$('psave').addEventListener('click', () => {
  const name = $('pname').value.trim();
  if (!name || BUILTIN.some(([n]) => n === name)) return; // empty or clashes with a built-in
  customs = customs.filter((p) => p.name !== name);       // same name = overwrite
  customs.push({ name, values: readValues() });
  chrome.storage.local.set({ customPresets: customs }, () => {
    buildPresetMenu();
    $('pname').value = '';
    matchPreset();
  });
});

// Delete the selected user preset (built-ins cannot be deleted).
$('pdel').addEventListener('click', () => {
  const name = $('preset').value;
  customs = customs.filter((p) => p.name !== name);
  chrome.storage.local.set({ customPresets: customs }, () => {
    buildPresetMenu();
    matchPreset();
  });
});

// Opens the banding test page in a new tab.
$('pattern').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('pattern.html') });
});

// ---------------------------------------------------------------
// Per-site switch and reset
// ---------------------------------------------------------------

// Adds or removes the current site from the list of sites with grain turned off.
$('site').addEventListener('change', () => {
  chrome.storage.local.get({ disabledSites: [] }, ({ disabledSites }) => {
    const set = new Set(disabledSites);
    $('site').checked ? set.add(host) : set.delete(host);
    chrome.storage.local.set({ disabledSites: [...set] });
  });
});

// Puts every setting back to its default.
$('reset').addEventListener('click', () => {
  chrome.storage.local.set(D, () => fill(D));
});
