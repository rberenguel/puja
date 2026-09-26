# Puja — sound plan

A generative, event-driven soundtrack for the stacking game, in the same spirit
as `shotgun-pollock/jazz/jazz.js` but tuned to puja's slower, more deliberate
rhythm.

## What we borrow from shotgun-pollock

Copy these into `puja/audio/` (or similar), preserving credits:

- `Tone.js` (from `misc/Tone.js`) — the audio engine.
- `jazz/piano/*.mp3` — piano samples (from [tambien/Piano](https://github.com/tambien/Piano)).
- `jazz/drums/*.mp3` — Salamander drum kit (Alexander Holm,
  [sfzinstruments.github.io/drums/salamander](https://sfzinstruments.github.io/drums/salamander/)).
- The MIDI→note / URL-generation helpers, chord tables, and `Tone.Sampler`
  wiring from `jazz/jazz.js`.

Update `puja/README.md` credits to mirror the relevant lines from
`shotgun-pollock/README.md`:

- Plan8 Music (idea for random jazzy music).
- Piano samples from github.com/tambien/Piano.
- Drum samples from The Salamander kit by Alexander Holm.
- Tone.js.

## Why puja is not shotgun-pollock

`jazz.js` fires notes on every keypress — dense, twitchy, jazz-club feel.
Puja's core event is a single well-timed click every few seconds, plus a
continuous sliding block. So the model inverts:

- **Placements are the melody** — one note per click, chord-locked.
- **The sliding block is the pulse** — a soft, quantised drum tick whenever the
  block reaches a turnaround point.
- **Height is a slow harmonic drift** — the base transpose creeps up as the
  tower grows, with a key change every ~8 blocks.
- **Perfect placements ring out** — a chime/arpeggio over the current chord.
- **Collapse is a crash** — one cymbal hit + a decaying drum flourish, then
  silence until reset.

The name "puja" invites a more meditative palette than the jazz-club chaos of
shotgun-pollock; the same samples support that if we play them sparser, lower
velocity, and with longer sustain.

## Event → sound mapping

Wire these into the existing hooks in `js/game.js`:

| Game event | Location in `game.js` | Sound |
|---|---|---|
| First user gesture (start) | `click` handler in `addEventListeners` | `setJazz()` equivalent — lazy-create the samplers on the first click so autoplay policies are satisfied |
| Block placed (any) | inside `placeBlock`, right after `overlap > 0` branch | One piano note from current chord, sustain proportional to `overlap/size` (tighter placement = shorter, brighter attack) |
| Perfect placement | inside `if (overhangSize < PERFECT_THRESHOLD)` | Small 3–4 note arpeggio one octave up over the current chord, plus a soft crash/splash |
| Tower pulse (`triggerTowerPulse`) | reuse the same trigger | Ride cymbal shimmer over the pulse duration |
| Direction swap | after `addLayer(nextDirection…)` | Optional soft snare stick tick — marks the new axis |
| Slide turnaround | in `animation`, when `speed *= -1` | Sub-audible hihat closed (`d0`, low volume) — makes the swing feel tactile |
| Game end (`endGame`) | at the top of `endGame` | Crash + descending piano cluster (`c0`+`e0`+`f0` in shotgun-pollock's kit) |
| Reset (`resetGame`) | at the end | A single low piano note as the new tower's tonic |

The pulse and turnaround ticks are the "drums" in this system; unlike
shotgun-pollock's every-3-keypresses `rhythm` counter, puja gets its rhythm from
gameplay geometry (turnaround = ~1.5–2s at start, faster as `speed` grows).

## Harmony model

Reuse `baseChords` / `highChords` from `jazz.js` but with a slower key
progression driven by `stack.length`:

```js
// pseudo
const KEY_CHANGE_EVERY = 8;
function currentTranspose(stackLen) {
  // step up a whole tone every 8 blocks, wrap after an octave
  const step = Math.floor(stackLen / KEY_CHANGE_EVERY) % 6;
  return 12 + [0, 2, 5, 7, 9, 4][step]; // pentatonic-ish drift
}
```

Chord choice: bias `baseChords` at low heights, blend in `highChords` as the
tower grows (mirrors the camera rising). Note pick is random within the current
chord, same idea as `nextPianoNote`.

For perfect placements, pick the top note of the chord and add the octave + 5th
above it — that's the "arpeggio" without needing a scheduler.

## Volume + palette awareness

- Master piano volume: `-12 dB`, drums: `-24 dB` (puja is calmer than
  shotgun-pollock; drop from `-10`/`-20`).
- Special palettes (Halloween, Christmas — see `activeSpecialPalettes` in
  `game.js`) can override the chord table:
  - Halloween: minor chords, add a low ride shimmer under every placement.
  - Christmas: major 7ths, sleigh-bell-ish (repurpose `splash1` at low velocity).
- Global mute: long-press already triggers `saveAsImage`; add a small `🔈/🔇`
  toggle in the UI (persist via the same idb-keyval pattern shotgun-pollock
  uses, or `localStorage` — puja doesn't currently ship idb-keyval).

## File layout

```
puja/
  audio/
    tone.min.js                 # copy of Tone.js
    piano/                      # copy of shotgun-pollock/jazz/piano
    drums/                      # copy of shotgun-pollock/jazz/drums
    CREDITS.md                  # sample + library credits
  js/
    sound.js                    # new: setSound(), onPlace(), onPerfect(),
                                # onPulse(), onTurnaround(), onEnd(), onReset()
    game.js                     # import from ./sound.js, call at the hooks above
  index.html                    # <script src="./audio/tone.min.js"></script>
```

`sound.js` exports one lazy-init entry point (`setSound()` — like `setJazz`)
plus the per-event functions. It owns two module-level `Tone.Sampler`s and the
`chordIndex`/`noteCount`/`transpose` state, same shape as `jazz.js`.

## Rollout

1. Copy assets + `Tone.js`, add credits to `README.md` and `audio/CREDITS.md`.
2. Add `js/sound.js` cribbed from `jazz.js`, trimmed to the hooks above.
3. Wire calls in `game.js` at the marked locations. Keep them behind a
   `soundEnabled` flag so a mute toggle is trivial.
4. Add the mute button to `ui.js` + `index.html`.
5. Playtest: check that turnaround ticks don't get annoying, tune volumes,
   maybe gate turnaround ticks to every Nth swing once `speed` grows.

## Addendum — the corrected model

The first pass above got the model wrong. `jazz.js` in shotgun-pollock is not
event-sparse: every keypress in that game fires `jazzing()`, and during play
that's ~10Hz. The music emerges from **input density**, not from a Transport
clock and not from cleverness in the note picker. Placements in puja fire at
roughly 0.3Hz — 30× sparser — so porting the same call-per-input model gives
30× sparser music. That's what the first cut sounded like.

The fix is to find a denser event source in puja and drive `jazzing()`
verbatim from that, keeping the port faithful. The sliding block is the
obvious candidate: it's continuously moving during `gameState === "playing"`,
and its traversal period is a well-defined fraction of a second that already
depends on `speed` (which grows with height). So:

- Divide each half-traversal (left→right or right→left) into ~6 slices.
- Every time the block crosses a slice boundary in `animation()`, call
  `jazzing()`. That gives 12 events per full swing, ~6–8Hz at low heights and
  faster as `speed` ramps up — the same ballpark as shotgun-pollock's keypress
  cadence, and it *naturally* accelerates as the game gets harder.
- Keep `jazz.js`'s rhythm counter (`rhythm % 4`) and `nextPianoNote` picker
  unchanged. The counter cycles through drum patterns exactly as it did there.
- Placements stop being the *source* of music. They become accents on top:
  chord-change nudge, snare/crash on perfect, cluster on collapse. Same list
  as before, but no longer the primary driver.
- Turnarounds still get their own tick — they're now downbeats between the
  slice-driven groove.

Slice count and volumes are the two knobs to tune once it's playing: too few
slices and it's still sparse, too many and it turns into noise; volumes need
to drop further because the beat is now continuous rather than punctuational.

### Delta to the earlier plan

- `sound.js` gains a `tickSlice(sliceIndex)` entry point that internally does
  what `jazzing()` did (piano note + drum pattern by `rhythm % 4`). The
  per-event hooks (`onPerfect`, `onEnd`, `onReset`, `onPulse`) stay; `onPlace`
  becomes a lighter accent (a single chord-tone, no drum), and
  `onDirectionSwap` and `onTurnaround` become optional flourishes.
- `game.js` calls `tickSlice` from inside the `animation()` movement branch,
  keyed off the block's fractional position along its current axis. Cheap:
  compare current slice index to previous and fire on change.
- The mute toggle and Tone.start-on-gesture concerns from the first pass
  still apply (they were correct, just applied to the wrong music model).

## Open questions to try later

- Should the sliding block's *position* modulate anything (e.g. a soft pan
  L↔R matching the block's x)? Cheap with `Tone.Panner`, might feel great with
  headphones.
- Instead of piano, would a Rhodes / marimba / kalimba sample set fit puja's
  meditative vibe better? Same `Tone.Sampler` shape, different mp3s.
- A very quiet tanpura-style drone (single sustained note at the current tonic)
  could underpin the whole tower — one `Tone.Synth` or a looped sample.
