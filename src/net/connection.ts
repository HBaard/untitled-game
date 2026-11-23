import type { ClientMessage, ServerMessage } from './protocol';
import { WS_PATH } from './protocol';

export interface Connection {
  send(msg: ClientMessage): void;
}

/** The game server marks the pages it serves; anything else (vite dev, file://) is hot-seat. */
export const isOnlinePage = (): boolean => document.querySelector('meta[name="archon-online"]') !== null;

/** Opens the game socket on the server that served this page. Sends made before it opens are queued. */
export function connect(onMessage: (msg: ServerMessage) => void, onClose: () => void): Connection {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}${WS_PATH}`);
  const queue: string[] = [];
  ws.addEventListener('open', () => queue.splice(0).forEach((m) => ws.send(m)));
  ws.addEventListener('message', (e) => onMessage(JSON.parse(String(e.data)) as ServerMessage));
  ws.addEventListener('close', onClose);
  return {
    send(msg) {
      const text = JSON.stringify(msg);
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
      else queue.push(text);
    },
  };
}
