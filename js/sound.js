// Generative sound for puja. Ported from shotgun-pollock/jazz/jazz.js.
// See ../audio/CREDITS.md for sample and library provenance.
//
// Model: the sliding block is our metronome. animation() calls tickSlice()
// several times per traversal, which fires jazzing()-equivalent piano+drum
// events. Placements are accents on top of that groove.

const baseChords = [
  [48, 55, 57, 59, 64],
  [48, 55, 57, 62],
  [60, 64, 67, 69, 74, 76, 81],
  [48, 52, 55, 59, 62, 66],
  [60, 62, 64, 67, 71, 74, 78],
  [60, 65, 69, 70],
  [60, 70, 71, 77],
  [60, 64, 67, 69],
];

const highChords = [
  [72, 79, 83, 90],
  [79, 83, 84, 86],
  [71, 74, 76, 79, 81, 86, 88, 93],
  [72, 76, 79, 81, 86, 90],
];

const allNotes = [
  21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75,
  78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108,
];

function midiToNote(midi) {
  return new Tone.Frequency(midi, "midi").toNote();
}

function getNotesUrl(midi, vel) {
  return `${midiToNote(midi).replace("#", "s")}v${vel}.mp3`;
}

const pianoUrls = {};
allNotes.forEach((n) => (pianoUrls[midiToNote(n)] = getNotesUrl(n, 2)));

let pianoSampler = null;
let drumSampler = null;
let ready = false;
let soundEnabled = true;
let starting = false;

// State mirroring jazz.js: rolling chord, note counter, rhythm counter, key drift.
let currentChordChoice = baseChords;
let chordIndex = 0;
let noteCount = 0;
let rhythm = 0;
let transpose = 12;

// Classic jazz swing ride pattern ("spang-a-lang"). At 100 BPM each quarter
// note is 0.6s, so a full 4-beat bar is 2.4s. The swung "and" lands 2/3 of
// the way through each beat — that's the triplet feel that makes it swing.
// Hi-hat foot on beats 2 and 4 (the traditional jazz backbeat).
// Scheduled via Tone.Transport so timing is sample-accurate on the audio
// thread and doesn't drift with main-thread work.
const BPM = 90;
const BEAT_SEC = 60 / BPM;
const AND_OFFSET = BEAT_SEC * (2 / 3);
let drumLoopHandle = null;

function refreshChordPool(stackLen) {
  // Bias upward as the tower grows. baseChords early, highChords more likely later.
  const highBias = Math.min(0.6, stackLen / 60);
  currentChordChoice = Math.random() < highBias ? highChords : baseChords;
}

function pickTranspose(stackLen) {
  // Slow drift with tower height plus a small random shove, similar to
  // jazz.js's "24 + -6 + rand*12" but re-anchored per placement.
  const step = Math.floor(stackLen / 8) % 6;
  const drift = [0, 2, 5, 7, 9, 4][step];
  return 12 + drift + Math.floor(Math.random() * 5) - 2;
}

function safeTrigger(sampler, note, dur, when) {
  if (!sampler) return;
  try {
    if (when !== undefined) sampler.triggerAttackRelease(note, dur, when);
    else sampler.triggerAttackRelease(note, dur);
  } catch (err) {
    console.log(err);
  }
}

