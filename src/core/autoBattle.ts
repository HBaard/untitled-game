import { tileLuminance } from './board';
import type { Battle, BattleOutcome } from './turn';
import { requirePiece } from './turn';
import type { Cycle, GameState, Piece, PieceKind, Pos, Side } from './types';
import type { CombatStats } from './units';
import { UNITS } from './units';

/** Extra damage per hit when fighting on a square fully of your own colour. */
export const COLOR_BONUS = 1;
/** Speed and recovery are 1..6; time costs are SCALE_TOP - stat, so 6 -> 1 tick, 1 -> 6 ticks. */
const SCALE_TOP = 7;
/** Safety cap on simulated time; every fighter hits at least every 12 ticks. */
const MAX_TIME = 10_000;

export interface Fighter extends CombatStats {
  readonly hp: number;
}

export interface FightResult {
  readonly aHp: number;
  readonly dHp: number;
  readonly aHits: number;
  readonly dHits: number;
  /** Tick on which the last blow landed. */
  readonly time: number;
}

export interface BattleReport extends BattleOutcome {
  /** Per-hit damage after the colour bonus. */
  readonly attackerDamage: number;
  readonly defenderDamage: number;
  readonly attackerHits: number;
  readonly defenderHits: number;
  readonly time: number;
}

/** Ticks of wind-up before each hit. */
export const windUp = (f: CombatStats): number => SCALE_TOP - f.speed;

/** Ticks from one hit to the next: pause after the hit, then the next wind-up. */
export const hitInterval = (f: CombatStats): number => SCALE_TOP - f.recovery + windUp(f);

/** 1 on a square of your own colour, 0 on the enemy's, in between while shifting. */
export function colorAffinity(side: Side, square: Pos, cycle: Cycle): number {
  const light = tileLuminance(square, cycle);
  return side === 'light' ? light : 1 - light;
}

export const hitDamage = (damage: number, affinity: number): number =>
  damage + Math.round(COLOR_BONUS * affinity);

/** The shapeshifter takes its opponent's form: current HP and full combat profile. */
export function toFighter(piece: Piece, opponent: Piece): Fighter {
  const form = piece.kind === 'shapeshifter' ? opponent : piece;
  const { damage, speed, recovery } = UNITS[form.kind];
  return { hp: form.hp, damage, speed, recovery };
}

/**
 * Event-driven duel: whoever's next hit comes first lands it. Hits on the same tick
 * land together, so both can fall. Stops the moment either side is down.
 */
export function fightTimed(a: Fighter, d: Fighter): FightResult {
  let r = { aHp: a.hp, dHp: d.hp, aHits: 0, dHits: 0, time: 0 };
  let nextA = windUp(a);
  let nextD = windUp(d);
  while (r.aHp > 0 && r.dHp > 0 && r.time < MAX_TIME) {
    const t = Math.min(nextA, nextD);
    const aStrikes = nextA === t;
    const dStrikes = nextD === t;
    r = {
      aHp: dStrikes ? r.aHp - d.damage : r.aHp,
      dHp: aStrikes ? r.dHp - a.damage : r.dHp,
      aHits: r.aHits + (aStrikes ? 1 : 0),
      dHits: r.dHits + (dStrikes ? 1 : 0),
      time: t,
    };
    if (aStrikes) nextA += hitInterval(a);
    if (dStrikes) nextD += hitInterval(d);
  }
  return r;
}

/** A surviving shapeshifter returns to its own form, keeping damage up to its own max HP. */
export const boardHp = (kind: PieceKind, battleHp: number): number =>
  Math.min(battleHp, UNITS[kind].maxHp);

const withColor = (f: Fighter, side: Side, square: Pos, cycle: Cycle): Fighter =>
  ({ ...f, damage: hitDamage(f.damage, colorAffinity(side, square, cycle)) });

/** Resolves a battle using the square's colour as it is now, before the turn advances. */
export function autoBattle(state: GameState, battle: Battle): BattleReport {
  const attacker = requirePiece(state, battle.attackerId);
  const defender = requirePiece(state, battle.defenderId);
  const a = withColor(toFighter(attacker, defender), attacker.side, battle.square, state.cycle);
  const d = withColor(toFighter(defender, attacker), defender.side, battle.square, state.cycle);
  const r = fightTimed(a, d);
  return {
    attackerHp: boardHp(attacker.kind, r.aHp),
    defenderHp: boardHp(defender.kind, r.dHp),
    attackerDamage: a.damage,
    defenderDamage: d.damage,
    attackerHits: r.aHits,
    defenderHits: r.dHits,
    time: r.time,
  };
}
