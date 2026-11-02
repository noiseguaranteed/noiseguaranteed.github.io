// Janko keyboard on AMY.
//
// Layout: row r (counted from the bottom, nearest the player), column c sounds
//   lowNote + rowOffset(r) + 2c
// so every row is a whole-tone scale.
// - janko: rowOffset = r % 2, and odd rows are shifted right by half a key. Odd rows sit a
//   semitone higher; rows 0/2/4 repeat the same notes, as do rows 1/3/5, so any note can be
//   reached from several rows.
// - chromatic: rowOffset = r, with no shift, so keys form a grid: the key directly above any key
//   is a semitone higher and a vertical line is a chromatic scale.
// Either way every scale/chord shape is the same in every key.
//
// The library (theory.js) adds chords and scales: latch captures notes to save under a name,
// "play chords" sounds the chosen chord from any one key, and the chosen scale is marked on the
// keys (or, with "scale only", is all that sounds).

import {
  PRESET_CHORDS, PRESET_SCALES, voice, chordIntervals, scaleIntervals, matchChord, matchScale,
} from './theory.js?v=5';

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

const presetChords = PRESET_CHORDS.map(c => ({ ...c, id: 'chord:' + c.name, kind: 'chord' }));
const presetScales = PRESET_SCALES.map(s => ({ ...s, id: 'scale:' + s.name, kind: 'scale', root: 0 }));

const state = {
  audio: false,
  lowNote: 48,                   // C3
  octaves: 3,
  rows: 4,
  layout: 'janko',
  bank: 0,
  patch: 0,
  sustain: false,
  held: new Map(),               // midi note -> number of fingers/keys holding it
  lit: new Map(),                // key position "r,c" -> number of fingers/keys lighting it
  pointers: new Map(),           // pointerId -> { key, notes, lit } for that finger
  keysDown: new Map(),           // KeyboardEvent.code -> { notes, lit } for that key
  keyEls: new Map(),             // midi note -> [elements]
  keyAt: new Map(),              // key position "r,c" -> element
  // Library
  library: [],                   // the player's own chords and scales
  latch: false,
  captured: new Set(),           // notes caught by latch, waiting to be saved
  latchSounding: new Set(),      // captured notes currently held on
  chord: presetChords[0],
  strip: [],                     // chord ids on the chord strip
  slot: 0,                       // the strip button in use; its chord is state.chord
  chordMode: false,
  split: false,                  // left half plays chords, right half single notes
  spread: 'close',
  scale: null,
  scaleRoot: 0,                  // pitch class
  scaleOnly: false,
};

const cols = () => state.octaves * 6 + 1;   // row 0 runs C..C inclusive
const chromatic = () => state.layout === 'chromatic';
const rowOffset = r => chromatic() ? r : r % 2;
const rowShift = r => chromatic() ? 0 : (r % 2) * 0.5;      // in key widths
const widthInKeys = () => cols() + (chromatic() ? 0 : 0.5);
const noteFor = (r, c) => state.lowNote + rowOffset(r) + 2 * c;
const highestNote = () => Math.max(noteFor(state.rows - 1, cols() - 1), noteFor(state.rows - 2, cols() - 1));
const octaveOf = n => Math.floor(n / 12) - 1;
const noteName = n => NAMES[n % 12] + (n % 12 === 0 ? octaveOf(n) : '');   // octave on Cs only, to keep keys tidy
const fullName = n => NAMES[n % 12] + octaveOf(n);
const inScale = n => !!state.scale && state.scale.intervals.includes(((n - state.scaleRoot) % 12 + 12) % 12);

// Split: a key belongs to the half its centre is in. Janko rows are offset by half a key, so the
// boundary steps between rows rather than cutting through keys.
const keyCentre = pos => { const [r, c] = pos.split(',').map(Number); return c + rowShift(r) + 0.5; };
const leftHalf = pos => keyCentre(pos) < widthInKeys() / 2;
const chordKey = pos => state.split ? !!pos && leftHalf(pos) : state.chordMode;
// With the keyboard split, copies of a note in the other half belong to the other hand.
const sameHalf = (positions, pos) =>
  state.split && pos ? positions.filter(p => leftHalf(p) === leftHalf(pos)) : positions;

