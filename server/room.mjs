// One game room with two seats. Pure: every function returns a new room.

/** @typedef {'light' | 'dark'} Side */
/** @typedef {{ light: unknown, dark: unknown }} Room */

/** @returns {Room} */
export const createRoom = () => ({ light: null, dark: null });

/**
 * Seats a client: the first one gets a random side, the second gets the other.
 * @param {Room} room
 * @param {unknown} client
 * @param {() => number} rand
 * @returns {{ room: Room, side: Side | null }} side is null when the room is full
 */
export function join(room, client, rand = Math.random) {
  const free = /** @type {Side[]} */ (['light', 'dark']).filter((s) => room[s] === null);
  if (free.length === 0) return { room, side: null };
  const side = free.length === 2 ? (rand() < 0.5 ? 'light' : 'dark') : free[0];
  return { room: { ...room, [side]: client }, side };
}

/**
 * @param {Room} room
 * @param {unknown} client
 * @returns {{ room: Room, side: Side | null }} the seat it left, if it had one
 */
export function leave(room, client) {
  const side = room.light === client ? 'light' : room.dark === client ? 'dark' : null;
  return { room: side ? { ...room, [side]: null } : room, side };
}

/** @param {Room} room */
export const isFull = (room) => room.light !== null && room.dark !== null;

/** @param {Side} side */
export const otherSide = (side) => (side === 'light' ? 'dark' : 'light');
