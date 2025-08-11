// public/auth.js — ローカル保存の薄い auth/wallet API
export const LS_KEY_USER  = 'astro_user';
export const LS_KEY_COINS = 'astro_coins'; // { name: number }
export const LS_KEY_HIST  = 'astro_hist';  // { name: number[] }

export const $ = (id)=> document.getElementById(id);

export function currentUser(){
  return localStorage.getItem(LS_KEY_USER) || null;
}
export function setCurrentUser(name){
  localStorage.setItem(LS_KEY_USER, String(name));
  return name;
}
export function coinsOf(name){
  if(!name) return 0;
  try{
    const map = JSON.parse(localStorage.getItem(LS_KEY_COINS) || '{}');
    return Number(map[name] ?? 0);
  }catch{ return 0; }
}
export function setCoins(name, value){
  if(!name) return;
  let map = {};
  try{ map = JSON.parse(localStorage.getItem(LS_KEY_COINS) || '{}'); }catch{}
  map[name] = Math.max(0, Math.floor(value));
  localStorage.setItem(LS_KEY_COINS, JSON.stringify(map));
}
export function pushHistory(name, mult){
  if(!name) return;
  let map = {};
  try{ map = JSON.parse(localStorage.getItem(LS_KEY_HIST) || '{}'); }catch{}
  const arr = map[name] || [];
  arr.push(Number(mult));
  if(arr.length > 200) arr.splice(0, arr.length-200);
  map[name] = arr;
  localStorage.setItem(LS_KEY_HIST, JSON.stringify(map));
}
