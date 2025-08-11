// public/ads.js — スマホ対策：画像が出なくても確実にCTAを表示（非モジュール）
(function () {
  const HAPPYM_URL = 'https://is.gd/pcTwWJ';
  const banners = [
    'https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=1&device_type=0',
    'https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=2&device_type=0',
    'https://appollo.jp/api/bn/?acd=WYuaeKhMfyyHEoOsviFTUQ&banner_type=3&device_type=0',
  ];

  window.renderAdSlot = function renderAdSlot() {
    const slot = document.getElementById('adSlot');
    if (!slot) return;

    const pick = banners[(Math.random() * banners.length) | 0];

    const fallbackBtnHtml = `<a href="${HAPPYM_URL}" class="ad-cta">案件ページをひらく</a>`;
    const fallbackEscaped = fallbackBtnHtml
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    slot.innerHTML = `
      <a href="https://appollo.jp/api/lp/?acd=WYuaeKhMfyyHEoOsviFTUQ&title=">
        <img src="${pick}" alt="AD" style="max-width:100%;height:auto;display:block;margin:auto"
          onerror="this.parentElement.outerHTML='${fallbackEscaped}'">
      </a>
      <div style="margin-top:8px;text-align:center">
        <a href="${HAPPYM_URL}" class="ad-cta small">うまく表示されない場合はこちら</a>
      </div>
    `;
  };
})();
