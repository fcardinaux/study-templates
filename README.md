# Study Templates

Printable A4 templates for studying chess with pen and paper — blank boards paired
with room to write, so a position and the notes about it live on the same page.

All five are one-page PDFs. Print, annotate, repeat.

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](LICENSE)

---

## Chess

### One board, notes below

<img src="previews/chess-1-board-top-left.png" width="300" alt="One board in the top-left corner with ruled lines beside and below it">

A single board in the top-left corner, ruled lines to its right, and the rest of the
page ruled edge to edge. The most writing space of the set — for annotating one
position in depth: a game you are reviewing, a tactic you missed, an endgame you want
to reason through.

**[Download PDF](chess-1-board-top-left.pdf)**

### Three boards, left column

<img src="previews/chess-3-boards-left.png" width="300" alt="Three boards stacked down the left side, each with ruled lines to its right">

Three boards stacked down the left margin, each with its own block of ruled lines.
A steady left-to-right rhythm — diagram, then commentary — that suits three related
positions: an opening line at three branch points, or three puzzles in a row.

**[Download PDF](chess-3-boards-left.pdf)**

### Three boards, alternating

<img src="previews/chess-3-boards-alternate.png" width="300" alt="Three boards alternating left, right, left down the page with ruled lines opposite each">

The same three boards, alternating left–right–left down the page. The zig-zag makes
each position visually distinct from its neighbours, which helps when the three are
*not* a sequence but separate items you will scan back through later.

**[Download PDF](chess-3-boards-alternate.pdf)**

### Cornell layout, dot grid

<img src="previews/chess-cornell-dots.png" width="300" alt="Cornell note layout with a cue column, a board at the top of the main column, a dot grid, and a summary band">

The [Cornell note-taking layout](#about-the-cornell-layout) adapted for chess: a narrow
cue column on the left for questions and keywords, the board at the top of the main
column, and a summary band ruled off at the foot of the page. One grid runs across the
whole page, anchored on the crossing of the two rules, and the board's squares are
exactly one grid cell — so the dots, the rules and the board all line up.

**[Download PDF](chess-cornell-dots.pdf)**

### Cornell layout, crosshair grid

<img src="previews/chess-cornell-crosshairs.png" width="300" alt="The same Cornell layout with a crosshair tick grid instead of dots">

The same Cornell layout, and the same grid, with a crosshair in place of each dot. The
ticks give you horizontal and vertical alignment cues rather than single points — easier
to rule a straight line or draw a second board freehand, slightly busier on the page.

**[Download PDF](chess-cornell-crosshairs.pdf)**

---

## Printing

The PDFs are **A4** (210 × 297 mm).

In your print dialog, set the scale to **100%** — not "Fit to page" or "Shrink to
printable area". Scaling stretches the page to your printer's margins and the board
squares stop being square, which makes pieces sketched on them look lopsided.

On US Letter paper, 100% scale will clip a few millimetres off one edge. The board
itself sits well inside the margins, so nothing important is lost, but Letter-native
versions are not available yet.

## About the Cornell layout

Two of these templates follow the Cornell note-taking method — cue column, note-taking
area, summary — developed by Walter Pauk at Cornell University in the 1950s. The method
is used here on its merits as a note-taking structure.

These templates are not affiliated with, endorsed by, or connected to Cornell University.

## How these were made

Designed by [François Cardinaux](https://github.com/fcardinaux). The first generation
was produced with Google Gemini as HTML and CSS and printed to PDF from Chrome; the
PDFs are now generated from the source in `src/`.

## Building from source

Every PDF in this repository is generated. To change a template, edit the source and
rebuild — do not edit the PDFs.

```
./build.sh
```

That regenerates all five PDFs and refreshes the preview images. It needs Chrome
(set `CHROME=/path/to/chrome` if yours is not in the usual place) and Python 3,
which serves the sources locally because browsers will not load ES modules over
`file://`.

| File | What it holds |
| --- | --- |
| `src/lib.js` | The board, the ruled lines, and the dot and crosshair grids |
| `src/layouts.js` | The five page layouts, and every measurement they share |
| `src/render.html` | Draws one template at a given page size |

Each layout is a function of the page size, so a page of different proportions keeps
the same geometry and simply fits however many ruled lines the height allows.

Everything is drawn as explicit SVG rather than CSS backgrounds. That matters: Chrome
rasterises a CSS gradient when it prints, which is how the original dot and crosshair
grids ended up as 72 dpi bitmaps on an otherwise vector page.

## License

[Creative Commons Attribution 4.0 International](LICENSE) (CC BY 4.0).

Print them, share them, remix them, use them in a class or a coaching business — just
credit the source. Attribution suggestion:

> Study Templates by François Cardinaux — https://github.com/fcardinaux/study-templates — CC BY 4.0

One caveat, stated plainly: the layouts were produced with AI assistance, and a blank
8 × 8 grid with ruled lines is close to the floor of what copyright protects in the
first place. The licence covers whatever rights do exist in the design and arrangement,
and makes clear you are welcome to the rest.
