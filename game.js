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

// Team: green = same team, orange = same conference/league, gray = otherwise.
function cmpTeam() {
  return (g, s) => ({
    color: g.team === s.team ? "green" : g.conference === s.conference ? "orange" : "gray",
    arrow: "",
  });
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
let sport = SPORTS[sportKey];
let players = playable(sportKey);
let secret = pickSecret();
let guessesLeft = MAX_GUESSES;
let gameOver = false;
let guessedNames = new Set();

function pickSecret() {
  return players[Math.floor(Math.random() * players.length)];
}

/* ---------- 6) Page elements ---------- */

const input = document.getElementById("player-input");
const dropdown = document.getElementById("dropdown");
const rows = document.getElementById("rows");
const statusEl = document.getElementById("status");
const header = document.getElementById("board-header");
const newGameBtn = document.getElementById("new-game");
const tabs = document.querySelectorAll(".tab");

/* ---------- 7) Drawing the board ---------- */

// Make the header and rows use one column per clue (plus the name column).
function applyColumns() {
  const template = "150px repeat(" + sport.columns.length + ", 70px)";
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

  result.clues.forEach(function (clue) {
    const cell = document.createElement("div");
    cell.className = "cell clue " + clue.color;
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

  if (result.win) endGame(true);
  else if (guessesLeft <= 0) endGame(false);
  else updateStatus();
}

function updateStatus() {
  statusEl.textContent =
    "Guess the mystery " + sport.name + " player — " + guessesLeft + " guesses left";
}

function endGame(won) {
  gameOver = true;
  statusEl.textContent = won
    ? "🎉 You got it! It was " + secret.name + "."
    : "❌ Out of guesses! It was " + secret.name + ".";
}

function newGame() {
  players = playable(sportKey);
  secret = pickSecret();
  guessesLeft = MAX_GUESSES;
  gameOver = false;
  guessedNames = new Set();
  rows.innerHTML = "";
  input.value = "";
  dropdown.innerHTML = "";
  updateStatus();
}

function switchSport(key) {
  if (key === sportKey) return;
  sportKey = key;
  sport = SPORTS[key];
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.sport === key));
  applyColumns();
  newGame();
}

newGameBtn.addEventListener("click", newGame);
tabs.forEach((t) => t.addEventListener("click", () => switchSport(t.dataset.sport)));

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
