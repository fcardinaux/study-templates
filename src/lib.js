// SVG building blocks shared by every template.
//
// Everything here emits explicit SVG geometry. That is deliberate: Chrome
// rasterises CSS gradients when printing to PDF, which is why the dot and
// crosshair grids in the first generation of these templates shipped as
// 72 dpi bitmaps while the rest of the page stayed vector.

import { QR } from './qr.js';

const NS = 'http://www.w3.org/2000/svg';

export function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.appendChild(c);
  return node;
}

export const COLOR = {
  frame: '#333333',       // board outline
  gridline: '#666666',    // lines between squares
  dark: '#E8E8E8',        // dark squares
  light: '#FFFFFF',
  label: '#333333',       // rank and file coordinates
  rule: '#D8D8D8',        // ruled writing lines
  separator: '#CCCCCC',   // dotted rule between sections
  divider: '#222222',     // Cornell cue-column and summary rules
  grid: '#CCCCCC',        // dot and crosshair grids
  qr: '#111111',
};

// A board on a 100-unit viewBox: an 84-unit playing area inset by 8 units
// of gutter on each side, which is where the coordinates sit.
const GUTTER = 8;
const PLAY = 84;
const SQUARE = PLAY / 8;          // 10.5
const FILES = 'abcdefgh';

// `coordinates` draws the rank and file letters; `flipped` turns the board to
// Black's side, putting h8 in the bottom-left corner. The squares themselves are
// unchanged by flipping: a 180-degree turn maps (file, rank) to (9-file, 9-rank),
// which preserves the colour of every square.
export function board(x, y, size, { coordinates = true, flipped = false } = {}) {
  const g = el('svg', {
    x, y, width: size, height: size,
    viewBox: '0 0 100 100', overflow: 'visible',
  });

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      g.appendChild(el('rect', {
        x: GUTTER + f * SQUARE, y: GUTTER + r * SQUARE,
        width: SQUARE, height: SQUARE,
        fill: (r + f) % 2 ? COLOR.dark : COLOR.light,
      }));
    }
  }

  for (let i = 1; i < 8; i++) {
    const at = GUTTER + i * SQUARE;
    g.appendChild(el('line', { x1: GUTTER, y1: at, x2: GUTTER + PLAY, y2: at,
      stroke: COLOR.gridline, 'stroke-width': 0.12 }));
    g.appendChild(el('line', { x1: at, y1: GUTTER, x2: at, y2: GUTTER + PLAY,
      stroke: COLOR.gridline, 'stroke-width': 0.12 }));
  }

  g.appendChild(el('rect', {
    x: GUTTER, y: GUTTER, width: PLAY, height: PLAY,
    fill: 'none', stroke: COLOR.frame, 'stroke-width': 0.6,
  }));

  // The gutter is kept even without coordinates, so all three views share one
  // geometry and stay interchangeable on the page.
  if (!coordinates) return g;

  const label = (text, cx, cy) => el('text', {
    x: cx, y: cy, fill: COLOR.label, 'font-size': 3.2, 'font-weight': 'bold',
    'font-family': 'Helvetica, Arial, sans-serif',
    'text-anchor': 'middle', 'dominant-baseline': 'central',
  }, [document.createTextNode(text)]);

  for (let f = 0; f < 8; f++) {
    const cx = GUTTER + (f + 0.5) * SQUARE;
    const file = FILES[flipped ? 7 - f : f];
    g.appendChild(label(file, cx, GUTTER / 2 + 0.5));
    g.appendChild(label(file, cx, GUTTER + PLAY + GUTTER / 2 - 0.5));
  }
  for (let r = 0; r < 8; r++) {
    const cy = GUTTER + (r + 0.5) * SQUARE;
    const rank = String(flipped ? r + 1 : 8 - r);
    g.appendChild(label(rank, GUTTER / 2, cy));
    g.appendChild(label(rank, GUTTER + PLAY + GUTTER / 2, cy));
  }
  return g;
}

