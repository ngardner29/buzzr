# Sports Guesser — Design (v1)

A daily player-guessing game like Poeltl/Weddle, for **NBA, NFL, and MLB**.

## Big-picture vision
- Home screen with three sports: **NBA, NFL, MLB**. Each opens its own screen.
- Two modes per sport:
  - **Daily** — one shared puzzle per day, like Wordle. *(Built first.)*
  - **Ranked** — players have a rank and race another real person to guess first. *(Built last; needs an online server, which Claude will handle.)*
- Players: **current/active roster players only** — no retired players.

## Gameplay (the guess)
Each guess shows a row of clue boxes, colored:
- 🟩 Green = exact match
- 🟧 Orange = close / partial credit
- ⬜ Gray = wrong (no red)
- ↑ / ↓ arrows on number clues = guess higher / lower

| Clue | 🟩 Green | 🟧 Orange (close) | ⬜ Gray |
|------|---------|------------------|--------|
| Team | same team | same conference, different team | other conference |
| Conference | same | — | different |
| Division | same | — | different |
| Position | same | related position (e.g. PG vs SG) | unrelated |
| Height | exact | within ~2 inches ↑/↓ | further ↑/↓ |
| Age | exact | within 2 years ↑/↓ | further ↑/↓ |
| Jersey # | exact | within 2 ↑/↓ | further ↑/↓ |

(NFL/MLB use their own column variants, e.g. MLB League/Division and Bats/Throws.)

Round rules: **8 guesses max.** Exact match = win. Out of guesses = reveal the answer.

## Tech approach
- Beginner-friendly **static site** (HTML/CSS/JS) — basically double-click to play.
- Player data stored as files the page loads (`data/nba.js`, `data/nfl.js`, `data/mlb.js`),
  all in the **same tidy format** so one game engine handles every sport.
- A **data-fetcher script** (`scripts/`) pulls current rosters from **ESPN's free data API**
  (one consistent source for all three sports) and writes the data files.
  Re-run occasionally to refresh rosters. Conference/division come from small built-in maps.

## File layout
```
sports-guesser/
├── index.html        the page you open
├── style.css         styling
├── game.js           guessing logic (added later)
├── data/{nba,nfl,mlb}.js   players + clues per sport
└── scripts/          the data-fetcher
```

## Build order (slices)
1. Project skeleton + **input box & dropdown** (real NBA data). ← current step
2. Core guess engine for NBA (clue coloring, 8 guesses, win/lose).
3. Daily mode (same secret player for everyone each day).
4. Add NFL + MLB (reuse engine, swap data).
5. Home screen + navigation between sports/modes.
6. Ranked mode + online server (advanced; Claude builds server).

## Data source notes
- ESPN endpoints, e.g. `site.api.espn.com/apis/site/v2/sports/{basketball/nba | football/nfl | baseball/mlb}/teams/{id}/roster`.
- Provides: name, jersey, position, height (inches + display), age, weight, college.
