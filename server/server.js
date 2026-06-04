/* ============================================================
   Sports Guesser — online ranked server.

   A small WebSocket server that:
     1. matches two waiting players (same sport),
     2. sends both a shared random seed (so they get the same player),
     3. referees the race (first to solve wins, disconnect = forfeit),
     4. updates Elo ratings and remembers them in ratings.json.

   Run locally:   cd server && npm install && npm start
   It listens on process.env.PORT (or 8080).
   ============================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;
const RATINGS_FILE = path.join(__dirname, "ratings.json");

/* ---------- Ratings (saved to a file so ranks persist) ---------- */

let ratings = {};
try {
  ratings = JSON.parse(fs.readFileSync(RATINGS_FILE, "utf8"));
} catch (e) {
  ratings = {};
}

function record(id) {
  if (!ratings[id]) ratings[id] = { rating: 1000, wins: 0, losses: 0, draws: 0 };
  return ratings[id];
}
function saveRatings() {
  try {
    fs.writeFileSync(RATINGS_FILE, JSON.stringify(ratings, null, 2));
  } catch (e) {
    console.error("could not save ratings:", e.message);
  }
}

// Standard Elo update. score: 1 = win, 0.5 = draw, 0 = loss.
function elo(rating, opponent, score) {
  const expected = 1 / (1 + Math.pow(10, (opponent - rating) / 400));
  return Math.round(rating + 32 * (score - expected));
}

/* ---------- Matchmaking ---------- */

const queues = { nba: [], nfl: [], mlb: [] };

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (e) {}
  }
}

// Remove a socket from every queue (used on disconnect / cancel).
function dequeue(ws) {
  for (const sport of Object.keys(queues)) {
    const i = queues[sport].indexOf(ws);
    if (i !== -1) queues[sport].splice(i, 1);
  }
}

function tryMatch(sport) {
  const q = queues[sport];
  while (q.length >= 2) {
    const a = q.shift();
    const b = q.shift();
    if (a.readyState !== a.OPEN) {
      if (b.readyState === b.OPEN) q.unshift(b);
      continue;
    }
    if (b.readyState !== b.OPEN) {
      if (a.readyState === a.OPEN) q.unshift(a);
      continue;
    }
    startMatch(a, b, sport);
  }
}

function startMatch(a, b, sport) {
  const seed = crypto.randomInt(0, 2 ** 31); // both browsers turn this into the same player
  const room = { sport, seed, players: [a, b], done: false, status: new Map() };
  a.match = room;
  b.match = room;
  send(a, { type: "matchFound", seed, sport, yourRating: record(a.playerId).rating, opponentRating: record(b.playerId).rating });
  send(b, { type: "matchFound", seed, sport, yourRating: record(b.playerId).rating, opponentRating: record(a.playerId).rating });
}

// Finish a match. winner = a socket, or null for a draw.
function finishMatch(room, winner) {
  if (room.done) return;
  room.done = true;
  const [a, b] = room.players;
  const ra = record(a.playerId).rating;
  const rb = record(b.playerId).rating;

  let sa, sb;
  if (winner === null) {
    sa = sb = 0.5;
  } else if (winner === a) {
    sa = 1;
    sb = 0;
  } else {
    sa = 0;
    sb = 1;
  }

  const na = elo(ra, rb, sa);
  const nb = elo(rb, ra, sb);

  const recA = record(a.playerId);
  const recB = record(b.playerId);
  recA.rating = na;
  recB.rating = nb;
  if (sa === 1) recA.wins++;
  else if (sa === 0) recA.losses++;
  else recA.draws++;
  if (sb === 1) recB.wins++;
  else if (sb === 0) recB.losses++;
  else recB.draws++;
  saveRatings();

  send(a, { type: "result", outcome: sa === 1 ? "win" : sa === 0.5 ? "draw" : "loss", newRating: na, delta: na - ra });
  send(b, { type: "result", outcome: sb === 1 ? "win" : sb === 0.5 ? "draw" : "loss", newRating: nb, delta: nb - rb });

  a.match = null;
  b.match = null;
}

function opponentOf(room, ws) {
  return room.players[0] === ws ? room.players[1] : room.players[0];
}

/* ---------- WebSocket wiring ---------- */

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Sports Guesser server is running.");
});

const wss = new WebSocketServer({ server });

wss.on("connection", function (ws) {
  ws.playerId = null;
  ws.match = null;

  ws.on("message", function (raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }

    if (msg.type === "queue") {
      ws.playerId = String(msg.playerId || crypto.randomUUID());
      const sport = queues[msg.sport] ? msg.sport : "nba";
      ws.sport = sport;
      dequeue(ws);
      queues[sport].push(ws);
      send(ws, { type: "searching" });
      tryMatch(sport);
      return;
    }

    if (msg.type === "cancel") {
      dequeue(ws);
      return;
    }

    if (msg.type === "progress" && ws.match && !ws.match.done) {
      const room = ws.match;
      // Tell the opponent how the race is going.
      send(opponentOf(room, ws), { type: "opponentProgress", guesses: msg.guesses, solved: !!msg.solved });

      if (msg.solved) {
        finishMatch(room, ws); // first to solve wins
      } else if (msg.guesses >= 8) {
        room.status.set(ws, "out");
        const [a, b] = room.players;
        if (room.status.get(a) === "out" && room.status.get(b) === "out") {
          finishMatch(room, null); // both failed -> draw
        }
      }
      return;
    }
  });

  ws.on("close", function () {
    dequeue(ws);
    if (ws.match && !ws.match.done) {
      finishMatch(ws.match, opponentOf(ws.match, ws)); // opponent wins by forfeit
    }
  });
});

server.listen(PORT, function () {
  console.log("Sports Guesser server listening on port " + PORT);
});
