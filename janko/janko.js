// Janko keyboard on AMY.
//
// Layout: row r (counted from the bottom, nearest the player), column c sounds
//   lowNote + (r % 2) + 2c
// so every row is a whole-tone scale, and odd rows sit a semitone higher, shifted right by half
// a key. Rows 0/2/4 repeat the same notes, as do rows 1/3/5, so any note can be reached from
// several rows and every scale/chord shape is the same in every key.

const SYNTH = 1;
const DEFAULT_SYNTHS = [0, 1, 2, 10];
// Voices per bank: one per finger where AMY's ~240 oscs allow it. The piano patch uses 25 oscs
// per voice and only 8 voices get oscs; with more, notes landing on the extra voices are silent.
const NUM_VOICES = { 0: 10, 128: 10, 256: 8 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const BANK_SIZE = { 0: 128, 128: 128, 256: 1 };

// Computer-keyboard fallback. QWERTY rows are staggered like Janko rows: A sits half a key left
// of Z, and 1 half a key left of Q, so each pair maps to one Janko row pair.
const QWERTY = [
  { codes: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'], offset: 0 },
  { codes: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'], offset: -1 },
  { codes: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'], offset: 12 },
  { codes: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'], offset: 11 },
];

const $ = id => document.getElementById(id);
const board = $('board');

const state = {
  audio: false,
  lowNote: 48,                   // C3
  octaves: 3,
  rows: 4,
  bank: 0,
  patch: 0,
  sustain: false,
  held: new Map(),               // midi note -> number of fingers/keys holding it
  pointers: new Map(),           // pointerId -> midi note (or null between keys)
  keysDown: new Map(),           // KeyboardEvent.code -> midi note
  keyEls: new Map(),             // midi note -> [elements]
};

const cols = () => state.octaves * 6 + 1;   // row 0 runs C..C inclusive
const noteName = n => NAMES[n % 12] + (n % 12 === 0 ? Math.floor(n / 12) - 1 : '');

function send(msg) {
  if (state.audio) amy_send(msg);
}

// ---- Layout ----

function layout() {
  board.replaceChildren();
  state.keyEls.clear();
  const { width, height } = board.getBoundingClientRect();
  const W = width / (cols() + 0.5);
  const H = height / state.rows;
  const gap = Math.max(2, Math.min(W, H) * 0.06);
  for (let r = 0; r < state.rows; r++) {
    const shift = (r % 2) * 0.5;
    const top = (state.rows - 1 - r) * H;
    for (let c = 0; c < cols(); c++) {
      const note = state.lowNote + (r % 2) + 2 * c;
      const el = document.createElement('div');
      el.className = 'key ' + (BLACK.has(note % 12) ? 'black' : 'white') + (note % 12 === 0 ? ' c' : '');
      el.style.left = `${(c + shift) * W + gap / 2}px`;
      el.style.top = `${top + gap / 2}px`;
      el.style.width = `${W - gap}px`;
      el.style.height = `${H - gap}px`;
      el.textContent = noteName(note);
      if (state.held.has(note)) el.classList.add('lit');
      board.append(el);
      if (!state.keyEls.has(note)) state.keyEls.set(note, []);
      state.keyEls.get(note).push(el);
    }
  }
  const hi = state.lowNote + 12 * state.octaves;
  $('range').textContent = `${noteName(state.lowNote)}–${noteName(hi)}`;
}

// The whole cell is the hit area, so there are no dead zones between keys.
function noteAt(clientX, clientY) {
  const rect = board.getBoundingClientRect();
  // When the page is rotated 180°, the board's top-left corner is at the rect's bottom-right.
  const flipped = document.documentElement.classList.contains('flipped');
  const x = flipped ? rect.right - clientX : clientX - rect.left;
  const y = flipped ? rect.bottom - clientY : clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  const W = rect.width / (cols() + 0.5);
  const H = rect.height / state.rows;
  const r = state.rows - 1 - Math.floor(y / H);
  const c = Math.floor(x / W - (r % 2) * 0.5);
  if (c < 0 || c >= cols()) return null;
  return state.lowNote + (r % 2) + 2 * c;
}

// ---- Notes ----

function press(note, vel) {
  const n = state.held.get(note) || 0;
  if (n === 0) {
    send({ synth: SYNTH, note, vel });
    for (const el of state.keyEls.get(note) || []) el.classList.add('lit');
  }
  state.held.set(note, n + 1);
}

function release(note) {
  const n = state.held.get(note) || 0;
  if (n > 1) { state.held.set(note, n - 1); return; }
  state.held.delete(note);
  send({ synth: SYNTH, note, vel: 0 });
  for (const el of state.keyEls.get(note) || []) el.classList.remove('lit');
}

function releaseAll() {
  for (const note of [...state.held.keys()]) {
    state.held.set(note, 1);
    release(note);
  }
  state.pointers.clear();
  state.keysDown.clear();
}

const velocityFor = e =>
  e.pointerType === 'pen' && e.pressure > 0 ? Math.min(1, 0.15 + e.pressure) : Number($('vel').value);

// ---- Touch / mouse / pen ----

board.addEventListener('pointerdown', e => {
  e.preventDefault();
  try { board.setPointerCapture(e.pointerId); } catch {}
  const note = noteAt(e.clientX, e.clientY);
  state.pointers.set(e.pointerId, note);
  if (note !== null) press(note, velocityFor(e));
});

// Sliding a finger onto another key releases the old note and plays the new one (glissando).
board.addEventListener('pointermove', e => {
  if (!state.pointers.has(e.pointerId)) return;
  const prev = state.pointers.get(e.pointerId);
  const note = noteAt(e.clientX, e.clientY);
  if (note === prev) return;
  if (prev !== null) release(prev);
  if (note !== null) press(note, velocityFor(e));
  state.pointers.set(e.pointerId, note);
});

function endPointer(e) {
  if (!state.pointers.has(e.pointerId)) return;
  const note = state.pointers.get(e.pointerId);
  state.pointers.delete(e.pointerId);
  if (note !== null) release(note);
}
board.addEventListener('pointerup', endPointer);
board.addEventListener('pointercancel', endPointer);
board.addEventListener('lostpointercapture', endPointer);
document.addEventListener('contextmenu', e => e.preventDefault());

// ---- Computer keyboard ----

const QWERTY_NOTE = new Map();
for (const row of QWERTY) row.codes.forEach((code, i) => QWERTY_NOTE.set(code, row.offset + 2 * i));

window.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); setSustain(true); return; }
  if (!QWERTY_NOTE.has(e.code) || state.keysDown.has(e.code)) return;
  e.preventDefault();
  const note = state.lowNote + QWERTY_NOTE.get(e.code);
  state.keysDown.set(e.code, note);
  press(note, Number($('vel').value));
});

window.addEventListener('keyup', e => {
  if (e.code === 'Space') { setSustain(false); return; }
  if (!state.keysDown.has(e.code)) return;
  release(state.keysDown.get(e.code));
  state.keysDown.delete(e.code);
});

window.addEventListener('blur', releaseAll);

// ---- Controls ----

function loadPatch() {
  releaseAll();
  const patch = state.bank + state.patch;
  $('patch').textContent = state.bank === 256 ? '—' : String(state.patch + 1);
  $('patch-down').disabled = $('patch-up').disabled = BANK_SIZE[state.bank] === 1;
  send({ synth: SYNTH, num_voices: NUM_VOICES[state.bank], patch });
  if (state.sustain) send({ synth: SYNTH, pedal: 1 });
}

function stepPatch(d) {
  const n = BANK_SIZE[state.bank];
  state.patch = (state.patch + d + n) % n;
  loadPatch();
}

function setSustain(on) {
  if (on === state.sustain) return;
  state.sustain = on;
  $('sustain').setAttribute('aria-pressed', String(on));
  send({ synth: SYNTH, pedal: on ? 1 : 0 });
}

function shiftOctave(d) {
  const next = state.lowNote + 12 * d;
  if (next < 12 || next + 12 * state.octaves > 108) return;
  releaseAll();
  state.lowNote = next;
  layout();
}

$('bank').addEventListener('change', e => { state.bank = Number(e.target.value); state.patch = 0; loadPatch(); });
$('patch-down').addEventListener('click', () => stepPatch(-1));
$('patch-up').addEventListener('click', () => stepPatch(1));
$('oct-down').addEventListener('click', () => shiftOctave(-1));
$('oct-up').addEventListener('click', () => shiftOctave(1));
$('octaves').addEventListener('change', e => {
  releaseAll();
  state.octaves = Number(e.target.value);
  while (state.lowNote + 12 * state.octaves > 108) state.lowNote -= 12;
  layout();
});
$('rows').addEventListener('change', e => { releaseAll(); state.rows = Number(e.target.value); layout(); });
$('volume').addEventListener('input', e => send({ volume: Number(e.target.value) }));
$('sustain').addEventListener('click', () => setSustain(!state.sustain));
$('labels').addEventListener('click', e => {
  const hide = board.classList.toggle('hide-labels');
  e.currentTarget.setAttribute('aria-pressed', String(!hide));
});
function setFlipped(on) {
  document.documentElement.classList.toggle('flipped', on);
  $('flip').setAttribute('aria-pressed', String(on));
  try { localStorage.setItem('janko-flipped', on ? '1' : ''); } catch {}
}
$('flip').addEventListener('click', () => { releaseAll(); setFlipped(!document.documentElement.classList.contains('flipped')); });
try { if (localStorage.getItem('janko-flipped')) setFlipped(true); } catch {}
$('fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
new ResizeObserver(layout).observe(board);

// ---- Audio start ----

async function startAudio() {
  $('start-btn').disabled = true;
  $('start-btn').textContent = 'Starting…';
  await amy_live_start_web();
  await new Promise(r => setTimeout(r, 300));
  state.audio = true;
  for (const s of DEFAULT_SYNTHS) send({ synth: s, num_voices: 0 });
  send({ volume: Number($('volume').value) });
  loadPatch();
  $('start').hidden = true;
}

$('start-btn').addEventListener('click', startAudio);
if (!window.crossOriginIsolated) $('warn').hidden = false;
layout();

(async () => {
  while (typeof amy_module === 'undefined' || amy_module === null) await new Promise(r => setTimeout(r, 100));
  $('start-btn').disabled = false;
  $('start-btn').textContent = 'start playing';
})();

// Exposed for experimenting from the browser console.
window.janko = { state, press, release, noteAt, layout };
