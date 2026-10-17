// The five templates, each a function of the page size in CSS pixels.
//
// Every measurement below is the A4 original, recovered from the first
// generation of PDFs. Layouts scale to the page width and then fit as many
// ruled lines as the height allows, so a page with a different aspect ratio
// keeps the same proportions instead of being letterboxed.

import { board, rules, dottedRule, line, text, lattice, dotGrid, crosshairGrid,
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
  qrSize: 60,           // ~16mm on A4, which keeps a 33-module code scannable
  qrGap: 14,            // clearance between the last content and the code

  // Scoresheet
  sheetBoard: 200,      // diagram for the position worth keeping
  fieldTop: 36,         // first header field, relative to the top margin
  fieldPitch: 44,       // header field to header field
  fieldLabel: 54,       // room for a field's label before its rule starts
  fieldRows: 4,         // count: White, Black, Event, Date
  headerGap: 34,        // header block to the move table
  colGap: 22,           // between the two halves of the move table
  numberWidth: 34,      // the move-number column inside a half
  textSize: 11,
  numberSize: 10,
  textGap: 6,           // a label's baseline above the rule it sits on
};

// Entries that count something rather than measure it, so they must not scale
// with the page. (`gridRows` is knowingly not in here — see the Cornell note.)
const COUNTS = new Set(['rulesPerBlock', 'fieldRows']);

const scaled = (s) => Object.fromEntries(
  Object.entries(REF).map(([k, v]) => [k, COUNTS.has(k) ? v : v * s]),
);

// Content runs to the bottom margin like any other edge of the page. The QR is
// the one obstacle, and it occupies a single corner, so layouts step around that
// box rather than stopping a whole band short of it and leaving the band empty.
// The box includes `qrGap` on the two sides content approaches from, which also
// covers the quiet zone the code is drawn with.
const qrBox = (W, H, R) => ({
  x: W - R.margin - R.qrSize - R.qrGap,
  y: H - R.margin - R.qrSize - R.qrGap,
  right: W - R.margin,
  bottom: H - R.margin,
});

const stampQr = (nodes, W, H, R) =>
  nodes.push(qrCode(W - R.margin - R.qrSize, H - R.margin - R.qrSize, R.qrSize));

// How many lines of a block fit above the bottom margin, capped at a full block.
const fit = (top, bottom, gap, max) =>
  Math.max(0, Math.min(max, Math.floor((bottom - top) / gap) + 1));

function boardRow(nodes, R, x, y, rulesX, rulesWidth, bottom, view, avoid) {
  nodes.push(board(x, y, R.boardSize, view));
  const top = y + R.rulesOffset;
  const n = fit(top, bottom, R.ruleGap, R.rulesPerBlock);
  if (n) nodes.push(rules(rulesX, top, rulesWidth, n, R.ruleGap, avoid));
  return n;
}

// One board top-left, then full-width ruled sections to the foot of the page.
function oneBoardTopLeft(W, H, view) {
  const s = W / A4.width, R = scaled(s);
  const content = W - 2 * R.margin;
  const bottom = H - R.margin;
  const avoid = qrBox(W, H, R);
  const nodes = [];
  const rulesX = R.margin + R.boardSize + R.gutter;

  boardRow(nodes, R, R.margin, R.top, rulesX, content - R.boardSize - R.gutter,
           bottom, view, avoid);

  let cursor = R.top + R.boardSize - s;
  let lead = R.leadAfterBoard;
  let blocks = 0;
  while (true) {
    const sepY = cursor + lead;
    const top = sepY + R.afterSeparator;
    const n = fit(top, bottom, R.ruleGap, R.rulesPerBlock);
    if (n < 2) break;
    nodes.push(dottedRule(R.margin, sepY, content, 2 * s, avoid));
    nodes.push(rules(R.margin, top, content, n, R.ruleGap, avoid));
    cursor = top + (n - 1) * R.ruleGap;
    lead = R.leadAfterBlock;
    blocks++;
  }

  // What is left at the foot is too short for another separated block, but it is
  // still writing space: the last block runs on at the same pitch to the bottom
  // margin instead of ending a block early and leaving the band blank.
  if (blocks) {
    for (let at = cursor + R.ruleGap; at <= bottom; at += R.ruleGap) {
      nodes.push(rules(R.margin, at, content, 1, R.ruleGap, avoid));
    }
  }

  stampQr(nodes, W, H, R);
  return nodes;
}

