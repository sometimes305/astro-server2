import { $, currentUser, historyOf } from './auth.js';

export function initHistoryUI(){
  const btn = $('historyBtn');
  const modal = $('histModal');
  const grid = $('histGrid');
  const close = $('histClose');

  const render = ()=>{
    const u = currentUser(); grid.innerHTML='';
    const list = historyOf(u).slice(0, 20);
    for (const m of list) {
      const item = document.createElement('div');
      item.className = 'hist';
      item.textContent = Number(m).toFixed(2) + '×';
      grid.appendChild(item);
    }
  };

  btn.onclick = ()=>{ render(); modal.style.display='grid'; };
  close.onclick = ()=>{ modal.style.display='none'; };
  modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.style.display='none'; });
}
