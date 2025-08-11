import { $, currentUser, coinsOf, setCoins, pushHistory } from './auth.js';

// —— ログ表示
const log = (html)=>{ const el=$('log'); const d=document.createElement('div'); d.innerHTML=html; el.prepend(d); };

// —— 分布：即爆p + Lomax(α, λ) で 全体中央値=1.5×
const MEDIAN_TARGET = 1.5;
const INSTANT_CRASH_PROB = 0.03;  // 即爆3%
const SHAPE_ALPHA = 1.1;          // ←高倍率を出やすくするパラメータ（小さいほど重い尾）

function computeLomaxScale(alpha, m = MEDIAN_TARGET, p = INSTANT_CRASH_PROB){
  const q = (0.5 - p) / (1 - p); // F_Y(m-1)
  const denom = Math.pow(1 - q, -1/alpha) - 1;
  return (m - 1) / denom;
}
const LOMAX_SCALE = computeLomaxScale(SHAPE_ALPHA);

export function sampleCrash(){
  if(Math.random()<INSTANT_CRASH_PROB) return 1.01;
  const U = Math.random();
  const y = LOMAX_SCALE * (Math.pow(U, -1/SHAPE_ALPHA) - 1); // Y=X-1
  return 1 + y; // 上限なし（超高倍率も極稀に出る）
}

