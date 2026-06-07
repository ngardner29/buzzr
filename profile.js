/* ============================================================
   Sports Guesser — profile, views, and the Ranked screen.
   Uses globals from game.js (tierOf, rank, sportKey, sport,
   SPORTS, mode, newGame, tabs, applyColumns) and online.js
   (findOnlineMatch, getPlayerId).
   ============================================================ */

/* ---------- Username ("account") ---------- */
function getUsername() {
  try {
    return localStorage.getItem("sg_username") || "";
  } catch (e) {
    return "";
  }
}
function setUsername(name) {
  try {
    localStorage.setItem("sg_username", name);
  } catch (e) {}
}

function badgePath(rating) {
  return "assets/ranks/" + tierKey(rating) + ".png";
}

/* ---------- Elements ---------- */
const accountModal = document.getElementById("account-modal");
const usernameInput = document.getElementById("username-input");
const usernameError = document.getElementById("username-error");
const usernameSave = document.getElementById("username-save");

const profileChip = document.getElementById("profile-chip");
const chipBadge = document.getElementById("chip-badge");
const chipName = document.getElementById("chip-name");

const viewGame = document.getElementById("view-game");
const viewRanked = document.getElementById("view-ranked");

const openRankedBtn = document.getElementById("open-ranked");
const rankedBack = document.getElementById("ranked-back");
const rankedBadge = document.getElementById("ranked-badge");
const rankedTier = document.getElementById("ranked-tier");

const profileToggle = document.getElementById("profile-toggle");
const profileMenu = document.getElementById("profile-menu");
const profileBadgeSm = document.getElementById("profile-badge-sm");
const profileNameSm = document.getElementById("profile-name-sm");
const profileBadgeLg = document.getElementById("profile-badge-lg");
const profileTier = document.getElementById("profile-tier");
const profileRecord = document.getElementById("profile-record");
const changeUsername = document.getElementById("change-username");

const rsportBtns = document.querySelectorAll(".rsport");
const playRanked = document.getElementById("play-ranked");

let selectedRankedSport = "nba";
let pendingPlay = false; // set when we need a username before starting ranked

/* ---------- Keeping the UI in sync ---------- */
function refreshProfileUI() {
  const name = getUsername() || "Player";
  const path = badgePath(rank.rating);
  const tier = tierOf(rank.rating);

  chipName.textContent = name;
  chipBadge.src = path;

  rankedBadge.src = path;
  rankedTier.textContent = tier;

  profileNameSm.textContent = name;
  profileBadgeSm.src = path;
  profileBadgeLg.src = path;
  profileTier.textContent = tier;
  profileRecord.textContent = rank.wins + "W · " + rank.losses + "L";
}

// Called from game.js after a ranked match so badges update on promotion.
function onRankChanged() {
  refreshProfileUI();
}

/* ---------- Views ---------- */
function showView(name) {
  viewGame.style.display = name === "game" ? "" : "none";
  viewRanked.style.display = name === "ranked" ? "" : "none";
}

function openRanked() {
  profileMenu.style.display = "none";
  if (getUsername()) profileChip.style.display = "";
  refreshProfileUI();
  showView("ranked");
}

function setSport(key) {
  if (!SPORTS[key]) return;
  sportKey = key;
  sport = SPORTS[key];
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.sport === key));
  applyColumns();
}

function startRanked(online) {
  setSport(selectedRankedSport);
  showView("game");
  if (online) {
    findOnlineMatch();
  } else {
    mode = "ranked";
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
    newGame();
  }
}

/* ---------- Account modal ---------- */
function openAccountModal() {
  usernameInput.value = getUsername();
  usernameError.textContent = "";
  accountModal.style.display = "flex";
  setTimeout(() => usernameInput.focus(), 60);
}

function saveUsername() {
  const v = (usernameInput.value || "").trim();
  if (v.length < 2) {
    usernameError.textContent = "Please enter at least 2 characters.";
    return;
  }
  setUsername(v);
  getPlayerId(); // make sure we have an id for the server
  accountModal.style.display = "none";
  profileChip.style.display = "";
  refreshProfileUI();
  if (typeof cloudSync === "function") cloudSync(); // save new name to the cloud if logged in
  if (pendingPlay) {
    pendingPlay = false;
    startRanked(false); // they set a name in order to play ranked — start now
  }
}

/* ---------- Wiring ---------- */
usernameSave.addEventListener("click", saveUsername);
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveUsername();
});

profileChip.addEventListener("click", openRanked);
openRankedBtn.addEventListener("click", openRanked);
rankedBack.addEventListener("click", () => showView("game"));

profileToggle.addEventListener("click", () => {
  profileMenu.style.display = profileMenu.style.display === "none" ? "" : "none";
});
changeUsername.addEventListener("click", openAccountModal);

rsportBtns.forEach((b) =>
  b.addEventListener("click", () => {
    selectedRankedSport = b.dataset.sport;
    rsportBtns.forEach((x) => x.classList.toggle("active", x === b));
  })
);

playRanked.addEventListener("click", () => {
  // Ranked needs a name for your rank + badge. Prompt once, then start.
  if (!getUsername()) {
    pendingPlay = true;
    openAccountModal();
    return;
  }
  startRanked(false);
});

/* ---------- Start ---------- */
// Ranked + login launch later, so we don't prompt for a username on first visit.
// Daily and Unlimited play work with no account at all.
const usingFirebase = typeof firebaseConfigured === "function" && firebaseConfigured();
if (!usingFirebase && getUsername()) {
  profileChip.style.display = "";
  refreshProfileUI();
}
