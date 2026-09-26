# A minimal generative jazz swing model

A drop-in "cheap jazz backing" for browser games. Uses
[Tone.js](https://tonejs.github.io) with a piano sampler + a drum sampler and
a single `Tone.Transport.scheduleRepeat` loop. Produces a recognisable
spang-a-lang swing without a bar of pre-composed music.

Copy `sound.js` from this project as a starting point. The essentials are
below; everything else (chord tables, placement/end-game accents) is optional.

## Samples

- **Piano** — [tambien/Piano](https://github.com/tambien/Piano) Internet
  Archive samples. Only the `v2` velocity variant of every 4th MIDI note
  (A0, C1, D#1, F#1, A1, …, C8) is needed — ~30 files, ~5 MB.
- **Drums** — [Salamander drum kit](https://sfzinstruments.github.io/drums/salamander/)
  by Alexander Holm. For this pattern you only need:
  - `c0` — ride, loud attack (e.g. `ride1_OH_FF_1.mp3`)
  - `c1` — ride, softer/medium (e.g. `ride1_OH_MP_1.mp3`) — used for the
    swung "a"
  - `b0` — hi-hat foot stomp (e.g. `hihatFootStomp_OH_MP_1.mp3`)

Optional extras (nice for game-event accents, not needed for the loop):
snare `e0`, snare stick `g0`, crash `f0`, splash `a0`.

## The whole audio system

Two Tone.js samplers, one Transport loop, one function.

### Setup

```js
const BPM = 90;                        // adjust to taste (85–110 all work)
const BEAT_SEC = 60 / BPM;             // 0.667s at 90 BPM
const AND_OFFSET = BEAT_SEC * (2 / 3); // triplet-eighth "and"
const SWING_RATIO = 2 / 3;             // 0.60 lighter, 0.70 draggier

const drum = new Tone.Sampler({
  urls: {
    c0: "ride1_OH_FF_1.mp3",
    c1: "ride1_OH_MP_1.mp3",
    b0: "hihatFootStomp_OH_MP_1.mp3",
  },
  baseUrl: "drums/",
  volume: -22,
  release: 0.3,
}).toDestination();

// Piano setup omitted — use tambien/Piano's `${note}v2.mp3` naming for
// all MIDI notes in [21, 108] stepped by 3. See tambien/Piano readme.
```

### The loop

```js
let beat = 0; // 0..3, index within a 4-beat bar

function tick(time) {
  // Piano note per beat — random pick from a rotating chord table (see below).
  // Provides the constant harmonic filler between drum accents.
  playPianoNote(time);

  // Ride "ding" on every beat.
  drum.triggerAttackRelease("c0", 0.6, time);

  // Swung "a" 2/3 through the beat, on 1, 2, 4 (skip 3 for phrase room).
  if (beat !== 2) {
    drum.triggerAttackRelease("c1", 0.4, time + AND_OFFSET);
  }

  // Hi-hat foot on 2 and 4 — jazz backbeat.
  if (beat === 1 || beat === 3) {
    drum.triggerAttackRelease("b0", 0.3, time);
  }

  beat = (beat + 1) % 4;
}

// Start on a user gesture (browser autoplay policies).
await Tone.start();
Tone.Transport.scheduleRepeat(tick, BEAT_SEC);
Tone.Transport.start();
```

That's it. Two files of setup, ten lines of loop. Result: `ding-a ding-a-CH
ding ding-a-CH` (CH = hi-hat foot) on repeat, tempo you like.

### Why it swings

The "and" of each beat (`+ AND_OFFSET`) lands on the third triplet, not the
straight midpoint (`+ BEAT_SEC / 2`). That triplet placement — long, short,
long, short — is the entire trick. A 2:1 ratio is the classic hard swing;
tighten (`SWING_RATIO = 0.6`) for shuffled 8ths, loosen (`0.7`) for a lazy
Coltrane-ballad drag.

### Why Tone.Transport (not setInterval)

`Tone.Transport.scheduleRepeat` runs on the audio thread and is
sample-accurate. `setInterval` gets stomped on by rendering/physics on the
main thread — a 30ms drift in the tick easily desynchronises the "a" from
its beat, and the swing disappears. If the host app is a heavy 3D scene, use
Transport.

## Piano note picker

To avoid composing anything, use Plan8's
[Jazzkeys](http://plan8.co)-style random chord walker: keep a pool of
"pretty" chord voicings (MIDI numbers) and each beat pick a random note from
a randomly-picked chord, transposed by a slow-drifting offset.

```js
const baseChords = [
  [48, 55, 57, 59, 64],
  [48, 55, 57, 62],
  [60, 64, 67, 69, 74, 76, 81],
  [48, 52, 55, 59, 62, 66],
  [60, 62, 64, 67, 71, 74, 78],
  [60, 65, 69, 70],   // BbMaj7 inversion
  [60, 70, 71, 77],   // EbMaj7 inversion
  [60, 64, 67, 69],   // Am7b5 inversion
];
const highChords = [
  [72, 79, 83, 90],
  [79, 83, 84, 86],
  [71, 74, 76, 79, 81, 86, 88, 93],
  [72, 76, 79, 81, 86, 90],
];

let pool = baseChords;
let noteCount = 0;
let transpose = 12; // rolling shift; bump on game events for variety

function playPianoNote(time) {
  if (noteCount % 3 === 0) pool = Math.random() < 0.5 ? baseChords : highChords;
  const chord = pool[Math.floor(Math.random() * pool.length)];
  const midi = chord[Math.floor(Math.random() * chord.length)] + transpose;
  const sustain = 0.5 + Math.random() * 1.3;
  piano.triggerAttackRelease(midiToNote(midi), sustain, time);
  noteCount = (noteCount + 1) % 10;
}
```

The chord tables are stolen from [Plan8's
Jazzkeys](http://plan8.co); credit them if you ship it.

## Hooking into game events

Keep the loop constant; drive musical variation from gameplay:

- **Placement / point scored** — call `playPianoNote(now)` for a bonus note,
  and/or bump `transpose` by a random amount for a "key change" accent.
- **Perfect / combo** — schedule a short piano arpeggio (top of current
  chord + 5th + octave, staggered by ~80ms) plus a splash cymbal.
- **Fail / game over** — one crash hit and a descending piano cluster.
- **Score tier / rising tension** — bias `pool` toward `highChords` as some
  progress metric grows; the harmony drifts upward.
- **Reset** — set `beat = 0`, `noteCount = 0`, `transpose = 12` so the next
  run starts on the downbeat with a fresh key.

## Tuning notes

- 90 BPM is a comfortable "walking" feel. Below ~80 it drags; above ~120 the
  swung "a" starts to sound like just a delayed ride.
- Piano-per-beat can feel busy if the piano volume is too high relative to
  drums. Start with `piano: -14 dB`, `drum: -22 dB`.
- If you want a sparser piano, gate `playPianoNote` behind a random check
  (`Math.random() < 0.7`).
- On mobile Safari, `Tone.start()` must be called from a user gesture. A
  splash/tap-to-start screen is cleaner than a persistent mute icon.

## Credits (paste into your project's README)

- Plan8 Music (jazzkeys chord-walk idea) — <http://plan8.co>
- Piano samples — <https://github.com/tambien/Piano>
- Salamander drum kit by Alexander Holm — <https://sfzinstruments.github.io/drums/salamander/>
- Tone.js — <https://tonejs.github.io>
