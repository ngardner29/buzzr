# Turning on login + cloud-saved ranks (Firebase)

The login code is already built. To switch it on, make a free Firebase project
and paste its keys into `firebase-config.js`. ~10 minutes, all free.

## Steps

1. Go to **https://console.firebase.google.com** and sign in with your Google account.
2. Click **Add project** → give it a name (e.g. `sports-guesser`) → create it.
   (You can turn off Google Analytics — not needed.)
3. On the project home, click the **`</>`** (Web) icon to add a web app.
   Name it anything → **Register app**. Firebase shows a `firebaseConfig = { … }`
   block. Keep that page open.
4. In the left menu, open **Build → Authentication → Get started**, then under
   **Sign-in method** enable:
   - **Email/Password**
   - **Google** (pick your support email when asked)
5. In the left menu, open **Build → Firestore Database → Create database** →
   **Start in test mode** → pick a location → Enable.
6. Open `firebase-config.js` in this project and replace the `PASTE_…` values with
   the matching ones from step 3 (`apiKey`, `authDomain`, `projectId`, `appId`).

That's it — reload the game and you'll get the **login screen** (email/password
or "Continue with Google"). Your username and rank now save to the cloud and
follow you on any device.

## Notes
- The keys in `firebase-config.js` are **safe to be public** — that's how Firebase
  web apps work. Security comes from Firestore rules, not from hiding the key.
- "Test mode" Firestore is open for 30 days. Before sharing widely, tighten the
  rules so each user can only read/write their own profile (I can set that up).
- Until you paste real keys, the game keeps using the simple local username — so
  nothing breaks in the meantime.
