# Session Compaction Summary

## User Intent
- Fix several gameplay and quality issues in Puja (a block-stacking PWA game)
- Improve sharing UX to use native iOS share sheet
- Add visual branding to the foundation block
- Normalize gameplay speed across desktop and mobile

## Contextual Work Summary

### Rendering Quality
- Added `renderer.setPixelRatio(window.devicePixelRatio)` to fix blurry/blocky rendering on Retina/iPhone displays

### Share Image
- Replaced `toDataURL` + manual blob conversion with `canvas.toBlob()` callback — this was the root cause of native share sheet not appearing on iOS
- Removed `isMobile` guard so native share is attempted on all platforms
- Added custom WebGL re-render with tighter camera frustum before capture, to zoom in on the tower in the exported image
- Fixed image clipping (was computing frustum width-first; changed to height-first: `capHeight = Math.max(40, towerHeight * 1.3)`)

### Speed Normalization
- Desktop landscape has a wider frustum than mobile portrait; block covered fewer screen pixels per second on mobile
- Fix: divide movement by `viewScale = (camera.right - camera.left) / 40` so block always covers the same screen fraction regardless of orientation

### Foundation Block Branding
- `addVersionText(layer)` creates canvas textures on two lateral faces of the foundation block
- Version (from `manifest.json`, fetched in `init()`) on the +X face; "puja" on the +Z face
- Text fades out over 3 seconds via per-frame canvas redraw + `texture.needsUpdate`
- User tuned positions via `makeCanvas(text, xRatio, yRatio, fontSize)` — current values: version `(0.5, 0.6, 25px)`, puja `(0.49, 0.55, 65px)`
- Face assignment (`verMat`/`nameMat` at indices 0 and 4) left for user to swap as needed

### Nihilistic Messages
- Added Beckett ("Fail better") and Kafka ("infinite hope, but not for us") quotes
- Existing intentional duplicate of "Don't wish it were easier" preserved with comment

### Version Bump
- `manifest.json` and `sw.js` bumped from 0.4.1 → 0.4.3 across two bumps this session

## Files Touched

### Core Logic
- **js/game.js**: `setPixelRatio`, `addVersionText`, version fetch in `init()`, speed normalization with `viewScale`, foundation block branding lifecycle (fade + cleanup)
- **js/ui.js**: `saveAsImage` rewritten to use `canvas.toBlob`, native share without `isMobile` guard, height-based frustum for zoom, removed `dataURLToBlob` helper

### Config / Assets
- **js/config.js**: Two new nihilistic messages added; intentional duplicate comment added
- **manifest.json**: Version 0.4.1 → 0.4.3
- **sw.js**: Cache name 0.4.1 → 0.4.3
