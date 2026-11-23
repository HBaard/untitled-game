// Slices the generated sprite sheet into a transparent 64px-cell atlas.
// Usage: node scripts/build-sprites.mjs [source.jpeg] [out.png]
// The source has a baked-in checkerboard "transparency", so the background is
// removed by flood-filling bright, unsaturated pixels inward from each crop edge
// (the sprites' dark outlines stop the fill).
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const SRC = process.argv[2] ?? 'art/sprite-sheet-source.jpeg';
const OUT = process.argv[3] ?? 'src/assets/sprites.png';
const CELL = 64;
const FIT = 60;
const ROWS = [
  { y0: 152, y1: 306, names: ['wizard', 'unicorn', 'knight', 'archer', 'valkyrie', 'golem', 'djinni', 'phoenix'] },
  { y0: 410, y1: 570, names: ['sorceress', 'dragon', 'shapeshifter', 'troll', 'goblin', 'banshee', 'manticore', 'basilisk'] },
];

// Enclosed background pockets (gaps between limbs, bow string, coils) that the
// edge flood fill can't reach. Source-image coordinates, picked by inspection.
const HOLE_SEEDS = [
  [640, 176], [640, 229], // archer: inside the bow
  [259, 286], [305, 270], [317, 270], // unicorn: between the legs
  [933, 223], [986, 223], // golem: between arms and torso
  [1273, 194], // phoenix: beside the head
  [77, 457], [82, 505], [88, 499], // sorceress: between staff and robe
  [264, 440], [270, 457], [235, 446], [329, 469], // dragon: neck and wing gaps
  [1291, 487], [1332, 528], // basilisk: inside the coils
];

// Parts painted out of a sprite, [x0, y0, x1, y1) in source coordinates. They read as
// background; any sprite pixel next to them is outlined so the cut edge looks drawn.
const ERASE = [
  // knight: its sword (the arena draws an animated one); the arm and fist stay
  [395, 150, 435, 227], // blade
  [395, 222, 416, 248], // crossguard and grip, left of the fist
  [416, 222, 441, 235], // crossguard, above the fist
  [395, 246, 434, 268], // grip and pommel below the fist
  [395, 230, 430, 258], // the outstretched fist; PAINT draws a hanging arm instead
];

// Pixels painted on top of the source, [x0, y0, x1, y1, rgb], later entries win.
// The knight gets a hanging sword arm in its own armour colours.
const INK = [0, 0, 0];
const ARMOUR = [197, 218, 237];
const ARMOUR_SHADE = [162, 182, 193];
const BAND = [234, 239, 184];
const GAUNTLET = [120, 150, 190];
const PAINT = [
  [425, 214, 436, 258, INK], // outline: left side and bottom of the arm
  [430, 219, 442, 246, ARMOUR],
  [430, 219, 434, 246, ARMOUR_SHADE],
  [430, 232, 442, 236, BAND], // elbow band, like the knee bands
  [429, 246, 443, 254, GAUNTLET],
  [425, 254, 443, 258, INK],
];
const paintAt = (x, y) => {
  for (let i = PAINT.length - 1; i >= 0; i--) {
    const [x0, y0, x1, y1, rgb] = PAINT[i];
    if (x >= x0 && x < x1 && y >= y0 && y < y1) return rgb;
  }
  return null;
};
const OUTLINE_PX = 4;
const inErase = (x, y) => ERASE.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);

const img = jpeg.decode(fs.readFileSync(SRC), { useTArray: true });
const { width: W, data: D } = img;
const rawPx = (x, y) => {
  const painted = paintAt(x, y);
  if (painted) return painted;
  if (inErase(x, y)) return [255, 255, 255];
  const i = (y * W + x) * 4;
  return [D[i], D[i + 1], D[i + 2]];
};

// Knight: the shield moves outward to the right, and the body it covered is rebuilt by
// mirroring the knight's left half (which brings along a mirrored arm holding it).
const KNIGHT_AXIS = 464; // source x of the knight's centre line
/** Tight outline of the shield: the pixels that move. */
const SHIELD = [[464, 209], [524, 209], [524, 261], [503, 278], [484, 278], [466, 259]];
/** Slightly wider area the mirrored body fills, so no trace of the old shield is left. */
const SHIELD_COVER = [[464, 209], [524, 209], [524, 261], [505, 281], [478, 281], [462, 262]];
const SHIELD_SHIFT = 10;

function insidePolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const isBackgroundPx = ([r, g, b]) => Math.min(r, g, b) > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 40;

