# QDate — Deployment Runbook

Two parts:

- **Part A** gets you a **working, installable Android app** (backend hosted + an APK you can put on any phone). Do these in order.
- **Part B** is the extra work required before a **public Google Play release**.

The app-side prep is already done: `android.package`, a configurable API URL, and `eas.json` all exist. What's left is mostly deploying the backend and building.

---

## Part A — Working installed app

### 0. Accounts you'll need (all have free tiers)
- **MongoDB Atlas** — you already have this (cluster `cluster0.6sub7qj`).
- **Render** (backend hosting) — https://render.com — sign up with GitHub.
- **Expo** (builds) — https://expo.dev — free account.

### 1. Commit your work
Everything from the last sessions is uncommitted. Commit and push to GitHub (Render deploys from your repo):
```bash
git add -A
git commit -m "Matcher fixes + Android build prep"
git push
```

### 2. Lock down MongoDB Atlas for production
1. **Atlas → Database Access** → make sure your DB user has a **strong password** (the repo's dev password is weak — rotate it, then update your local `.env` too).
2. **Atlas → Network Access** → **Add IP Address** → `0.0.0.0/0` ("allow from anywhere").
   - Render's free tier has dynamic outbound IPs, so you can't whitelist a single one. `0.0.0.0/0` is why the DB password **must** be strong.
3. Keep your existing connection string (it points at the data you've already seeded). It looks like:
   `mongodb+srv://<user>:<password>@cluster0.6sub7qj.mongodb.net/`
   You'll paste this into Render as an env var (step 3), **not** into the repo.

### 3. Deploy the backend on Render
1. **Render Dashboard → New → Web Service** → connect your GitHub repo.
2. Configure:
   - **Root Directory:** `qdate-backend`  ← important (monorepo)
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
   - **Instance Type:** Free to start (see the memory note below).
3. **Environment → add variable:**
   - `MONGODB_URI` = your full Atlas connection string from step 2.
   - (Don't set `PORT` — Render provides it and the server already reads `process.env.PORT`.)
4. **Create Web Service.** Wait for the deploy to finish, then copy your public URL, e.g. `https://qdate-backend.onrender.com`.
5. **Test it** in a browser:
   `https://<your-render-url>/api/health` → should return `{"ok":true}` (or similar).

> **Memory note:** the face-recognition model (TensorFlow.js) is memory-heavy. Render's **free** 512 MB instance may be slow or occasionally restart when computing embeddings. If it crashes, upgrade to the Starter instance, or (simpler for a demo) tell users to leave "face-based matching" **off** at sign-up — the app matches on interests without it.

> **Free-tier sleep:** free Render services sleep after inactivity; the first request after a nap takes ~30–60 s to wake. Fine for a demo.

### 4. Point the app at your backend
Edit **`qdate-mobile/eas.json`** and replace **both** `https://REPLACE-WITH-YOUR-DEPLOYED-BACKEND` placeholders with your Render URL (no trailing slash):
```json
"env": { "EXPO_PUBLIC_API_URL": "https://qdate-backend.onrender.com" }
```
(Do this in the `preview` **and** `production` profiles.) Commit + push.

### 5. Build the Android app
```bash
cd qdate-mobile
npm install -g eas-cli
eas login                                   # your Expo account
eas build -p android --profile preview      # → an installable .apk
```
- First run asks to create an EAS project + generate an Android keystore — say **yes** (Expo manages the signing key for you).
- When it finishes, the terminal prints a build URL. Open it and **Download** the `.apk`.

### 6. Install & test on a real phone
1. Transfer the `.apk` to your Android phone (email/Drive/USB) and tap it.
2. Allow **"Install unknown apps"** when prompted.
3. Open QDate → register a user → confirm it talks to your live backend (matches, chat, Discover all work).
   - If nothing loads: re-check the `/api/health` URL, that the Render service is awake, and that `EXPO_PUBLIC_API_URL` in `eas.json` matches your Render URL exactly.

✅ At this point you have a real, installable Android app backed by a hosted server. Good enough for a demo, a portfolio, or handing the APK to testers.

---

## Part B — Before a public Play Store release

These are real prerequisites for publishing to the public. Prioritized.

### 7. Real authentication (highest priority)
Today the API identifies users by a raw `userId` in the URL with no token — anyone could act as anyone, and `GET /users/:id` is unauthenticated.
- Issue a signed token (JWT) on login/register, send it as `Authorization: Bearer <token>`, and verify it in an Express middleware.
- Reject requests whose token doesn't match the `:userId` they're acting on.

### 8. Secrets hygiene
- **Rotate** the Atlas password (the old one is in the repo's git history).
- Keep secrets only in Render's env vars. Add `qdate-backend/.env` to `.gitignore` if it isn't already, and never commit real credentials.

### 9. Photo storage
Photos are currently base64 strings in MongoDB (heavy, slow). Move uploads to object storage (Cloudinary or AWS S3) and store only the URL.

### 10. Push notifications (optional but on-brand)
The "your match is ready" flow assumes notifications. Add `expo-notifications` + Expo Push, or Firebase Cloud Messaging.

### 11. Privacy & Play compliance (mandatory to publish)
QDate is a dating app that processes **face biometrics** — a sensitive data category.
- Write and **host a privacy policy** (a simple public web page). You'll paste its URL into the Play Console.
- Fill out Play's **Data safety** form declaring what you collect (photos, biometric-derived data, messages).
- Provide a content rating and complete the dating-app declarations.
- **Simplest path for a student project:** consider shipping the public build with face-based matching **disabled by default** (or removed), so you avoid the biometric-data compliance burden entirely. The app already degrades gracefully to interest-based matching.

### 12. Publish to the Play Store
1. Create a **Google Play Developer account** (one-time $25).
2. Build the store bundle: `eas build -p android --profile production` (produces an `.aab`).
3. Submit it — either upload the `.aab` manually in the Play Console, or use `eas submit -p android` after configuring it.
4. Complete the store listing (screenshots, description, privacy policy URL, data safety), then roll out to internal testing → production.

### Nice-to-haves
- Add **ESLint** + a minimal **CI** (typecheck both packages + the unit suite on every push) so regressions can't slip in.
- Address the two remaining low-severity matcher items noted in the test report (double-booking race → a partial-unique index; learning-day boundary).

---

### Quick reference

| Thing | Value |
|---|---|
| Backend root (Render) | `qdate-backend` |
| Build command | `npm install && npm run build` |
| Start command | `node dist/index.js` |
| Required env var | `MONGODB_URI` |
| Health check | `GET /api/health` |
| App API URL config | `qdate-mobile/eas.json` → `env.EXPO_PUBLIC_API_URL` |
| Sideload APK | `eas build -p android --profile preview` |
| Play Store AAB | `eas build -p android --profile production` |
| Android package id | `com.qdate.app` (in `app.json`) |