export function setSoundEnabled(v) {
  soundEnabled = !!v;
  try {
    localStorage.setItem("puja.sound", soundEnabled ? "1" : "0");
  } catch {}
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function loadSoundPreference() {
  try {
    const v = localStorage.getItem("puja.sound");
    if (v !== null) soundEnabled = v === "1";
  } catch {}
  return soundEnabled;
}

// Call from a user gesture. Resumes the AudioContext and lazy-creates samplers.
export function setSound(onReady) {
  if (ready) {
    onReady?.();
    return;
  }
  if (typeof Tone === "undefined") {
    console.warn("Tone.js not loaded");
    return;
  }
  if (starting) return;
  starting = true;

  Tone.start()
    .catch((err) => console.warn("Tone.start failed", err))
    .finally(() => {
      let pianoLoaded = false;
      let drumsLoaded = false;
      const check = () => {
        if (pianoLoaded && drumsLoaded) {
          ready = true;
          startJazzLoop();
          onReady?.();
        }
      };
      pianoSampler = new Tone.Sampler({
        attack: 0,
        urls: pianoUrls,
        baseUrl: "audio/piano/",
        curve: "exponential",
        release: 0.8,
        volume: -14,
        onload: () => {
          pianoLoaded = true;
          check();
        },
      }).toDestination();
      drumSampler = new Tone.Sampler({
        attack: 0,
        urls: {
          c0: "ride1_OH_FF_1.mp3",
          c1: "ride1_OH_MP_1.mp3",
          c2: "ride1_OH_FF_3.mp3",
          b0: "hihatFootStomp_OH_MP_1.mp3",
          b1: "hihatFootStomp_OH_MP_3.mp3",
          d0: "hihatClosed_OH_F_1.mp3",
          e0: "snare_OH_F_1.mp3",
          f0: "crash1_OH_FF_1.mp3",
          f1: "crash2_OH_FF_1.mp3",
          f2: "crash2_OH_FF_3.mp3",
          g0: "snareStick_OH_F_3.mp3",
          a0: "splash1_OH_F_1.mp3",
          a1: "splash1_OH_F_3.mp3",
          a2: "splash1_OH_P_1.mp3",
        },
        baseUrl: "audio/drums/",
        curve: "exponential",
        release: 0.3,
        volume: -22,
        onload: () => {
          drumsLoaded = true;
          check();
        },
      }).toDestination();
    });
}

export function isReady() {
  return ready;
}

// nextPianoNote from jazz.js, close to verbatim; picks a note from the
// current chord pool + rolling transpose.
function nextPianoNote(time) {
  if (noteCount % 3 === 0) {
    if (Math.random() < 0.5) {
      currentChordChoice = baseChords;
    } else {
      currentChordChoice = highChords;
    }
  }
  chordIndex = Math.floor(Math.random() * currentChordChoice.length);
  noteCount = (noteCount + 1) % 10;
  const chord = currentChordChoice[chordIndex];
  const noteIdx = Math.floor(Math.random() * chord.length);
  const midi = chord[noteIdx] + transpose;
  const play = midiToNote(midi);
  if (Math.random() * 10 > 0 && play) {
    const sustain = 0.5 + Math.random() * 1.3;
    safeTrigger(pianoSampler, play, sustain, time);
  }
}

function startJazzLoop() {
  if (drumLoopHandle !== null) return;
  drumLoopHandle = Tone.Transport.scheduleRepeat(tickJazz, BEAT_SEC);
  Tone.Transport.start();
}

// One beat of the swing ride pattern. Fires every BEAT_SEC.
//   Beat 1: DING            (ride)
//   Beat 2: DING-a           (ride + swung ride + hihat foot)
//   Beat 3: DING            (ride)
//   Beat 4: DING-a           (ride + swung ride + hihat foot)
// The "a" is scheduled at time + AND_OFFSET (2/3 of the beat) so it lands
// on the third triplet — the swung-eighth position that defines the feel.
// `rhythm` is the beat index within the bar (0..3).
function tickJazz(time) {
  if (!soundEnabled || !ready) return;
  nextPianoNote(time);
  // Ride "ding" on every beat.
  safeTrigger(drumSampler, "c0", 0.6, time);
  // Swung "a" on every beat except beat 3 — leaving beat-3-to-4 open gives
  // the pattern a little breathing room, closer to real jazz phrasing.
  if (rhythm !== 2) {
    safeTrigger(drumSampler, "c1", 0.4, time + AND_OFFSET);
  }
  // Hi-hat foot on beats 2 and 4 — jazz backbeat.
  if (rhythm === 1 || rhythm === 3) {
    safeTrigger(drumSampler, "b0", 0.3, time);
  }
  rhythm = (rhythm + 1) % 4;
}

// Placement accent: nudge chord pool + rolling transpose, single note.
export function onPlace(stackLen, precision = 0.5) {
  if (!soundEnabled || !ready) return;
  refreshChordPool(stackLen);
  transpose = pickTranspose(stackLen);
  const chord = currentChordChoice[Math.floor(Math.random() * currentChordChoice.length)];
  const midi = chord[Math.floor(Math.random() * chord.length)] + transpose;
  const sustain = 0.4 + (1 - precision) * 0.8;
  safeTrigger(pianoSampler, midiToNote(midi), sustain);
}

// Perfect: bright arpeggio + splash.
export function onPerfect() {
  if (!soundEnabled || !ready) return;
  const chord = currentChordChoice[chordIndex] || currentChordChoice[0];
  const now = pianoSampler.now();
  const top = chord[chord.length - 1] + transpose;
  [top, top + 7, top + 12].forEach((n, i) => {
    safeTrigger(pianoSampler, midiToNote(n), 0.6, now + i * 0.08);
  });
  safeTrigger(drumSampler, "a0", 0.9, now);
}

// Tower pulse: ride shimmer.
export function onPulse() {
  if (!soundEnabled || !ready) return;
  const now = drumSampler.now();
  safeTrigger(drumSampler, "c0", 1.2, now);
  safeTrigger(drumSampler, "c2", 0.8, now + 0.15);
}

// Turnaround: tiny hihat foot-stomp — a downbeat between slice ticks.
export function onTurnaround() {
  if (!soundEnabled || !ready) return;
  safeTrigger(drumSampler, "b0", 0.3);
}

// Direction swap after a placement: snare-stick flourish.
export function onDirectionSwap() {
  if (!soundEnabled || !ready) return;
  safeTrigger(drumSampler, "g0", 0.3);
}

// Collapse: crash + descending cluster.
export function onEnd() {
  if (!soundEnabled || !ready) return;
  const now = pianoSampler.now();
  safeTrigger(drumSampler, "f0", 1.5, now);
  const chord = currentChordChoice[chordIndex] || currentChordChoice[0];
  const cluster = [
    chord[chord.length - 1] + transpose,
    chord[Math.floor(chord.length / 2)] + transpose - 12,
    chord[0] + transpose - 12,
  ];
  cluster.forEach((n, i) => {
    safeTrigger(pianoSampler, midiToNote(n), 1.4, now + 0.12 + i * 0.14);
  });
}

// Reset: settle on a low tonic, reset counters.
export function onReset() {
  rhythm = 0;
  noteCount = 0;
  currentChordChoice = baseChords;
  chordIndex = 0;
  transpose = 12;
  if (!soundEnabled || !ready) return;
  safeTrigger(pianoSampler, midiToNote(36 + transpose), 1.8);
}
