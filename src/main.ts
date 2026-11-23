import type { ArenaDriver } from './arenaScreen';
import { hotSeatDriver, runArena } from './arenaScreen';
import {
  applyMoveAction, applySpellCast, finishBattle, highlightedMoves, initialUi, planClick, selectedPiece,
} from './app/boardInput';
import type { ClickResult } from './app/boardInput';
import {
  cancelSpell, chooseFallen, spellPrompt, spellTargets, startSpell,
} from './app/spellInput';
import type { WheelSlot } from './app/spellWheel';
import { closeWheel, slotAt, wheelSlots } from './app/spellWheel';
import type { BattleSummary, BoardUi } from './app/boardInput';
import { arenaOutcome, createArena } from './combat/arena';
import { CYCLE_MAX, tileLuminance } from './core/board';
import { createInitialState } from './core/setup';
import { SPELLS, casterOf } from './core/spells';
import type { Battle } from './core/turn';
import type { Side } from './core/types';
import { opposite } from './core/types';
import { UNITS } from './core/units';
import type { Connection } from './net/connection';
import { connect, isOnlinePage } from './net/connection';
import { InputBook, onlineDriver } from './net/onlineArena';
import type { GameAction, ServerMessage } from './net/protocol';
import { BOARD_PX, TILE, drawBoard, lerpColor, pixelToTile } from './render/boardView';
import { loadSpriteSheet } from './render/sprites';

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const ctx = canvas.getContext('2d')!;
const status = document.querySelector<HTMLElement>('#status')!;
const battlePanel = document.querySelector<HTMLElement>('#battle')!;
const battleText = document.querySelector<HTMLElement>('#battle-text')!;
const arenaHelp = document.querySelector<HTMLElement>('.arena-help')!;
const spellPanel = document.querySelector<HTMLElement>('#spells')!;
const spellTitle = document.querySelector<HTMLElement>('#spell-title')!;
const spellActions = document.querySelector<HTMLElement>('#spell-actions')!;
const spellPromptEl = document.querySelector<HTMLElement>('#spell-prompt')!;

canvas.width = BOARD_PX;
canvas.height = BOARD_PX;

/** Network play state; null when playing hot-seat on one keyboard. */
interface Online {
  conn: Connection;
  readonly book: InputBook;
  side: Side | null;
  /** Both players connected and the game started. */
  ready: boolean;
  notice: string | null;
}

let ui: BoardUi = initialUi(createInitialState());
let sprites: HTMLImageElement | null = null;
/** Counts games so arena numbers never repeat; both players count the same 'start'/'newGame' actions. */
let gameNumber = 0;
let stopArena: (() => void) | null = null;
let online: Online | null = null;

function describeGame(state: BoardUi['game']): string {
  if (state.winner) return state.winner === 'draw' ? 'Draw!' : `${state.winner.toUpperCase()} wins!`;
  const phase = state.cycle.level / CYCLE_MAX;
  const trend = state.cycle.rising ? 'brightening' : 'darkening';
  return `Turn ${state.turnNumber} · ${state.turn.toUpperCase()} to move · shifting tiles ${Math.round(phase * 100)}% light, ${trend}`;
}

function describeStatus(): string {
  if (!online) return describeGame(ui.game);
  if (online.notice) return online.notice;
  if (!online.side) return 'Connecting to the game server…';
  const you = `You are ${online.side.toUpperCase()}`;
  if (!online.ready) return `${you} · waiting for an opponent to join…`;
  const whose = ui.game.winner ? '' : ui.game.turn === online.side ? ' · your move' : ' · opponent’s move';
  return `${you}${whose} · ${describeGame(ui.game)}`;
}

const fighterResult = (name: string, hp: number): string =>
  hp > 0 ? `${name} survives with ${hp} HP` : `${name} falls`;

function describeBattle({ attacker, defender, outcome }: BattleSummary): string {
  const a = UNITS[attacker.kind].name;
  const d = UNITS[defender.kind].name;
  return `${a} (${attacker.hp} HP) attacked ${d} (${defender.hp} HP): `
    + `${fighterResult(a, outcome.attackerHp)}, ${fighterResult(d, outcome.defenderHp)}.`;
}

function render(): void {
  drawBoard(ctx, {
    pieces: ui.game.pieces,
    cycle: ui.game.cycle,
    selected: selectedPiece(ui),
    moves: highlightedMoves(ui),
    spellTargets: spellTargets(ui),
    wheel: myTurn() ? currentWheel() : [],
    spellPicked: ui.spell?.pieceId ? ui.game.pieces.find((p) => p.id === ui.spell!.pieceId) ?? null : null,
    sprites,
  });
  renderSpellPanel();
  status.textContent = describeStatus();
  battlePanel.hidden = !ui.lastBattle;
  if (ui.lastBattle) battleText.textContent = describeBattle(ui.lastBattle);
}

