/* ============================================================
   Buzzr — online ranked client.

   Talks to the matchmaking server over a WebSocket to find a real
   opponent and race them. Self-contained: if the server can't be
   reached, it shows a friendly message and the rest of the game
   keeps working.
   ============================================================ */

// Your deployed matchmaking server (Render). wss = secure WebSocket.
const SERVER_URL = "wss://buzzr-tbeq.onrender.com";
// Same server over plain HTTPS, for the /stats player-count poll.
const STATS_URL = SERVER_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:") + "/stats";

let socket = null;
let onlineOppGuesses = 0;
let onlineOppRating = 700;
let currentRoom = null; // set when playing a private "invite a friend" match

/* ---------- Elements ---------- */
const mmModal = document.getElementById("matchmaking-modal");
const mmText = document.getElementById("mm-text");
const mmCancel = document.getElementById("mm-cancel");
const inviteBox = document.getElementById("invite-box");
const inviteLink = document.getElementById("invite-link");
const inviteCopy = document.getElementById("invite-copy");
// (the Invite-a-friend button is wired in profile.js, which owns username gating)

/* ---------- A stable anonymous id for this browser ---------- */
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

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no easily-confused chars
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ---------- Connecting and messaging ---------- */
function netSend(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

// roomCode = null for open matchmaking, or a code for a private friend match.
function findOnlineMatch(roomCode) {
  currentRoom = roomCode || null;
  showMatchmaking();
  mmText.textContent = "Connecting to the server…";

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
  socket.addEventListener("close", () => {
    if (!gameOver && mmModal.style.display !== "none") {
      mmText.textContent = "Connection lost. The server may be waking up — try again.";
    }
  });
}

function queueNow() {
  const msg = { type: "queue", playerId: getPlayerId(), sport: sportKey, rating: rank.rating };
  if (currentRoom) {
    msg.room = currentRoom;
    showInvite(currentRoom);
    mmText.textContent = "Waiting for your friend to join…";
  } else {
    inviteBox.style.display = "none";
    mmText.textContent = "Searching for an opponent in " + SPORTS[sportKey].name + "…";
  }
  netSend(msg);
}

function onNetError() {
  mmText.textContent = "⚠️ Couldn't reach the server. It may be asleep — wait a few seconds and try again.";
}

// Show "N players online" on the Ranked screen.
function setOnlineCount(online) {
  const el = document.getElementById("online-count");
  if (!el) return;
  const n = online == null ? "—" : online;
  el.textContent = "🟢 " + n + (n === 1 ? " player online" : " players online");
}

// Poll the server's /stats once (used when the Ranked screen opens).
function fetchOnlineCount() {
  const el = document.getElementById("online-count");
  if (el) el.textContent = "🟢 checking who’s online…";
  fetch(STATS_URL)
    .then((r) => r.json())
    .then((d) => setOnlineCount(d.online))
    .catch(() => {
      if (el) el.textContent = "🟢 server waking up…";
    });
}

function handleServerMessage(msg) {
  if (msg.type === "online") {
    setOnlineCount(msg.count);
    return;
  }
  if (msg.type === "searching") {
    if (currentRoom) mmText.textContent = "Waiting for your friend to join…";
    else mmText.textContent = "Searching for an opponent in " + SPORTS[sportKey].name + "…";
  } else if (msg.type === "matchFound") {
    hideMatchmaking();
    startOnlineGame(msg.seed, msg.sport, msg.yourRating, msg.opponentRating);
  } else if (msg.type === "opponentProgress") {
    onlineOppGuesses = msg.guesses;
    if (!gameOver) updateOnlineStatus();
  } else if (msg.type === "result") {
    showOnlineResult(msg);
  }
}

/* ---------- Matchmaking modal ---------- */
function showMatchmaking() {
  inviteBox.style.display = "none";
  mmModal.style.display = "flex";
}
function hideMatchmaking() {
  mmModal.style.display = "none";
}
function showInvite(code) {
  const base = location.origin + location.pathname;
  inviteLink.value = base + "?room=" + code;
  inviteBox.style.display = "";
}
function cancelMatchmaking() {
  netSend({ type: "cancel" });
  currentRoom = null;
  hideMatchmaking();
}

/* ---------- Running an online match ---------- */
function startOnlineGame(seed, sportName, yourRating, oppRating) {
  if (SPORTS[sportName]) {
    sportKey = sportName;
    sport = SPORTS[sportName];
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.sport === sportName));
    applyColumns();
  }

  mode = "online";
  modeBtns.forEach((b) => b.classList.remove("active"));
  players = playable(sportKey);
  if (typeof showView === "function") showView("game"); // leave the ranked lobby

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
  onlineOppRating = typeof oppRating === "number" ? oppRating : 700;
  if (rankEl) {
    rankEl.style.display = "";
    rankEl.textContent = "Online match — first to solve wins!";
  }
  updateOnlineStatus();
}

function updateOnlineStatus() {
  statusEl.textContent =
    "🌐 Online " + sport.name + " race — " + guessesLeft + " guesses left · Opponent: " +
    onlineOppGuesses + (onlineOppGuesses === 1 ? " guess" : " guesses");
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

// Flat points — your opponent's rank doesn't matter. Win +25, loss -25, draw 0.
function applyOnlineElo(outcome) {
  const before = rank.rating;
  if (outcome === "win") {
    rank.rating += 25;
    rank.wins++;
  } else if (outcome === "loss") {
    rank.rating = Math.max(0, rank.rating - 25);
    rank.losses++;
  }
  saveRank(rank);
  return rank.rating - before;
}

function showOnlineResult(msg) {
  gameOver = true;
  if (msg.outcome !== "win") revealSecret();

  const delta = applyOnlineElo(msg.outcome);
  const sign = delta >= 0 ? "+" : "";
  const label =
    msg.outcome === "win"
      ? "🏆 You won the race!"
      : msg.outcome === "draw"
      ? "🤝 Draw — nobody solved it."
      : "❌ Your opponent solved it first.";
  statusEl.textContent =
    label + " It was " + secret.name + ". " + sign + delta + " RP · " + tierOf(rank.rating);
  if (rankEl) rankEl.textContent = "Online · " + tierOf(rank.rating);
  if (typeof onRankChanged === "function") onRankChanged();
  if (typeof showResultModal === "function") showResultModal(msg.outcome, delta);
}

/* ---------- Wiring ---------- */
if (mmCancel) mmCancel.addEventListener("click", cancelMatchmaking);
if (inviteCopy) {
  inviteCopy.addEventListener("click", function () {
    inviteLink.select();
    try {
      navigator.clipboard.writeText(inviteLink.value);
    } catch (e) {
      document.execCommand("copy");
    }
    inviteCopy.textContent = "Copied!";
    setTimeout(() => (inviteCopy.textContent = "Copy"), 1500);
  });
}
// (PLAY and Invite are wired in profile.js so they can require a username first.)

// Leaving online mode mid-search? drop out of the server queue.
modeBtns.forEach((b) =>
  b.addEventListener("click", function () {
    if (b.dataset.mode !== "online") netSend({ type: "cancel" });
  })
);
