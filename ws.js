export function connectWS(game){
  const WS_URL = ""; // 例: "wss://xxxxx.onrender.com" （使う時に入れてね）
  if(!WS_URL) return;

  try{
    const ws = new WebSocket(WS_URL);
    ws.addEventListener('open', ()=> console.log('WS connected'));
    ws.addEventListener('message', (e)=>{
      const msg = JSON.parse(e.data);
      if(msg.type==='mult' && typeof msg.value==='number'){
        game.setServerMult(msg.value);
      }
      if(msg.type==='round' && msg.phase==='crash' && typeof msg.crashAt==='number'){
        game.forceCrashAt(msg.crashAt);
      }
    });
  }catch(err){
    console.warn('WS error', err);
  }
}
