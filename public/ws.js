// public/ws.js — WebSocket 接続とメッセージ処理
import { currentUser, coinsOf } from './auth.js';

export function connectWS(game){
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  const ws = new WebSocket(url);

  ws.addEventListener('open', ()=>{
    const name  = currentUser() || 'ゲスト';
    const coins = Number(coinsOf(name) || 0);
    ws.send(JSON.stringify({ type:'hello', name, coins }));
  });

  ws.addEventListener('message', (e)=>{
    let msg; try{ msg = JSON.parse(e.data); }catch{ return; }

    if (msg.type === 'init') {
      if (msg.phase) game.setServerPhase(msg.phase);
      if (typeof msg.crashAt === 'number') game.forceCrashAt(msg.crashAt);
      if (typeof msg.lobbyMsLeft === 'number') game.setLobbyCountdown(msg.lobbyMsLeft);
      return;
    }
    if (msg.type === 'lobby' && typeof msg.msLeft === 'number') {
      game.setLobbyCountdown(msg.msLeft); return;
    }
    if (msg.type === 'round' && msg.phase) {
      game.setServerPhase(msg.phase);
      if (typeof msg.crashAt === 'number') game.forceCrashAt(msg.crashAt);
      return;
    }
    if (msg.type === 'mult' && typeof msg.value === 'number') {
      game.setServerMult(msg.value); return;
    }
    if (msg.type === 'passengers' && Array.isArray(msg.list)) {
      game.setPassengers && game.setPassengers(msg.list); return;
    }
    if (msg.type === 'chat') {
      game.onChat && game.onChat(msg); return;
    }
    if (msg.type === 'eject' && typeof msg.name === 'string') {
      game.onEject && game.onEject(msg.name); return;
    }
  });

  // ゲームから送信するためのヘルパ
  window.wsSend = (obj)=>{
    if(ws.readyState === WebSocket.OPEN){
      ws.send(JSON.stringify(obj));
    }
  };
  window.wsChat = (text)=>{
    if(ws.readyState === WebSocket.OPEN){
      ws.send(JSON.stringify({ type:'chat', text }));
    }
  };
}
