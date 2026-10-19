/* dither.js: turn photos and scans into noise guaranteed colours.

     var canvas = NoiseDither.dither(imageOrCanvas, { palette: 'magenta', method: 'atkinson', pixel: 2 });

   Options:
     palette   "magenta" (black + nav magenta, like images/hs_dithered.png), "green",
               "mono" (black + white), "logo" (black, white and the six logo colours),
               "wash" (black + the page's wash colours) or comma-separated colours
     method    "atkinson" (light, high contrast; the classic Mac look), "floyd"
               (Floyd-Steinberg; smoother tones) or "bayer" (ordered cross-hatch pattern)
     pixel     size of each dither dot in source pixels; 2 makes it chunkier (default 1)
     width     output width in dots, instead of working it out from `pixel`
     contrast  -1 to 1 (default 0)
     brightness -1 to 1 (default 0)

   The result is a canvas with one canvas pixel per dot. Show it with CSS
   `image-rendering: pixelated`, or use NoiseDither.scale() for a bigger PNG.
   Reading pixels needs a same-origin image: a file the person chose, or an image
   on the same site (not file:// pages, where the browser blocks it). */
(function () {
  var PALETTES = {
    magenta: ['#000000', '#f273ff'],
    green: ['#000000', '#81ff73'],
    mono: ['#000000', '#ffffff'],
    logo: ['#000000', '#ffffff', '#00ff00', '#0000ff', '#00ffff', '#ff40ff', '#ffff00', '#ff0000']
  };

  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function hexToRgb(hex) {
    hex = hex.trim().replace('#', '');
    if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function resolvePalette(p) {
    if (Array.isArray(p)) return p;
    if (p === 'wash') {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--wash-noise').trim();
      return v ? ['#000000'].concat(v.split(',')) : PALETTES.magenta;
    }
    return PALETTES[p] || String(p).split(',');
  }

  // Nearest palette colour by "redmean" distance, a cheap approximation of how
  // different two colours look to people.
  function nearest(pal, r, g, b) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i < pal.length; i++) {
      var c = pal[i], rm = (r + c[0]) / 2;
      var dr = r - c[0], dg = g - c[1], db = b - c[2];
      var d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function dither(source, opts) {
    var o = Object.assign({ palette: 'magenta', method: 'atkinson', pixel: 1, contrast: 0, brightness: 0 }, opts);
    var pal = resolvePalette(o.palette).map(hexToRgb);
    var sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
    var w = Math.max(1, Math.round(o.width || sw / Math.max(1, o.pixel)));
    var h = Math.max(1, Math.round(sh * w / sw));

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h), px = img.data;

    // Working copy in floats so diffused error can go past 0-255.
    var buf = new Float32Array(w * h * 3);
    var k = (1 + o.contrast) / (1 - Math.min(0.99, o.contrast)), lift = o.brightness * 128;
    for (var i = 0, j = 0; i < px.length; i += 4, j += 3) {
      // Transparent areas count as white, so scans and logos on clear backgrounds work.
      var a = px[i + 3] / 255;
      for (var c = 0; c < 3; c++) {
        var v = px[i + c] * a + 255 * (1 - a);
        buf[j + c] = (v - 128) * k + 128 + lift;
      }
    }

    var spread = 255 / Math.max(1, pal.length - 1);
    for (var y = 0; y < h; y++) {
      // Floyd-Steinberg runs back and forth along the lines, which avoids drifting streaks.
      var reverse = o.method === 'floyd' && y % 2 === 1;
      for (var xi = 0; xi < w; xi++) {
        var x = reverse ? w - 1 - xi : xi;
        var p = (y * w + x) * 3;
        var r = buf[p], g = buf[p + 1], b = buf[p + 2];
        if (o.method === 'bayer') {
          var t = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * spread;
          r += t; g += t; b += t;
        }
        var q = pal[nearest(pal, r, g, b)];
        var o4 = (y * w + x) * 4;
        px[o4] = q[0]; px[o4 + 1] = q[1]; px[o4 + 2] = q[2]; px[o4 + 3] = 255;
        if (o.method === 'bayer') continue;

        var er = r - q[0], eg = g - q[1], eb = b - q[2];
        var dir = reverse ? -1 : 1;
        var spots = o.method === 'floyd'
          ? [[dir, 0, 7 / 16], [-dir, 1, 3 / 16], [0, 1, 5 / 16], [dir, 1, 1 / 16]]
          // Atkinson passes on only 6/8 of the error, which keeps highlights and shadows clean.
          : [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]];
        for (var s = 0; s < spots.length; s++) {
          var nx = x + spots[s][0], ny = y + spots[s][1];
          if (nx < 0 || nx >= w || ny >= h) continue;
          var np = (ny * w + nx) * 3, f = spots[s][2];
          buf[np] += er * f; buf[np + 1] += eg * f; buf[np + 2] += eb * f;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // Enlarge a canvas by a whole number with hard edges, for exporting.
  function scale(canvas, factor) {
    var out = document.createElement('canvas');
    out.width = canvas.width * factor;
    out.height = canvas.height * factor;
    var ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  }

  window.NoiseDither = { dither: dither, scale: scale, palettes: PALETTES };
})();