const currentWheel = (): WheelSlot[] => wheelSlots(ui, TILE, BOARD_PX);

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** Lists the caster's 7 spells (used or out of targets: crossed out), plus Revive's fallen pieces. */
/** A one-line prompt under the board while the wheel is open or a spell is being aimed. */
function renderSpellPanel(): void {
  spellPanel.hidden = !(myTurn() && (ui.wheel || ui.spell));
  if (spellPanel.hidden) return;
  const side = ui.game.turn;
  const caster = casterOf(ui.game, side);
  const left = SPELLS.length - ui.game.spellsUsed[side].length;
  spellTitle.textContent = `${caster ? UNITS[caster.kind].name : 'Caster'}: ${left} of ${SPELLS.length} spells left`;
  spellPromptEl.textContent = ui.spell
    ? `${spellPrompt(ui)} · Esc to cancel`
    : 'Pick a spell (casting uses your turn). Grey: used or nothing to cast on. Click the caster again to deselect.';
  spellActions.replaceChildren(...(ui.spell ? [button('Cancel', () => setUi(cancelSpell(ui)))] : []));
}

function arenaDriver(arenaId: number): ArenaDriver {
  if (!online?.side) return hotSeatDriver;
  const { conn, book, side } = online;
  return onlineDriver(arenaId, side, book, (tick, input) => conn.send({ type: 'input', arena: arenaId, tick, input }));
}

function startBattle(battle: Battle): void {
  const arenaId = gameNumber * 10_000 + ui.game.turnNumber;
  const floor = lerpColor(tileLuminance(battle.square, ui.game.cycle));
  stopArena = runArena(createArena(ui.game, battle), { sprites, floor }, arenaDriver(arenaId), (final) => {
    stopArena = null;
    online?.book.close(arenaId);
    setUi(finishBattle(ui, arenaOutcome(final)!));
  });
}

/** Every board change goes through here, so a new attack always opens the arena. */
function setUi(next: BoardUi): void {
  const battleStarts = next.pendingBattle !== null && ui.pendingBattle === null;
  ui = next;
  render();
  if (battleStarts) startBattle(next.pendingBattle!);
}

function newGame(): void {
  stopArena?.();
  stopArena = null;
  gameNumber++;
  setUi(initialUi(createInitialState()));
}

function applyAction(action: GameAction): void {
  if (action.type === 'newGame') return newGame();
  try {
    setUi(action.type === 'spell' ? applySpellCast(ui, action.cast) : applyMoveAction(ui, action));
  } catch (err) {
    console.warn('Ignored an action that is not legal here', action, err); // e.g. a double-click sent twice
  }
}

/** Hot-seat plays an action at once; online sends it and plays it when the server echoes it to both. */
function submit(action: GameAction): void {
  if (online) online.conn.send({ type: 'action', action });
  else applyAction(action);
}

const myTurn = (): boolean => !online || (online.ready && ui.game.turn === online.side);

/** Selections stay local; moves and spells are submitted (and, online, sent to both players). */
function play(r: ClickResult): void {
  if (r.kind === 'select') setUi(r.ui);
  else if (r.kind === 'move') submit(r.action);
  else submit({ type: 'spell', cast: r.cast });
}

function showOnlineKeys(side: Side): void {
  arenaHelp.innerHTML = `<span>You are the ${side.toUpperCase()} fighter: `
    + '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> (or <kbd>I</kbd><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd>) move · '
    + '<kbd>G</kbd> (or <kbd>Ä</kbd>) fire</span>';
}

function onServerMessage(o: Online, msg: ServerMessage): void {
  switch (msg.type) {
    case 'welcome':
      o.side = msg.side;
      showOnlineKeys(msg.side);
      break;
    case 'full':
      o.notice = 'This game already has two players.';
      break;
    case 'start':
      o.ready = true;
      o.notice = null;
      newGame();
      return;
    case 'opponentLeft':
      o.ready = false;
      stopArena?.();
      stopArena = null;
      break;
    case 'action':
      applyAction(msg.action);
      return;
    case 'input':
      if (o.side) o.book.record(msg.arena, opposite(o.side), msg.tick, msg.input);
      return;
  }
  render();
}

function goOnline(): void {
  const o: Online = { conn: { send: () => undefined }, book: new InputBook(), side: null, ready: false, notice: null };
  o.conn = connect((msg) => onServerMessage(o, msg), () => {
    o.ready = false;
    o.notice = o.notice ?? 'Lost the connection to the game server. Reload to rejoin.';
    stopArena?.();
    stopArena = null;
    render();
  });
  online = o;
}

canvas.addEventListener('click', (e) => {
  if (!myTurn()) return;
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const x = (e.clientX - rect.left) * scale;
  const y = (e.clientY - rect.top) * scale;
  const slot = slotAt(currentWheel(), x, y, TILE);
  if (slot) return pickFromWheel(slot);
  play(planClick(ui, pixelToTile(x, y)));
});

/** The wheel sits over the board, so its squares take clicks first. Grey squares do nothing. */
function pickFromWheel({ item }: WheelSlot): void {
  if (item.kind === 'fallen') setUi(chooseFallen(ui, item.piece.id));
  else if (item.enabled) play(startSpell(ui, item.spell));
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.spell) setUi(cancelSpell(ui));
  else if (e.key === 'Escape' && ui.wheel) setUi(closeWheel(ui));
});

document.querySelector('#new-game')!.addEventListener('click', () => {
  if (ui.pendingBattle || (online && !online.ready)) return;
  submit({ type: 'newGame' });
});

if (isOnlinePage()) goOnline();
render();
void loadSpriteSheet().then((img) => {
  sprites = img;
  render();
});
