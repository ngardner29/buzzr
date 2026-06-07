/* ============================================================
   Sports Guesser — game logic for NBA, NFL, and MLB.

   One engine runs all three sports. Each sport just describes
   its own columns in the SPORTS config near the bottom.
   ============================================================ */

// Raw player lists come from the data/*.js files.
const RAW = { nba: NBA_PLAYERS, nfl: NFL_PLAYERS, mlb: MLB_PLAYERS };

const MAX_GUESSES = 8;

/* ---------- 1) Small comparison helpers ----------
   Each "compare" function takes (guess, secret) and returns
   { color: 'green'|'orange'|'gray', arrow: '' | '↑' | '↓' }. */

// Compare a number clue (height, age, jersey). Arrow points toward the secret.
function numberCompare(guessVal, secretVal, within) {
  if (guessVal == null || secretVal == null) return { color: "gray", arrow: "" };
  const diff = secretVal - guessVal;
  if (diff === 0) return { color: "green", arrow: "" };
  const color = Math.abs(diff) <= within ? "orange" : "gray";
  return { color, arrow: diff > 0 ? "↑" : "↓" };
}

// Builders that return a compare function:

// Exact match on a field -> green, otherwise gray.
function cmpExact(field) {
  return (g, s) => ({ color: g[field] === s[field] ? "green" : "gray", arrow: "" });
}

// Team: green = same team, gray = otherwise. (Never orange.)
function cmpTeam() {
  return (g, s) => ({ color: g.team === s.team ? "green" : "gray", arrow: "" });
}

// Division: green only if same division AND same conference (names like
// "East"/"West" repeat across conferences in the NFL and MLB).
function cmpDivision() {
  return (g, s) => ({
    color: g.division === s.division && g.conference === s.conference ? "green" : "gray",
    arrow: "",
  });
}

// Position: green = same position, orange = same group, gray = otherwise.
function cmpGroup(valueField, groupFn) {
  return (g, s) => {
    if (g[valueField] === s[valueField]) return { color: "green", arrow: "" };
    return { color: groupFn(g) === groupFn(s) ? "orange" : "gray", arrow: "" };
  };
}

// A number clue with a "within" range for orange.
function cmpNumber(field, within) {
  return (g, s) => numberCompare(g[field], s[field], within);
}

// Handedness (bats/throws): green = same, orange = one is a switch (B), gray = opposite.
function cmpHand(field) {
  return (g, s) => {
    const a = g[field], b = s[field];
    if (a === b) return { color: "green", arrow: "" };
    if (a === "B" || b === "B") return { color: "orange", arrow: "" };
    return { color: "gray", arrow: "" };
  };
}

/* ---------- 2) Position groups (for "related = orange") ---------- */

// NBA: squash into Guard / Forward / Center.
function nbaBucket(p) {
  const pos = (p.position || "").toUpperCase();
  if (["PG", "SG", "G"].includes(pos)) return "G";
  if (["SF", "PF", "F"].includes(pos)) return "F";
  if (pos === "C") return "C";
  return pos;
}

// NFL: hand-built groups so similar roles count as "close".
const NFL_GROUP = {
  QB: "QB",
  RB: "BACK", FB: "BACK",
  WR: "REC", TE: "REC",
  C: "OL", G: "OL", OT: "OL", T: "OL", OL: "OL",
  DE: "DL", DT: "DL", NT: "DL",
  LB: "LB", ILB: "LB", OLB: "LB", MLB: "LB",
  CB: "DB", S: "DB", FS: "DB", SS: "DB", DB: "DB",
  P: "ST", PK: "ST", K: "ST", LS: "ST",
};
function nflGroup(p) {
  return NFL_GROUP[p.position] || p.position;
}

// MLB: the data already carries a position group (P / IF / OF).
function mlbGroup(p) {
  return p.posGroup || p.position;
}

/* ---------- 3) Display helpers ---------- */

const shortConf = (v) => (v === "Eastern" ? "East" : v === "Western" ? "West" : v);
const showNum = (v) => (v == null ? "?" : String(v));

// Columns every sport shares at the end.
const TAIL_COLUMNS = [
  { header: "Ht", value: (p) => p.heightDisplay || "?", compare: cmpNumber("height", 2) },
  { header: "Age", value: (p) => showNum(p.age), compare: cmpNumber("age", 2) },
  { header: "#", value: (p) => (p.jersey == null ? "?" : "#" + p.jersey), compare: cmpNumber("jersey", 2) },
];

/* ---------- 4) The three sports ---------- */