function send(msg) {
  if (state.audio) amy_send(msg);
}

// ---- Layout ----

function layout() {
  board.replaceChildren();
  state.keyEls.clear();
  state.keyAt.clear();
  const { width, height } = board.getBoundingClientRect();
  const W = width / widthInKeys();
  const H = height / state.rows;
  const gap = Math.max(2, Math.min(W, H) * 0.06);
  for (let r = 0; r < state.rows; r++) {
    const shift = rowShift(r);
    const top = (state.rows - 1 - r) * H;
    for (let c = 0; c < cols(); c++) {
      const note = noteFor(r, c);
      const el = document.createElement('div');
      el.className = 'key ' + (BLACK.has(note % 12) ? 'black' : 'white') + (note % 12 === 0 ? ' c' : '');
      el.style.left = `${(c + shift) * W + gap / 2}px`;
      el.style.top = `${top + gap / 2}px`;
      el.style.width = `${W - gap}px`;
      el.style.height = `${H - gap}px`;
      el.textContent = noteName(note);
      el.dataset.pos = `${r},${c}`;
      if (state.split && leftHalf(el.dataset.pos) && !(c + 1 < cols() && leftHalf(`${r},${c + 1}`))) {
        el.classList.add('split-edge');
      }
      if (state.lit.has(el.dataset.pos)) el.classList.add('lit');
      board.append(el);
      if (!state.keyEls.has(note)) state.keyEls.set(note, []);
      state.keyEls.get(note).push(el);
      state.keyAt.set(el.dataset.pos, el);
    }
  }
  $('range').textContent = `${noteName(state.lowNote)}–${fullName(highestNote())}`;
  markKeys();
}

// Scale and capture markings, redrawn whenever they change.
function markKeys() {
  for (const [note, els] of state.keyEls) {
    const scaled = inScale(note);
    for (const el of els) {
      el.classList.toggle('in-scale', scaled);
      el.classList.toggle('scale-root', scaled && ((note - state.scaleRoot) % 12 + 12) % 12 === 0);
      el.classList.toggle('muted', state.scaleOnly && !!state.scale && !scaled
        && !(state.split && leftHalf(el.dataset.pos)));
      el.classList.toggle('captured', state.captured.has(note));
    }
  }
}

// The whole cell is the hit area, so there are no dead zones between keys.
// Returns the key's position "r,c", or null.
function keyAtPoint(clientX, clientY) {
  const rect = board.getBoundingClientRect();
  // When the page is rotated 180°, the board's top-left corner is at the rect's bottom-right.
  const flipped = document.documentElement.classList.contains('flipped');
  const x = flipped ? rect.right - clientX : clientX - rect.left;
  const y = flipped ? rect.bottom - clientY : clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  const W = rect.width / widthInKeys();
  const H = rect.height / state.rows;
  const r = state.rows - 1 - Math.floor(y / H);
  const c = Math.floor(x / W - rowShift(r));
  if (c < 0 || c >= cols()) return null;
  return `${r},${c}`;
}

const posNote = pos => { const [r, c] = pos.split(',').map(Number); return noteFor(r, c); };
const noteAt = (clientX, clientY) => { const pos = keyAtPoint(clientX, clientY); return pos && posNote(pos); };

// ---- Notes ----
// Sounding and lighting are counted separately: a note sounds once however many keys hold it,
// but which keys light up depends on how it was played (see keyOn).

function press(note, vel) {
  const n = state.held.get(note) || 0;
  if (n === 0) send({ synth: SYNTH, note, vel });
  state.held.set(note, n + 1);
}

function release(note) {
  const n = state.held.get(note) || 0;
  if (n === 0) return;
  if (n > 1) { state.held.set(note, n - 1); return; }
  state.held.delete(note);
  send({ synth: SYNTH, note, vel: 0 });
}

function light(positions) {
  for (const pos of positions) {
    const n = state.lit.get(pos) || 0;
    if (n === 0) state.keyAt.get(pos)?.classList.add('lit');
    state.lit.set(pos, n + 1);
  }
}

