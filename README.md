# Fine Grain

A lightweight Chrome extension that adds adjustable film grain over web pages to hide **color banding** on old or low-quality displays.

<!-- Add a before/after screenshot here: ![Before and after](docs/before-after.png) -->

## Why I built it

My old monitor runs over VGA and shows visible banding in gradients. I noticed that applying grain in VLC made the banding disappear: noise dithers the color steps so your eye no longer sees hard edges. The one grain extension I found had limited options, so I built my own with finer control.

## Features

- Intensity, grain size (0.1 steps), softness, contrast
- Animated or static grain, adjustable speed
- Monochrome or colored noise, three blend modes
- Presets (built-in and your own)
- Built-in banding test page
- Per-site disable and an `Alt+G` hotkey
- Optional fix to keep grain visible in video fullscreen

## Install (developer mode)

1. Download or clone this repo.
2. Open `chrome://extensions` (or `brave://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.
4. Pin Fine Grain and click its icon to adjust.

## Project structure

```
extension/
  manifest.json    Extension settings: permissions, icons, scripts, Alt+G shortcut
  content.js       Draws the grain overlay on every page and applies settings
  popup.html       Control panel layout and styling
  popup.js         Control panel logic: sliders, presets, per-site switch
  background.js    Handles the Alt+G toggle shortcut
  fullscreen.js    Optional fix to keep grain visible in video fullscreen
  pattern.html     Banding test page
  icons/           Toolbar and extension-page icons
```

Every script has comments at the top of each section explaining what it does.

## How it works

- A content script adds a fixed, click-through `<canvas>` over each page and blends it with `mix-blend-mode`.
- Noise is bell-curve distributed (closer to real film grain than flat random noise) and drawn **once**.
- Animation moves that canvas with GPU-driven CSS transforms, so there is no per-frame JavaScript.
- Settings live in `chrome.storage.local` and update the page after a short pause while you drag sliders.

## Performance

Performance is the top priority after correctness. Key choices: draw once and animate on the GPU, skip work in background tabs, and wait for the page to finish parsing before the first draw. Static mode costs essentially nothing.

## Known limitations

- Only affects browser pages, not the whole desktop.
- Some sites fullscreen a bare video element, which hides the overlay. Enable the fullscreen setting or use `F11`.
- Tested in Chromium. Brave should work (same engine) but is untested. A Firefox port is planned.

## Roadmap

- [ ] Gamma, brightness and contrast correction
- [ ] Dimmer and warm tint with a schedule
- [ ] Per-site profiles
- [ ] Firefox support
- [ ] Chrome Web Store release

See [CHANGELOG.md](CHANGELOG.md) for version history.

## What I learned

- How dithering hides banding, and why noise shape and blend mode matter
- Chrome storage write limits and why debouncing is needed
- Moving animation off the main thread to fix lag on weak hardware
- Manifest V3 structure, content scripts, and extension messaging

## Built with

JavaScript, HTML, CSS, Manifest V3.

## License

MIT, see [LICENSE](LICENSE).
