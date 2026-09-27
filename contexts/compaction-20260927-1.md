# Session Compaction Summary

## User Intent
- Bolt a generative, event-driven jazz soundtrack onto puja, reusing samples
  and libraries from the sibling `shotgun-pollock` project.
- Iterate on the swing feel until it actually swings, then document the
  final model as a portable skill for future games.
- Keep `game.js` from bloating; extract self-contained subsystems.

## Contextual Work Summary

### Planning
- Wrote `sound-plan.md` proposing an event-driven port of shotgun-pollock's
  jazz system. Later appended an addendum correcting the mental model
  (density, not cleverness, was what made shotgun-pollock work).

### Audio system port
- Copied `Tone.js`, piano samples, and drum samples from
  `../shotgun-pollock/jazz/` into `puja/audio/`. Preserved credit lineage
  in `audio/CREDITS.md` and puja's `README.md`.
- Built `js/sound.js` around a `Tone.Sampler` piano + drum kit, chord tables
  cribbed from jazz.js, and per-event hooks (`onPlace`, `onPerfect`,
  `onPulse`, `onTurnaround`, `onDirectionSwap`, `onEnd`, `onReset`).
- Wired hooks into `js/game.js` at placement, perfect-hit, tower-pulse,
  turnaround, direction-swap, endGame, and resetGame.
- Handled the AudioContext autoplay gate: `setSound()` calls `Tone.start()`
  inside the canvas click gesture.

### Swing iteration (the long saga)
- v1: slice-driven `tickSlice` — piano+drums fired on block-slide boundary
  crossings with swung slice widths. Sparse, arrhythmic, "not swinging".
- v2: dropped piano off ticks; moved to enter/leave-base transitions.
- v3: still felt off. Root cause admitted: I had been calling the ticks
  "keypresses" and misreading shotgun-pollock — jazzing() actually fires on
  a `framecounter % 25 == 0` fixed cadence, not on keypresses.
- v4: replaced slice ticks with `setInterval(tickJazz, 417)`. Still not
  swinging because piano-per-tick had been removed. Put it back.
- v5: user pointed out drum timing was still off. Diagnosed setInterval
  drift under Three.js + Cannon load; switched to
  `Tone.Transport.scheduleRepeat` for sample-accurate audio-thread timing.
- v6: user conceded shotgun-pollock's swing isn't really a swing.
  Implemented a real "spang-a-lang" pattern: BPM=90, ride ding every beat,
  swung "a" at `time + BEAT_SEC * 2/3`, hi-hat foot on beats 2 and 4,
  piano-per-beat via `nextPianoNote`.

### Mute toggle
- Persistent `#mute-toggle` button, phosphor icons (`ph-speaker-high` /
  `ph-speaker-slash`), state persisted to `localStorage["puja.sound"]`.
  Moved out of `.ui-container` (fixes iOS positioning) with safe-area insets.

### Extractions from game.js
- Split slice tracking out (before it was ripped entirely for Transport).
- Moved the foundation-block "puja + version" overlay to
  `js/versionText.js` (`attachVersionText` / `updateVersionText` /
  `disposeVersionText`).

### Sample pruning + PWA cache
- Deleted 450 unused piano-velocity samples and one unused drum sample
  (85 MB → 6.8 MB in `audio/`).
- `sw.js` now precaches exactly the 30 piano + 14 drum files puja uses,
  plus `phosphor.css` and `Phosphor-Light.woff2`.
- `manifest.json` bumped 0.4.3 → 0.5.0 → 0.5.1.

### Portable skill doc
- Wrote `swing-model.md`: full standalone doc of the final swing model
  (BPM, `AND_OFFSET`, sample list, minimal Transport loop, chord walker,
  event-hook suggestions, tuning knobs, credits).

## Files Touched

### Core Logic
- **js/sound.js**: complete rewrite; final state is `Tone.Transport`-driven
  jazz swing at BPM=90 with ride, swung "a", hi-hat backbeat, piano-per-beat,
  plus game-event accents.
- **js/game.js**: sound hooks wired throughout; slice tracking and
  version-text logic removed after extractions.
- **js/versionText.js** *(new)*: foundation-block overlay subsystem.
- **js/ui.js**: `initMuteToggle`, phosphor icon rendering, localStorage
  persistence.

### PWA / assets
- **sw.js**: precaches only the samples in use; bumped cache version.
- **manifest.json**: version bumps.
- **index.html**: loads `Tone.js` and `phosphor.css`; mute button moved out
  of `.ui-container`.
- **css/style.css**: `#mute-toggle` fixed-position with safe-area insets.
- **audio/piano/**, **audio/drums/**: pruned to only what `sound.js` loads.
- **audio/CREDITS.md** *(new)*: sample & library provenance.

### Docs
- **sound-plan.md** *(new)*: original plan + addendum.
- **swing-model.md** *(new)*: portable skill doc for the final swing model.
- **README.md**: credits section (further edited by user).
- **contexts/compaction-20260927-1.md** *(this file)*.
