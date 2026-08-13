# QDate — slow dating, by design

QDate is an **intentional dating app** built to fight the "paradox of choice" in modern dating. Instead of endless swiping, every user gets **one match at a time**, and the app **learns your taste from your behavior** rather than just your stated preferences.

It runs a **two-phase lifecycle**:

- **Phase 1 — first 14 days (learning):** one *daily* match with a 24-hour window. The system watches how you engage to learn what you actually want.
- **Phase 2 — after 14 days (curated):** one *high-quality weekly* match that must clear a quality bar. Skipping one costs a cooldown, to keep matches intentional.

---

## What it does

- **One-at-a-time matching** with a two-sided **reciprocity gate** (you're only matched with someone who's also a strong match *for you*).
- **Two-phase lifecycle** with countdown timers and skip cooldowns.
- **Behavioral learning** — reply latency, message frequency, and activity feed an ML ranker; an **intent score** rewards thoughtful engagement.
- **Face-recognition ML (optional, opt-in)** — learns your *visual taste* from calibration swipes and scores looks **mutually** (both people must find each other attractive).
- **Discover** — swipe on interests and faces to calibrate the system (this trains taste; it does **not** create matches).
- **Insights dashboard**, **community guidelines + reporting/moderation**, **age & gender preferences**, and **biometric consent**.

---

## Trying the app

QDate is a real, installable **Android app** connected to a **hosted server** — there's nothing to run or set up on your computer.

### 1. Install
Install the **QDate** Android app on an Android phone:
- Copy the provided **`qdate.apk`** to the phone and tap it (allow "install from unknown sources" if prompted), **or** open the install link supplied with the submission.

### 2. Sign in
The app is connected to a live server pre-loaded with demo profiles, so you can sign in and immediately see a populated experience.

**To try Phase 2 (the curated weekly match)** — log in with a ready-made account (password **`qdate1234`** for all):

| Email | Password |
|---|---|
| `p2_woman_0@qdate.test` | `qdate1234` |
| `p2_man_4@qdate.test` | `qdate1234` |

**To try Phase 1 (the 14-day daily-match learning phase)** — tap **Create account** and register a fresh user (new accounts always start in Phase 1 and go through onboarding).

> The server runs on a free tier and "sleeps" when idle, so the **first** action after opening the app may take up to ~60 seconds while it wakes up. After that it's responsive.

### 3. What to explore
- **Today** — your single match with a countdown; reveal it, then open the chat or skip.
- **Discover** — swipe on interests and faces to *train* your taste (this doesn't create matches).
- **Chat** — message a match once you both connect.
- **Insights** — your intent score and how the system is learning your preferences.
- **Menu (☰)** — your full profile, edit profile, community guidelines, and sign out.
- Compare **Phase 2** (the `p2_*` logins → one curated weekly match) with **Phase 1** (a fresh account → daily matches during the 14-day learning period).

---

## Tech stack

**Backend**
- Node.js + **Express** (TypeScript), hosted on Render
- **MongoDB** via **Mongoose** (MongoDB Atlas)
- **In-process ML in TypeScript** — a learned-weight compatibility ranker, plus a pretrained face-embedding pipeline (`@vladmandic/face-api` on **TensorFlow.js**) and a per-user visual-taste model
- **bcrypt** email/password auth

**Mobile**
- **Expo** + **React Native** (TypeScript) — built into a native **Android app** with EAS Build
- **React Navigation** (stack + bottom tabs), **AsyncStorage** for the session

---

## Project structure

```
QDate2/
├── qdate-backend/         # Node/Express + MongoDB API + ML
│   └── src/
│       ├── routes/        # REST API endpoints
│       ├── services/      # matchmaker, auth, calibration, moderation, …
│       ├── ml/            # ranker, features, face embeddings, face taste
│       └── models/        # Mongoose schemas (User, Match, Swipe, …)
└── qdate-mobile/          # React Native app
    └── src/
        ├── screens/       # Welcome, Login, DailyFocus, Discover, Chat, …
        ├── navigation/    # RootNavigator (auth-aware)
        ├── auth/          # AuthContext (logged-in state)
        └── api.ts         # single client for all backend calls
```

---

## Note

Face-recognition matching is **optional and opt-in** (biometric consent at sign-up). If a user declines, the app matches on interests and behavior instead — the face features simply don't run.
