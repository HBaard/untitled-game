# Project: Archon
Goal is to make a working game, a version of the old game Archon from 1983, here is a short descrption

The Board (Strategy Phase): You play on a 9x9 grid as either Light (Knights, Archers, Golems, Valkyries, Unicorns, and the Wizard) or Dark (Goblins, Manticoras, Trolls, Banshees, Dragons, and the Sorceress).

The Combat (Action Phase): When your piece enters a square occupied by an opponent's piece, the game shifts to a separate real-time battle arena.
The outcome wasn't predetermined: a weak piece like a Goblin could technically defeat a powerful Dragon if the player had fast reactions and dodged attacks.
Damage was persistent� if a unit survived a battle, it kept its lowered HP for future fights unless healed.
Shifting Board Tiles: The colors of certain tiles slowly cycled between light, dark, and gray over time. Fighting on a tile matching your side's color gave your piece extra health and advantage.
Spells & Victory: Leaders (Wizard and Sorceress) could cast powerful spells like Heal, Teleport, Revive, or Imprison. You won by either wiping out all enemy pieces or occupying all five Power Points on the board simultaneously.

In the original Archon: The Light and the Dark, both armies consist of 18 units led by a powerful spellcaster. While their pieces broadly mirror each other in role, each unit has unique attack speeds, health pools, movement ranges, and combat mechanics.

The Light ArmyThe
Light side generally features high mobility, ranged firepower, and precise area control.
name | #nrb | movement | description
Wizard|1|Teleport (3 squares)|Leader/Spellcaster. Fires fast magic missiles. Can cast 7 distinct spells across the board (Heal, Teleport, Revive, Imprison, Shift, Exchange, Elemental). 
Phoenix|1|Fly (5 squares)|Area Denial. Explodes into a ring of fire that damages surrounding enemies while rendering the Phoenix briefly invulnerable.
Unicorn|2|Ground (4 squares)|Fast Sniper. Moves quickly across the board and shoots rapid light bolts in straight lines.
Golem|2|Ground (3 squares)|Heavy Tank. Slow-moving with high health. Throws heavy boulders that inflict massive damage on hit.
Valkyrie|2|Fly (3 squares)|Versatile Flier. Can fly over obstacles and hurls piercing spears with good range.
Archer|2|Ground (3 squares)|Ranged Infantry. Low health, but shoots fast arrows continuously from long range.
Sylph|1|Fly (4 squares)|Air Spirit. Sturdy flier that hurls fast whirlwinds; good at contesting power points.
Knight|7|Ground (3 squares)|Melee Pawn. Low health, swings a short-range sword. Weak on their own, but effective at swarming damaged foes.

The Dark Army
The Dark side relies on area-effect attacks, high durability, and disruptive special abilities.
name | #nrb | movement | description
Sorceress|1|Teleport (3 squares)|Leader/Spellcaster. Fires lightning bolts. Shares the same 7 spellcasting abilities as the Wizard.
Dragon|1|Fly (5 squares)|Heavy Assault. Massive health pool; breathes continuous flames that sweep across the arena.
Manticore|2|Ground (4 squares)|Ranged Skirmisher. Shoots a volley of spikes that spread out over distance.
Troll|2|Ground (3 squares)|Heavy Brawler. Slow-moving high-HP monster. Throws heavy rocks and slowly regenerates health over time on dark tiles.
Banshee|2|Fly (3 squares)|Aura Attacker. Emits a screaming aura of energy around itself that continuously drains the enemy's life up close.
Goblin|7|Ground (3 squares)|Melee Pawn. Low health, strikes with a short-range club. Equivalent to the Knight.
Shape-Shifter|1|Ground (3 squares)|Wildcard. Takes on the exact shape, health, and attack power of whichever enemy piece it engages in battle.
Serpent|2|Ground (3 squares)|Venom Spitter. Low health, but spits fast poison darts that briefly slow the target.

The 7 Spells

