import { $, currentUser, historyOf } from './auth.js';

export function initHistory(){
  const $btn=$('historyBtn'), $modal=$('histModal'), $grid=$('histGrid'), $close=$('histClose');

  function open(){
    const data = historyOf(currentUser());
    $grid.innerHTML='';
    data.forEach(o=>{
      const cell=document.createElement('div'); cell.className='cell';
      cell.innerHTML=`<div class="id">${o.id}</div><div class="v ${o.v>=9?'hi':''}">${o.v.toFixed(2)}倍</div>`;
      $grid.appendChild(cell);
    });
    $modal.style.display='grid';
  }
  function close(){ $modal.style.display='none'; }

  $btn.onclick=open; $close.onclick=close;

  return { open, close };
}