const SPORTS = {
  nba: {
    label: "🏀 NBA",
    name: "NBA",
    columns: [
      { header: "Team", value: (p) => p.team, compare: cmpTeam() },
      { header: "Conf", value: (p) => shortConf(p.conference), compare: cmpExact("conference") },
      { header: "Div", value: (p) => p.division, compare: cmpDivision() },
      { header: "Pos", value: (p) => p.position || "?", compare: cmpGroup("position", nbaBucket) },
      ...TAIL_COLUMNS,
    ],
  },
  nfl: {
    label: "🏈 NFL",
    name: "NFL",
    columns: [
      { header: "Team", value: (p) => p.team, compare: cmpTeam() },
      { header: "Conf", value: (p) => p.conference, compare: cmpExact("conference") },
      { header: "Div", value: (p) => p.division, compare: cmpDivision() },
      { header: "Pos", value: (p) => p.position || "?", compare: cmpGroup("position", nflGroup) },
      ...TAIL_COLUMNS,
    ],
  },
  mlb: {
    label: "⚾ MLB",
    name: "MLB",
    columns: [
      { header: "Team", value: (p) => p.team, compare: cmpTeam() },
      { header: "Lg", value: (p) => p.conference, compare: cmpExact("conference") },
      { header: "Div", value: (p) => p.division, compare: cmpDivision() },
      { header: "Pos", value: (p) => p.position || "?", compare: cmpGroup("position", mlbGroup) },
      { header: "Bats", value: (p) => p.bats || "?", compare: cmpHand("bats") },
      { header: "Thr", value: (p) => p.throws || "?", compare: cmpHand("throws") },
      ...TAIL_COLUMNS,
    ],
  },
};

// Only keep players who have the core clue data (so no blank cells).
function playable(sportKey) {
  let list = RAW[sportKey].filter((p) => p.height && p.age != null && p.jersey != null);
  if (sportKey === "mlb") list = list.filter((p) => p.bats && p.throws);
  return list;
}

// Compare a guess to the secret using the current sport's columns.
function compareGuess(guess, secret, sport) {
  const clues = sport.columns.map((col) => {
    const result = col.compare(guess, secret);
    return { value: col.value(guess), color: result.color, arrow: result.arrow };
  });
  return { win: guess.name === secret.name, clues };
}

/* ---------- 5) Game state ---------- */

let sportKey = "nba";
let mode = "daily"; // "daily" = same player for everyone today, "free" = random, "ranked" = race a ghost
let ghostTarget = null; // ranked: how many guesses the AI opponent needs this round
let oppRating = null; // ranked: the opponent's rating this round
let rank = loadRank(); // ranked: persisted { rating, wins, losses }
let sport = SPORTS[sportKey];
let players = playable(sportKey);
let secret = pickSecret();
let guessesLeft = MAX_GUESSES;
let gameOver = false;
let guessedNames = new Set();

// In Daily mode, pick a player from today's date so everyone gets the same one.
function dailyIndex(key, n) {
  // Use UTC so everyone on Earth gets the SAME player on the same calendar day.
  const now = new Date();
  const dayNum = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  let h = dayNum >>> 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; // mix in the sport
  return h % n;
}

function pickSecret() {
  if (mode === "daily") return players[dailyIndex(sportKey, players.length)];
  return players[Math.floor(Math.random() * players.length)]; // free + ranked are random
}

/* ---------- Ranked: rating, tiers, and the AI "ghost" opponent ----------
   This is the same Elo math real online ranked uses. Today you race a ghost;
   later, when there's a server, the ghost becomes a real opponent. */

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Read/save your rank from the browser so it's remembered between visits.
// New players start at 700 = Copper (the lowest rank).
function loadRank() {
  try {
    return JSON.parse(localStorage.getItem("sg_rank2")) || { rating: 700, wins: 0, losses: 0 };
  } catch (e) {
    return { rating: 700, wins: 0, losses: 0 };
  }
}
function saveRank(r) {
  try {
    localStorage.setItem("sg_rank2", JSON.stringify(r));
  } catch (e) {}
  // If signed in to Firebase, also save the rank to the cloud (auth.js).
  if (typeof onRankSaved === "function") onRankSaved();
}

// Turn a rating number into a tier name. Everyone starts at 1000 = Silver.
// The rating number is hidden from players; only the tier name/badge shows.
function tierOf(rating) {
  if (rating < 800) return "Copper";
  if (rating < 950) return "Bronze";
  if (rating < 1100) return "Silver";
  if (rating < 1250) return "Gold";
  if (rating < 1400) return "Platinum";
  if (rating < 1550) return "Emerald";
  if (rating < 1700) return "Diamond";
  return "Champion";
}

// Lowercase key for the badge image file, e.g. "silver" -> assets/ranks/silver.png
function tierKey(rating) {
  return tierOf(rating).toLowerCase();
}

// The bottom rating of each tier (matches tierOf). Used for the progress bar.
const TIER_FLOORS = [
  ["Copper", 700], ["Bronze", 800], ["Silver", 950], ["Gold", 1100],
  ["Platinum", 1250], ["Emerald", 1400], ["Diamond", 1550], ["Champion", 1700],
];