Summon Elemental
Effect: Summons a temporary, powerful Elemental (Earth, Air, Fire, or Water) to attack an enemy piece on an adjacent square.
How it works: The Elemental exists only for that single battle. Win or lose, it disappears immediately after the fight, leaving the target square occupied by the winner (if the Elemental wins, the original enemy piece is destroyed and the square becomes empty).

Heal
Effect: Restores a damaged piece back to 100% full health.
How it works: Can be cast on any friendly piece anywhere on the board. Since damage carries over from previous battles in Archon, casting this on a heavily damaged high-tier unit like a Dragon or Golem turns the tide of the match.

Revive
Effect: Brings a previously destroyed piece back to life.
How it works: Places the resurrected piece onto an open square adjacent to your leader (Wizard or Sorceress). You cannot revive another spellcaster or a previously summoned Elemental.

Teleport
Effect: Instantly moves any friendly piece to any open square on the board.
How it works: Ignores all pathing, obstacles, and movement limits. It is commonly used to drop a strong piece directly onto a critical Power Point or to save a stranded leader from being cornered.

Imprison
Effect: Traps an enemy piece on its current tile, preventing it from moving or attacking.
How it works: The target piece cannot take any actions until the tile it sits on transitions to its home color (e.g., an imprisoned Light piece becomes free when its tile cycles to Light/White). If cast on a neutral Power Point tile, the imprisonment lasts indefinitely until dispelled by Shift.

Shift
Effect: Inverts the current cycle phase of all non-fixed tiles on the board.
How it works: Instantly turns all Light squares to Dark, and all Dark squares to Light. This flips combat advantages instantly across the entire map, weakening enemy units while empowering your own during battle.

Exchange
Effect: Swaps the physical positions of any two pieces on the board.
How it works: Can swap two friendly pieces, two enemy pieces, or one friendly and one enemy piece. A favorite high-level tactic is swapping a weak enemy piece with a powerful enemy guarding a Power Point, or pulling an enemy leader out of safety.

