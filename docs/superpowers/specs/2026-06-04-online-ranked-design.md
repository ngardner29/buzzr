# Online Ranked — Design

Goal: two real people, on different computers anywhere, **race** to guess the same
mystery player. Fastest to solve wins; both players' ranks go up/down (Elo).

## The pieces

```
   Player A's browser ─┐                          ┌─ Player B's browser
   (the game, static)  │   WebSocket (live link)  │   (the game, static)
                       └──────► SERVER ◄───────────┘
                                 │
                    matchmaking · race referee · Elo · saves ranks
```

- **Frontend** = the existing static game (HTML/CSS/JS). Can be hosted free on
  **GitHub Pages**. No change to how it's built.
- **Backend** = a small **Node.js WebSocket server** (`server/server.js`). It does
  the things only a shared, trusted middle can do:
  1. **Matchmaking** — puts two waiting players (same sport) into a match.
  2. **Same puzzle** — sends both a shared random **seed**; each browser turns the
     seed into the *same* secret player from its own (identical) data. No secret
     travels over the wire to pick apart.
  3. **Referee** — first to report "solved" wins; if someone disconnects, the other
     wins; both run out = draw.
  4. **Elo + ranks** — updates both ratings and remembers them in `ratings.json`.

- **Identity (no logins):** each browser makes a random ID once and stores it in
  `localStorage`. The server tracks your rating by that ID. (Real accounts later.)

## Message flow (WebSocket)

```
Browser → server:  {type:"queue",    playerId, sport}
server → both:     {type:"matchFound", seed, sport, yourRating, opponentRating}
Browser → server:  {type:"progress",  solved, guesses}     (sent after each guess)
server → opponent: {type:"opponentProgress", guesses, solved}   (for the live race)
server → both:     {type:"result",    outcome:"win|loss|draw", newRating, delta}
```

## Why this shape

- **Cheap & simple:** the server only relays small messages — it never needs the
  player database, because both browsers already have identical data and rebuild the
  same secret from the seed.
- **Keeps the static site:** the game itself stays a plain static page (easy hosting,
  easy for a beginner). Only the tiny server needs Node.
- **Offline still works:** if there's no server (or it's unreachable), Ranked falls
  back to the existing **AI ghost** mode, so the game never breaks.

## Going live — hosting (the one decision needed)

The static game → **GitHub Pages** (free). The server → a free Node host:

| Host | Good for | Note |
|------|----------|------|
| **Render** (recommended) | easiest Node WebSocket deploy | free tier sleeps when idle, wakes on use |
| **Railway** | simple, fast | small monthly free credit |
| **Fly.io** | always-on small VM | a bit more setup |

Steps once a host is chosen: push to GitHub → connect the repo → it runs
`node server/server.js` → copy the `wss://…` URL into `SERVER_URL` in the frontend.

## v1 limits (hardening later)

- Clue checking happens in the browser, so the secret is derivable by a determined
  cheater. Fine for friends; later the server can referee guesses itself.
- No accounts/leaderboard yet — rank is per-browser ID. Accounts + a global
  leaderboard are a natural next step.
