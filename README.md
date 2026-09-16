# Fast Boys India

A community app for car enthusiasts in Mumbai, Delhi and Bangalore: crews, convoys, garages and exploration.

**Stack:** React Native + Expo SDK 57 (custom dev client) · Expo Router · Supabase (Postgres + PostGIS, Auth, Storage, Realtime) · Redux Toolkit · TanStack Query · Sentry · PostHog

---

## Prerequisites

- **Node 24.** If you use `fnm`, it switches automatically in this folder (see `.node-version`).
- **EAS CLI:** `npm install -g eas-cli`
- **A test phone.** Android works today. iPhone needs an Apple Developer account first.

## First-time setup

### 1. Install and configure

```bash
npm install
cp .env.example .env   # then fill in the values (see comments in the file)
```

### 2. Supabase

1. Create a project at supabase.com: region **South Asia (Mumbai)**, and tick
   **Enable automatic RLS** under Security. The second migration locks down the
   `rls_auto_enable()` function that this option creates, so `db:push` fails without it.
2. Link this folder to it and apply the database migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push     # creates tables, security policies, PostGIS
   npm run db:types    # regenerates src/types/database.ts from the real database
   ```
3. In the dashboard, under **Authentication → Sign In / Providers**:
   - **Phone:** enable it, then set:
     - **Test Phone Numbers and OTPs:** `919876543210=123456`, so you can sign in without
       a real SMS provider. Also set **Test OTPs Valid Until**, because test numbers stop
       working after that date.
     - **SMS OTP Expiry:** `300` (5 minutes). The default of 60 seconds is too short when
       SMS arrives late on a weak signal.
     - **Twilio fields:** the dashboard won't save Phone until the 3 Twilio fields have
       values, even if you only use test numbers. For local testing, type `placeholder` in
       each. Real numbers won't receive an SMS until a real provider is configured (which
       in India also needs DLT registration).
   - **Email:** disable it. Phone is our only sign-in method, and leaving email on would let
     people create accounts through the API another way.

### 3. Build the dev app (once, and again whenever native code changes)

```bash
eas login
eas init                                             # links the project to your Expo account
eas build --profile development --platform android   # builds in the cloud, gives you an install link
```

Install the APK on your phone. It appears as **Fast Boys (Dev)**.

## Day-to-day development

```bash
npx expo start
```

Open **Fast Boys (Dev)** on your phone and connect to the dev server. Code changes reload instantly.

You only need a **new EAS build** after:
- adding a package with native code
- changing `app.config.ts`, permissions or icons

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the dev server |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Check code style and common mistakes |
| `npm run db:push` | Apply new migrations in `supabase/migrations` to the linked project |
| `npm run db:types` | Regenerate `src/types/database.ts` after a migration |
| `npx supabase migration new <name>` | Create a new, empty migration file |

## Project structure

```
app/                  Screens. File path = route (Expo Router)
  _layout.tsx         Providers + who-sees-what gate (loading / auth / onboarding / tabs)
  (auth)/             Sign-in and OTP screens
  (onboarding)/       First-run profile setup
  (tabs)/             Main app: Feed, Crews, Map, Garage, Profile
src/
  features/<name>/    Everything for one feature: api.ts (Supabase calls), hooks.ts, Redux slice
                      garage/ also has photos.ts (pick, shrink, upload) and components/ (forms)
  services/           The ONLY place third-party SDKs are imported (Supabase, Sentry, PostHog…)
  store/              Redux store
  lib/                Small helpers: env vars, query client, phone numbers
  components/         Shared UI: Screen, Button, TextField
  theme/              Colours, spacing, text sizes
  types/database.ts   Generated database types
supabase/migrations/  Database changes as SQL, applied in order
```

## The garage (Phase 2)

- **Tables:** `vehicles`, `vehicle_photos`, `modifications`. Photos and mods have no owner of
  their own; permission is checked through the car they belong to.
- **Photos** live in a private `vehicle-photos` storage bucket, under `<user id>/<car id>/`.
  The storage rules check that first folder, so people can only write into their own space.
  The app displays them with short-lived signed links, refreshed hourly.
- **Before upload** every photo is resized to 1600px and saved at 70% quality, which turns a
  4MB camera photo into roughly 300KB. That matters on Indian mobile data.
- **Limits:** 10 photos per car (enforced by a database trigger, not just the app), 5MB per file.
- **Mod categories** are a fixed list in the database. Adding one means a migration plus a label
  in `MOD_CATEGORY_LABELS`.
- **The main car** is switched through the `set_primary_vehicle` database function, so there is
  never a moment with two main cars.

## Crews and convoys (Phase 3)

- **Crews:** `crews` + `crew_members`. Joining goes through the `join_crew_by_code` database
  function, and there is deliberately no insert rule on `crew_members`, so nobody can add
  themselves to a crew whose id they happened to learn.
- **Crew mates** can see each other's display name, main car and that car's photos. Nothing else:
  other cars, their photos and all mods stay private.
- **Owners** delete a crew rather than leaving it, which the database enforces.
- **Convoys:** `convoys` + `convoy_participants`, one running convoy per crew (a partial unique
  index). Only the person who started it, or the crew owner, can end it.
- **Live positions are never stored.** They travel over a Supabase Realtime presence channel
  named `convoy:<id>` and disappear when phones stop publishing. Recording drives is Phase 4.
- **Ghost Mode** stops publishing and withdraws the position already out there, so the dot
  vanishes for everyone within a couple of seconds. Switching it off republishes immediately.
- **Location is foreground only** for now, through `src/services/location/`. Swapping in the paid
  background tracker later means writing one more file there and changing a single line.
- **Maps** go through `src/services/maps/AppMap.tsx`, currently react-native-maps (Apple Maps on
  iPhone, works in Expo Go). Testing Mapbox later is a change to that one file.

## House rules

1. **Server data vs device state.** Anything stored in Supabase goes through TanStack Query.
   Device-only state (auth status, Ghost Mode, data-saver) goes in Redux. Never both.
2. **Wrap third-party SDKs** in `src/services/` so they can be swapped. Maps and background
   location will follow this pattern in Phases 3–4.
3. **Every table has Row Level Security** with explicit policies. The app uses a public key,
   so RLS is what protects user data.
4. **No personal data in monitoring.** No phone numbers or locations go to Sentry or PostHog.
5. **Env vars starting with `EXPO_PUBLIC_` are public.** Never put secrets in them.
