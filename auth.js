// ユーザー管理（localStorage） + 端末紐付け
export const LS_USERS = 'astro_users_v1';
export const LS_CURRENT = 'astro_current_user_v1';

export const $ = (id)=>document.getElementById(id);

export function loadUsers(){ try{ return JSON.parse(localStorage.getItem(LS_USERS)||'{}'); }catch{ return {}; } }
export function saveUsers(obj){ localStorage.setItem(LS_USERS, JSON.stringify(obj)); }
export function currentUser(){ return localStorage.getItem(LS_CURRENT)||''; }
export function setCurrentUser(u){ localStorage.setItem(LS_CURRENT, u); }

export async function sha256(text){
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export function coinsOf(u){ const users=loadUsers(); return users[u]?.coins ?? 0; }
export function setCoins(u,v){ const users=loadUsers(); if(!users[u]) users[u]={passHash:'',coins:0,history:[]}; users[u].coins=v; saveUsers(users); }
export function historyOf(u){ const users=loadUsers(); return users[u]?.history ?? []; }
export function pushHistory(u, value){ const users=loadUsers(); if(!users[u]) users[u]={passHash:'',coins:0,history:[]}; users[u].history.unshift({id:Date.now().toString().slice(-8),v:value}); users[u].history = users[u].history.slice(0,20); saveUsers(users); }

export function initAuthUI(){
  const $userArea = $('userArea');
  const $authModal=$('authModal'), $uName=$('uName'), $uPass=$('uPass');
  const $login=$('loginBtn'), $signup=$('signupBtn');

  function refresh(){
    const u=currentUser();
    $userArea.innerHTML = u
      ? `<span style="font-size:12px;opacity:.9">👩‍🚀 ${u}</span> <button id="logout" class="small danger">ログアウト</button>`
      : `<button id="openAuth" class="small primary">ログイン/登録</button>`;
    $('openAuth')?.addEventListener('click', ()=> $authModal.style.display='grid');
    $('logout')?.addEventListener('click', ()=>{ setCurrentUser(''); refresh(); $authModal.style.display='grid'; });
  }
  refresh();

  async function login(){
    const u=$uName.value.trim(), p=$uPass.value;
    if(!u||!p) return alert('ユーザー名とパスワードを入力してね');
    const users=loadUsers(); const h=await sha256(p);
    if(!users[u] || users[u].passHash!==h) return alert('ユーザー名またはパスワードが違います');
    setCurrentUser(u); $uPass.value=''; $authModal.style.display='none'; refresh();
  }
  async function signup(){
    const u=$uName.value.trim(), p=$uPass.value;
    if(!u||!p) return alert('ユーザー名とパスワードを入力してね');
    const users=loadUsers(); if(users[u]) return alert('そのユーザー名は使われています');
    users[u]={passHash:await sha256(p), coins:1000, history:[]}; saveUsers(users); setCurrentUser(u); $uPass.value=''; $authModal.style.display='none'; refresh();
  }
  $login.onclick=login; $signup.onclick=signup;

  if(!currentUser()) $authModal.style.display='grid';

  return { refreshUserBar: refresh };
}
