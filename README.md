# astro-server2

シンプルな Express + WebSocket のゲームサーバーです。

## 起動

```powershell
cd C:\Codex\astro-server2
npm.cmd install
npm.cmd start
```

- デフォルト待受: `0.0.0.0:3000`
- ヘルスチェック: `GET /health`

## 環境変数

- `PORT` (default: `3000`)
- `HOST` (default: `0.0.0.0`)
- `LOBBY_MS` (default: `15000`)
- `CRASH_PAUSE_MS` (default: `5000`)
- `GAME_TICK_MS` (default: `100`)
- `WS_HEARTBEAT_MS` (default: `30000`)
- `WS_MAX_PAYLOAD` (default: `4096`)
- `CHAT_MAX_LEN` (default: `200`)

## 公開前チェック

1. Node.js は `20.x` 推奨（`package.json` の engines に準拠）。
2. 3000 番ポートを使う場合はファイアウォール/リバースプロキシを設定。
3. `GET /health` が `200` を返すことを確認。
4. プロセスマネージャ（例: pm2, NSSM, Docker restart policy）で自動再起動を有効化。
5. HTTPS 終端は nginx / Caddy / Cloudflare Tunnel などで実施。

## 最短デプロイ (Railway)

1. Railway アカウント作成: https://railway.app
2. このプロジェクトを GitHub に push
3. Railway で `New Project` -> `Deploy from GitHub repo` からこのリポジトリを選択
4. `Variables` に必要なら以下を設定
   - `HOST=0.0.0.0`
   - `PORT=3000` (通常は Railway 側の割当 PORT が優先されるので未設定でもOK)
5. Deploy 完了後、`Generate Domain` を押して公開 URL を取得
6. `https://<your-domain>/health` が `ok: true` ならプレイ可能

## ローカル Docker 起動

```powershell
cd C:\Codex\astro-server2
docker build -t astro-server2 .
docker run --rm -p 3000:3000 astro-server2
```