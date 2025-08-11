// public/ads.js
import { $, currentUser, coinsOf, setCoins } from './auth.js';

export function initAds(){
  const watchBtn = $('watchAdBtn');
  const modal = $('adModal');
  const adCount = $('adCount');
  const adBar = $('adBar');
  const adSlot = $('adSlot');
  const adClaim = $('adClaim');
  const adClose = $('adClose');

  let timer = null, left = 10;

  // ---- 同じタブで遷移するバナー（target 付けない）
  // 必要に応じてバナーの種類を差し替えてOK
  const HAPPYM_URL = 'https://is.gd/pcTwWJ';
  const banners = [
    `<a href="https://appollo.jp/api/lp/?acd=WYuaeKhMfyyHEoOsviFTUQ&title=">
       <img src="https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=1&device_type=0" alt="AD">
     </a>`,
    `<a href="https://appollo.jp/api/lp/?acd=WYuaeKhMfyyHEoOsviFTUQ&title=">
       <img src="https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=2&device_type=0" alt="AD">
     </a>`,
    `<a href="https://appollo.jp/api/lp/?acd=WYuaeKhMfyyHEoOsviFTUQ&title=">
       <img src="https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=3&device_type=0" alt="AD">
     </a>`,
    // 予備：ハッピーメール直リンク（画像は無し／テキスト）
    `<a href="${HAPPYM_URL}" style="display:inline-block;padding:8px 12px;border:1px solid #888;border-radius:8px">おすすめ案件を見る</a>`
  ];

  const openAd = ()=>{
    // 新規タブは開かない：モーダル内にバナーをそのまま表示
    const pick = Math.floor(Math.random()*banners.length);
    adSlot.innerHTML = banners[pick];

    left = 10;
    adCount.textContent = String(left);
    adBar.style.width = '0%';
    adClaim.disabled = true;
    modal.style.display = 'grid';

    timer = setInterval(()=>{
      left--;
      adCount.textContent = String(left);
      adBar.style.width = (100*(10-left)/10)+'%';
      if (left <= 0) {
        clearInterval(timer); timer=null;
        adClaim.disabled = false;
      }
    }, 1000);
  };

  const closeAd = ()=>{
    modal.style.display = 'none';
    if (timer) { clearInterval(timer); timer=null; }
  };

  watchBtn.onclick = ()=>{
    const u = currentUser();
    if (!u) { alert('先にログインしてください'); return; }
    if (coinsOf(u) > 0) { alert('所持が0のときだけ視聴できます'); return; }
    openAd();
  };

  adClaim.onclick = ()=>{
    const u = currentUser(); if (!u) return;
    setCoins(u, coinsOf(u) + 10);
    closeAd();
    alert('+10 付与しました');
  };

  adClose.onclick = closeAd;
  modal.addEventListener('click', (e)=>{ if(e.target===modal) closeAd(); });
}