function unlight(positions) {
  for (const pos of positions) {
    const n = state.lit.get(pos) || 0;
    if (n === 0) continue;
    if (n > 1) { state.lit.set(pos, n - 1); continue; }
    state.lit.delete(pos);
    state.keyAt.get(pos)?.classList.remove('lit');
  }
}

// Every key on the board that sounds `note` (none if it's off the board).
const copiesOf = note => (state.keyEls.get(note) || []).map(el => el.dataset.pos);

// One key per note: the copy nearest the `anchor` key, measured on screen, so a chord lights up
// as one compact shape next to the finger instead of on every repeat of its notes.
function nearestCopies(notes, anchor) {
  const { width, height } = board.getBoundingClientRect();
  const W = width / widthInKeys(), H = height / state.rows;
  const centre = pos => { const [r, c] = pos.split(',').map(Number); return [(c + rowShift(r)) * W, r * H]; };
  const [ax, ay] = centre(anchor);
  return notes.flatMap(note => {
    let best = null, bestDist = Infinity;
    const near = sameHalf(copiesOf(note), anchor);
    for (const pos of near.length ? near : copiesOf(note)) {
      const [x, y] = centre(pos);
      const dist = (x - ax) ** 2 + (y - ay) ** 2;
      if (dist < bestDist) { bestDist = dist; best = pos; }
    }
    return best ? [best] : [];
  });
}

function releaseAll() {
  for (const note of [...state.held.keys()]) {
    state.held.set(note, 1);
    release(note);
  }
  for (const pos of state.lit.keys()) state.keyAt.get(pos)?.classList.remove('lit');
  state.lit.clear();
  state.pointers.clear();
  state.keysDown.clear();
  state.latchSounding.clear();
}

// What one key sounds: the chosen chord rooted on the key with "play chords" (or in the left half
// when split), otherwise just its own note. "Scale only" silences single notes outside the scale;
// when split, chords in the left half are left alone, so any root can be played.
function notesForKey(note, pos) {
  const chord = chordKey(pos) && !!state.chord;
  if (state.scaleOnly && state.scale && !inScale(note) && !(state.split && chord)) return [];
  if (chord) return voice(note, state.chord.intervals, state.spread);
  return [note];
}

// Plays one key. `pos` is the key that was touched; without one (computer keyboard) the lowest
// copy of the note stands in. A chord lights each of its notes once, nearest that key; a single
// note lights every copy (in its own half, when split), showing where else it sits on the board.
function keyOn(note, vel, pos = copiesOf(note)[0]) {
  const notes = notesForKey(note, pos);
  for (const n of notes) press(n, vel);
  const lit = chordKey(pos) && pos
    ? nearestCopies(notes, pos)
    : notes.flatMap(n => sameHalf(copiesOf(n), pos));
  light(lit);
  return { notes, lit, note, vel, pos, chord: chordKey(pos) && !!state.chord };
}

function keyOff({ notes, lit }) {
  for (const n of notes) release(n);
  unlight(lit);
}

// Re-voices a held chord key with the current chord type. The new chord goes on before the old
// one comes off, so notes the two chords share keep sounding instead of restarting.
function revoice(held) {
  if (!held.chord) return held;
  const next = keyOn(held.note, held.vel, held.pos);
  keyOff(held);
  return { ...held, ...next };
}

const NOTHING = { notes: [], lit: [], chord: false };

const velocityFor = e =>
  e.pointerType === 'pen' && e.pressure > 0 ? Math.min(1, 0.15 + e.pressure) : Number($('vel').value);

// ---- Touch / mouse / pen ----

const fingerOn = (pos, e) => ({ key: pos, ...(pos === null ? NOTHING : keyOn(posNote(pos), velocityFor(e), pos)) });

board.addEventListener('pointerdown', e => {
  e.preventDefault();
  const pos = keyAtPoint(e.clientX, e.clientY);
  if (state.latch) {
    if (pos !== null) toggleCapture(posNote(pos), velocityFor(e));
    return;
  }
  try { board.setPointerCapture(e.pointerId); } catch {}
  state.pointers.set(e.pointerId, fingerOn(pos, e));
});

