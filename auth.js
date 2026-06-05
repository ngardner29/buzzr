/* ============================================================
   Sports Guesser — Firebase login + cloud-saved rank.

   Turns on only when firebase-config.js has real values AND the
   Firebase SDK loaded. Otherwise the game uses local usernames
   (handled in profile.js) and nothing here runs — so the game
   always works, configured or not.

   Cloud data model: collection "users", doc id = user uid,
   fields { username, rating, wins, losses }.
   ============================================================ */

let cloudReady = false;
let fbAuth = null;
let fbDb = null;
let fbUser = null;

/* ---------- Elements ---------- */
const loginModal = document.getElementById("login-modal");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const googleLogin = document.getElementById("google-login");
const logoutBtn = document.getElementById("logout-btn");

function showLoginErr(e) {
  loginError.textContent = (e && e.message ? e.message : String(e)).replace("Firebase: ", "");
}

/* ---------- Cloud save (called from game.js saveRank via onRankSaved) ---------- */
function cloudSync() {
  if (!cloudReady || !fbUser) return;
  fbDb
    .collection("users")
    .doc(fbUser.uid)
    .set(
      { username: getUsername(), rating: rank.rating, wins: rank.wins, losses: rank.losses },
      { merge: true }
    )
    .catch((e) => console.error("cloud save failed:", e));
}
function onRankSaved() {
  cloudSync();
}

/* ---------- Auth state ---------- */
async function handleAuthState(user) {
  fbUser = user;

  if (!user) {
    if (profileChip) profileChip.style.display = "none";
    loginModal.style.display = "flex";
    return;
  }

  loginModal.style.display = "none";

  // Load (or create) this user's profile in Firestore.
  const ref = fbDb.collection("users").doc(user.uid);
  let data;
  try {
    const snap = await ref.get();
    if (snap.exists) {
      data = snap.data();
    } else {
      const fallbackName = (user.displayName || (user.email || "player").split("@")[0]).slice(0, 16);
      data = { username: fallbackName, rating: 700, wins: 0, losses: 0 };
      await ref.set(data);
    }
  } catch (e) {
    console.error("could not load profile:", e);
    data = { username: "Player", rating: 700, wins: 0, losses: 0 };
  }

  // Apply cloud data locally (without triggering another cloud write).
  setUsername(data.username);
  rank = { rating: data.rating || 700, wins: data.wins || 0, losses: data.losses || 0 };
  try {
    localStorage.setItem("sg_rank2", JSON.stringify(rank));
  } catch (e) {}

  if (profileChip) profileChip.style.display = "";
  if (logoutBtn) logoutBtn.style.display = "";
  refreshProfileUI();
  updateRankDisplay();
}

/* ---------- Login actions ---------- */
function doEmailLogin() {
  loginError.textContent = "";
  fbAuth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value).catch(showLoginErr);
}
function doEmailSignup() {
  loginError.textContent = "";
  fbAuth.createUserWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value).catch(showLoginErr);
}
function doGoogleLogin() {
  loginError.textContent = "";
  const provider = new firebase.auth.GoogleAuthProvider();
  fbAuth.signInWithPopup(provider).catch(showLoginErr);
}
function doLogout() {
  if (fbAuth) fbAuth.signOut();
}

/* ---------- Setup ---------- */
function initFirebase() {
  if (typeof firebase === "undefined" || !firebaseConfigured()) {
    return; // not configured — profile.js handles local usernames
  }
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    cloudReady = true;

    loginBtn.addEventListener("click", doEmailLogin);
    signupBtn.addEventListener("click", doEmailSignup);
    googleLogin.addEventListener("click", doGoogleLogin);
    if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
    loginPassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doEmailLogin();
    });

    fbAuth.onAuthStateChanged(handleAuthState);
  } catch (e) {
    console.error("Firebase init failed:", e);
    cloudReady = false;
  }
}

initFirebase();
