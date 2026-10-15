# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.6.0]
### Added
- Presets: four built-ins (VGA anti-banding, Film look, Subtle, Lightest) plus save/delete your own.
- Banding test page with smooth gradients to tune grain by eye.
### Changed
- Background tabs do no grain work until shown.
- First draw waits for the page to finish parsing, so it never delays page load.

## [0.5.0]
### Changed
- Rewrote the animation: the grain image is drawn once and animated by the GPU, with no per-frame JavaScript. Fixes heavy lag on older machines and a slow-opening popup.
### Added
- Extension icon.

## [0.4.0]
### Fixed
- Controls freezing after dragging sliders. Settings were saved to synced storage on every slider step and hit Chrome's write limits. Now saved locally and applied after a short pause.

## [0.3.0]
### Added
- Softness (blur) and contrast controls.
- Grain size now moves in 0.1 steps.

## [0.2.0]
### Added
- Optional "Keep grain in video fullscreen" setting. Redirects bare-video fullscreen requests to the video's parent container so the overlay stays visible.

## [0.1.0]
### Added
- Full-screen, click-through grain overlay (Manifest V3).
- Popup controls: intensity, size, speed, blend mode, animated, monochrome, per-site disable.
- Alt+G hotkey toggle.
