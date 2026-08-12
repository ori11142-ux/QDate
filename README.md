# QDate — slow dating, by design

QDate is an **intentional dating app** built to fight the "paradox of choice" in modern dating. Instead of endless swiping, every user gets **one match at a time**, and the app **learns your taste from your behavior** rather than just your stated preferences.

It runs a **two-phase lifecycle**:

- **Phase 1 — first 14 days (learning):** one *daily* match with a 24-hour window. The system watches how you engage to learn what you actually want.
- **Phase 2 — after 14 days (curated):** one *high-quality weekly* match that must clear a quality bar. Skipping one costs a cooldown, to keep matches intentional.

---

## Features

- **One-at-a-time matching** with a two-sided **reciprocity gate** (you're only matched with someone who's also a strong match *for you*).
- **Two-phase lifecycle** with countdown timers and skip cooldowns.
- **Behavioral learning** — reply latency, message frequency, and activity feed an ML ranker; an **intent score** rewards thoughtful engagement.
- **Face-recognition ML (optional, opt-in)** — learns your *visual taste* from calibration swipes and scores looks **mutually** (both people must find each other attractive).
- **Discover** — swipe on interests and faces to calibrate the system (this trains taste; it does **not** create matches).
- **Insights dashboard**, **community guidelines + reporting/moderation**, **age & gender preferences**, and **biometric consent**.

---

## Tech stack

**Backend** (`qdate-backend/`)
- Node.js + **Express** (TypeScript, run with `tsx`)
- **MongoDB** via **Mongoose** (MongoDB Atlas)
- **In-process ML in TypeScript** — a learned-weight compatibility ranker, plus a pretrained face-embedding pipeline (`@vladmandic/face-api` on **TensorFlow.js**) and a per-user visual-taste model
- **bcrypt** email/password auth

**Mobile** (`qdate-mobile/`)
- **Expo** (SDK 54) + **React Native** (TypeScript) — one codebase for iOS & Android
- **React Navigation** (stack + bottom tabs)
- **AsyncStorage** for the persisted session
- Built into a native **Android app** with **EAS Build**

---

## Repository structure

```
QDate2/
├── qdate-backend/         # Node/Express + MongoDB API + ML
│   └── src/
│       ├── index.ts       # server entry point
│       ├── routes/        # REST API endpoints
│       ├── services/      # matchmaker, auth, calibration, moderation, …
│       ├── ml/            # ranker, features, face embeddings, face taste
│       ├── models/        # Mongoose schemas (User, Match, Swipe, …)
│       └── scripts/       # seeding + dev tools
├── qdate-mobile/          # Expo React Native app
│   └── src/
│       ├── screens/       # Welcome, Login, Register, DailyFocus, Discover, Chat, …
│       ├── components/    # reusable UI
│       ├── navigation/    # RootNavigator (auth-aware)
│       ├── auth/          # AuthContext (logged-in state)
│       └── api.ts         # single client for all backend calls
├── DEPLOY.md              # how to host the backend + build the Android app
└── README.md
```

---

## Getting started

### Prerequisites
- **Node.js 18+** and npm
- A **MongoDB Atlas** account (free tier is fine) — you'll need a connection string
- An **Android phone** to install the app (see **[DEPLOY.md](DEPLOY.md)** to build the APK)

### 1. Backend

```bash
cd qdate-backend
npm install
```

Create a `.env` file in `qdate-backend/` with your Atlas connection string:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/qdate
```

> In MongoDB Atlas → **Network Access**, add your current IP address (or `0.0.0.0/0` for dev) so the server can connect.

Start the API:

```bash
npm run dev
```

It listens on **http://localhost:5000**. Verify it's up: open **http://localhost:5000/api/health** → `{"ok":true}`.

### 2. Android app

The mobile client ships as a real, installable **Android app**. Build it with EAS and install the APK on your phone — the full walkthrough (hosting the backend, setting the URL, running the build) is in **[DEPLOY.md](DEPLOY.md)**. In short:

```bash
cd qdate-mobile
npm install
eas build -p android --profile preview   # → an installable .apk
```

The app reads its backend URL from `EXPO_PUBLIC_API_URL` in `eas.json`, so your backend must be **deployed** (reachable over the internet, not just `localhost`) and that URL set before you build. Download the finished APK and install it on your phone.

---

## Test accounts & seed data

From `qdate-backend/`, populate the database with test users (all share the password **`qdate1234`**):

```bash
npm run seed          # base seed users
npm run seed:faces    # users with real faces (for the face-ML features)
npm run seed:phase2   # 8 users already in Phase 2 (to test curated matching)
```

Handy dev tool — instantly move any user between phases (resets their state and generates a match):

```bash
npm run dev:phase -- <name-or-email> 2    # → Phase 2
npm run dev:phase -- <name-or-email> 1    # → Phase 1
```

Example logins after seeding: `p2_woman_0@qdate.test` / `qdate1234` (Phase 2), or any `rface_*@qdate.test` / `qdate1234`.

---

## Useful scripts

**Backend** (`qdate-backend/`)
| Command | What it does |
|---|---|
| `npm run dev` | Start the API with auto-reload (`tsx watch`) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run the compiled server (`node dist/index.js`) |
| `npm run seed` / `seed:faces` / `seed:phase2` | Seed test data |
| `npm run dev:phase -- <user> <1\|2>` | Jump a user to a phase for testing |

**Mobile** (`qdate-mobile/`)
| Command | What it does |
|---|---|
| `eas build -p android --profile preview` | Build an installable Android APK |
| `eas build -p android --profile production` | Build a Play-Store bundle (`.aab`) |

---

## Building & hosting

To ship the Android app you host the backend and build the APK with EAS. Full step-by-step instructions — hosting the backend on Render, configuring Atlas, and running the build — are in **[DEPLOY.md](DEPLOY.md)**.

---

## Notes

- **Face-recognition features are optional.** They're opt-in (biometric consent) and memory-heavy; if you don't need them the app matches on interests without them.
- **Never commit real secrets** — keep your `MONGODB_URI` in `.env` (gitignored), not in the code.
