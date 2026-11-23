import { describe, expect, it } from 'vitest';
import { SPELLS } from '../core/spells';
import { ICONS, ICON_SIZE, toGrey } from './spellIcons';

describe('spell icons', () => {
  it('every spell has a square 13x13 icon', () => {
    for (const id of SPELLS) {
      const icon = ICONS[id];
      expect(icon, id).toHaveLength(ICON_SIZE);
      for (const row of icon) expect(row, `${id}: "${row}"`).toHaveLength(ICON_SIZE);
    }
  });

  it('grey keeps brightness order', () => {
    const level = (c: string) => Number(/rgb\((\d+)/.exec(c)![1]);
    expect(level(toGrey('#ffffff'))).toBeGreaterThan(level(toGrey('#14101c')));
  });
});
