/* ============================================================
   Firebase config.

   To turn on real logins + cloud-saved ranks:
   1. Go to https://console.firebase.google.com and create a free project.
   2. Add a "Web app" (the </> icon). It shows you a config object.
   3. In Authentication, enable "Email/Password" and "Google" sign-in.
   4. In Firestore Database, create a database (start in test mode).
   5. Paste the config values below (replacing the PASTE_… placeholders).

   These web keys are SAFE to be public — that's how Firebase works.
   Until you paste real values, the game just uses local usernames.
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID",
};

// True once real values are pasted in above.
function firebaseConfigured() {
  return typeof FIREBASE_CONFIG.apiKey === "string" && FIREBASE_CONFIG.apiKey.indexOf("PASTE") !== 0;
}