// The repository QR, drawn as vector. Horizontal runs of dark modules are merged
// into single rects, which keeps the element count down. `quiet` is the white
// margin the code needs to stay readable, measured in modules.
export function qrCode(x, y, size, quiet = 3) {
  const n = QR.length;
  const m = size / n;
  const pad = quiet * m;
  const g = el('g', {});
  g.appendChild(el('rect', {
    x: x - pad, y: y - pad, width: size + 2 * pad, height: size + 2 * pad,
    fill: COLOR.light,
  }));
  for (let r = 0; r < n; r++) {
    const row = QR[r];
    let c = 0;
    while (c < n) {
      if (row[c] !== '1') { c++; continue; }
      let run = 1;
      while (c + run < n && row[c + run] === '1') run++;
      g.appendChild(el('rect', {
        x: x + c * m, y: y + r * m, width: run * m, height: m, fill: COLOR.qr,
      }));
      c += run;
    }
  }
  return g;
}

// `avoid` is a box no line may cross — in practice the QR code in the corner of
// the page. A line at that height stops short of it; every other line is drawn
// to its full width. Without this, content would have to stop a whole band above
// the code and leave the rest of that band empty.
const clipped = (x, y, width, avoid) =>
  avoid && y >= avoid.y && y <= avoid.bottom && x + width > avoid.x
    ? Math.max(0, avoid.x - x)
    : width;

export const inside = (avoid, x, y) =>
  !!avoid && x >= avoid.x && x <= avoid.right && y >= avoid.y && y <= avoid.bottom;

// A run of text. `vcenter` puts the middle of the text on y instead of its
// baseline, which is what you want inside a table row.
export function text(str, x, y, {
  size = 11, fill = COLOR.label, anchor = 'start', weight = 'normal',
  vcenter = false,
} = {}) {
  const attrs = {
    x, y, fill, 'font-size': size, 'font-weight': weight,
    'font-family': 'Helvetica, Arial, sans-serif', 'text-anchor': anchor,
  };
  if (vcenter) attrs['dominant-baseline'] = 'central';
  return el('text', attrs, [document.createTextNode(str)]);
}

// A block of ruled writing lines, top-aligned at y.
export function rules(x, y, width, count, gap, avoid) {
  const g = el('g', {});
  for (let i = 0; i < count; i++) {
    const at = y + i * gap;
    const w = clipped(x, at, width, avoid);
    if (w > 0) g.appendChild(el('rect', { x, y: at, width: w, height: 1, fill: COLOR.rule }));
  }
  return g;
}

// The dotted horizontal rule the original used between sections.
export function dottedRule(x, y, width, step = 2, avoid) {
  const g = el('g', {});
  const w = clipped(x, y, width, avoid);
  for (let at = 0; at < w; at += step) {
    g.appendChild(el('rect', { x: x + at, y, width: 1, height: 1, fill: COLOR.separator }));
  }
  return g;
}

export function line(x, y, width, height, fill) {
  return el('rect', { x, y, width, height, fill });
}

// Grids are drawn from a single lattice anchored on a given origin, so that
// every region of a page shares one continuous grid rather than each starting
// its own. `rect` clips it to the region being filled.
export function lattice(originX, originY, pitch, rect, avoid) {
  const points = [];
  const i0 = Math.ceil((rect.x - originX) / pitch);
  const i1 = Math.floor((rect.x + rect.width - originX) / pitch);
  const j0 = Math.ceil((rect.y - originY) / pitch);
  const j1 = Math.floor((rect.y + rect.height - originY) / pitch);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = originX + i * pitch, y = originY + j * pitch;
      if (!inside(avoid, x, y)) points.push([x, y]);
    }
  }
  return points;
}

export function dotGrid(points, radius) {
  const g = el('g', {});
  for (const [cx, cy] of points)
    g.appendChild(el('circle', { cx, cy, r: radius, fill: COLOR.grid }));
  return g;
}

export function crosshairGrid(points, arm, weight) {
  const g = el('g', {});
  const h = arm / 2;
  for (const [cx, cy] of points) {
    g.appendChild(el('rect', { x: cx - h, y: cy - weight / 2, width: arm, height: weight, fill: COLOR.grid }));
    g.appendChild(el('rect', { x: cx - weight / 2, y: cy - h, width: weight, height: arm, fill: COLOR.grid }));
  }
  return g;
}

// The board is drawn on a 100-unit viewBox: an 84-unit playing area inside an
// 8-unit coordinate gutter. These convert a wanted square size into the box and
// gutter that produce it, which is how the board gets onto the lattice.
export const boxForSquare = (square) => square * 100 / 10.5;
export const gutterForSquare = (square) => square * 8 / 10.5;
