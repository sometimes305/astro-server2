// public/main.js
import { initGame } from './game.js';
import { connectWS } from './ws.js';
import { $, currentUser, coinsOf, setCoins, setCurrentUser } from './auth.js';

const game = initGame();
connectWS(game);

/* -------------------- グローバル：確実に動くログアウト -------------------- */
window.doLogout = function () {
  console.log('[logout] called');
  try {
    // auth.js のユーザーだけを確実にクリア
    localStorage.removeItem('astro_user'); // ← LS_KEY_USER
    // 旧キーが残っていた場合の掃除（無くてもOK）
    localStorage.removeItem('userName');
    localStorage.removeItem('userPass');
  } finally {
    // 履歴を残さず完全再読み込み
    location.href = location.origin + location.pathname;
  }
};

/* -------------------- ユーザー表示/ログイン/ログアウト -------------------- */
function renderUserArea() {
  const area = $('userArea');
  const name = currentUser();
  if (name) {
    area.innerHTML = `${name} <button class="small" type="button" data-action="logout">ログアウト</button>`;
  } else {
    area.innerHTML = `<button id="openAuth" class="small" type="button">ログイン</button>`;
    $('openAuth').onclick = () => openAuthModal(true);
  }
}
renderUserArea();

// 文書全体でログアウトクリックを拾う（イベント委譲）
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="logout"]');
  if (btn) {
    e.preventDefault();
    window.doLogout();
  }
});

function openAuthModal(show) {
  const m = $('authModal');
  if (m) m.style.display = show ? 'flex' : 'none';
}
window.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'authModal') openAuthModal(false);
});

// ログイン/新規登録（auth.js の API を使う）
const loginBtn  = $('loginBtn');
const signupBtn = $('signupBtn');
if (loginBtn && signupBtn) {
  loginBtn.onclick = () => doAuth(false);
  signupBtn.onclick = () => doAuth(true);
}
function doAuth(isSignup) {
  const name = $('uName')?.value.trim();
  const pass = $('uPass')?.value; // いまは未使用（保存しない）
  if (!name || !pass) return alert('ユーザー名とパスワードを入力してね');

  // ★ auth.js の setCurrentUser を使う（これが全ての基準）
  setCurrentUser(name);

  // 初回ユーザーに初期コイン（既に持ってたら何もしない）
  if (typeof coinsOf(name) !== 'number') {
    setCoins(name, 100);
  }

  openAuthModal(false);
  renderUserArea();
  location.reload(); // WSに新しい名前で hello を送らせるため
}

/* -------------------- 広告（モーダル開閉＋カウント） -------------------- */
const adModal  = $('adModal');
const adBar    = $('adBar');
const adCount  = $('adCount');
const adClaim  = $('adClaim');
const watchAdBtn = $('watchAdBtn');
let adTimer = null;

function openAdModal() {
  if (!adModal) return;
  if (window.renderAdSlot) window.renderAdSlot(); // ads.js（非モジュール）

  adModal.style.display = 'flex';
  let left = 10;
  adCount.textContent = String(left);
  adClaim.disabled = true;
  adBar.style.width = '0%';

  if (adTimer) clearInterval(adTimer);
  adTimer = setInterval(() => {
    left = Math.max(0, left - 1);
    adCount.textContent = String(left);
    adBar.style.width = `${(10 - left) * 10}%`;
    if (left === 0) {
      clearInterval(adTimer);
      adClaim.disabled = false;
    }
  }, 1000);
}
function closeAdModal(){ if (adTimer) clearInterval(adTimer); if (adModal) adModal.style.display='none'; }

if (watchAdBtn) {
  watchAdBtn.onclick = () => {
    const c = coinsOf(currentUser());
    if (c > 0) return alert('所持が0の時だけ見られます');
    openAdModal();
  };
}
if (adClaim) {
  adClaim.onclick = () => {
    const name = currentUser();
    const c = coinsOf(name);
    setCoins(name, c + 10);
    closeAdModal();
  };
}
// 所持0の時のみ広告ボタン有効
setInterval(() => {
  if (!watchAdBtn) return;
  const c = coinsOf(currentUser());
  watchAdBtn.disabled = c > 0;
}, 800);

/* -------------------- 履歴モーダル（過去20回の最終倍率） -------------------- */
const histBtn   = $('historyBtn');
const histModal = $('histModal');
const histClose = $('histClose');

function getHistory(name) {
  if (!name) return [];
  try {
    const raw = localStorage.getItem('astro_hist'); // auth.js と同じキーから取得
    const map = raw ? JSON.parse(raw) : {};
    const arr = map[name] || [];
    return arr.slice(-20).reverse();
  } catch {
    return [];
  }
}
function renderHistory() {
  const grid = $('histGrid');
  if (!grid) return;
  const list = getHistory(currentUser());
  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = `<div style="opacity:.7">履歴なし</div>`;
    return;
  }
  list.forEach((x) => {
    const cell = document.createElement('div');
    cell.className = 'histCell';
    cell.textContent = `${x.toFixed(2)}×`;
    grid.appendChild(cell);
  });
}
function openHistModal(show){
  if (!histModal) return;
  if (show) renderHistory();
  histModal.style.display = show ? 'flex' : 'none';
}
if (histBtn)   histBtn.onclick   = () => openHistModal(true);
if (histClose) histClose.onclick = () => openHistModal(false);
window.addEventListener('click', (e)=>{
  if (e.target && e.target.id === 'histModal') openHistModal(false);
});