// Sliding a finger onto another key releases the old note(s) and plays the new one(s) (glissando).
board.addEventListener('pointermove', e => {
  const finger = state.pointers.get(e.pointerId);
  if (!finger) return;
  const pos = keyAtPoint(e.clientX, e.clientY);
  if (pos === finger.key) return;
  keyOff(finger);
  state.pointers.set(e.pointerId, fingerOn(pos, e));
});

function endPointer(e) {
  const finger = state.pointers.get(e.pointerId);
  if (!finger) return;
  state.pointers.delete(e.pointerId);
  keyOff(finger);
}
board.addEventListener('pointerup', endPointer);
board.addEventListener('pointercancel', endPointer);
board.addEventListener('lostpointercapture', endPointer);
document.addEventListener('contextmenu', e => e.preventDefault());

// ---- Computer keyboard ----

const QWERTY_NOTE = new Map();
for (const row of QWERTY) row.codes.forEach((code, i) => QWERTY_NOTE.set(code, row.offset + 2 * i));
const typing = e => e.target instanceof HTMLInputElement && e.target.type === 'text';

window.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
  if (e.key === 'Escape' && !$('picker').hidden) { closePicker(); return; }
  if (e.code === 'Space') { e.preventDefault(); setSustain(true); return; }
  if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && !$('strip').hidden) {
    e.preventDefault();
    selectSlot(state.slot + (e.code === 'ArrowUp' ? -1 : 1));
    return;
  }
  if (!QWERTY_NOTE.has(e.code) || state.keysDown.has(e.code)) return;
  e.preventDefault();
  const note = state.lowNote + QWERTY_NOTE.get(e.code);
  if (state.latch) { toggleCapture(note, Number($('vel').value)); return; }
  state.keysDown.set(e.code, keyOn(note, Number($('vel').value)));
});

window.addEventListener('keyup', e => {
  if (e.code === 'Space') { setSustain(false); return; }
  if (!state.keysDown.has(e.code)) return;
  keyOff(state.keysDown.get(e.code));
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

// Keep the whole keyboard within MIDI notes 12..120.
function fitRange() {
  while (highestNote() > 120 && state.lowNote > 12) state.lowNote -= 12;
}

function shiftOctave(d) {
  const prev = state.lowNote;
  state.lowNote += 12 * d;
  if (state.lowNote < 12 || highestNote() > 120) { state.lowNote = prev; return; }
  releaseAll();
  layout();
}

// Wires up a .seg group: each button carries data-<key>; the pressed one shows the current value.
function segmented(key, onChoose) {
  const buttons = [...document.querySelectorAll(`[data-${key}]`)];
  const show = value => buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === String(value))));
  buttons.forEach(b => b.addEventListener('click', () => { onChoose(b.dataset[key]); show(b.dataset[key]); }));
  return show;
}

