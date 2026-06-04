# Sports Guesser — online ranked server

A tiny Node.js WebSocket server that matches two players, referees their race,
and tracks Elo ranks. See `../docs/superpowers/specs/2026-06-04-online-ranked-design.md`
for the full design.

## Run it on your computer (for testing)

You need **Node.js** installed (https://nodejs.org — the "LTS" version). Then:

```
cd server
npm install        # downloads the one dependency (ws)
npm start          # starts the server on http://localhost:8080
```

Leave it running. Then open the game's `index.html`, go to **🏆 Ranked**, and click
**🌐 Find Online Match**. To test a real match, open the game in **two browser windows**
(or two browsers) and click Find Online Match in both — they'll be paired and race.

> The frontend points at `ws://localhost:8080` by default (see `SERVER_URL` near the
> top of `../online.js`). Change that to your real address after you deploy.

## Put it online (so friends can play from anywhere)

The server needs to run on a host that's always reachable. Easiest free option:

### Render (recommended)
1. Push this whole project to a GitHub repo.
2. On https://render.com → **New → Web Service** → connect the repo.
3. Settings: **Root Directory** = `server`, **Build Command** = `npm install`,
   **Start Command** = `npm start`.
4. Render gives you a URL like `https://sports-guesser.onrender.com`. The WebSocket
   address is the same with `wss://` → `wss://sports-guesser.onrender.com`.
5. Put that in `SERVER_URL` in `online.js`, and host the game itself on
   **GitHub Pages** (Settings → Pages).

Other hosts (Railway, Fly.io, Glitch) work the same way — they just need to run
`node server.js` and expose the port in `process.env.PORT`.

## How it works (quick version)

- A player sends `{type:"queue", playerId, sport}`.
- When two are waiting for the same sport, the server sends both
  `{type:"matchFound", seed, ...}`. Each browser turns the seed into the same player.
- After each guess a player sends `{type:"progress", solved, guesses}`.
- First to `solved:true` wins; a disconnect forfeits; both failing is a draw.
- The server updates both Elo ratings and saves them in `ratings.json`.
