# QDate Backend

Node.js + Express + MongoDB backend for QDate.

## Architecture reconciliation (from `Finals project Architecture report-1.pdf`)

- **Implemented exactly**: 14-day learning phase with daily matching, then Phase 2 weekly curated matching with cooldown penalties on curated skips; behavioral learning from message cadence/latency and calibration swipes; feedback loop for post-match learning.
- **Implemented with stack-aligned adaptation**: the report describes a future Python + pgvector service. This repo currently uses TypeScript + MongoDB, so the ranker is implemented as an explainable TypeScript ML module (`src/ml/*`) that learns adaptive weights from in-app outcomes/feedback and can be replaced later by the dedicated ML service.
- **Scale profiles idea**: calibration cards now include structured metadata tags (interests + looks decks). Swipe likes/dislikes (weighted by response time) are converted into taste vectors.
- **Ethics**: appearance taste is modeled only through abstract calibration tags and optional candidate `appearanceTags`; no inference of protected attributes from photos.

## Stack

- **Runtime**: Node.js 22 LTS
- **Language**: TypeScript (run with `tsx`, build with `tsc`)
- **DB**: MongoDB 7 via Mongoose 8
- **Server**: Express 4

## Setup

### 1. Start MongoDB

Easiest path is Docker. From the project root:

```bash
docker compose up -d
```

Verify it's running:
```bash
docker compose ps
# Should show qdate-mongo with state "running"
```

**Don't have Docker?** Two alternatives:
- **MongoDB Atlas** (free tier): create a cluster, grab the connection string, paste into `.env` as `MONGODB_URI=`
- **Local install**: install MongoDB Community Edition for your OS, then it'll be at the default `mongodb://localhost:27017`

### 2. Install dependencies + configure

```bash
npm install
cp .env.example .env
```

### 3. Seed the database

```bash
npm run seed
```

This wipes everything and creates: 4 users, 2 matches, a 4-message conversation, and 11 calibration swipes. Output should end with a count summary.

### 4. Verify the data layer

```bash
npm run verify
```

Runs a full CRUD round-trip through every service. Should print a series of `─── Section ───` blocks followed by `✓ Data layer verified.`

### 5. Run the dev server

```bash
npm run dev
```

Server listens on `http://localhost:5000`. Try:

```bash
curl http://localhost:5000/api/health
# { "ok": true, "db": "connected", "uptimeSeconds": 4 }
```

## Project layout

```
src/
├── config/
│   └── db.ts                 # Mongoose connection
├── models/                   # Schemas + types
│   ├── User.ts
│   ├── Match.ts
│   ├── Message.ts
│   └── Swipe.ts
├── services/                 # CRUD + queries (called from routes)
│   ├── users.ts
│   ├── matches.ts
│   ├── messages.ts
│   └── swipes.ts
├── routes/
│   └── index.ts              # Express route handlers (thin wrappers over services)
├── scripts/
│   ├── seed.ts               # npm run seed
│   └── verify.ts             # npm run verify
└── index.ts                  # Server entry
```

## Schema design notes

### Why messages are a separate collection, not embedded in matches

ML aggregations like "average reply latency for user X across all conversations" or "message-length distribution by phase" are the whole point of keeping the chat corpus. Those queries are painful with embedded message arrays and easy with a flat `messages` collection that has the right indexes.

### Behavioral fields are stored at write time

Every message is persisted with:
- `text` — the content
- `messageLength` — derived from `text.length` but stored explicitly to skip the derivation in aggregations
- `responseTimeSeconds` — seconds since the other party's last message in this conversation, or `null` if this is an opener
- `sentAt`, `readAt` — for read-latency analysis

`recordMessage()` in `services/messages.ts` computes `responseTimeSeconds` automatically by querying the last message from the other party. The route handler just passes `{ matchId, senderId, text }`.

### Calibration swipes are independent of matches