// A button that opens or closes a panel bar.
function panelToggle(buttonId, panelId) {
  $(buttonId).addEventListener('click', e => {
    const open = $(panelId).hidden;
    $(panelId).hidden = !open;
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
}

function toggleButton(id, on) {
  $(id).setAttribute('aria-pressed', String(on));
}

function saveSetting(key, value) {
  try { localStorage.setItem('janko-' + key, value); } catch {}
}
function loadSetting(key) {
  try { return localStorage.getItem('janko-' + key); } catch { return null; }
}

segmented('bank', v => { state.bank = Number(v); state.patch = 0; loadPatch(); });
const showLayout = segmented('layout', v => {
  releaseAll(); state.layout = v; fitRange(); layout(); saveSetting('layout', v);
});
const showOctaves = segmented('octaves', v => {
  releaseAll(); state.octaves = Number(v); fitRange(); layout(); saveSetting('octaves', v);
});
const showRows = segmented('rows', v => {
  releaseAll(); state.rows = Number(v); fitRange(); layout(); saveSetting('rows', v);
});
if (['janko', 'chromatic'].includes(loadSetting('layout'))) state.layout = loadSetting('layout');
if (['2', '3', '4'].includes(loadSetting('octaves'))) state.octaves = Number(loadSetting('octaves'));
if (['2', '4', '6'].includes(loadSetting('rows'))) state.rows = Number(loadSetting('rows'));
fitRange();
showLayout(state.layout); showOctaves(state.octaves); showRows(state.rows);

panelToggle('settings-btn', 'settings');
panelToggle('library-btn', 'library');
$('patch-down').addEventListener('click', () => stepPatch(-1));
$('patch-up').addEventListener('click', () => stepPatch(1));
$('oct-down').addEventListener('click', () => shiftOctave(-1));
$('oct-up').addEventListener('click', () => shiftOctave(1));
$('volume').addEventListener('input', e => send({ volume: Number(e.target.value) }));
$('sustain').addEventListener('click', () => setSustain(!state.sustain));
$('labels').addEventListener('click', e => {
  const hide = board.classList.toggle('hide-labels');
  e.currentTarget.setAttribute('aria-pressed', String(!hide));
});
function setFlipped(on) {
  document.documentElement.classList.toggle('flipped', on);
  toggleButton('flip', on);
  saveSetting('flipped', on ? '1' : '');
}
$('flip').addEventListener('click', () => { releaseAll(); setFlipped(!document.documentElement.classList.contains('flipped')); });
if (loadSetting('flipped')) setFlipped(true);
$('fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
new ResizeObserver(layout).observe(board);

// ---- Library: latch and save ----

// Latched notes light every copy, like single notes: here the player is collecting notes, not
// reading a shape.
function latchOn(note, vel) { press(note, vel); light(copiesOf(note)); }
function latchOff(note) { release(note); unlight(copiesOf(note)); }

function toggleCapture(note, vel) {
  if (state.captured.has(note)) {
    state.captured.delete(note);
    if (state.latchSounding.delete(note)) latchOff(note);
  } else {
    state.captured.add(note);
    state.latchSounding.add(note);
    latchOn(note, vel);
  }
  showCapture();
}

function setLatch(on) {
  state.latch = on;
  toggleButton('latch', on);
  if (!on) {
    for (const n of state.latchSounding) latchOff(n);
    state.latchSounding.clear();
  }
}

function clearCapture() {
  for (const n of state.latchSounding) latchOff(n);
  state.latchSounding.clear();
  state.captured.clear();
  $('cap-name').value = '';
  showCapture();
}

// Shows the captured notes, and suggests a name when they match a preset.
function showCapture() {
  const notes = [...state.captured].sort((a, b) => a - b);
  $('captured').textContent = notes.length ? notes.map(fullName).join(' ') : 'latch on, then tap keys';
  $('save-chord').disabled = notes.length < 2;
  $('save-scale').disabled = notes.length < 2;
  $('clear-capture').disabled = notes.length === 0;
  let suggestion = 'name';
  if (notes.length >= 2) {
    const root = NAMES[notes[0] % 12];
    const chord = matchChord(chordIntervals(notes));
    const scale = matchScale(scaleIntervals(notes));
    suggestion = chord ? `${root} ${chord.name}` : scale ? `${root} ${scale.name}` : `${root} shape`;
  }
  $('cap-name').placeholder = suggestion;
  markKeys();
}

function saveCapture(kind) {
  const notes = [...state.captured];
  if (notes.length < 2) return;
  const name = $('cap-name').value.trim() || $('cap-name').placeholder;
  const item = kind === 'chord'
    ? { id: 'mine:' + Date.now().toString(36), kind, name, intervals: chordIntervals(notes) }
    : { id: 'mine:' + Date.now().toString(36), kind, name, intervals: scaleIntervals(notes), root: Math.min(...notes) % 12 };
  state.library.push(item);
  saveLibrary();
  setLatch(false);
  clearCapture();
  if (kind === 'chord') chooseChord(item); else chooseScale(item);
  announce(`saved ${kind} ${name}`);
}

function saveLibrary() {
  saveSetting('library', JSON.stringify(state.library));
}

function loadLibrary() {
  try {
    const items = JSON.parse(loadSetting('library') || '[]');
    state.library = items.filter(i => i && typeof i.name === 'string' && Array.isArray(i.intervals)
      && (i.kind === 'chord' || i.kind === 'scale') && i.intervals.every(Number.isInteger));
  } catch { state.library = []; }
}

const announce = text => { $('library-status').textContent = text; };

$('latch').addEventListener('click', () => setLatch(!state.latch));
$('clear-capture').addEventListener('click', clearCapture);
$('save-chord').addEventListener('click', () => saveCapture('chord'));
$('save-scale').addEventListener('click', () => saveCapture('scale'));
$('cap-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveCapture('chord'); });

// ---- Library: chords and scales ----

const allChords = () => [...presetChords, ...state.library.filter(i => i.kind === 'chord')];
const allScales = () => [...presetScales, ...state.library.filter(i => i.kind === 'scale')];

// ---- Library: chord strip ----
// Quick chord-type switching for the chord hand. Choosing a chord from the list puts it in the
// strip button in use; tapping a strip button switches to its chord, even mid-chord.

const STRIP_DEFAULTS = ['maj7', 'm7', '7', 'm7b5', '7sus4', 'dim7'].map(name => 'chord:' + name);
const chordById = (id, fallback) =>
  allChords().find(i => i.id === id) || allChords().find(i => i.id === fallback) || presetChords[0];

function setChord(item) {
  state.chord = item;
  $('chord-pick').textContent = item.name;
  saveSetting('chord', item.id);
}

function chooseChord(item) {
  releaseAll();
  setChord(item);
  state.strip[state.slot] = item.id;
  saveSetting('strip', JSON.stringify(state.strip));
  renderStrip();
}

function selectSlot(i) {
  state.slot = (i + state.strip.length) % state.strip.length;
  saveSetting('slot', String(state.slot));
  setChord(chordById(state.strip[state.slot], STRIP_DEFAULTS[state.slot]));
  renderStrip();
  for (const [id, finger] of state.pointers) state.pointers.set(id, revoice(finger));
  for (const [code, key] of state.keysDown) state.keysDown.set(code, revoice(key));
}

function renderStrip() {
  $('strip').replaceChildren(...state.strip.map((id, i) => {
    const b = document.createElement('button');
    b.textContent = chordById(id, STRIP_DEFAULTS[i]).name;
    b.setAttribute('aria-pressed', String(i === state.slot));
    // On pointerdown, not click: click waits for the finger to lift. Click still serves the
    // keyboard (detail 0), so the strip stays reachable with Tab and Enter.
    b.addEventListener('pointerdown', e => { e.preventDefault(); selectSlot(i); });
    b.addEventListener('click', e => { if (e.detail === 0) selectSlot(i); });
    return b;
  }));
}

// The strip shows only while some keys play chords.
function showStrip() {
  const show = state.split || state.chordMode;
  if ($('strip').hidden === show) $('strip').hidden = !show;
}

function chooseScale(item) {
  releaseAll();
  state.scale = item;
  if (item && item.id.startsWith('mine:')) state.scaleRoot = item.root ?? state.scaleRoot;
  $('scale-pick').textContent = item ? item.name : 'none';
  $('scale-only').disabled = !item;
  showScaleRoot();
  saveSetting('scale', item ? item.id : '');
}

function showScaleRoot() {
  $('scale-root').textContent = NAMES[state.scaleRoot];
  saveSetting('scale-root', String(state.scaleRoot));
  markKeys();
}

// Plays the chosen chord briefly from middle C, so choosing from the list can be heard.
function audition(item) {
  if (!state.audio) return;
  const notes = voice(60, item.intervals, state.spread);
  for (const n of notes) press(n, Number($('vel').value));
  const middleC = copiesOf(60)[0];
  const lit = middleC ? nearestCopies(notes, middleC) : [];
  light(lit);
  setTimeout(() => keyOff({ notes, lit }), 700);
}

const showSpread = segmented('spread', v => { releaseAll(); state.spread = v; saveSetting('spread', v); });
$('chord-mode').addEventListener('click', () => {
  releaseAll();
  state.chordMode = !state.chordMode;
  toggleButton('chord-mode', state.chordMode);
  showStrip();
});
function setSplit(on) {
  releaseAll();
  state.split = on;
  toggleButton('split', on);
  $('chord-mode').disabled = on;   // the split decides where chords play
  saveSetting('split', on ? '1' : '');
  showStrip();
  layout();
}
$('split').addEventListener('click', () => setSplit(!state.split));
if (loadSetting('split')) setSplit(true);
$('scale-only').addEventListener('click', () => {
  releaseAll();
  state.scaleOnly = !state.scaleOnly;
  toggleButton('scale-only', state.scaleOnly);
  markKeys();
});
$('root-down').addEventListener('click', () => { state.scaleRoot = (state.scaleRoot + 11) % 12; showScaleRoot(); });
$('root-up').addEventListener('click', () => { state.scaleRoot = (state.scaleRoot + 1) % 12; showScaleRoot(); });

// ---- Library: picker ----
// An on-page list rather than a <select>, so it turns with the page when flipped.

let pickerReturn = null;

function openPicker(kind) {
  pickerReturn = document.activeElement;
  $('picker-title').textContent = kind === 'chord' ? 'choose a chord' : 'choose a scale';
  const presets = $('picker-presets'), mine = $('picker-mine');
  presets.replaceChildren();
  mine.replaceChildren();
  const current = kind === 'chord' ? state.chord : state.scale;
  const choose = item => {
    if (kind === 'chord') { chooseChord(item); audition(item); } else chooseScale(item);
    closePicker();
  };
  const choice = item => {
    const b = document.createElement('button');
    b.textContent = item ? item.name : 'none';
    b.setAttribute('aria-pressed', String((current?.id ?? null) === (item?.id ?? null)));
    b.addEventListener('click', () => choose(item));
    return b;
  };
  if (kind === 'scale') presets.append(choice(null));
  for (const item of kind === 'chord' ? presetChords : presetScales) presets.append(choice(item));
  const own = state.library.filter(i => i.kind === kind);
  for (const item of own) {
    const wrap = document.createElement('span');
    wrap.className = 'own';
    const del = document.createElement('button');
    del.textContent = '×';
    del.className = 'delete';
    del.setAttribute('aria-label', `delete ${item.name}`);
    del.addEventListener('click', () => {
      state.library = state.library.filter(i => i !== item);
      saveLibrary();
      if (state.chord === item) chooseChord(presetChords[0]);
      renderStrip();   // other strip buttons holding it fall back to their defaults
      if (state.scale === item) chooseScale(null);
      openPicker(kind);
    });
    wrap.append(choice(item), del);
    mine.append(wrap);
  }
  $('picker-none').hidden = own.length > 0;
  $('picker').hidden = false;
  (presets.querySelector('[aria-pressed="true"]') || presets.firstChild).focus();
}

function closePicker() {
  $('picker').hidden = true;
  pickerReturn?.focus?.();
}

$('chord-pick').addEventListener('click', () => openPicker('chord'));
$('scale-pick').addEventListener('click', () => openPicker('scale'));
$('picker-close').addEventListener('click', closePicker);
$('picker').addEventListener('click', e => { if (e.target === $('picker')) closePicker(); });

// Restore the library and choices from last time.
loadLibrary();
try {
  const saved = JSON.parse(loadSetting('strip') || 'null');
  state.strip = STRIP_DEFAULTS.map((id, i) => (Array.isArray(saved) && typeof saved[i] === 'string' ? saved[i] : id));
} catch { state.strip = [...STRIP_DEFAULTS]; }
const savedSlot = Number(loadSetting('slot'));
state.slot = Number.isInteger(savedSlot) && savedSlot >= 0 && savedSlot < state.strip.length ? savedSlot : 0;
setChord(chordById(state.strip[state.slot], STRIP_DEFAULTS[state.slot]));
renderStrip();
const savedRoot = Number(loadSetting('scale-root'));
if (Number.isInteger(savedRoot) && savedRoot >= 0 && savedRoot < 12) state.scaleRoot = savedRoot;
chooseScale(allScales().find(i => i.id === loadSetting('scale')) || null);
if (['close', 'drop 2', 'drop 2+4', 'open', 'wide'].includes(loadSetting('spread'))) state.spread = loadSetting('spread');
showSpread(state.spread);
showCapture();

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
window.janko = { state, press, release, noteAt, keyAtPoint, noteFor, layout, voice };