## Overview
Original browser game in the style of the 1983 classic (own name TBD, own art/layout/balance; do not copy the original's name, sprites or exact board layout). Turn-based 9x9 board; moving onto an enemy starts a real-time arena duel.

## Working arrangement
- Target first: 2 players, one keyboard (hot-seat). Network play is a wanted later extension, so keep game logic deterministic and driven by serializable actions.
- Node is installed via nvm (v22); in non-interactive shells run `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"` first.

## Commands
- `npm run dev` - Vite dev server
- `npm test` - Vitest unit tests (`npm run test:watch` for watch mode)
- `npm run typecheck` - tsc, no emit
- `npm run build` - typecheck + production build to dist/
- `npm run online` - build, then start the LAN game server (`npm run server` alone serves the existing dist/); `PORT` env, default 8080. Both players open the printed http://<LAN-IP>:8080 address
- `npm run sprites` - regenerate `src/assets/sprites.png` (64px-cell atlas) from the Gemini sprite sheet JPEG in the repo root; enclosed background pockets are listed by hand in `HOLE_SEEDS`; knight edits (sword erased via `ERASE`, hand-painted arm via `PAINT`, shield moved right over a mirrored body via `SHIELD`/`SHIELD_COVER`) since the arena animates the sword

## Project Structure
- `src/core/` - pure rules, no DOM: types, units (stats), board (tiles, power points, luminance cycle), setup, movement, turn (moves, battles, imprisonment, win check). Unit tested.
- `src/app/` - pure UI state transitions (e.g. boardInput click handling). Unit tested.
- `src/render/` - canvas drawing only. `sprites.ts` maps piece kinds to atlas cells; falls back to text glyphs if the sheet hasn't loaded.
- `src/combat/` - pure fixed-timestep (60 Hz) arena sim: `arena.ts` (create/step/outcome), `field.ts` (shared types, hurt/heal), `attacks.ts` (per-unit attack table), `shots.ts` (projectiles, bouncing, fire), `boulders.ts` (seeded placement, PRNG), `controls.ts` (key codes -> per-tick inputs). Unit tested.
- `src/arenaScreen.ts` - popup overlay, real-time loop and keyboard listeners; `src/render/arenaView.ts` draws it top-down, `src/render/arena3d.ts` first-person (raycasting: `raycast.ts` pure ray/rect + projection math, unit tested; `raster3d.ts` walls/floor/ceiling pixels; `billboards.ts` z-buffered sprites).
- `src/net/` - network play: `protocol.ts` (messages), `lockstep.ts` (pure per-tick input buffer, unit tested), `onlineArena.ts` (arena driver + input book), `connection.ts` (WebSocket).
- `server/` - plain-JS Node server (`server.mjs`: static dist/ + WebSocket relay on /ws; `room.mjs`: pure seat logic, unit tested).
- `src/main.ts` - DOM wiring; hot-seat or online depending on the page.
- `src/core/spells.ts` - the 7 spells (pure, unit tested); `src/app/spellInput.ts` - aiming spells; `src/app/spellWheel.ts` - the spell wheel's contents and layout.
- Planned: AI.

## 3D arena (Wolfenstein-style first-person view)
- Toggle with the "Arena: 2D/3D" button under the board. It's a game setting sent as a `GameAction` (`{type:'arenaView'}`) so online both clients switch together; reset to 2D on online 'start'.
- Steering (`ArenaState.steering`, `src/combat/steering.ts`): 2D = 'compass'. Hot-seat 3D = 'tank' (one keyboard): up/down walk, left/right turn TURN_STEP (16) of 1024 table directions per tick. Online 3D = 'fps', a mouse-aimed shooter: click the arena to capture the pointer (`src/mouseAim.ts`, Esc frees it), mouse turns, W/S walk, A/D strafe (diagonals x SQRT1_2), left button (or G) fires. Mouse turn travels in `ArenaInput.turn` as whole table steps (MOUSE_STEPS_PER_PX 0.5, remainder carried); the online driver sends it on one tick only when catching up several. Shots fly along the facing. The direction table is built by repeated angle-halving with sqrt only (determinism rule).
- Screen: hot-seat split screen (light left, dark right) 960x420 views rendered at half resolution, minimap + HP/reload panels in the 220px strip below; online shows only your own view full width. Walls = arena edge (brick) + boulders (stone, glowing as worn); all walls WALL_H 64, eye at 32, so nothing shows over a wall.

## Rules / Constraints
- Keep functions small and focused
- Game logic is pure functions over immutable state, unit tested without DOM/canvas

## Board rules (implemented in src/core/board.ts, turn.ts)
- Power points: A5 (fixed light, Wizard start), I5 (fixed dark, Sorceress start), E1, E5, E9 (shifting). A piece on a power point heals every turn and is immune to all magic, friendly or enemy (`isSpellImmune`).
- All pieces heal 1 HP every `HEAL_INTERVAL` (4) turns otherwise.
- Shifting squares: all of column E and row 5 (except A5/I5) plus the 2x2 core of each corner quadrant; each 4x4 quadrant is 6 light / 6 dark / 4 shifting (31 shifting squares total; our own pattern, not the original's).
- Battles (temporary, until the real-time arena exists): `src/core/autoBattle.ts`. Units have [life, damage, speed, recovery] in units.ts (1..6 scales; HP = life x LIFE_SCALE 3). First hit after 7-speed ticks, then every (7-speed)+(7-recovery) ticks; hits resolve in time order, same-tick hits land together, fight stops the moment one falls. +COLOR_BONUS (1) damage per hit on own colour (rounded share on grey), colour read before the fight. Shapeshifter copies opponent HP and profile. Trolls regen 2 instead of 1.
- Arena (replaces autoBattle in the UI; autoBattle kept for tests/future AI): attacking sets `pendingBattle`, the arena popup runs, `finishBattle` applies the result. 960x640 field, light starts left, dark right. Boulders: `BOULDER_COUNT` seeded from turn number + square, start columns kept clear; block movement and shots. Attacks per unit in `src/combat/attacks.ts` (shapeshifter uses its form's): melee (knight/goblin: instant hit on the square in front); shots with per-unit speed/radius/range (speeds: boulder 4 < fireball 5 < lightning/flame 6 < arrow/spear 8 < whirlwind 9 < spike 10 < bolt 12 < venom 18); whirlwind and lightning bounce off boulders; wizard fireball leaves fire (3 s, 1 dmg every 0.5 s, opponent only); dragon flame is a short cone (narrow 2 steps, then widens, hits once); bursts (phoenix blast: 2-fighter radius + 1 s immunity; banshee scream: same radius, steals half the damage dealt). Banshee moves through boulders. Boulders have 12 HP, worn by base damage (dragon flame 2 hits, golem/troll boulder 3); damage = unit damage + colour bonus, reload = hitInterval x 8 ticks. Arena sprites mirror to face their `heading` (last horizontal move); `nativeHeading` in sprites.ts says which way each picture faces (only the dragon faces left). Keys by KeyboardEvent.code: light W/A/S/D = up/left/down/right, G fire; dark I/J/K/L = up/left/down/right, Quote (Ä on Swedish layout) fire.

## Network play (LAN, branch network-play)
- Mode: pages served by server/server.mjs carry `<meta name="archon-online">` and connect; vite dev and file:// stay hot-seat.
- Seats: first visitor gets a random side, second the other, third is turned away. A player leaving frees the seat; the next joiner triggers 'start', which resets the game on both.
- Board: clicks are planned locally (`planClick`); moves are sent as `GameAction`s, the server echoes them to both in one order, and both apply them (`applyMoveAction`). The server runs no rules.
- Arena: deterministic lockstep. Before simulating tick t a client sends its input for t + INPUT_DELAY (3); a tick runs only when both inputs are known. Arena id = gameNumber * 10000 + turnNumber, identical on both clients. Online, either key set (WASD/IJKL, G/Ä) controls your own fighter.
- Determinism rule: the sim must not use Math.random, Date, or implementation-approximated Math functions (hypot, sin, cos, atan2, exp, pow...); Math.sqrt and + - * / are exact everywhere.

## Spells (src/core/spells.ts)
- Click your Wizard/Sorceress twice to open the spell wheel (`src/app/spellWheel.ts`, drawn on the board canvas): 7 board-sized squares with pixel icons (`src/render/spellIcons.ts`, grey = used or no valid target). Clicking the caster cycles: first click selects it (moves shown), second opens the wheel (moves hidden), third deselects; with no castable spell the second click deselects. The wheel is centred on the caster without covering it (half circle on an edge, quarter in a corner). Revive's fallen pieces are picked from a wheel too. Then click the spell's (purple-highlighted) targets; Esc or Cancel aborts. Casting uses the turn. Each side has the 7 spells once per game (`spellsUsed` in GameState). No casting while the caster is dead or imprisoned. Nothing on a power point can be targeted.
- Teleport: own free piece to any empty square, or onto an enemy (not on a power point) to fight at once. Heal: wounded friendly piece to full. Shift Time: reverse the cycle direction; at a peak jump to the opposite extreme (`shiftTime` in board.ts), then the turn advances it as usual. Exchange: swap any two pieces (not imprisoned, not on power points). Summon Elemental: a deterministic-random fire/water/air/earth elemental (own stats/attack, drawn procedurally in render/elementals.ts) appears on any empty non-power-point square as a temporary piece of the caster's side that flies 4; after its first fight (attacking or defending, win or lose) it vanishes and is never counted as fallen, so a square it won is left empty (`resolveBattle`). Revive: a fallen non-caster to an empty square next to the caster, full HP. Imprison: enemy cannot move (or cast, if a caster) until the cycle reaches the colour opposite its side (light piece: full dark; dark piece: full light).
- Hidden cost: each spell cast lowers the caster's max HP in later fights by SPELL_HP_COST (1) (`casterMaxHp`, applied in createArena).
- Spells are `GameAction`s (`{type:'spell', cast}`), so network play relays them like moves.
