// Load before amy.js.
//
// Workaround for AMY's web build (v1.2.163): emscripten's glue reads a renderSizeHint field
// that the bundled miniaudio never fills in, so it passes garbage (e.g. 2143289344), and
// current Chrome rejects that and refuses to create the AudioContext. Drop invalid values.
(() => {
  const Native = window.AudioContext;
  if (!Native) return;
  window.AudioContext = class extends Native {
    constructor(opts) {
      if (opts && typeof opts.renderSizeHint === 'number' &&
          !(opts.renderSizeHint >= 1 && opts.renderSizeHint <= 288000)) {
        opts = { ...opts };
        delete opts.renderSizeHint;
      }
      super(opts);
    }
  };
})();