// How far through the current tier you are, and how many points to the next one.
function rankProgress(rating) {
  let i = 0;
  for (let k = 0; k < TIER_FLOORS.length; k++) {
    if (rating >= TIER_FLOORS[k][1]) i = k;
  }
  const cur = TIER_FLOORS[i];
  if (i === TIER_FLOORS.length - 1) {
    return { tier: cur[0], next: null, pct: 1, toNext: 0 }; // Champion = max
  }
  const next = TIER_FLOORS[i + 1];
  const lo = cur[1];
  const hi = next[1];
  let pct = (rating - lo) / (hi - lo);
  pct = Math.max(0, Math.min(1, pct));
  return { tier: cur[0], next: next[0], pct: pct, toNext: Math.max(0, hi - rating) };
}

// Decide how many guesses the ghost opponent needs (tougher as your rating climbs).
function ghostGuesses(rating) {
  return clamp(Math.round(5 - (rating - 1000) / 250) + (Math.floor(Math.random() * 3) - 1), 2, 6);
}

// Update your rating after a ranked round using the Elo formula.
function applyRankResult(won) {
  const expected = 1 / (1 + Math.pow(10, (oppRating - rank.rating) / 400));
  const K = 32;
  const before = rank.rating;
  rank.rating = Math.round(rank.rating + K * ((won ? 1 : 0) - expected));
  if (won) rank.wins++;
  else rank.losses++;
  saveRank(rank);
  return rank.rating - before; // how many points you gained/lost
}

/* ---------- 6) Page elements ---------- */

const input = document.getElementById("player-input");
const dropdown = document.getElementById("dropdown");
const rows = document.getElementById("rows");
const statusEl = document.getElementById("status");
const rankEl = document.getElementById("rank");
const header = document.getElementById("board-header");
const newGameBtn = document.getElementById("new-game");
const tabs = document.querySelectorAll(".tab");
const modeBtns = document.querySelectorAll(".mode-btn");

/* ---------- 7) Drawing the board ---------- */

// Make the header and rows use one column per clue (plus the name column).
function applyColumns() {
  // Column widths come from CSS vars so they can shrink on phones (see style.css).
  const template = "var(--name-col) repeat(" + sport.columns.length + ", var(--clue-col))";
  header.style.gridTemplateColumns = template;
  rows.style.gridTemplateColumns = template;

  header.innerHTML = "";
  const nameHead = document.createElement("div");
  nameHead.className = "cell head name";
  nameHead.textContent = "Player";
  header.appendChild(nameHead);

  sport.columns.forEach(function (col) {
    const h = document.createElement("div");
    h.className = "cell head";
    h.textContent = col.header;
    header.appendChild(h);
  });
}

function renderRow(player, result) {
  const nameCell = document.createElement("div");
  nameCell.className = "cell name";
  nameCell.textContent = player.name;
  rows.appendChild(nameCell);

  result.clues.forEach(function (clue, i) {
    const cell = document.createElement("div");
    cell.className = "cell clue " + clue.color;
    cell.style.animationDelay = i * 0.06 + "s"; // flip in left-to-right
    cell.textContent = clue.value + (clue.arrow ? " " + clue.arrow : "");
    rows.appendChild(cell);
  });
}

/* ---------- 8) Playing ---------- */

function submitGuess(player) {
  if (gameOver) return;
  if (guessedNames.has(player.name)) return;
  guessedNames.add(player.name);

  const result = compareGuess(player, secret, sport);
  renderRow(player, result);

  guessesLeft--;
  input.value = "";
  dropdown.innerHTML = "";

  // Online matches are refereed by the server (see online.js).
  if (mode === "online") {
    onlineAfterGuess(result.win);
    return;
  }

  if (result.win) endGame(true);
  else if (guessesLeft <= 0) endGame(false);
  else updateStatus();
}

// Reveal the secret player as a final row (all green = it's them) so you see their stats.
function revealSecret() {
  const result = compareGuess(secret, secret, sport);
  const nameCell = document.createElement("div");
  nameCell.className = "cell name answer";
  nameCell.textContent = "★ " + secret.name;
  rows.appendChild(nameCell);
  result.clues.forEach(function (clue, i) {
    const cell = document.createElement("div");
    cell.className = "cell clue " + clue.color;
    cell.style.animationDelay = i * 0.06 + "s";
    cell.textContent = clue.value + (clue.arrow ? " " + clue.arrow : "");
    rows.appendChild(cell);
  });
}

