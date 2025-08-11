import { initAuthUI } from './auth.js';
import { initAds } from './ads.js';
import { initHistory } from './history.js';
import { initGame } from './game.js';
import { connectWS } from './ws.js';

window.addEventListener('DOMContentLoaded', () => {
  const auth = initAuthUI();
  const ads  = initAds();
  const hist = initHistory();

  const game = initGame({ auth, ads, hist }); // ← ここで resetRound→自動受付まで到達
  connectWS(game); // サーバー使う時だけ WS_URL を ws.js に入れる
});
