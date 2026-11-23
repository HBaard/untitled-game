import type { SpellId } from '../core/types';

/** Icons are 13x13 pixel grids; each character is a palette colour, '.' is transparent. */
export const ICON_SIZE = 13;

const PALETTE: Readonly<Record<string, string>> = {
  k: '#14101c', // outline
  w: '#ffffff',
  p: '#7a3fd0', // purple
  P: '#c69cff', // light purple
  r: '#d8282a', // red
  y: '#ffd23a', // gold
  n: '#8a5a2b', // brown
  b: '#2f6fd8', // blue
  B: '#8cc4ff', // light blue
  o: '#ff8a1e', // orange
  s: '#c0c6d0', // silver
  a: '#e8eef6', // air white
  e: '#9a7246', // earth brown
};

const BLANK = '.'.repeat(ICON_SIZE);

/** Arrow pointing right, five rows tall, drawn in colour c. */
const ARROW = ['........kk...', '..kkkkkkkck..', '..kccccccccck', '..kkkkkkkck..', '........kk...'];
const arrow = (c: string, flip: boolean): string[] =>
  ARROW.map((row) => (flip ? [...row].reverse().join('') : row).replaceAll('c', c));

/** Diamond split into the four elements' colours, outlined. */
function elementsDiamond(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < ICON_SIZE; y++) {
    let row = '';
    for (let x = 0; x < ICON_SIZE; x++) {
      const dx = x - 6;
      const dy = y - 6;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d > 6) row += '.';
      else if (d === 6 || dx === 0 || dy === 0) row += 'k';
      else row += dy < 0 ? (dx < 0 ? 'o' : 'b') : dx < 0 ? 'a' : 'e';
    }
    rows.push(row);
  }
  return rows;
}

export const ICONS: Readonly<Record<SpellId, readonly string[]>> = {
  teleport: [
    '....kkkkk....',
    '..kkpppppkk..',
    '.kppPPPPPppk.',
    '.kpPkkkkkPpk.',
    'kpPk.....kPpk',
    'kpPk..w..kPpk',
    'kpPk.www.kPpk',
    'kpPk..w..kPpk',
    'kpPk.....kPpk',
    '.kpPkkkkkPpk.',
    '.kppPPPPPppk.',
    '..kkpppppkk..',
    '....kkkkk....',
  ],
  heal: [
    BLANK,
    '....kkkkk....',
    '....kwwwk....',
    '....kwrwk....',
    '.kkkkwrwkkkk.',
    '.kwwwwrwwwwk.',
    '.kwrrrrrrrwk.',
    '.kwwwwrwwwwk.',
    '.kkkkwrwkkkk.',
    '....kwrwk....',
    '....kwwwk....',
    '....kkkkk....',
    BLANK,
  ],
  shiftTime: [
    '.kkkkkkkkkkk.',
    '.knnnnnnnnnk.',
    '..kyyyyyyyk..',
    '..kyyyyyyyk..',
    '...kyyyyyk...',
    '....kyyyk....',
    '.....kyk.....',
    '....k.y.k....',
    '...k..y..k...',
    '..k..yyy..k..',
    '..kyyyyyyyk..',
    '.knnnnnnnnnk.',
    '.kkkkkkkkkkk.',
  ],
  exchange: [BLANK, ...arrow('B', false), BLANK, ...arrow('o', true), BLANK],
  summonElemental: elementsDiamond(),
  revive: [
    '....kkkkk....',
    '...kyyyyyk...',
    '..kyk...kyk..',
    '..kyk...kyk..',
    '...kyk.kyk...',
    '.kkkkyyykkkk.',
    '.kyyyyyyyyyk.',
    '.kkkkyyykkkk.',
    '.....kyk.....',
    '.....kyk.....',
    '.....kyk.....',
    '.....kyk.....',
    '.....kkk.....',
  ],
  imprison: [
    '.kkkkkkkkkkk.',
    '.ksssssssssk.',
    '.ks.s.s.s.sk.',
    '.ks.s.s.s.sk.',
    '.ks.s.s.s.sk.',
    '.ks.s.s.s.sk.',
    '.ks.skkks.sk.',
    '.ks.kyyyk.sk.',
    '.ks.kykyk.sk.',
    '.ks.kyyyk.sk.',
    '.ks.s.s.s.sk.',
    '.ksssssssssk.',
    '.kkkkkkkkkkk.',
  ],
};

/** Same brightness, no colour: how a used or unavailable spell is shown. */
export function toGrey(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = Math.round(0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255));
  const g = Math.round(60 + lum * 0.45);
  return `rgb(${g},${g},${g})`;
}

/** Draws an icon with its top-left at (x, y), `px` screen pixels per icon pixel. */
export function drawIcon(ctx: CanvasRenderingContext2D, id: SpellId, x: number, y: number, px: number, grey: boolean): void {
  ICONS[id].forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const color = PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = grey ? toGrey(color) : color;
      ctx.fillRect(x + c * px, y + r * px, px, px);
    });
  });
}
