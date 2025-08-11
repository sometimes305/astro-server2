// server.js — Expressでpublic配信 + WebSocket進行 + 参加者同期/チャット/脱出合図
const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.status(200).send('ok'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---------------- ランタイム状態 ----------------
let phase = 'idle';
let simMult = 1.0;
let crashAt = 1.5;
let lobbyEndAt = 0;
let lastLobbySec = null;

// 接続クライアントの軽量状態
let nextId = 1;
const clients = new Map(); // id -> { ws, name, coins, bet, gain, joined, cashed }
function publicPassengers() {
  return [...clients.entries()].map(([id, c]) => ({
    id,
    name  : c.name  ?? '？？',
    coins : (typeof c.coins === 'number') ? c.coins : null,
    bet   : c.bet   | 0,
    gain  : c.gain  | 0,
    joined: !!c.joined,
    cashed: !!c.cashed
  }));
}
function pushPassengers() {
  const msg = JSON.stringify({ type: 'passengers', list: publicPassengers() });
  wss.clients.forEach(ws => { if (ws.readyState === ws.OPEN) ws.send(msg); });
}
const broadcast = (obj) => {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(ws => { if (ws.readyState === ws.OPEN) ws.send(msg); });
};

// ----------- 倍率の確率分布（指定どおり） -----------
const buckets = [
  { p: 0.05, min: 1.01,     max: 1.01,     mode: 'point' }, // 1.01倍
  { p: 0.05, min: 1.02,     max: 1.10,     mode: 'lin'   }, // 1.02–1.1倍
  { p: 0.45, min: 1.10,     max: 2.00,     mode: 'lin'   }, // 1.1–2.0倍
  { p: 0.20, min: 2.00,     max: 5.00,     mode: 'lin'   }, // 2.0–5.0倍
  { p: 0.10, min: 5.00,     max: 20.00,    mode: 'lin'   }, // 5–20倍
  { p: 0.05, min: 20.00,    max: 100.00,   mode: 'lin'   }, // 20–100倍
  { p: 0.05, min: 100.00,   max: 10000.00, mode: 'log'   }, // 100–10000倍
  { p: 0.05, min: 10000.00, max: 1e8,      mode: 'log'   }  // 10000–1億倍
];
function sampleLinear(min, max){ return min + Math.random()*(max-min); }
function sampleLogUniform(min, max){
  const a=Math.log(min), b=Math.log(max);
  return Math.exp(a + Math.random()*(b-a));
}
function sampleCrash(){
  let u=Math.random();
  for(const b of buckets){
    if(u < b.p){
      if(b.mode==='point') return b.min;
      const v = (b.mode==='log') ? sampleLogUniform(b.min,b.max) : sampleLinear(b.min,b.max);
      return Math.min(v, 1e8);
    }
    u -= b.p;
  }
  return 1.01;
}

// ----------- 上昇スピード -----------
const stages = [
  { t: 5,   r: 1.15 },
  { t: 10,  r: 1.28 },
  { t: 25,  r: 1.45 },
  { t: 50,  r: 1.60 },
  { t: 100, r: 1.80 },
  { t: 1e3, r: 2.00 },
  { t: 1e4, r: 2.30 },
  { t: 1e6, r: 2.60 },
  { t: 1e8, r: 3.00 }
];
const rateFor = (m)=>{ for(const s of stages){ if(m < s.t) return s.r; } return stages.at(-1).r; };

// ----------- 接続時の処理 -----------
wss.on('connection', (ws) => {
  const id = String(nextId++);
  clients.set(id, { ws, name: null, coins: null, bet:0, gain:0, joined:false, cashed:false });

  // 初期通知
  ws.send(JSON.stringify({
    type: 'init',
    phase,
    crashAt,
    lobbyMsLeft: phase === 'lobby' ? Math.max(0, lobbyEndAt - Date.now()) : undefined
  }));
  pushPassengers();

  ws.on('message', (raw)=>{
    let msg; try{ msg = JSON.parse(raw); } catch { return; }
    const c = clients.get(id); if(!c) return;

    if(msg.type==='hello'){
      c.name  = String(msg.name || '？？');
      if(typeof msg.coins==='number') c.coins = msg.coins|0;
      pushPassengers();
      return;
    }
    if(msg.type==='wallet' && typeof msg.coins==='number'){
      c.coins = msg.coins|0; pushPassengers();
      return;
    }
    if(msg.type==='join' && typeof msg.bet==='number'){
      c.bet = msg.bet|0; c.joined = true; pushPassengers();
      return;
    }
    if(msg.type==='cashout' && typeof msg.gain==='number'){
      c.gain = msg.gain|0; c.cashed = true; pushPassengers();
      // 脱出アニメ合図
      broadcast({ type: 'eject', name: c.name || '？？' });
      return;
    }
    if (msg.type === 'chat' && typeof msg.text === 'string') {
      const payload = {
        type: 'chat',
        name: (c?.name || '？？'),
        text: String(msg.text).slice(0, 200),
        ts: Date.now()
      };
      broadcast(payload);
      return;
    }
  });

  ws.on('close', ()=>{ clients.delete(id); pushPassengers(); });
});

// ----------- ラウンド制御 -----------
function startLobby(){
  phase = 'lobby';
  simMult = 1.0;
  // ラウンド毎の値を初期化
  clients.forEach(c=>{ c.bet=0; c.gain=0; c.joined=false; c.cashed=false; });
  pushPassengers();

  lobbyEndAt = Date.now() + 15000; // 15秒受付
  lastLobbySec = null;
  broadcast({ type:'round', phase, lobbyMsLeft: 15000 }); // 受付開始を即通知
}
function startFlight(){
  if(phase==='flight') return; // 二重発射ガード
  phase = 'flight';
  simMult = 1.0;
  crashAt = sampleCrash();
  broadcast({ type:'round', phase, crashAt });
}
function endCrash(){
  phase = 'crash';
  broadcast({ type:'round', phase, crashAt });
  setTimeout(startLobby, 5000); // 5秒休憩
}

// ----------- メインループ -----------
setInterval(()=>{
  if(phase==='lobby'){
    const msLeft = Math.max(0, lobbyEndAt - Date.now());
    const sec = Math.floor(msLeft/1000);
    if(sec !== lastLobbySec){
      lastLobbySec = sec;
      broadcast({ type:'lobby', msLeft });
    }
    if(msLeft <= 0) startFlight();
    return;
  }
  if(phase==='flight'){
    const dt = 0.1;
    simMult *= Math.pow(rateFor(simMult), dt);
    if(simMult >= crashAt){
      simMult = crashAt;
      broadcast({ type:'mult', value: simMult });
      endCrash();
    }else{
      broadcast({ type:'mult', value: simMult });
    }
  }
}, 100);

// ----------- 起動 -----------
server.listen(PORT, ()=> {
  console.log(`listening on :${PORT}`);
  startLobby();
});