Per the mobile design, the interests deck and looks deck are deliberately uncorrelated. The `swipes` collection stores them with a `mode` discriminator. No foreign key to a user candidate — calibration cards may not be real users in the system.

### Indexes

| Collection | Index | Purpose |
|---|---|---|
| users | `email` (unique) | Login lookup |
| matches | `userId` | "My matches" listings |
| matches | `userId, status` (compound) | "My active/pending match" — hot path |
| matches | `status` | Cron sweeps for expiry |
| messages | `matchId, sentAt` (compound) | Load a conversation in order |
| messages | `senderId, sentAt -1` (compound) | "User's recent messages" — ML feature extraction |
| swipes | `userId` | User's swipe history |
| swipes | `userId, mode, swipedAt -1` (compound) | Per-mode history with recency |

## ML matching pipeline

### Features extracted per user (`src/ml/features.ts`)

- Messaging behavior: average + median reply latency, message frequency/day, average message length, average read latency.
- Activity-time profile: normalized morning/afternoon/evening/night activity buckets.
- Stated profile: intent, communication style, intellect-importance, age, intent score.
- Calibration taste vectors: interests + looks vectors from swipes, using `responseTimeMs` as confidence.
- Feedback signal: average willingness-to-meet + communication-compatibility ratings.

### Ranker (`src/ml/ranker.ts`)

- `scoreCandidate(requester, candidate)` remains 0–100 and deterministic.
- Matching generation uses `scoreCandidateWithLearning` (adaptive weighted model) for candidate ranking.
- Training signal comes from match outcomes (`connected` vs `skipped/expired`) and explicit feedback.
- Phase 2 curation applies a higher score threshold before surfacing a weekly match.

### Phase logic

- Phase 1: up to day 14 (`LEARNING_DAYS`) daily matching.
- Phase 2: one curated match per week, higher quality threshold, `isIntentionalPairing=true`.
- Curated skip applies cooldown (`cooldownUntil`) for 14 days.

## API

| Method | Path | What it does |
|---|---|---|
| GET  | `/api/health` | Server + DB status |
| POST | `/api/users` | Create user |
| GET  | `/api/users/:id` | Fetch user by id |
| GET  | `/api/users/by-email/:email` | Fetch by email |
| GET  | `/api/matches/current/:userId` | The user's current pending/active match |
| POST | `/api/messages` | Record a chat message (computes latency) |
| GET  | `/api/messages/match/:matchId` | Load full conversation |
| POST | `/api/messages/match/:matchId/mark-read` | Mark unread messages from the other party |
| POST | `/api/swipes` | Record a calibration swipe |
| GET  | `/api/swipes/:userId?mode=interests\|looks` | List a user's swipes |
| POST | `/api/analytics/message_event` | Record message telemetry + update intent score |
| POST | `/api/learning/feedback` | Record post-match feedback + update intent score |
| GET  | `/api/calibration/interests/:userId` | Interests calibration deck (with tags) |
| GET  | `/api/calibration/looks/:userId` | Looks calibration deck (with tags) |
| GET  | `/api/match/weekly_curated/:userId` | Weekly curated Phase 2 match |
| POST | `/api/match/daily_generate` | Daily Phase 1 match |

## Remaining TODO

- Auth middleware (Firebase token verification) is still pending.
- Future roadmap from architecture doc (Python supervised service + vector DB + clustering) remains a later migration path.

## A note for the ML lead

Once the seed runs, you can hit Mongo directly with the shell:

```bash
docker compose exec mongodb mongosh qdate

# Examples:
db.messages.find({}, { text: 1, messageLength: 1, responseTimeSeconds: 1 }).limit(5)
db.swipes.aggregate([{ $group: { _id: '$mode', total: { $sum: 1 }, liked: { $sum: { $cond: ['$liked', 1, 0] } } } }])
```

The `getAvgResponseTimeSeconds` and `getLikeRates` service functions are starting points for the features you'll want to extract.