// Three boards down the page; `sides` picks which margin each one sits against.
//
// Scaling to the page width alone would push the last board off the foot of a
// page that is proportionally shorter than A4 — on US Letter it left 3.5mm below
// the bottom coordinates, inside the unprintable edge of most printers. So the
// scale is also capped at the point where that board keeps a full bottom margin:
// a short page gets slightly smaller boards rather than clipped ones. A board in
// the right-hand column has to clear the QR code too; one on the left sits beside
// it and does not.
function threeBoards(W, H, sides, view) {
  const foot = REF.margin +
    (sides[sides.length - 1] === 'right' ? REF.qrSize + REF.qrGap : 0);
  const span = REF.top + (sides.length - 1) * REF.boardPitch + REF.boardSize + foot;
  const s = Math.min(W / A4.width, H / span), R = scaled(s);
  const content = W - 2 * R.margin;
  const bottom = H - R.margin;
  const avoid = qrBox(W, H, R);
  const rulesWidth = content - R.boardSize - R.gutter;
  const nodes = [];

  sides.forEach((side, i) => {
    const y = R.top + i * R.boardPitch;
    if (y + R.boardSize > H) return;
    const boardX = side === 'left' ? R.margin : W - R.margin - R.boardSize;
    const rulesX = side === 'left' ? R.margin + R.boardSize + R.gutter : R.margin;
    boardRow(nodes, R, boardX, y, rulesX, rulesWidth, bottom, view, avoid);
    // A separator sits between consecutive sections, so every row but the last.
    if (i < sides.length - 1) {
      const sepY = y + R.boardSize + R.leadAfterBoard - s;
      if (sepY < bottom) nodes.push(dottedRule(R.margin, sepY, content, 2 * s, avoid));
    }
  });

  // Past the foot of the last board the page is clear from margin to margin, so
  // the ruled lines carry on across the full width at the same pitch instead of
  // ending in a blank band. They keep the last block's rhythm, so the lines beside
  // the board and the lines below it read as one column of writing.
  const last = R.top + (sides.length - 1) * R.boardPitch;
  const clearOf = last + R.boardSize + R.leadAfterBoard;
  for (let i = R.rulesPerBlock; ; i++) {
    const at = last + R.rulesOffset + i * R.ruleGap;
    if (at > bottom) break;
    if (at >= clearOf) nodes.push(rules(R.margin, at, content, 1, R.ruleGap, avoid));
  }

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
    { x: R.margin, y: summaryY + s, width: content, height: H - R.margin - summaryY - s },
  ];

  const avoid = qrBox(W, H, R);
  const nodes = [];
  for (const rect of regions) {
    const points = lattice(dividerX, summaryY, pitch, rect, avoid);
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

// A scoresheet: who played, a diagram of the position worth keeping, and two
// columns of numbered moves. The one template here that records a game rather
// than annotating a position, and the one most likely to be printed.
//
// The move rows share the ruled-line pitch of the other layouts, so a page holds
// as many moves as the page height allows: 50 on A4, fewer on a shorter page.
function scoresheet(W, H, view) {
  const s = W / A4.width, R = scaled(s);
  const content = W - 2 * R.margin;
  const bottom = H - R.margin;
  const avoid = qrBox(W, H, R);
  const nodes = [];

  const small = { size: R.numberSize, fill: COLOR.gridline };

  // Header: the players and the occasion on the left, the diagram on the right.
  const boardX = W - R.margin - R.sheetBoard;
  nodes.push(board(boardX, R.top, R.sheetBoard, view));

  const fieldEnd = boardX - R.colGap;
  ['White', 'Black', 'Event', 'Date'].forEach((name, i) => {
    const y = R.top + R.fieldTop + i * R.fieldPitch;
    nodes.push(text(name, R.margin, y - R.textGap, { size: R.textSize }));
    nodes.push(line(R.margin + R.fieldLabel, y,
                    fieldEnd - R.margin - R.fieldLabel, 1, COLOR.rule));
  });

  // The move table: two halves, each a move number and a cell per player. The
  // numbers run down the first half and continue down the second.
  const tableTop = R.top + R.sheetBoard + R.headerGap;
  const rows = Math.floor((avoid.y - tableTop) / R.ruleGap);
  const half = (content - R.colGap) / 2;
  const cell = (half - R.numberWidth) / 2;

  [R.margin, R.margin + half + R.colGap].forEach((x0, c) => {
    nodes.push(text('White', x0 + R.numberWidth + cell / 2, tableTop - R.textGap,
                    { ...small, anchor: 'middle' }));
    nodes.push(text('Black', x0 + R.numberWidth + cell * 1.5, tableTop - R.textGap,
                    { ...small, anchor: 'middle' }));

    for (let i = 0; i <= rows; i++) {
      nodes.push(line(x0, tableTop + i * R.ruleGap, half, 1, COLOR.rule));
    }
    for (const dx of [0, R.numberWidth, R.numberWidth + cell, half]) {
      nodes.push(line(x0 + dx, tableTop, 1, rows * R.ruleGap, COLOR.separator));
    }
    for (let i = 0; i < rows; i++) {
      nodes.push(text(String(c * rows + i + 1),
                      x0 + R.numberWidth - R.textGap,
                      tableTop + (i + 0.5) * R.ruleGap,
                      { ...small, anchor: 'end', vcenter: true }));
    }
  });

  // The result belongs at the end of a game, so it sits at the foot of the page,
  // in the band beside the code rather than in the header.
  const resultY = (avoid.y + bottom) / 2;
  nodes.push(text('Result', R.margin, resultY - R.textGap, { size: R.textSize }));
  nodes.push(rules(R.margin + R.fieldLabel, resultY, content - R.fieldLabel,
                   1, R.ruleGap, avoid));

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
  'chess-scoresheet': scoresheet,
};

// Human-readable names, used for the PDF title. A note app lists a file by its
// title, so every file names its own layout, view and page size there as well as
// in its filename.
export const TITLES = {
  'chess-1-board-top-left': 'one board, notes below',
  'chess-3-boards-left': 'three boards, left column',
  'chess-3-boards-alternate': 'three boards, alternating',
  'chess-cornell-dots': 'Cornell layout, dot grid',
  'chess-cornell-crosshairs': 'Cornell layout, crosshair grid',
  'chess-scoresheet': 'scoresheet',
};

// How the board is labelled. The squares are identical in all three.
export const VIEWS = {
  'white-view': { coordinates: true,  flipped: false },  // a1 bottom-left
  'black-view': { coordinates: true,  flipped: true  },  // h8 bottom-left
  'no-coords':  { coordinates: false, flipped: false },
};
