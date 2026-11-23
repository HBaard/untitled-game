// Local-network game server: serves the built game (dist/) and relays messages
// between the two players. It does not run game rules; both browsers do, in step.
// Usage: npm run online   (or: npm run build && npm run server)   PORT=8080 by default.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRoom, isFull, join, leave, otherSide } from './room.mjs';

const PORT = Number(process.env.PORT ?? 8080);
const WS_PATH = '/ws';
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const ONLINE_META = '<meta name="archon-online" content="1" />';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function serveFile(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const file = path.resolve(DIST, `.${urlPath === '/' ? '/index.html' : urlPath}`);
  if (!file.startsWith(DIST + path.sep)) return void res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return void res.writeHead(404).end('Not found');
    const ext = path.extname(file);
    // Mark the page as online so the client connects instead of playing hot-seat.
    const body = ext === '.html' ? String(data).replace('<head>', `<head>\n    ${ONLINE_META}`) : data;
    res.writeHead(200, { 'Content-Type': TYPES[ext] ?? 'application/octet-stream' }).end(body);
  });
}

let room = createRoom();

const send = (ws, msg) => {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};
const broadcast = (msg) => [room.light, room.dark].forEach((ws) => send(ws, msg));

function onConnection(ws, req) {
  const joined = join(room, ws);
  if (!joined.side) {
    send(ws, { type: 'full' });
    ws.close();
    return;
  }
  room = joined.room;
  const side = joined.side;
  console.log(`${side} joined from ${req.socket.remoteAddress}`);
  send(ws, { type: 'welcome', side });
  if (isFull(room)) broadcast({ type: 'start' });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === 'action') broadcast({ type: 'action', action: msg.action }); // same order for both
    else if (msg.type === 'input') send(room[otherSide(side)], msg);
  });
  ws.on('close', () => {
    room = leave(room, ws).room;
    console.log(`${side} left`);
    send(room[otherSide(side)], { type: 'opponentLeft' });
  });
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/ is missing: run `npm run build` first (or use `npm run online`).');
  process.exit(1);
}

const server = http.createServer(serveFile);
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url ?? '/', 'http://x').pathname !== WS_PATH) return void socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, req));
});
server.listen(PORT, '0.0.0.0', () => {
  console.log('Game server running. Both players open one of:');
  for (const ip of ['localhost', ...lanAddresses()]) console.log(`  http://${ip}:${PORT}`);
});
