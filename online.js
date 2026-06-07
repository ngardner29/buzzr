/* ============================================================
   Sports Guesser — online ranked client.

   Talks to server/server.js over a WebSocket to find a real
   opponent and race them. This file is self-contained: if the
   server isn't reachable, nothing here breaks the offline game.

   ⬇️ When you deploy the server, change this to your server's address.
      Local testing:  ws://localhost:8080
      Deployed (https site):  wss://your-server-address
   ============================================================ */

const SERVER_URL = "ws://localhost:8080";

let socket = null;
let onlineOppGuesses = 0;
let onlineRating = 1000;

const findOnlineBtn = document.getElementById("find-online");

/* ---------- A stable anonymous id for this browser (no login) ---------- */
function getPlayerId() {
  let id = null;
  try {
    id = localStorage.getItem("sg_pid");
  } catch (e) {}
  if (!id) {
    id =
      window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : "p_" + Math.floor(Math.random() * 1e9) + "_" + Date.now();
    try {
      localStorage.setItem("sg_pid", id);
    } catch (e) {}
  }
  return id;
}

/* ---------- Connecting and messaging ---------- */

function netSend(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

function findOnlineMatch() {
  statusEl.textContent = "🌐 Connecting to the online server…";
  if (socket && socket.readyState === WebSocket.OPEN) {
    queueNow();
    return;
  }
  try {
    socket = new WebSocket(SERVER_URL);
  } catch (e) {
    onNetError();
    return;
  }
  socket.addEventListener("open", queueNow);
  socket.addEventListener("message", (e) => handleServerMessage(JSON.parse(e.data)));
  socket.addEventListener("error", onNetError);
}

function queueNow() {
  statusEl.textContent = "🔎 Searching for an opponent in " + SPORTS[sportKey].name + "…";
  netSend({ type: "queue", playerId: getPlayerId(), sport: sportKey });
}

function onNetError() {
  statusEl.textContent =
    "⚠️ Couldn't reach the online server. Make sure it's running or deployed — you can still play Ranked vs the AI.";
}

function handleServerMessage(msg) {
  if (msg.type === "matchFound") {
    startOnlineGame(msg.seed, msg.sport, msg.yourRating, msg.opponentRating);
  } else if (msg.type === "opponentProgress") {
    onlineOppGuesses = msg.guesses;
    if (!gameOver) updateOnlineStatus();
  } else if (msg.type === "result") {
    showOnlineResult(msg);
  }
}

/* ---------- Running an online match ---------- */

function startOnlineGame(seed, sportName, yourRating, oppRating) {
  // Make sure we're on the right sport (the server decides which).
  if (SPORTS[sportName]) {
    sportKey = sportName;
    sport = SPORTS[sportName];
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.sport === sportName));
    applyColumns();
  }

  mode = "online";
  modeBtns.forEach((b) => b.classList.remove("active"));
  players = playable(sportKey);

  // Both browsers turn the SAME seed into the SAME secret player.
  const idx = ((seed % players.length) + players.length) % players.length;
  secret = players[idx];

  guessesLeft = MAX_GUESSES;
  gameOver = false;
  guessedNames = new Set();
  rows.innerHTML = "";
  input.value = "";
  dropdown.innerHTML = "";

  onlineOppGuesses = 0;
  onlineRating = yourRating;
  if (rankEl) {
    rankEl.style.display = "";
    rankEl.textContent = "Online Rank: " + yourRating + "  (opponent " + oppRating + ")";
  }
  updateOnlineStatus();
}

function updateOnlineStatus() {
  statusEl.textContent =
    "🌐 Online " + sport.name + " race — " + guessesLeft + " guesses left · Opponent: " +
    onlineOppGuesses + " guesses";
}

// Called from game.js after each guess while in an online match.
function onlineAfterGuess(won) {
  const guesses = MAX_GUESSES - guessesLeft;
  netSend({ type: "progress", solved: won, guesses: guesses });
  if (won) {
    gameOver = true;
    statusEl.textContent = "✅ You solved it in " + guesses + "! Waiting for the result…";
  } else if (guessesLeft <= 0) {
    gameOver = true;
    statusEl.textContent = "😬 Out of guesses — waiting to see if your opponent finishes…";
  } else {
    updateOnlineStatus();
  }
}

function showOnlineResult(msg) {
  gameOver = true;
  if (msg.outcome !== "win") revealSecret(); // show who it was at the bottom
  onlineRating = msg.newRating;
  const sign = msg.delta >= 0 ? "+" : "";
  const label =
    msg.outcome === "win"
      ? "🏆 You won the race!"
      : msg.outcome === "draw"
      ? "🤝 Draw — nobody solved it."
      : "❌ Your opponent solved it first.";
  statusEl.textContent = label + " It was " + secret.name + ". " + sign + msg.delta + " RP → " + msg.newRating;
  if (rankEl) {
    rankEl.style.display = "";
    rankEl.textContent = "Online Rank: " + msg.newRating;
  }
}

/* ---------- Show the "Find Online Match" button only in Ranked mode ---------- */

function updateOnlineButtonVisibility() {
  if (!findOnlineBtn) return;
  // Online PvP isn't deployed yet — keep this hidden so Ranked plays vs the rival.
  findOnlineBtn.style.display = "none";
}

if (findOnlineBtn) {
  findOnlineBtn.addEventListener("click", findOnlineMatch);
}

// React to mode/sport buttons (these listeners run after game.js's own).
modeBtns.forEach((b) =>
  b.addEventListener("click", function () {
    // Leaving online mode while searching? tell the server to drop us from the queue.
    if (b.dataset.mode !== "online") netSend({ type: "cancel" });
    updateOnlineButtonVisibility();
  })
);
tabs.forEach((t) => t.addEventListener("click", updateOnlineButtonVisibility));

updateOnlineButtonVisibility();
