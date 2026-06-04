# 🏀🏈⚾ Sports Guesser

A daily player-guessing game like Poeltl/Weddle for **NBA, NFL, and MLB**.
Guess the mystery player in **8 tries** — each guess shows clues that turn
green (exact), orange (close), or gray (wrong), with ↑/↓ arrows.

## How to play

Just open **`index.html`** in a web browser (double-click it).

- **Tabs** at the top switch sport: 🏀 NBA · 🏈 NFL · ⚾ MLB.
- **Modes:**
  - **Daily** — the same mystery player for everyone, changes automatically each day.
  - **Free Play** — a random player you can replay as much as you want.
  - **🏆 Ranked** — race an AI "ghost" opponent; win to climb Bronze → Diamond.
    Your rank is saved in your browser.
- Type a name, press **Enter** to guess the top match.

## Clues

| Color | Meaning |
|-------|---------|
| 🟩 Green | exact match |
| 🟧 Orange | close (same conference, related position, within 2 of height/age/number, or a switch-hitter) |
| ⬜ Gray | wrong |
| ↑ / ↓ | the secret's height/age/number is higher / lower |

MLB also shows **Bats** and **Throws** (handedness).

## Project files

```
index.html      the page you open
style.css       styling
game.js         all the game logic (one engine runs all 3 sports)
data/*.js       current players + their clues, per sport
scripts/        the data fetcher + auto-refresh helpers
```

## Updating the players

Rosters change (trades, call-ups). To refresh by hand:

```
python3 scripts/fetch_players.py          # all three sports
python3 scripts/fetch_players.py nba      # just one
```

### Automatic daily refresh (optional)

- **In the cloud:** if you push this project to GitHub, the workflow in
  `.github/workflows/refresh-data.yml` refreshes the rosters every day for free.
- **On this Mac:** install the daily job (runs at 4 AM while the Mac is on):
  ```
  cp scripts/com.sportsguesser.refresh.plist ~/Library/LaunchAgents/
  launchctl load ~/Library/LaunchAgents/com.sportsguesser.refresh.plist
  ```

## Still to come

- 🎨 Visual design polish.
- 🌐 Real online Ranked (two real people racing live) — needs a hosted server.
  The ranked scoring (Elo) is already built; deploying a server swaps the ghost
  for a real opponent.

Data comes from ESPN's free public API.