const px = (x, y) => {
  const shieldX = x - SHIELD_SHIFT;
  if (insidePolygon(shieldX, y, SHIELD)) return rawPx(shieldX, y);
  if (insidePolygon(x, y, SHIELD_COVER)) return rawPx(2 * KNIGHT_AXIS - 1 - x, y);
  return rawPx(x, y);
};
const isForeground = ([r, g, b]) => Math.max(r, g, b) < 110 || Math.max(r, g, b) - Math.min(r, g, b) > 50;
const isBackground = isBackgroundPx;

function columnSpans(y0, y1) {
  const spans = [];
  let start = null;
  for (let x = 0; x <= W; x++) {
    let hit = false;
    for (let y = y0; x < W && y < y1 && !hit; y++) hit = isForeground(px(x, y));
    if (hit && start === null) start = x;
    if (!hit && start !== null) {
      if (x - start > 3) spans.push([start, x]);
      start = null;
    }
  }
  return spans;
}

/** Blackens visible pixels within OUTLINE_PX of an erased (now transparent) area. */
function outlineErasedEdges(out, w, h, x0, y0) {
  const erasedHole = (x, y) => x >= 0 && y >= 0 && x < w && y < h && out[(y * w + x) * 4 + 3] === 0 && inErase(x0 + x, y0 + y);
  const edge = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[(y * w + x) * 4 + 3] === 0 || paintAt(x0 + x, y0 + y)) continue;
      let near = false;
      for (let dy = -OUTLINE_PX; dy <= OUTLINE_PX && !near; dy++) {
        for (let dx = -OUTLINE_PX; dx <= OUTLINE_PX && !near; dx++) near = erasedHole(x + dx, y + dy);
      }
      if (near) edge.push((y * w + x) * 4);
    }
  }
  for (const i of edge) out.set([0, 0, 0], i);
}

/** Returns an RGBA crop with background flood-filled to alpha 0. */
function cutOut(x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0;
  const out = new Uint8ClampedArray(w * h * 4);
  const bg = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set([...px(x0 + x, y0 + y), 255], (y * w + x) * 4);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
  for (const [sx, sy] of HOLE_SEEDS) stack.push([sx - x0, sy - y0]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || bg[y * w + x]) continue;
    if (!isBackground(px(x0 + x, y0 + y))) continue;
    bg[y * w + x] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  for (let i = 0; i < w * h; i++) if (bg[i]) out[i * 4 + 3] = 0;
  outlineErasedEdges(out, w, h, x0, y0);
  return { w, h, out };
}

/** Alpha-weighted box downscale into a CELL x CELL tile, bottom-centred, hard alpha. */
function toCell({ w, h, out }) {
  const scale = FIT / Math.max(w, h);
  const tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
  const ox = Math.floor((CELL - tw) / 2), oy = CELL - th - 2;
  const cell = new Uint8ClampedArray(CELL * CELL * 4);
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const sx0 = Math.floor(tx / scale), sx1 = Math.max(sx0 + 1, Math.floor((tx + 1) / scale));
      const sy0 = Math.floor(ty / scale), sy1 = Math.max(sy0 + 1, Math.floor((ty + 1) / scale));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1 && sy < h; sy++) {
        for (let sx = sx0; sx < sx1 && sx < w; sx++) {
          const i = (sy * w + sx) * 4, al = out[i + 3] / 255;
          r += out[i] * al; g += out[i + 1] * al; b += out[i + 2] * al; a += al; n++;
        }
      }
      if (a / n < 0.5) continue;
      cell.set([r / a, g / a, b / a, 255], ((oy + ty) * CELL + ox + tx) * 4);
    }
  }
  return cell;
}

const cols = Math.max(...ROWS.map((r) => r.names.length));
const atlas = new PNG({ width: cols * CELL, height: ROWS.length * CELL });
const index = {};
ROWS.forEach((row, ri) => {
  const spans = columnSpans(row.y0, row.y1);
  if (spans.length !== row.names.length) throw new Error(`row ${ri}: found ${spans.length} sprites ${JSON.stringify(spans)}`);
  spans.forEach(([x0, x1], ci) => {
    const cell = toCell(cutOut(x0 - 2, row.y0 - 2, x1 + 2, row.y1 + 2));
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const s = (y * CELL + x) * 4, d = ((ri * CELL + y) * atlas.width + ci * CELL + x) * 4;
        for (let k = 0; k < 4; k++) atlas.data[d + k] = cell[s + k];
      }
    }
    index[row.names[ci]] = { col: ci, row: ri };
  });
});
fs.writeFileSync(OUT, PNG.sync.write(atlas));
console.log(`wrote ${OUT}`, JSON.stringify(index));
