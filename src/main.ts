import { runArena } from './arenaScreen';
import { clickTile, finishBattle, highlightedMoves, initialUi, selectedPiece } from './app/boardInput';
import type { BattleSummary, BoardUi } from './app/boardInput';
import { arenaOutcome, createArena } from './combat/arena';
import { CYCLE_MAX, tileLuminance } from './core/board';
import type { Battle } from './core/turn';
import { createInitialState } from './core/setup';
import { UNITS } from './core/units';
import { BOARD_PX, drawBoard, lerpColor, pixelToTile } from './render/boardView';
import { loadSpriteSheet } from './render/sprites';

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const ctx = canvas.getContext('2d')!;
const status = document.querySelector<HTMLElement>('#status')!;
const battlePanel = document.querySelector<HTMLElement>('#battle')!;
const battleText = document.querySelector<HTMLElement>('#battle-text')!;

canvas.width = BOARD_PX;
canvas.height = BOARD_PX;

let ui: BoardUi = initialUi(createInitialState());
let sprites: HTMLImageElement | null = null;

function describeStatus(state: BoardUi['game']): string {
  if (state.winner) return state.winner === 'draw' ? 'Draw!' : `${state.winner.toUpperCase()} wins!`;
  const phase = state.cycle.level / CYCLE_MAX;
  const trend = state.cycle.rising ? 'brightening' : 'darkening';
  return `Turn ${state.turnNumber} · ${state.turn.toUpperCase()} to move · shifting tiles ${Math.round(phase * 100)}% light, ${trend}`;
}

const fighterResult = (name: string, hp: number): string =>
  hp > 0 ? `${name} survives with ${hp} HP` : `${name} falls`;

function describeBattle({ attacker, defender, outcome }: BattleSummary): string {
  const a = UNITS[attacker.kind].name;
  const d = UNITS[defender.kind].name;
  return `${a} (${attacker.hp} HP) attacked ${d} (${defender.hp} HP): `
    + `${fighterResult(a, outcome.attackerHp)}, ${fighterResult(d, outcome.defenderHp)}.`;
}

function startBattle(battle: Battle): void {
  const floor = lerpColor(tileLuminance(battle.square, ui.game.cycle));
  runArena(createArena(ui.game, battle), { sprites, floor }, (final) => {
    ui = finishBattle(ui, arenaOutcome(final)!);
    render();
  });
}

function render(): void {
  drawBoard(ctx, {
    pieces: ui.game.pieces,
    cycle: ui.game.cycle,
    selected: selectedPiece(ui),
    moves: highlightedMoves(ui),
    sprites,
  });
  status.textContent = describeStatus(ui.game);
  battlePanel.hidden = !ui.lastBattle;
  if (ui.lastBattle) battleText.textContent = describeBattle(ui.lastBattle);
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const before = ui;
  ui = clickTile(ui, pixelToTile((e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale));
  render();
  if (ui.pendingBattle && !before.pendingBattle) startBattle(ui.pendingBattle);
});

document.querySelector('#new-game')!.addEventListener('click', () => {
  if (ui.pendingBattle) return;
  ui = initialUi(createInitialState());
  render();
});

render();
void loadSpriteSheet().then((img) => {
  sprites = img;
  render();
});
