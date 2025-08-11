export const $ = (id)=>document.getElementById(id);

const LS_KEY_USER = 'astro_user';
const LS_KEY_COINS = 'astro_coins';
const LS_KEY_HISTORY = 'astro_hist';

export function currentUser(){
  return localStorage.getItem(LS_KEY_USER) || '';
}
export function setCurrentUser(name){
  localStorage.setItem(LS_KEY_USER, name);
}

export function coinsOf(name){
  const all = JSON.parse(localStorage.getItem(LS_KEY_COINS) || '{}');
  const v = all[name];
  // 0 は正しい残高。未登録のときだけ 100 を初期値にする
  return (typeof v === 'number') ? v : 100;
}
export function setCoins(name, val){
  const all = JSON.parse(localStorage.getItem(LS_KEY_COINS) || '{}');
  all[name] = Math.max(0, Math.floor(val));
  localStorage.setItem(LS_KEY_COINS, JSON.stringify(all));
}

export function pushHistory(name, mult){
  const all = JSON.parse(localStorage.getItem(LS_KEY_HISTORY) || '{}');
  const list = all[name] || [];
  list.unshift(Number(mult));
  all[name] = list.slice(0, 20);
  localStorage.setItem(LS_KEY_HISTORY, JSON.stringify(all));
}
export function historyOf(name){
  const all = JSON.parse(localStorage.getItem(LS_KEY_HISTORY) || '{}');
  return all[name] || [];
}

export function initAuthUI(){
  const userArea = $('userArea');
  const authModal = $('authModal');
  const uName = $('uName');
  const uPass = $('uPass');
  const loginBtn = $('loginBtn');
  const signupBtn = $('signupBtn');

  const render = ()=>{
    const u = currentUser();
    if (u) {
      userArea.innerHTML = `👤 <b>${u}</b> <button id="logoutBtn" class="small">ログアウト</button>`;
      $('logoutBtn').onclick = ()=>{
        localStorage.removeItem(LS_KEY_USER);
        render();
      };
    } else {
      userArea.innerHTML = `<button id="openAuth" class="small">ログイン/登録</button>`;
      $('openAuth').onclick = ()=>{ authModal.style.display='grid'; };
    }
  };

  const doAuth = (mode)=>{
    const name = (uName.value||'').trim();
    const pass = (uPass.value||'').trim();
    if (!name || !pass) { alert('ユーザー名とパスワードを入力'); return; }
    setCurrentUser(name);
    if (mode==='signup' && typeof coinsOf(name) !== 'number') {
      setCoins(name, 100);
    }
    authModal.style.display='none';
    render();
  };

  loginBtn.onclick  = ()=>doAuth('login');
  signupBtn.onclick = ()=>doAuth('signup');
  authModal.addEventListener('click', (e)=>{ if(e.target===authModal) authModal.style.display='none'; });

  render();
}
