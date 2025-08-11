import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = process.env.PORT || 3000;

// 倍率生成
const MEDIAN_TARGET = 1.5;
const INSTANT_CRASH_PROB = 0.03;
const SHAPE_ALPHA = 1.5;
function computeLomaxScale(alpha, m = MEDIAN_TARGET, p = INSTANT_CRASH_PROB) {
  const q = (0.5 - p) / (1 - p);
  const denom = Math.pow(1 - q, -1/alpha) - 1;
  return (m - 1) / denom;
}
const LOMAX_SCALE = computeLomaxScale(SHAPE_ALPHA);
function sampleCrash() {
  if (Math.random() < INSTANT_CRASH_PROB) return 1.01;
  const U = Math.random();
  const y = LOMAX_SCALE * (Math.pow(U, -1/SHAPE_ALPHA) - 1);
  return 1 + y;
}

// HTTPサーバー
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  }
});

// WSサーバー
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  console.log('Client connected');
  ws.send(JSON.stringify({ type: 'welcome', msg: 'Connected to Astro Server' }));
});

// ラウンド配信ループ
setInterval(() => {
  const crashAt = sampleCrash();
  wss.clients.forEach(client => {
    client.send(JSON.stringify({ type: 'round', crashAt }));
  });
}, 5000); // 5秒ごとに新しい倍率

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
