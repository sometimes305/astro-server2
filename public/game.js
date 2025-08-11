// サーバ同期版 game.js（自走しない・ロビー残り秒表示・搭乗/帰還可能）
import { $, currentUser, coinsOf, setCoins, pushHistory } from './auth.js';

const log = (html)=>{
  const el=$('log'); const d=document.createElement('div');
  d.innerHTML=html; el.prepend(d);
};

export function initGame(){
  const $bal=$('balance'), $wallet=$('wallet');
  const $state=$('stateLabel'), $count=$('countdown'), $mult=$('mult');
  const $join=$('joinBtn'), $cash=$('cashoutBtn');
  const $bet=$('bet'), $betMax=$('betMax'), $lock=$('lockTip');
  const $stage=$('stage'), $stars=$('stars'), $rocket=$('rocket');
  const $passengers=$('passengers');

  // 背景の星
  for(let i=0;i<200;i++){
    const s=document.createElement('div'); s.className='star';
    s.style.left=Math.random()*100+'%';
    s.style.top=(Math.random()*-2000)+'px';
    s.style.animationDelay=(Math.random()*2.4)+'s';
    s.style.opacity=.3+Math.random()*.7;
    $stars.appendChild(s);
  }

  // 乗客（ログインユーザーのみ表示）
  let passengers=[];
  function resetPassengers(){
    const name = (currentUser() || 'あなた');
    passengers = [{ id:'you', name, joined:false, gain:0 }];
    renderPassengers();
  }
  function renderPassengers(){
    $passengers.innerHTML = '';
    const p = passengers[0];
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div class="ava">🧑‍🚀</div>
      <div class="name">${p.name}</div>
      <div>${p.joined? '●' : '-'}</div>
      <div>${p.gain>0?'<span class="pwin">+'+p.gain.toLocaleString('ja-JP')+'</span>':''}</div>`;
    $passengers.appendChild(row);
    p._row = row;
  }

  // 状態
  let phase='idle', mult=1.00, crashAt=1.5, joined=false, betAmt=0, youCashed=false;
  let loopId=0;

  const setPhase=(s)=>{ phase=s; $state.textContent=({idle:'待機中',lobby:'搭乗受付中',flight:'上昇中',crashed:'爆発…'})[s]||s; };

  function updateWalletBars(){
    const u=currentUser(); const c=coinsOf(u);
    $bal.textContent=$wallet.textContent=c.toLocaleString('ja-JP');
  }
  function updateUI(){
    $mult.textContent = mult.toFixed(2)+'×';
    const h = Math.min(1, Math.log10(Math.max(mult,1))/Math.log10(1e2));
    let y = 210 - h*260; const topMin=20;
    if(y<topMin){ y=topMin; const starOffset=-(mult-1)*2; $stars.style.transform=`translateY(${starOffset}px)`; }
    else { $stars.style.transform='translateY(0px)'; }
    $rocket.style.top=y+'px';
    updateWalletBars();
  }

  function resetRound(){
    cancelAnimationFrame(loopId); loopId=0;
    mult=1.00; youCashed=false; joined=false; betAmt=0;
    $bet.disabled=false; $cash.disabled=true; $join.disabled=true;
    $rocket.classList.remove('explode'); setPhase('idle'); updateUI(); resetPassengers();
  }

  function joinNow(){
    if (phase !== 'lobby' || joined) return;
    let v = Math.max(1, Math.floor($bet.value||0));
    v = Math.min(10000, v);
    const u = currentUser(); let c = coinsOf(u);
    if (v > c) v = c;
    if (v <= 0) return;

    joined = true; betAmt = v;
    setCoins(u, c - betAmt);
    updateWalletBars();
    $join.disabled = true;
    $bet.disabled  = true;
    log(`搭乗！ ベット <b>${betAmt.toLocaleString('ja-JP')}</b> 星粒`);
  }

  function cashout(){
    if(phase!=='flight' || youCashed) return;
    const u=currentUser();
    const gain=Math.floor(betAmt*mult);
    setCoins(u, coinsOf(u)+gain); youCashed=true;
    log(`帰還成功！ <b style="color:var(--good)">${mult.toFixed(2)}×</b> で <b>+${gain.toLocaleString('ja-JP')}</b> 星粒。<span class="tag ok">WIN</span>`);
    updateWalletBars();
  }

  function loop(){
    loopId=requestAnimationFrame(loop);
    // 同期モードは UI 更新だけ
    $cash.disabled = !(phase==='flight' && joined && !youCashed);
    updateUI();
  }

  // ---- サーバ同期の受け口 ----
  function setServerPhase(p){
    if (p === 'lobby') {
      setPhase('lobby');
      $join.disabled=false; $bet.disabled=false; $cash.disabled=true;
      if (!loopId) loop();
    }
    if (p === 'flight') {
      setPhase('flight');
      $join.disabled=true; $bet.disabled=true;
      $cash.disabled = joined && !youCashed;
      if (!loopId) loop();
    }
    if (p === 'crash') {
      setPhase('crashed');
      $rocket.classList.add('explode');
      const u=currentUser(); pushHistory(u, mult);
      if(joined && !youCashed){
        log(`爆発！ <b style="color:var(--bad)">${mult.toFixed(2)}×</b> 帰還できず… <span class="tag no">LOSE</span>（-${betAmt.toLocaleString('ja-JP')}）`);
      }
      setTimeout(()=>{
        $rocket.classList.remove('explode');
        mult = 1.00; setPhase('idle'); updateUI();
        joined=false; betAmt=0; youCashed=false;
      }, 1200);
    }
  }
  function setServerMult(v){
    mult = v;
    $cash.disabled = !(phase==='flight' && joined && !youCashed);
    updateUI();
  }
  function forceCrashAt(v){ crashAt=v; }

  // ロビー残り時間の表示＆ロック（0までカウント）
  function setLobbyCountdown(msLeft){
    const sec = Math.max(0, Math.floor(msLeft / 1000));
    $count.textContent = sec + '秒';

    const lock = msLeft <= 1000;
    $bet.disabled  = lock || joined;
    $join.disabled = lock || joined;
    $lock.style.display = lock ? 'inline-block' : 'none';
  }

  // 入力
  $join.onclick = joinNow;
  $cash.onclick = cashout;
  $bet.oninput=()=>{
    let v=Math.max(1,Math.floor($bet.value||0));
    v=Math.min(10000,v);
    const c=coinsOf(currentUser());
    if(v>c) v=c; $bet.value=v;
  };
  $betMax.onclick=()=>{
    if(phase==='lobby'){
      const v=Math.min(10000, coinsOf(currentUser()));
      $bet.value=v;
    }
  };

  resetPassengers(); resetRound(); loop();

  return {
    get phase(){ return phase; },
    setServerMult,
    forceCrashAt,
    setServerPhase,
    setLobbyCountdown
  };
}
