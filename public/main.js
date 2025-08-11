import { initAuthUI } from './auth.js';
import { initAds } from './ads.js';
import { initHistoryUI } from './history.js';
import { initGame } from './game.js';
import { connectWS } from './ws.js';

window.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  initAds();
  initHistoryUI();

  const game = initGame({});
  connectWS(game);
});