function updateStatus() {
  if (mode === "ranked") {
    statusEl.textContent =
      "🏆 Ranked " + sport.name + " — beat the opponent (solves in " + ghostTarget + ") · " +
      tierOf(rank.rating) + " · " + guessesLeft + " guesses left";
  } else {
    const tag = mode === "daily" ? "Daily" : "Unlimited";
    statusEl.textContent =
      tag + " · Guess the mystery " + sport.name + " player — " + guessesLeft + " guesses left";
  }
}

// Show the rank line (rating, tier, win/loss) only in ranked mode.
function updateRankDisplay() {
  if (!rankEl) return;
  if (mode === "ranked") {
    rankEl.style.display = "";
    rankEl.textContent = tierOf(rank.rating) + " · " + rank.wins + "W " + rank.losses + "L";
  } else {
    rankEl.style.display = "none";
  }
}

function endGame(solved) {
  gameOver = true;
  if (!solved) revealSecret(); // show who it was + their stats at the bottom

  if (mode === "ranked") {
    const used = MAX_GUESSES - guessesLeft;
    const beat = solved && used <= ghostTarget; // you must solve at least as fast as the ghost
    const delta = applyRankResult(beat);
    const sign = delta >= 0 ? "+" : "";
    let msg;
    if (solved) {
      msg = beat
        ? "🏆 Solved in " + used + " — you beat the opponent (" + ghostTarget + ")! "
        : "😬 Solved in " + used + ", but the opponent only needed " + ghostTarget + ". ";
    } else {
      msg = "❌ Out of guesses! It was " + secret.name + ". ";
    }
    statusEl.textContent = msg + sign + delta + " RP · " + tierOf(rank.rating);
    updateRankDisplay();
    if (typeof onRankChanged === "function") onRankChanged(); // refresh ranked screen badge
    return;
  }

  const hint = mode === "daily" ? " (Switch to Unlimited to keep playing.)" : "";
  statusEl.textContent = solved
    ? "🎉 You got it! It was " + secret.name + "." + hint
    : "❌ Out of guesses! It was " + secret.name + "." + hint;
}

function newGame() {
  // In an online match, "New Game" looks for a new opponent (handled in online.js).
  if (mode === "online") {
    findOnlineMatch();
    return;
  }
  players = playable(sportKey);
  if (mode === "ranked") {
    oppRating = rank.rating;
    ghostTarget = ghostGuesses(oppRating);
  }
  secret = pickSecret();
  guessesLeft = MAX_GUESSES;
  gameOver = false;
  guessedNames = new Set();
  rows.innerHTML = "";
  input.value = "";
  dropdown.innerHTML = "";
  updateStatus();
  updateRankDisplay();
}

function switchSport(key) {
  if (key === sportKey) return;
  sportKey = key;
  sport = SPORTS[key];
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.sport === key));
  applyColumns();
  newGame();
}

function switchMode(m) {
  if (m === mode) return;
  mode = m;
  modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
  newGame();
}

newGameBtn.addEventListener("click", newGame);
tabs.forEach((t) => t.addEventListener("click", () => switchSport(t.dataset.sport)));
modeBtns.forEach((b) => b.addEventListener("click", () => switchMode(b.dataset.mode)));

/* ---------- 9) Search box + dropdown ---------- */

const MAX_RESULTS = 8;
let activeIndex = -1;

input.addEventListener("input", function () {
  const typed = input.value.trim().toLowerCase();
  activeIndex = -1;
  if (typed === "") {
    dropdown.innerHTML = "";
    return;
  }
  const matches = players
    .filter((p) => p.name.toLowerCase().includes(typed))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(typed) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(typed) ? 0 : 1;
      return aStarts - bStarts;
    })
    .slice(0, MAX_RESULTS);
  showMatches(matches);
});

function showMatches(matches) {
  dropdown.innerHTML = "";
  matches.forEach(function (p) {
    const row = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = p.name;
    const team = document.createElement("span");
    team.className = "team-label";
    team.textContent = p.team;
    row.appendChild(name);
    row.appendChild(team);
    row.addEventListener("click", () => submitGuess(p));
    dropdown.appendChild(row);
  });
}

input.addEventListener("keydown", function (e) {
  const items = dropdown.querySelectorAll("li");
  if (items.length === 0) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = (activeIndex + 1) % items.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = (activeIndex - 1 + items.length) % items.length;
  } else if (e.key === "Enter") {
    const choose = activeIndex >= 0 ? activeIndex : 0;
    items[choose].click();
    return;
  } else if (e.key === "Escape") {
    dropdown.innerHTML = "";
    return;
  } else {
    return;
  }
  items.forEach((row, i) => row.classList.toggle("active", i === activeIndex));
});

document.addEventListener("click", function (e) {
  if (!e.target.closest(".search-box")) dropdown.innerHTML = "";
});

/* ---------- 10) Start ---------- */
applyColumns();
updateStatus();
updateRankDisplay();
