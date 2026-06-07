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
const { WebSocket, WebSocketServer } = require("ws");

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
  if (!ratings[id]) ratings[id] = { rating: 700, wins: 0, losses: 0, draws: 0 }; // 700 = Copper
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
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (e) {}
  }
}

// Private "invite a friend" rooms: code -> array of waiting sockets.
const privateRooms = {};

// Remove a socket from every queue + any private room (used on disconnect / cancel).
function dequeue(ws) {
  for (const sport of Object.keys(queues)) {
    const i = queues[sport].indexOf(ws);
    if (i !== -1) queues[sport].splice(i, 1);
  }
  if (ws.room && privateRooms[ws.room]) {
    const r = privateRooms[ws.room];
    const j = r.indexOf(ws);
    if (j !== -1) r.splice(j, 1);
    if (r.length === 0) delete privateRooms[ws.room];
  }
}

function tryMatch(sport) {
  const q = queues[sport];
  while (q.length >= 2) {
    const a = q.shift();
    const b = q.shift();
    if (a.readyState !== WebSocket.OPEN) {
      if (b.readyState === WebSocket.OPEN) q.unshift(b);
      continue;
    }
    if (b.readyState !== WebSocket.OPEN) {
      if (a.readyState === WebSocket.OPEN) q.unshift(a);
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
  // Relay each player's own local rating (sent when queueing) to the other.
  const ra = a.rating != null ? a.rating : 700;
  const rb = b.rating != null ? b.rating : 700;
  send(a, { type: "matchFound", seed, sport, yourRating: ra, opponentRating: rb });
  send(b, { type: "matchFound", seed, sport, yourRating: rb, opponentRating: ra });
}

// Try to pair the two newest players waiting in a private room.
function tryMatchRoom(code) {
  const r = privateRooms[code] || [];
  while (r.length >= 2) {
    const a = r.shift();
    const b = r.shift();
    if (a.readyState !== WebSocket.OPEN) {
      if (b.readyState === WebSocket.OPEN) r.unshift(b);
      continue;
    }
    if (b.readyState !== WebSocket.OPEN) {
      if (a.readyState === WebSocket.OPEN) r.unshift(a);
      continue;
    }
    startMatch(a, b, a.sport); // room uses the first player's sport
  }
  if ((privateRooms[code] || []).length === 0) delete privateRooms[code];
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
      ws.rating = typeof msg.rating === "number" ? msg.rating : 700;
      dequeue(ws);

      if (msg.room) {
        // Private match: only pair with someone using the same invite code.
        const code = String(msg.room).toUpperCase().slice(0, 12);
        ws.room = code;
        if (!privateRooms[code]) privateRooms[code] = [];
        privateRooms[code].push(ws);
        send(ws, { type: "searching", room: code });
        tryMatchRoom(code);
      } else {
        ws.room = null;
        queues[sport].push(ws);
        send(ws, { type: "searching" });
        tryMatch(sport);
      }
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
