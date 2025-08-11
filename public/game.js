// サーバ同期版 game.js（上限撤廃・他ユーザー表示・カウントダウン0まで・スマホ入力修正）
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
  const $stars=$('stars'), $rocket=$('rocket');

  // 背景の星
  for(let i=0;i<200;i++){
    const s=document.createElement('div'); s.className='star';
    s.style.left=Math.random()*100+'%';
    s.style.top=(Math.random()*-2000)+'px';
    s.style.animationDelay=(Math.random()*2.4)+'s';
    s.style.opacity=.3+Math.random()*.7;
    $stars.appendChild(s);
  }

  // 状態
  let phase='idle', mult=1.00, crashAt=1.5, joined=false, betAmt=0, youCashed=false;
  let loopId=0;

  const setPhase=(s)=>{ phase=s; $state.textContent=({idle:'待機中',lobby:'搭乗受付中',flight:'上昇中',crashed:'爆発…'})[s]||s; };

  function updateWalletBars(){
    const u=currentUser(); const c=coinsOf(u);
    $bal.textContent=$wallet.textContent=c.toLocaleString('ja-JP');
    window.wsSend && window.wsSend({ type:'wallet', coins:c });
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
    $rocket.classList.remove('explode'); setPhase('idle'); updateUI();
  }

  function joinNow(){
    if (phase !== 'lobby' || joined) return;
    let v = parseSafeBet($bet.value);
    const u = currentUser(); let c = coinsOf(u);
    if (v > c) v = c;
    if (v <= 0) return;

    joined = true; betAmt = v;
    setCoins(u, c - betAmt);
    updateWalletBars();
    $join.disabled = true;
    $bet.disabled  = true;
    log(`搭乗！ ベット <b>${betAmt.toLocaleString('ja-JP')}</b> 星粒`);
    window.wsSend && window.wsSend({ type:'join', bet: betAmt });
  }

  function cashout(){
    if(phase!=='flight' || youCashed) return;
    const u=currentUser();
    const gain=Math.floor(betAmt*mult);
    setCoins(u, coinsOf(u)+gain); youCashed=true;
    log(`帰還成功！ <b style="color:var(--good)">${mult.toFixed(2)}×</b> で <b>+${gain.toLocaleString('ja-JP')}</b> 星粒。<span class="tag ok">WIN</span>`);
    updateWalletBars();
    window.wsSend && window.wsSend({ type:'cashout', gain });
  }

  function loop(){
    loopId=requestAnimationFrame(loop);
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

    const lockNow = msLeft <= 1000;
    $bet.disabled  = lockNow || joined;
    $join.disabled = lockNow || joined;
    const lockEl = document.getElementById('lockTip'); if(lockEl){
      lockEl.style.display = lockNow ? 'inline-block' : 'none';
    }
  }

  // ===== 入力（上限撤廃：所持コインまで） =====
  function parseSafeBet(val){
    let s = String(val || '').replace(/[^\d]/g,'');
    if (s === '') s = '0';
    s = String(parseInt(s,10) || 0);
    let v = Math.max(0, parseInt(s,10));
    const c = coinsOf(currentUser());
    if (v > c) v = c; // 所持コインが上限
    return v;
  }

  // 入力イベント
  $join.onclick = joinNow;
  $cash.onclick = cashout;
  $bet.oninput = ()=>{
    $bet.value = String(parseSafeBet($bet.value));
  };
  $betMax.onclick=()=>{
    if(phase==='lobby'){
      const v = coinsOf(currentUser()); // 全額
      $bet.value = String(v);
    }
  };

  resetRound(); loop();

  return {
    get phase(){ return phase; },
    setServerMult,
    forceCrashAt,
    setServerPhase,
    setLobbyCountdown,
    setPassengers: (list)=>renderPassengersList(list), // 別ファイルで既に追加済み想定
  };
}

// 参加者表示が別にある場合はそちらを使用
function renderPassengersList(list){
  const box = document.getElementById('passengers');
  if (!box) return;
  box.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'row head';
  head.innerHTML = `
    <div class="ava">👥</div>
    <div class="name">ユーザー</div>
    <div class="coins">所持金</div>
    <div class="bet">掛け金</div>
    <div class="gain">獲得</div>`;
  box.appendChild(head);
  list.forEach(p=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="ava">🧑‍🚀</div>
      <div class="name">${String(p.name||'？？')}</div>
      <div class="coins">${p.coins!=null ? Number(p.coins).toLocaleString('ja-JP') : '-'}</div>
      <div class="bet">${p.joined ? Number(p.bet).toLocaleString('ja-JP') : '-'}</div>
      <div class="gain">${p.gain>0 ? ('+'+Number(p.gain).toLocaleString('ja-JP')) : ''}</div>`;
    box.appendChild(row);
  });
}
