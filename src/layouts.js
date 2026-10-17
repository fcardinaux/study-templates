// The five templates, each a function of the page size in CSS pixels.
//
// Every measurement below is the A4 original, recovered from the first
// generation of PDFs. Layouts scale to the page width and then fit as many
// ruled lines as the height allows, so a page with a different aspect ratio
// keeps the same proportions instead of being letterboxed.

import { board, rules, dottedRule, line, lattice, dotGrid, crosshairGrid,
         boxForSquare, gutterForSquare, COLOR } from './lib.js';

export const A4 = { width: 795, height: 1124 };

const REF = {
  margin: 46,
  top: 42,
  cornellTop: 38,
  boardSize: 310,
  ruleGap: 260 / 9,     // 10 lines spanning 260px
  rulesPerBlock: 10,
  gutter: 15,           // board to adjacent rules
  rulesOffset: 37,      // first rule, relative to the board top
  boardPitch: 332,      // board to board, stacked
  leadAfterBoard: 15,
  leadAfterBlock: 26,
  afterSeparator: 46,
  gridRows: 23,          // lattice rows between the top margin and the summary rule
  cueWidth: 218,
  cornellHeight: 756,
  summaryRule: 824,
  summaryHeight: 195,
};

const scaled = (s) => Object.fromEntries(
  Object.entries(REF).map(([k, v]) => [k, k === 'rulesPerBlock' ? v : v * s]),
);

// How many lines of a block fit above the bottom margin, capped at a full block.
const fit = (top, bottom, gap, max) =>
  Math.max(0, Math.min(max, Math.floor((bottom - top) / gap) + 1));

function boardRow(nodes, R, x, y, rulesX, rulesWidth, bottom) {
  nodes.push(board(x, y, R.boardSize));
  const top = y + R.rulesOffset;
  const n = fit(top, bottom, R.ruleGap, R.rulesPerBlock);
  if (n) nodes.push(rules(rulesX, top, rulesWidth, n, R.ruleGap));
  return n;
}

// One board top-left, then full-width ruled sections to the foot of the page.
function oneBoardTopLeft(W, H) {
  const s = W / A4.width, R = scaled(s);
  const content = W - 2 * R.margin;
  const bottom = H - R.margin;
  const nodes = [];
  const rulesX = R.margin + R.boardSize + R.gutter;

  boardRow(nodes, R, R.margin, R.top, rulesX, content - R.boardSize - R.gutter, bottom);

  let cursor = R.top + R.boardSize - s;
  let lead = R.leadAfterBoard;
  while (true) {
    const sepY = cursor + lead;
    const top = sepY + R.afterSeparator;
    const n = fit(top, bottom, R.ruleGap, R.rulesPerBlock);
    if (n < 2) break;
    nodes.push(dottedRule(R.margin, sepY, content, 2 * s));
    nodes.push(rules(R.margin, top, content, n, R.ruleGap));
    cursor = top + (n - 1) * R.ruleGap;
    lead = R.leadAfterBlock;
  }
  return nodes;
}

// Three boards down the page; `sides` picks which margin each one sits against.
function threeBoards(W, H, sides) {
  const s = W / A4.width, R = scaled(s);
  const content = W - 2 * R.margin;
  const bottom = H - R.margin;
  const rulesWidth = content - R.boardSize - R.gutter;
  const nodes = [];

  sides.forEach((side, i) => {
    const y = R.top + i * R.boardPitch;
    if (y + R.boardSize > H) return;
    const boardX = side === 'left' ? R.margin : W - R.margin - R.boardSize;
    const rulesX = side === 'left' ? R.margin + R.boardSize + R.gutter : R.margin;
    boardRow(nodes, R, boardX, y, rulesX, rulesWidth, bottom);
    // The original carries a separator after the first block only.
    if (i === 0) {
      const sepY = y + R.boardSize + R.leadAfterBoard - s;
      if (sepY < bottom) nodes.push(dottedRule(R.margin, sepY, content, 2 * s));
    }
  });
  return nodes;
}

// Cornell layout: cue column, board at the head of the note column, summary band.
//
// One lattice spans the whole page, anchored on the crossing of the cue divider
// and the summary rule, so the grid registers with both. The board's square size
// is the lattice pitch and its playing area starts one cell right of the divider,
// which puts every square corner on a grid point.
function cornell(W, H, grid) {
  const s = W / A4.width, R = scaled(s);
  const content = W - 2 * R.margin;
  const dividerX = R.margin + R.cueWidth;
  const summaryY = R.summaryRule;
  const bodyBottom = R.cornellTop + R.cornellHeight;

  const pitch = (summaryY - R.cornellTop) / (R.gridRows + 8 / 10.5);
  const boardSize = boxForSquare(pitch);
  const gutter = gutterForSquare(pitch);
  const boardX = dividerX + pitch - gutter;
  const boardY = R.cornellTop;

  const regions = [
    { x: R.margin, y: R.cornellTop, width: R.cueWidth, height: bodyBottom - R.cornellTop },
    { x: dividerX + s, y: R.cornellTop, width: W - R.margin - dividerX - s, height: bodyBottom - R.cornellTop },
    { x: R.margin, y: summaryY + s, width: content, height: Math.min(R.summaryHeight, H - R.margin - summaryY) },
  ];

  const nodes = [];
  for (const rect of regions) {
    const points = lattice(dividerX, summaryY, pitch, rect);
    nodes.push(grid(points, pitch));
  }

  nodes.push(line(dividerX, R.cornellTop, s, bodyBottom - R.cornellTop, COLOR.divider));
  nodes.push(line(R.margin, summaryY, content, s, COLOR.divider));

  // The board sits on an opaque panel so the grid does not show through it.
  nodes.push(line(boardX, boardY, boardSize, boardSize, COLOR.light));
  nodes.push(board(boardX, boardY, boardSize));
  return nodes;
}

const dots = (points, pitch) => dotGrid(points, pitch * 0.045);
const crosshairs = (points, pitch) => crosshairGrid(points, pitch * 0.40, pitch * 0.030);

export const LAYOUTS = {
  'chess-1-board-top-left': oneBoardTopLeft,
  'chess-3-boards-left': (W, H) => threeBoards(W, H, ['left', 'left', 'left']),
  'chess-3-boards-alternate': (W, H) => threeBoards(W, H, ['left', 'right', 'left']),
  'chess-cornell-dots': (W, H) => cornell(W, H, dots),
  'chess-cornell-crosshairs': (W, H) => cornell(W, H, crosshairs),
};
