const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clampInt(value, min, max, fallback = min) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeName(name) {
  const raw = String(name ?? '').trim();
  return raw.length > 0 ? raw.slice(0, 24) : 'Guest';
}

function toText(raw) {
  if (typeof raw === 'string') return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  return '';
}

const PORT = parsePositiveInt(process.env.PORT, 3000);
const HOST = process.env.HOST || '0.0.0.0';
const LOBBY_MS = parsePositiveInt(process.env.LOBBY_MS, 15000);
const CRASH_PAUSE_MS = parsePositiveInt(process.env.CRASH_PAUSE_MS, 5000);
const GAME_TICK_MS = parsePositiveInt(process.env.GAME_TICK_MS, 100);
const WS_HEARTBEAT_MS = parsePositiveInt(process.env.WS_HEARTBEAT_MS, 30000);
const WS_MAX_PAYLOAD = parsePositiveInt(process.env.WS_MAX_PAYLOAD, 4096);
const CHAT_MAX_LEN = parsePositiveInt(process.env.CHAT_MAX_LEN, 200);

let phase = 'idle';
let simMult = 1.0;
let crashAt = 1.5;
let lobbyEndAt = 0;
let lastLobbySec = null;
let nextId = 1;
let gameLoopTimer = null;
let crashTimeout = null;
let shuttingDown = false;
const clients = new Map();

function log(message, details = null) {
  const ts = new Date().toISOString();
  if (details === null) {
    console.log(`[${ts}] ${message}`);
    return;
  }
  console.log(`[${ts}] ${message}`, details);
}

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    phase,
    clients: clients.size,
    uptimeSec: Math.floor(process.uptime())
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  maxPayload: WS_MAX_PAYLOAD,
  perMessageDeflate: false
});

function publicPassengers() {
  return [...clients.entries()].map(([id, c]) => ({
    id,
    name: c.name ?? 'Guest',
    coins: typeof c.coins === 'number' ? c.coins : null,
    bet: c.bet | 0,
    gain: c.gain | 0,
    joined: Boolean(c.joined),
    cashed: Boolean(c.cashed)
  }));
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
}

function pushPassengers() {
  broadcast({ type: 'passengers', list: publicPassengers() });
}

const buckets = [
  { p: 0.05, min: 1.01, max: 1.01, mode: 'point' },
  { p: 0.05, min: 1.02, max: 1.1, mode: 'lin' },
  { p: 0.45, min: 1.1, max: 2.0, mode: 'lin' },
  { p: 0.2, min: 2.0, max: 5.0, mode: 'lin' },
  { p: 0.1, min: 5.0, max: 20.0, mode: 'lin' },
  { p: 0.05, min: 20.0, max: 100.0, mode: 'lin' },
  { p: 0.05, min: 100.0, max: 10000.0, mode: 'log' },
  { p: 0.05, min: 10000.0, max: 1e8, mode: 'log' }
];

function sampleLinear(min, max) {
  return min + Math.random() * (max - min);
}

function sampleLogUniform(min, max) {
  const a = Math.log(min);
  const b = Math.log(max);
  return Math.exp(a + Math.random() * (b - a));
}

function sampleCrash() {
  let u = Math.random();
  for (const b of buckets) {
    if (u < b.p) {
      if (b.mode === 'point') return b.min;
      const v = b.mode === 'log' ? sampleLogUniform(b.min, b.max) : sampleLinear(b.min, b.max);
      return Math.min(v, 1e8);
    }
    u -= b.p;
  }
  return 1.01;
}

const stages = [
  { t: 5, r: 1.15 },
  { t: 10, r: 1.28 },
  { t: 25, r: 1.45 },
  { t: 50, r: 1.6 },
  { t: 100, r: 1.8 },
  { t: 1e3, r: 2.0 },
  { t: 1e4, r: 2.3 },
  { t: 1e6, r: 2.6 },
  { t: 1e8, r: 3.0 }
];

function rateFor(multiplier) {
  for (const s of stages) {
    if (multiplier < s.t) return s.r;
  }
  return stages.at(-1).r;
}

function startLobby() {
  if (shuttingDown) return;
  phase = 'lobby';
  simMult = 1.0;

  clients.forEach((c) => {
    c.bet = 0;
    c.gain = 0;
    c.joined = false;
    c.cashed = false;
  });
  pushPassengers();

  lobbyEndAt = Date.now() + LOBBY_MS;
  lastLobbySec = null;
  broadcast({ type: 'round', phase, lobbyMsLeft: LOBBY_MS });
}

