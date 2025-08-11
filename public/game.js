// サーバ同期版 game.js（地面追加：ロビーで地面表示→発射で降下、炎OFF/ON、見切れ防止）
import { $, currentUser, coinsOf, setCoins, pushHistory } from './auth.js';

const log = (html)=>{
  const el=$('log'); const d=document.createElement('div');
  d.innerHTML=html; el.prepend(d);
};

export function initGame(){
  const $bal=$('balance'), $wallet=$('wallet');
  const $state=$('stateLabel'), $count=$('countdown'), $mult=$('mult');
  const $join=$('joinBtn'), $cash=$('cashoutBtn');
  const $bet=$('bet'), $betMax=$('betMax');
  const $stars=$('stars'), $rocket=$('rocket');
  const $space=$('space'), $ground=$('ground');
  const $chatLog = $('chatLog'), $chatText = $('chatText'), $chatSend = $('chatSend');

  // 星を増量（600）＋サイズ3種＋個別ドリフト
  const STAR_COUNT = 600;
  for (let i = 0; i < STAR_COUNT; i++) {
    const s = document.createElement('div');
    const kind = (Math.random() < 0.12) ? 's3' : (Math.random() < 0.5 ? 's2' : 's1');
    s.className = `star ${kind}`;
    s.style.left = (Math.random() * 100) + '%';
    s.style.top = (Math.random() * 100 - 120) + 'vh';
    s.style.animationDelay = (Math.random() * 2.4) + 's';
    const fall = kind === 's3' ? 26 + Math.random() * 8
               : kind === 's2' ? 36 + Math.random() * 8
               : 52 + Math.random() * 10;
    s.style.setProperty('--fall', fall + 's');
    $stars.appendChild(s);
  }

  // 状態
  let phase='idle', mult=1.00, crashAt=1.5, joined=false, betAmt=0, youCashed=false;
  let loopId=0;

  const setPhase=(s)=>{
    phase=s;
    $state.textContent=({idle:'待機中',lobby:'搭乗受付中',flight:'上昇中',crashed:'爆発…'})[s]||s;

    // 地面と炎の切替
    if (s === 'lobby' || s === 'idle') {
      $ground?.classList.remove('off');
      $rocket?.classList.add('idle');   // 炎OFF
    }
    if (s === 'flight') {
      // 地面を下に退避、炎ON
      $ground?.classList.add('off');
      $rocket?.classList.remove('idle');
    }
  };

  function updateWalletBars(){
    const u=currentUser(); const c=coinsOf(u);
    $bal.textContent=$wallet.textContent=c.toLocaleString('ja-JP');
    window.wsSend && window.wsSend({ type:'wallet', coins:c });
  }

  // 背景パララックス：倍率に応じて下方向に流す（上昇に見える）
  function updateParallax(){
    const k = Math.log10(Math.max(mult,1)); // 0..∞
    const dy_near =  k * 160;
    const dy_mid  =  k * 90;
    const dy_deep =  k * 40;
    const near = $space.querySelector('.layer-near');
    const mid  = $space.querySelector('.layer-mid');
    const deep = $space.querySelector('.layer-deep');
    if (near) near.style.transform = `translateY(${dy_near}px)`;
    if (mid)  mid.style.transform  = `translateY(${dy_mid}px)`;
    if (deep) deep.style.transform = `translateY(${dy_deep}px)`;
  }

  // ロケットのY座標（ロビー時は地面の上に正確に立てる／飛行時は倍率で上昇）
  function computeRocketTop(){
    const stage = $('stage').getBoundingClientRect();
    const rct   = $rocket.getBoundingClientRect();
    const root  = getComputedStyle(document.documentElement);
    const groundH = parseInt(root.getPropertyValue('--ground-h')) || 96;

    if (phase === 'lobby' || phase === 'idle') {
      // 地面上の発射台にしっかり接地（見切れ防止）
      const y = stage.height - groundH - rct.height + 16; // ちょい沈めで安定感
      return Math.max(20, y);
    }
    // 飛行時：以前のロジックで上昇
    const h = Math.min(1, Math.log10(Math.max(mult,1))/Math.log10(1e2)); // 100xで上端付近
    let y = 210 - h*260;
    const minTop = 20;
    return Math.max(minTop, y);
  }

  function updateUI(){
    $mult.textContent = mult.toFixed(2)+'×';
    $rocket.style.top = computeRocketTop() + 'px';
    updateParallax();
    updateWalletBars();
  }

  function resetRound(){
    cancelAnimationFrame(loopId); loopId=0;
    mult=1.00; youCashed=false; joined=false; betAmt=0;
    $bet.disabled=false; $cash.disabled=true; $join.disabled=true;
    $rocket.classList.remove('explode');
    setPhase('idle'); updateUI();
  }

  function parseSafeBet(val){
    let s = String(val || '').replace(/[^\d]/g,'');
    if (s === '') s = '0';
    s = String(parseInt(s,10) || 0);
    let v = Math.max(0, parseInt(s,10));
    const c = coinsOf(currentUser());
    if (v > c) v = c;
    return v;
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
    spawnEjector('YOU');
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
      setPhase('flight'); // 地面OFF & 炎ON
      $join.disabled=true; $bet.disabled=true;
      $cash.disabled = joined && !youCashed;
      if (!loopId) loop();
    }
    if (p === 'crash') {
      setPhase('crashed');
      $rocket.classList.add('explode');
      spawnExplosion();
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

  // ロビー残り時間の表示＆ロック
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

  // 参加者一覧
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
        <div class="name">${escapeHtml(p.name||'？？')}</div>
        <div class="coins">${p.coins!=null ? Number(p.coins).toLocaleString('ja-JP') : '-'}</div>
        <div class="bet">${p.joined ? Number(p.bet).toLocaleString('ja-JP') : '-'}</div>
        <div class="gain">${p.gain>0 ? ('+'+Number(p.gain).toLocaleString('ja-JP')) : ''}</div>`;
      box.appendChild(row);
    });
  }

  // チャット
  function addChatLine({name, text, ts}){
    if(!$chatLog) return;
    const d = document.createElement('div');
    const time = new Date(ts||Date.now());
    const hh = String(time.getHours()).padStart(2,'0');
    const mm = String(time.getMinutes()).padStart(2,'0');
    d.className = 'chat-line';
    d.innerHTML = `<span class="t">[${hh}:${mm}]</span> <b class="n">${escapeHtml(name||'？')}</b>: ${escapeHtml(text||'')}`;
    $chatLog.appendChild(d);
    $chatLog.scrollTop = $chatLog.scrollHeight;
  }
  if ($chatSend && $chatText) {
    const send = ()=>{
      const t = $chatText.value.trim();
      if (!t) return;
      window.wsChat && window.wsChat(t);
      $chatText.value = '';
    };
    $chatSend.onclick = send;
    $chatText.onkeydown = (e)=>{ if(e.key==='Enter') send(); };
  }

  // 脱出演出
  function spawnEjector(label='YOU'){
    const stage = document.getElementById('stage');
    const r = $rocket.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    const x = r.left - st.left + r.width*0.5;
    const y = r.top  - st.top  + r.height*0.2;

    const guy = document.createElement('div');
    guy.className = 'ejector';
    guy.innerHTML = `🧑‍🚀<span class="tag">${escapeHtml(label)}</span>`;
    guy.style.left = x + 'px';
    guy.style.top  = y + 'px';
    stage.appendChild(guy);

    guy.animate([
      { transform: 'translate(0,0) rotate(-10deg)', opacity: 1 },
      { transform: 'translate(-40px,-60px) rotate(-40deg)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-80px,120px) rotate(60deg)', opacity: 0.9, offset: 0.6 },
      { transform: 'translate(-80px,260px) rotate(80deg)', opacity: 0 }
    ], { duration: 1200, easing: 'ease-out' }).onfinish = ()=> guy.remove();
  }

  // 爆発演出
  function spawnExplosion(){
    const stage = document.getElementById('stage');
    const r = $rocket.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    const cx = r.left - st.left + r.width*0.5;
    const cy = r.top  - st.top  + r.height*0.4;

    for(let i=0;i<26;i++){
      const p = document.createElement('div');
      p.className = 'boom';
      p.style.left = cx + 'px';
      p.style.top  = cy + 'px';
      stage.appendChild(p);
      const ang = Math.random()*Math.PI*2;
      const dist= 60 + Math.random()*90;
      const tx = Math.cos(ang)*dist;
      const ty = Math.sin(ang)*dist;
      p.animate([
        { transform:'translate(0,0) scale(1)', opacity:1 },
        { transform:`translate(${tx}px,${ty}px) scale(0.2)`, opacity:0 }
      ], { duration: 720 + Math.random()*380, easing:'cubic-bezier(.2,.6,.3,1)' })
      .onfinish = ()=> p.remove();
    }
  }

  // 入力
  $join.onclick = joinNow;
  $cash.onclick = cashout;
  $bet.oninput = ()=>{ $bet.value = String(parseSafeBet($bet.value)); };
  $betMax.onclick=()=>{ if(phase==='lobby'){ const v = coinsOf(currentUser()); $bet.value = String(v); } };

  resetRound(); loop();

  return {
    get phase(){ return phase; },
    setServerMult,
    forceCrashAt,
    setServerPhase,
    setLobbyCountdown,
    setPassengers: (list)=>renderPassengersList(list),
    onChat: addChatLine,
    onEject: (name)=> spawnEjector(name || 'PLAYER'),
  };
}

// utils
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