export function initGame(api){
  // refs
  const $bal=$('balance'), $wallet=$('wallet');
  const $state=$('stateLabel'), $count=$('countdown'), $mult=$('mult');
  const $join=$('joinBtn'), $cash=$('cashoutBtn'), $newR=$('newRoundBtn');
  const $bet=$('bet'), $betMax=$('betMax'), $lock=$('lockTip');
  const $stage=$('stage'), $stars=$('stars'), $rocket=$('rocket');
  const $passengers=$('passengers');

  // 星生成
  for(let i=0;i<200;i++){const s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=(Math.random()*-2000)+'px';s.style.animationDelay=(Math.random()*2.4)+'s';s.style.opacity=.3+Math.random()*.7;$stars.appendChild(s);}

  // 乗客（あなた＋ボット）
  const BOT_COUNT=8;
  let passengers=[]; const rndName=()=>{const a=['あき','そら','レン','ユナ','ハル','ミナト','カイ','ノア','サラ','ユズ','リオ','メイ','タク','シン','ナナ'];return a[(Math.random()*a.length)|0];};
  function resetPassengers(){
    passengers=[]; passengers.push({id:'you',name:'あなた',bet:0,joined:false,status:'待機',cashAt:null,gain:0});
    for(let i=0;i<BOT_COUNT;i++){ passengers.push({id:'b'+i,name:rndName(),bet:0,joined:false,status:'待機',cashAt:null,gain:0,coins:100+((Math.random()*50)|0)*10}); }
    renderPassengers();
  }
  function renderPassengers(){
    $passengers.innerHTML='';
    for(const p of passengers){
      const row=document.createElement('div'); row.className='row';
      row.innerHTML=`<div class="ava">${p.id==='you'?'🧑‍🚀':'👨‍🚀'}</div>
        <div class="name">${p.name}<div class="stat">${p.status}</div></div>
        <div>${p.joined?(p.bet).toLocaleString('ja-JP'):'-'}</div>
        <div>${p.gain>0?'<span class="pwin">+'+p.gain.toLocaleString('ja-JP')+'</span>': (p.joined && phase!=='idle' ? (phase==='crashed' && p.cashAt===null ? '<span class="plose">LOSE</span>' : ''):'')}</div>`;
      $passengers.appendChild(row); p._row=row;
    }
  }
  const updateRow=(p)=>{ if(!p._row)return; p._row.querySelector('.stat').textContent=p.status; const g=p._row.children[3];
    g.innerHTML=p.gain>0?`<span class="pwin">+${p.gain.toLocaleString('ja-JP')}</span>`:(p.joined && phase!=='idle'?(phase==='crashed'&&p.cashAt===null?'<span class="plose">LOSE</span>':''):''); };

  // 状態
  let phase='idle', mult=1.00, crashAt=1.5, joined=false, betAmt=0, youCashed=false;
  let lobbyEnd=0, lockAt=0, lastTick=performance.now(), loopId=0;

  const stages=[{t:5,r:1.15},{t:10,r:1.28},{t:25,r:1.45},{t:50,r:1.6},{t:100,r:1.8},{t:1e3,r:2.0},{t:1e4,r:2.3},{t:1e6,r:2.6},{t:1e8,r:3.0}];
  const rateFor=(m)=>{ for(let i=0;i<stages.length;i++){ if(m<stages[i].t) return stages[i].r; } return stages.at(-1).r; };
  const spawnRing=()=>{ const r=document.createElement('div'); r.className='boostRing'; $stage.appendChild(r); setTimeout(()=>r.remove(),600); $rocket.classList.add('shake'); setTimeout(()=> $rocket.classList.remove('shake'),260); };
  const setPhase=(s)=>{ phase=s; $state.textContent=({idle:'待機中',lobby:'搭乗受付中',flight:'上昇中',crashed:'爆発…'})[s]||s; };

  function updateWalletBars(){ const u=currentUser(); const c=coinsOf(u); $bal.textContent=$wallet.textContent=c.toLocaleString('ja-JP'); }

  function updateUI(){
    $mult.textContent = mult.toFixed(2)+'×';
    const h = Math.min(1, Math.log10(mult)/Math.log10(1e2)); // 100xでほぼ上
    let y = 210 - h*260; const topMin=20;
    if(y<topMin){ y=topMin; const starOffset=-(mult-1)*2; $stars.style.transform=`translateY(${starOffset}px)`; } else { $stars.style.transform='translateY(0px)'; }
    $rocket.style.top=y+'px';
    updateWalletBars();
  }

  function resetRound(){
    cancelAnimationFrame(loopId);
    mult=1.00; youCashed=false; joined=false; betAmt=0; $bet.disabled=false; $cash.disabled=true; $newR.disabled=true;
    $rocket.classList.remove('explode'); setPhase('idle'); updateUI(); resetPassengers();
    setTimeout(startLobby,1000); // 自動受付
  }

  function startLobby(){
    if(phase!=='idle') return;
    setPhase('lobby'); lobbyEnd=performance.now()+15000; lockAt=lobbyEnd-1000;
    loop();
  }

  function beginFlight(){
    $bet.disabled=true;
    let v=Math.max(1, Math.floor($bet.value||0)); v=Math.min(10000, v);
    const u=currentUser(); let c=coinsOf(u); if(v>c) v=c;
    joined = v>0; betAmt=joined? v:0;
    if(joined){ setCoins(u, c-betAmt); updateWalletBars(); }
    // クラッシュ倍率をサンプリング
    crashAt = sampleCrash();
    setPhase('flight'); lastTick=performance.now(); spawnRing();
  }

  function crash(){
    setPhase('crashed'); $rocket.classList.add('explode'); spawnRing();
    const u=currentUser(); pushHistory(u, mult); // 履歴
    if(joined && !youCashed){ log(`爆発！ <b style="color:var(--bad)">${mult.toFixed(2)}×</b> 前に帰還できず… <span class="tag no">LOSE</span>（-${betAmt.toLocaleString('ja-JP')}）`); }
    setTimeout(()=> resetRound(),1500);
  }

  function cashout(){
    if(phase!=='flight'||youCashed) return;
    const u=currentUser();
    const gain=Math.floor(betAmt*mult); setCoins(u, coinsOf(u)+gain); youCashed=true;
    log(`帰還成功！ <b style="color:var(--good)">${mult.toFixed(2)}×</b> で <b>+${gain.toLocaleString('ja-JP')}</b> 星粒。<span class="tag ok">WIN</span>`);
    updateWalletBars();
  }

  function loop(){
    loopId=requestAnimationFrame(loop);
    const now=performance.now(); const dt=(now-lastTick)/1000; lastTick=now;

    if(phase==='lobby'){
      if(now>=lockAt) $bet.disabled=true;
      if(now>=lobbyEnd) beginFlight();
      $count.textContent=Math.max(0,Math.ceil((lobbyEnd-now)/1000))+'秒'; updateUI(); return;
    }

    if(phase==='flight'){
      const r=rateFor(mult); const prev=mult; mult = mult*Math.pow(r,dt);
      const marks=[5,10,25,50,100,1e3,1e4,1e6]; for(const x of marks){ if(prev<x && mult>=x){ spawnRing(); break; } }
      if(mult>=crashAt){ mult=crashAt; crash(); }
      $cash.disabled = !(phase==='flight' && joined && !youCashed);
      updateUI(); return;
    }
  }

  // 入力系
  $cash.onclick=cashout;
  $newR.onclick=()=>resetRound();
  $bet.oninput=()=>{ let v=Math.max(1,Math.floor($bet.value||0)); v=Math.min(10000,v); const c=coinsOf(currentUser()); if(v>c) v=c; $bet.value=v; };
  $betMax.onclick=()=>{ if(phase==='lobby' && performance.now()<lockAt){ const v=Math.min(10000, coinsOf(currentUser())); $bet.value=v; } };

  // 初期化
  resetPassengers();
  resetRound();

  return {
    // 将来オンライン連携用のAPI
    get phase(){ return phase; },
    setServerMult(v){ mult=v; }, // サーバー配信倍率で上書き
    forceCrashAt(v){ crashAt=v; },
  };
}