function startFlight() {
  if (shuttingDown || phase === 'flight') return;
  phase = 'flight';
  simMult = 1.0;
  crashAt = sampleCrash();
  broadcast({ type: 'round', phase, crashAt });
}

function endCrash() {
  if (shuttingDown) return;
  phase = 'crash';
  broadcast({ type: 'round', phase, crashAt });
  if (crashTimeout) clearTimeout(crashTimeout);
  crashTimeout = setTimeout(startLobby, CRASH_PAUSE_MS);
}

wss.on('connection', (ws, req) => {
  const id = String(nextId++);
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  clients.set(id, {
    ws,
    name: null,
    coins: null,
    bet: 0,
    gain: 0,
    joined: false,
    cashed: false
  });

  log(`ws connected id=${id} ip=${req.socket.remoteAddress ?? 'unknown'}`);

  ws.send(
    JSON.stringify({
      type: 'init',
      phase,
      crashAt,
      lobbyMsLeft: phase === 'lobby' ? Math.max(0, lobbyEndAt - Date.now()) : undefined
    })
  );
  pushPassengers();

  ws.on('message', (raw) => {
    if (shuttingDown) return;

    const payload = toText(raw);
    if (payload.length > WS_MAX_PAYLOAD) {
      ws.close(1009, 'payload too large');
      return;
    }

    let msg;
    try {
      msg = JSON.parse(payload);
    } catch {
      return;
    }

    const c = clients.get(id);
    if (!c || typeof msg !== 'object' || msg === null) return;

    if (msg.type === 'hello') {
      c.name = normalizeName(msg.name);
      if (msg.coins !== undefined) c.coins = clampInt(msg.coins, 0, 1_000_000_000, 0);
      pushPassengers();
      return;
    }

    if (msg.type === 'wallet') {
      c.coins = clampInt(msg.coins, 0, 1_000_000_000, c.coins ?? 0);
      pushPassengers();
      return;
    }

    if (msg.type === 'join') {
      c.bet = clampInt(msg.bet, 0, 1_000_000_000, 0);
      c.joined = true;
      pushPassengers();
      return;
    }

    if (msg.type === 'cashout') {
      c.gain = clampInt(msg.gain, 0, 1_000_000_000, 0);
      c.cashed = true;
      pushPassengers();
      broadcast({ type: 'eject', name: c.name || 'Guest' });
      return;
    }

    if (msg.type === 'chat' && typeof msg.text === 'string') {
      broadcast({
        type: 'chat',
        name: c.name || 'Guest',
        text: msg.text.trim().slice(0, CHAT_MAX_LEN),
        ts: Date.now()
      });
    }
  });

  ws.on('error', (err) => {
    log(`ws error id=${id}`, { message: err.message });
  });

  ws.on('close', () => {
    clients.delete(id);
    pushPassengers();
    log(`ws closed id=${id}`);
  });
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, WS_HEARTBEAT_MS);

function startGameLoop() {
  if (gameLoopTimer) clearInterval(gameLoopTimer);
  gameLoopTimer = setInterval(() => {
    if (shuttingDown) return;

    if (phase === 'lobby') {
      const msLeft = Math.max(0, lobbyEndAt - Date.now());
      const sec = Math.floor(msLeft / 1000);
      if (sec !== lastLobbySec) {
        lastLobbySec = sec;
        broadcast({ type: 'lobby', msLeft });
      }
      if (msLeft <= 0) startFlight();
      return;
    }

    if (phase === 'flight') {
      const dt = GAME_TICK_MS / 1000;
      simMult *= Math.pow(rateFor(simMult), dt);
      if (simMult >= crashAt) {
        simMult = crashAt;
        broadcast({ type: 'mult', value: simMult });
        endCrash();
      } else {
        broadcast({ type: 'mult', value: simMult });
      }
    }
  }, GAME_TICK_MS);
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`shutdown start signal=${signal}`);

  if (gameLoopTimer) clearInterval(gameLoopTimer);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (crashTimeout) clearTimeout(crashTimeout);

  wss.clients.forEach((ws) => {
    try {
      ws.close(1001, 'server shutdown');
    } catch {
      ws.terminate();
    }
  });

  wss.close(() => {
    server.close(() => {
      log('shutdown complete');
      process.exit(0);
    });
  });

  setTimeout(() => {
    log('forced exit');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  log('uncaughtException', { message: err.message, stack: err.stack });
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  log('unhandledRejection', { reason: String(reason) });
});

server.listen(PORT, HOST, () => {
  log(`listening on ${HOST}:${PORT}`);
  startGameLoop();
  startLobby();
});