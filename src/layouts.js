// The five templates, each a function of the page size in CSS pixels.
//
// Every measurement below is the A4 original, recovered from the first
// generation of PDFs. Layouts scale to the page width and then fit as many
// ruled lines as the height allows, so a page with a different aspect ratio
// keeps the same proportions instead of being letterboxed.

import { board, rules, dottedRule, line, lattice, dotGrid, crosshairGrid,
         qrCode, boxForSquare, gutterForSquare, COLOR } from './lib.js';

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
  qrSize: 60,           // ~16mm on A4, which keeps a 33-module code scannable
  qrGap: 14,            // clearance between the last content and the code
};

const scaled = (s) => Object.fromEntries(
  Object.entries(REF).map(([k, v]) => [k, k === 'rulesPerBlock' ? v : v * s]),
);

// The bottom of the usable area: the margin, less the room the QR needs. Keeping
// the reserve on every layout means no content can ever run under the code.
const usableBottom = (H, R) => H - R.margin - R.qrSize - R.qrGap;

const stampQr = (nodes, W, H, R) =>
  nodes.push(qrCode(W - R.margin - R.qrSize, H - R.margin - R.qrSize, R.qrSize));

// How many lines of a block fit above the bottom margin, capped at a full block.
const fit = (top, bottom, gap, max) =>
  Math.max(0, Math.min(max, Math.floor((bottom - top) / gap) + 1));

function boardRow(nodes, R, x, y, rulesX, rulesWidth, bottom, view) {
  nodes.push(board(x, y, R.boardSize, view));
  const top = y + R.rulesOffset;
  const n = fit(top, bottom, R.ruleGap, R.rulesPerBlock);
  if (n) nodes.push(rules(rulesX, top, rulesWidth, n, R.ruleGap));
  return n;
}

// One board top-left, then full-width ruled sections to the foot of the page.
function oneBoardTopLeft(W, H, view) {
  const s = W / A4.width, R = scaled(s);
  const content = W - 2 * R.margin;
  const bottom = usableBottom(H, R);
  const nodes = [];
  const rulesX = R.margin + R.boardSize + R.gutter;

  boardRow(nodes, R, R.margin, R.top, rulesX, content - R.boardSize - R.gutter, bottom, view);

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
  stampQr(nodes, W, H, R);
  return nodes;
}

// Three boards down the page; `sides` picks which margin each one sits against.
function threeBoards(W, H, sides, view) {
  const s = W / A4.width, R = scaled(s);
  const content = W - 2 * R.margin;
  const bottom = usableBottom(H, R);
  const rulesWidth = content - R.boardSize - R.gutter;
  const nodes = [];

  sides.forEach((side, i) => {
    const y = R.top + i * R.boardPitch;
    if (y + R.boardSize > H) return;
    const boardX = side === 'left' ? R.margin : W - R.margin - R.boardSize;
    const rulesX = side === 'left' ? R.margin + R.boardSize + R.gutter : R.margin;
    boardRow(nodes, R, boardX, y, rulesX, rulesWidth, bottom, view);
    // A separator sits between consecutive sections, so every row but the last.
    if (i < sides.length - 1) {
      const sepY = y + R.boardSize + R.leadAfterBoard - s;
      if (sepY < bottom) nodes.push(dottedRule(R.margin, sepY, content, 2 * s));
    }
  });
  stampQr(nodes, W, H, R);
  return nodes;
}

// Cornell layout: cue column, board at the head of the note column, summary band.
//
// One lattice spans the whole page, anchored on the crossing of the cue divider
// and the summary rule, so the grid registers with both. The board's square size
// is the lattice pitch and its playing area starts one cell right of the divider,
// which puts every square corner on a grid point.
function cornell(W, H, grid, view) {
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

  // Regions are the space between the rules, not including them, so no grid
  // point lands on the divider or the summary rule.
  const regions = [
    { x: R.margin, y: R.cornellTop, width: R.cueWidth - s, height: bodyBottom - R.cornellTop },
    { x: dividerX + s, y: R.cornellTop, width: W - R.margin - dividerX - s, height: bodyBottom - R.cornellTop },
    { x: R.margin, y: summaryY + s, width: content, height: Math.min(R.summaryHeight, usableBottom(H, R) - summaryY) },
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
  nodes.push(board(boardX, boardY, boardSize, view));
  stampQr(nodes, W, H, R);
  return nodes;
}

const dots = (points, pitch) => dotGrid(points, pitch * 0.045);
const crosshairs = (points, pitch) => crosshairGrid(points, pitch * 0.40, pitch * 0.030);

export const LAYOUTS = {
  'chess-1-board-top-left': oneBoardTopLeft,
  'chess-3-boards-left': (W, H, v) => threeBoards(W, H, ['left', 'left', 'left'], v),
  'chess-3-boards-alternate': (W, H, v) => threeBoards(W, H, ['left', 'right', 'left'], v),
  'chess-cornell-dots': (W, H, v) => cornell(W, H, dots, v),
  'chess-cornell-crosshairs': (W, H, v) => cornell(W, H, crosshairs, v),
};

// How the board is labelled. The squares are identical in all three.
export const VIEWS = {
  'white-view': { coordinates: true,  flipped: false },  // a1 bottom-left
  'black-view': { coordinates: true,  flipped: true  },  // h8 bottom-left
  'no-coords':  { coordinates: false, flipped: false },
};
