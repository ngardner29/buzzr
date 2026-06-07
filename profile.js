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
const inviteFriendBtn = document.getElementById("invite-friend");

let selectedRankedSport = "nba";
let pendingAction = null; // run after the user picks a username (ranked needs a name)

// Ranked needs a username (for your rank + badge). Prompt once, then run fn.
function requireNameThen(fn) {
  if (getUsername()) {
    fn();
    return;
  }
  pendingAction = fn;
  openAccountModal();
}

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

/* ---------- Ranked result popup ---------- */
const resultModal = document.getElementById("result-modal");
const resultTitle = document.getElementById("result-title");
const resultBadge = document.getElementById("result-badge");
const resultTierName = document.getElementById("result-tier");
const resultBarFill = document.getElementById("result-bar-fill");
const resultProgressText = document.getElementById("result-progress-text");
const resultDelta = document.getElementById("result-delta");
const resultClose = document.getElementById("result-close");

// outcome: "win" | "loss" | "draw". delta: points gained/lost this match.
function showResultModal(outcome, delta) {
  const prog = rankProgress(rank.rating);

  resultTitle.textContent =
    outcome === "win" ? "You Won!" : outcome === "draw" ? "Draw" : "You Lost";
  resultModal.classList.toggle("is-loss", outcome === "loss");

  resultBadge.src = badgePath(rank.rating);
  resultTierName.textContent = prog.tier;

  resultDelta.textContent = (delta >= 0 ? "+" : "") + delta + " RP";

  if (prog.next) {
    resultProgressText.textContent = prog.toNext + " pts to " + prog.next;
  } else {
    resultProgressText.textContent = "Max rank reached!";
  }

  // Animate the bar from 0 to its value.
  resultBarFill.style.width = "0%";
  resultModal.style.display = "flex";
  setTimeout(function () {
    resultBarFill.style.width = Math.round(prog.pct * 100) + "%";
  }, 80);
}

if (resultClose) {
  resultClose.addEventListener("click", function () {
    resultModal.style.display = "none";
  });
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
  if (typeof fetchOnlineCount === "function") fetchOnlineCount();
}

function setSport(key) {
  if (!SPORTS[key]) return;
  sportKey = key;
  sport = SPORTS[key];
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.sport === key));
  applyColumns();
}

// Start online ranked. roomCode = null for open matchmaking, or a code for a friend match.
function startOnlineRanked(roomCode) {
  setSport(selectedRankedSport);
  findOnlineMatch(roomCode || null); // shows the matchmaking screen; switches to game on match
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
  if (pendingAction) {
    const fn = pendingAction;
    pendingAction = null;
    fn(); // resume what they were trying to do (play / invite / join)
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

playRanked.addEventListener("click", () => requireNameThen(() => startOnlineRanked(null)));
if (inviteFriendBtn) {
  inviteFriendBtn.addEventListener("click", () =>
    requireNameThen(() => startOnlineRanked(randomRoomCode()))
  );
}

/* ---------- Start ---------- */
// Ranked + login launch later, so we don't prompt for a username on first visit.
// Daily and Unlimited play work with no account at all.
// Quick profile setup link, e.g. ?champion=noahdagoat — sets your name + Champion rank.
const champName = new URLSearchParams(location.search).get("champion");
if (champName) {
  setUsername(champName.slice(0, 16));
  rank.rating = 1750; // solidly Champion (>= 1700)
  saveRank(rank);
  try {
    history.replaceState({}, "", location.pathname); // tidy the URL afterward
  } catch (e) {}
}

const usingFirebase = typeof firebaseConfigured === "function" && firebaseConfigured();
if (!usingFirebase && getUsername()) {
  profileChip.style.display = "";
  refreshProfileUI();
}

// If opened via an invite link (?room=CODE), jump straight into that friend match.
const roomParam = new URLSearchParams(location.search).get("room");
if (roomParam) {
  const code = roomParam.toUpperCase().slice(0, 12);
  openRanked();
  requireNameThen(() => startOnlineRanked(code));
}
