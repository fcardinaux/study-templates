// SVG building blocks shared by every template.
//
// Everything here emits explicit SVG geometry. That is deliberate: Chrome
// rasterises CSS gradients when printing to PDF, which is why the dot and
// crosshair grids in the first generation of these templates shipped as
// 72 dpi bitmaps while the rest of the page stayed vector.

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
};

// A board on a 100-unit viewBox: an 84-unit playing area inset by 8 units
// of gutter on each side, which is where the coordinates sit.
const GUTTER = 8;
const PLAY = 84;
const SQUARE = PLAY / 8;          // 10.5
const FILES = 'abcdefgh';

export function board(x, y, size) {
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

  const label = (text, cx, cy) => el('text', {
    x: cx, y: cy, fill: COLOR.label, 'font-size': 3.2, 'font-weight': 'bold',
    'font-family': 'Helvetica, Arial, sans-serif',
    'text-anchor': 'middle', 'dominant-baseline': 'central',
  }, [document.createTextNode(text)]);

  for (let f = 0; f < 8; f++) {
    const cx = GUTTER + (f + 0.5) * SQUARE;
    g.appendChild(label(FILES[f], cx, GUTTER / 2 + 0.5));
    g.appendChild(label(FILES[f], cx, GUTTER + PLAY + GUTTER / 2 - 0.5));
  }
  for (let r = 0; r < 8; r++) {
    const cy = GUTTER + (r + 0.5) * SQUARE;
    g.appendChild(label(String(8 - r), GUTTER / 2, cy));
    g.appendChild(label(String(8 - r), GUTTER + PLAY + GUTTER / 2, cy));
  }
  return g;
}

// A block of ruled writing lines, top-aligned at y.
export function rules(x, y, width, count, gap) {
  const g = el('g', {});
  for (let i = 0; i < count; i++) {
    const at = y + i * gap;
    g.appendChild(el('rect', { x, y: at, width, height: 1, fill: COLOR.rule }));
  }
  return g;
}

// The dotted horizontal rule the original used between sections.
export function dottedRule(x, y, width, step = 2) {
  const g = el('g', {});
  for (let at = 0; at < width; at += step) {
    g.appendChild(el('rect', { x: x + at, y, width: 1, height: 1, fill: COLOR.separator }));
  }
  return g;
}

export function line(x, y, width, height, fill) {
  return el('rect', { x, y, width, height, fill });
}

export function dotGrid(x, y, width, height, pitch, radius = 1.5) {
  const g = el('g', {});
  for (let cy = pitch / 2; cy < height; cy += pitch)
    for (let cx = pitch / 2; cx < width; cx += pitch)
      g.appendChild(el('circle', { cx: x + cx, cy: y + cy, r: radius, fill: COLOR.grid }));
  return g;
}

export function crosshairGrid(x, y, width, height, pitch, arm = 13, weight = 1) {
  const g = el('g', {});
  const h = arm / 2;
  for (let cy = pitch / 2; cy < height; cy += pitch) {
    for (let cx = pitch / 2; cx < width; cx += pitch) {
      const px = x + cx, py = y + cy;
      g.appendChild(el('rect', { x: px - h, y: py - weight / 2, width: arm, height: weight, fill: COLOR.grid }));
      g.appendChild(el('rect', { x: px - weight / 2, y: py - h, width: weight, height: arm, fill: COLOR.grid }));
    }
  }
  return g;
}
