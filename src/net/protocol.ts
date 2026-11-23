import type { MoveAction } from '../app/boardInput';
import type { ArenaInput } from '../combat/controls';
import type { SpellCast } from '../core/spells';
import type { Side } from '../core/types';

/** Board-level actions. The server echoes them to both players in one order, and both apply them. */
export type GameAction =
  | MoveAction
  | { readonly type: 'spell'; readonly cast: SpellCast }
  | { readonly type: 'newGame' };

export type ClientMessage =
  | { readonly type: 'action'; readonly action: GameAction }
  /** This player's arena input for one tick of arena number `arena`. */
  | { readonly type: 'input'; readonly arena: number; readonly tick: number; readonly input: ArenaInput };

export type ServerMessage =
  | { readonly type: 'welcome'; readonly side: Side }
  | { readonly type: 'full' }
  /** Both players are connected: start a fresh game. */
  | { readonly type: 'start' }
  | { readonly type: 'opponentLeft' }
  | { readonly type: 'action'; readonly action: GameAction }
  | { readonly type: 'input'; readonly arena: number; readonly tick: number; readonly input: ArenaInput };

/** Path the game server accepts WebSocket connections on. */
export const WS_PATH = '/ws';
