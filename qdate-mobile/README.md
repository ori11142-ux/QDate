# QDate Mobile — Complete Project

Full mobile frontend for QDate, ready to drop into a fresh Expo project.

## What's included

**Flow:**
- Welcome → Register → Onboarding (preferences) → Main (one-time, persisted)
- Daily Focus (Phase 1) with gacha reveal animation
- Weekly Curated Match (Phase 2) with cooldown penalty modal on skip
- Chat screen with passive behavioral tracking on every send
- Insights dashboard with intent score, comm-style breakdown, reflection cards
- Sign out + phase toggle from Insights

**Architecture:**
- Auth state in AsyncStorage, hydrated on launch via Context
- Conditional navigation: signed-out users see Welcome stack, signed-in users see Main stack
- API layer with mock fallback (`USE_MOCK_API = true`) — flip to false when backend is live
- Phase-aware screens driven by `user.currentPhase`

## Setup

If you already have the project running, skip to "Drop in the files."

### From scratch

```powershell
# 1. Make sure Node 22 LTS is installed
node -v   # should print v22.x

# 2. Create fresh Expo project
cd $HOME\Desktop
npx create-expo-app qdate-mobile --template blank-typescript --yes
cd qdate-mobile

# 3. Install dependencies
npx expo install "@react-navigation/native" "@react-navigation/native-stack" `
  "@react-navigation/bottom-tabs" react-native-screens react-native-safe-area-context `
  react-native-gesture-handler "@react-native-async-storage/async-storage"
```

### Drop in the files

1. Extract `qdate-complete.zip`
2. Copy the `App.tsx` and `src` folder into your project root (`Desktop\qdate-mobile`)
3. Replace files when Windows asks
4. Run: `npx expo start -c`

## File layout

```
qdate-complete/
├── App.tsx                                  # Auth + Navigation providers
├── src/
│   ├── theme.ts                             # Colors, spacing, typography
│   ├── types.ts                             # Shared type contracts
│   ├── api.ts                               # Fetch wrapper, mock fallback
│   ├── mocks.ts                             # Mock data for offline dev
│   ├── auth/
│   │   └── AuthContext.tsx                  # Session state, sign in/out, phase toggle
│   ├── storage/
│   │   └── auth.ts                          # AsyncStorage wrapper for user
│   ├── navigation/
│   │   └── RootNavigator.tsx                # Conditional auth gate
│   ├── components/
│   │   ├── CountdownTimer.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── PrimaryButton.tsx
│   │   ├── MatchRevealCard.tsx              # Gacha reveal animation
│   │   └── CooldownModal.tsx                # Phase 2 skip confirmation
│   └── screens/
│       ├── WelcomeScreen.tsx                # Auth provider buttons
│       ├── RegisterScreen.tsx               # Name, email, age
│       ├── OnboardingScreen.tsx             # Intent preferences
│       ├── DailyFocusScreen.tsx             # Phase 1 & Phase 2
│       ├── ChatScreen.tsx                   # Conversation + tracking
│       └── InsightsScreen.tsx               # Dashboard + sign out + phase toggle
```

## Demoing both phases

1. Complete onboarding → land on Phase 1 (Daily Focus, Day 3 of 14)
2. Tap reveal → Olivia appears → Open Chat or Skip
3. Go to **Insights** tab → scroll to bottom → tap **"Switch to Phase 2 (demo)"**
4. Back to Today tab → header now says "This Week's Match · Curated · High Intentionality"
5. Tap reveal → Maya appears with a "✦ Curated" badge
6. Tap Skip → the **Cooldown Modal** appears warning about the 14-day penalty
7. Confirm Skip → lands on the cooldown closed state ("You're in cooldown · 14 days instead of 7")

## Backend integration checklist

When the backend dev is ready, flip `USE_MOCK_API = false` in `src/api.ts` and make sure these endpoints exist:

| Method | Path | Returns |
|---|---|---|
| POST | `/api/match/daily_generate` | `Match` |
| GET | `/api/match/weekly_curated/:userId` | `Match` (with `isIntentionalPairing`, `cooldownActive`) |
| POST | `/api/analytics/message_event` | `{ intent_score_updated: bool }` |
| POST | `/api/learning/feedback` | `{ accepted: bool }` |
| GET | `/api/insights/:userId` | `InsightsSummary` |

Auth wiring (when ready):
- `WelcomeScreen` "Continue with Email/Apple" should kick off Firebase OAuth, then navigate to Register with the resulting uid in route params
- `OnboardingScreen.handleStart()` should POST to `/api/register` before saving locally — if the request fails, don't save and show an error
- `signInDemo()` in `AuthContext` should be replaced with real Firebase Auth + `GET /api/me`

## What's still TODO

**Story-essential:**
- Match expiry flow: when the 24h/7d countdown hits zero, show a feedback prompt
- Real photo URLs (placeholder service like `https://i.pravatar.cc/400?u={matchId}` until backend serves them)

**Polish:**
- Profile/settings screen (currently sign-out is buried in Insights)
- Match history view
- Proper icons via `@expo/vector-icons` (replaces Unicode `♡` `◔` in the tab bar)
- Pull-to-refresh on Insights
- Lottie animations during loading states
- Push notifications via `expo-notifications`

**Out of scope until backend is real-time:**
- Real-time chat (currently auto-replies from a canned pool)
- Live charts on Insights with actual data
