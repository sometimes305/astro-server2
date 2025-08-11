export function connectWS(game) {
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws, retry = 0;

  const openWS = () => {
    ws = new WebSocket(WS_URL);

    ws.addEventListener('open', () => { console.log('WS connected'); retry = 0; });

    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'init') {
        if (typeof msg.crashAt === 'number') game.forceCrashAt?.(msg.crashAt);
        if (msg.phase) game.setServerPhase?.(msg.phase);
        if (typeof msg.lobbyMsLeft === 'number') game.setLobbyCountdown?.(msg.lobbyMsLeft);
      }

      if (msg.type === 'round') {
        if (typeof msg.crashAt === 'number') game.forceCrashAt?.(msg.crashAt);
        if (msg.phase) game.setServerPhase?.(msg.phase);
        if (typeof msg.lobbyMsLeft === 'number') game.setLobbyCountdown?.(msg.lobbyMsLeft);
      }

      if (msg.type === 'lobby' && typeof msg.msLeft === 'number') {
        game.setLobbyCountdown?.(msg.msLeft);
      }

      if (msg.type === 'mult' && typeof msg.value === 'number') {
        game.setServerMult?.(msg.value);
      }
    });

    ws.addEventListener('close', () => {
      if (retry < 5) setTimeout(openWS, Math.min(1000 * 2 ** retry++, 8000));
    });
    ws.addEventListener('error', () => { try { ws.close(); } catch {} });
  };

  openWS();
}
