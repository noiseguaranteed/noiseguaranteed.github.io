// Chord and scale presets, and chord voicing. Everything is stored as semitone intervals above a
// root, so any chord or scale can be played from any key.
//
// Names use # and b rather than ♯ and ♭: the site font is a Latin subset.

export const PRESET_CHORDS = [
  { name: 'maj7', intervals: [0, 4, 7, 11] },
  { name: 'maj9', intervals: [0, 4, 7, 11, 14] },
  { name: 'maj7#11', intervals: [0, 4, 7, 11, 18] },
  { name: '6/9', intervals: [0, 4, 7, 9, 14] },
  { name: 'm7', intervals: [0, 3, 7, 10] },
  { name: 'm9', intervals: [0, 3, 7, 10, 14] },
  { name: 'm11', intervals: [0, 3, 7, 10, 14, 17] },
  { name: 'm6', intervals: [0, 3, 7, 9] },
  { name: 'm(maj7)', intervals: [0, 3, 7, 11] },
  { name: '7', intervals: [0, 4, 7, 10] },
  { name: '9', intervals: [0, 4, 7, 10, 14] },
  { name: '13', intervals: [0, 4, 10, 14, 21] },
  { name: '7b9', intervals: [0, 4, 7, 10, 13] },
  { name: '7#9', intervals: [0, 4, 7, 10, 15] },
  { name: '7#11', intervals: [0, 4, 7, 10, 14, 18] },
  { name: '7alt', intervals: [0, 4, 10, 13, 15, 20] },
  { name: '7sus4', intervals: [0, 5, 7, 10] },
  { name: '9sus4', intervals: [0, 5, 7, 10, 14] },
  { name: 'm7b5', intervals: [0, 3, 6, 10] },
  { name: 'dim7', intervals: [0, 3, 6, 9] },
  { name: 'quartal', intervals: [0, 5, 10, 15] },
  { name: 'so what', intervals: [0, 5, 10, 15, 19] },
];

export const PRESET_SCALES = [
  { name: 'major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: 'lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'aeolian', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'melodic minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
  { name: 'harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: 'lydian dominant', intervals: [0, 2, 4, 6, 7, 9, 10] },
  { name: 'altered', intervals: [0, 1, 3, 4, 6, 8, 10] },
  { name: 'locrian #2', intervals: [0, 2, 3, 5, 6, 8, 10] },
  { name: 'bebop dominant', intervals: [0, 2, 4, 5, 7, 9, 10, 11] },
  { name: 'bebop major', intervals: [0, 2, 4, 5, 7, 8, 9, 11] },
  { name: 'half-whole dim', intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
  { name: 'whole-half dim', intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
  { name: 'whole tone', intervals: [0, 2, 4, 6, 8, 10] },
  { name: 'blues', intervals: [0, 3, 5, 6, 7, 10] },
  { name: 'major pentatonic', intervals: [0, 2, 4, 7, 9] },
  { name: 'minor pentatonic', intervals: [0, 3, 5, 7, 10] },
];

export const SPREADS = ['close', 'drop 2', 'drop 2+4', 'open', 'wide'];

// The notes of a chord rooted on `root`, voiced with one of SPREADS:
// - close: the intervals as stored
// - drop 2 / drop 2+4: the 2nd (and 4th) voice from the top moved down an octave
// - open: every other voice from the bottom moved up an octave
// - wide: open, with the root also moved down an octave
export function voice(root, intervals, spread) {
  let notes = [...new Set(intervals.map(i => root + i))].sort((a, b) => a - b);
  const n = notes.length;
  const shift = (index, by) => { if (index >= 0 && index < n) notes[index] += by; };
  if (spread === 'drop 2' || spread === 'drop 2+4') {
    shift(n - 2, -12);
    if (spread === 'drop 2+4' && n >= 5) shift(n - 4, -12);
  } else if (spread === 'open' || spread === 'wide') {
    for (let i = 1; i < n; i += 2) shift(i, 12);
    if (spread === 'wide') shift(0, -12);
  }
  notes = [...new Set(notes)].filter(m => m >= 0 && m <= 127);
  return notes.sort((a, b) => a - b);
}

// Captured notes -> intervals above the lowest one.
export const chordIntervals = notes => {
  const sorted = [...new Set(notes)].sort((a, b) => a - b);
  return sorted.map(m => m - sorted[0]);
};

// Captured notes -> pitch classes above the lowest note's pitch class, within one octave.
export const scaleIntervals = notes => {
  const root = Math.min(...notes);
  return [...new Set(notes.map(m => (m - root) % 12))].sort((a, b) => a - b);
};

const sameSet = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const pitchClasses = intervals => [...new Set(intervals.map(i => i % 12))].sort((a, b) => a - b);

// A preset whose notes match, ignoring octaves, or undefined.
export const matchChord = intervals =>
  PRESET_CHORDS.find(c => sameSet(pitchClasses(c.intervals), pitchClasses(intervals)));
export const matchScale = intervals =>
  PRESET_SCALES.find(s => sameSet(s.intervals, pitchClasses(intervals)));
