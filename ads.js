import { $, currentUser, coinsOf, setCoins } from './auth.js';

const BANNERS = [
  `<a href="https://appollo.jp/api/lp/?acd=WYuaeKhMfyyHEoOsviFTUQ&title=" target="_blank" rel="noopener"><img src="https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=1&device_type=0" alt="banner1"></a><img src="https://appollo.jp/api/imp/?acd=WYuaeKhMfyyHEoOsviFTUQ&device_type=" style="display:none">`,
  `<a href="https://appollo.jp/api/lp/?acd=WYuaeKhMfyyHEoOsviFTUQ&title=" target="_blank" rel="noopener"><img src="https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=2&device_type=0" alt="banner2"></a><img src="https://appollo.jp/api/imp/?acd=WYuaeKhMfyyHEoOsviFTUQ&device_type=" style="display:none">`,
  `<a href="https://appollo.jp/api/lp/?acd=WYuaeKhMfyyHEoOsviFTUQ&title=" target="_blank" rel="noopener"><img src="https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=3&device_type=0" alt="banner3"></a><img src="https://appollo.jp/api/imp/?acd=WYuaeKhMfyyHEoOsviFTUQ&device_type=" style="display:none">`,
  `<a href="https://appollo.jp/api/lp/?acd=WYuaeKhMfyyHEoOsviFTUQ&title=" target="_blank" rel="noopener"><img src="https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=1&device_type=1" alt="banner4"></a><img src="https://appollo.jp/api/imp/?acd=WYuaeKhMfyyHEoOsviFTUQ&device_type=" style="display:none">`,
  `<p style="margin:8px 0 0;"><a href="https://is.gd/pcTwWJ" target="_blank" rel="noopener">🔗 公式リンクはこちら</a></p>`
];

export function initAds(){
  const $wallet=$('wallet'), $bal=$('balance');
  const $watch=$('watchAdBtn'), $adModal=$('adModal'), $adBar=$('adBar'), $adCount=$('adCount'), $adClaim=$('adClaim'), $adSlot=$('adSlot');

  function refresh(){
    const c=coinsOf(currentUser());
    $wallet.textContent=$bal.textContent=c.toLocaleString('ja-JP');
    $watch.disabled = false;
  }

  function openAd(){
    if(coinsOf(currentUser())!==0){ alert('所持コインが0のときに視聴できます'); return; }
    $adModal.style.display='grid';
    $adSlot.innerHTML = BANNERS[(Math.random()*4|0)] + BANNERS[4];
    $adBar.style.width='0%'; $adClaim.disabled=true;
    let t=10; $adCount.textContent=t;
    const iv=setInterval(()=>{ t--; $adCount.textContent=t; $adBar.style.width=(100*(10-t)/10)+'%'; if(t<=0){ clearInterval(iv); $adCount.textContent='OK'; $adClaim.disabled=false; } },1000);
  }
  function closeAd(){ $adModal.style.display='none'; }
  function claim(){ closeAd(); const u=currentUser(); setCoins(u, coinsOf(u)+10); refresh(); }

  $watch.onclick=openAd;
  $adClaim.onclick=claim;

  refresh();
  return { refreshWallet: refresh };
}
