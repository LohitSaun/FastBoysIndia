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
  (tabs)/             Main app: Feed, Crews, Map, Ranks, Garage, Profile
src/
  features/<name>/    Everything for one feature: api.ts (Supabase calls), hooks.ts, Redux slice
                      garage/ also has photos.ts (pick, shrink, upload) and components/ (forms)
                      sos/ has no api.ts: nothing about it touches the server
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

## Drives and the explored map (Phase 4)

- **`trips`** holds one row per recorded drive: car, times, distance, duration, top speed and a
  simplified route line. The individual GPS readings are **not** stored, so there's no
  second-by-second log of anyone's movements.
- **`explored_squares`** is the fog-of-war: the world is cut into 0.001° squares (about 110m in
  India) and any square you drive through is unlocked forever. Re-driving a road is free, because
  the primary key already covers it.
- **Saving a drive** goes through the `record_trip` function, so the drive and its squares are
  written together. It also refuses to record a drive in a car that isn't yours.
- **Totals** come from the `my_trip_stats` and `my_explored_stats` views, which use
  `security_invoker` so each person only ever sees their own numbers.
- **Erasing** is possible: a drive can be deleted, and the whole explored map can be wiped.
- **The map draws squares inside the visible region only**, capped, and stops drawing when zoomed
  too far out.
- **Simulated drives:** in development there's a switch that replays a Bandra → Sea Link → Worli
  route through the same location wrapper the real GPS uses. It keeps testing on Indian roads
  regardless of where the developer is, and it never appears in a real build (`__DEV__` only).

## The offline drive queue (Phase 6b)

- **The bug this fixes:** press stop in a dead zone and `record_trip` fails, and until now the
  whole drive was gone. Indian highways have plenty of places with no signal.
- **A failed save is queued on the phone** instead of lost, and retried when the app opens and
  whenever it returns to the foreground. The drive keeps its real `started_at`, so a late upload
  still lands in the right month on the leaderboards.
- **A drive in progress is checkpointed every 30 seconds**, so the app being killed — iOS
  reclaiming memory, a flat battery, a crash — costs half a minute rather than 200km. A checkpoint
  found at startup becomes a finished drive waiting to upload.
- **Two kinds of failure, treated oppositely.** No answer at all is temporary, so it stays queued.
  An answer that *refuses* the drive will not fix itself — usually the car was deleted since, which
  `record_trip` rejects — so the car is dropped and it goes again. You keep the distance and the
  squares.
- **Nothing is ever deleted silently.** After `MAX_ATTEMPTS` the app stops retrying and shows the
  drive with a Discard button. Your data, your call.
- **No network-detection library.** Trying and failing costs less than asking the phone whether
  it's online, and it can't be wrong about it.
- **No background uploading.** With the app closed nothing runs; the drive waits safely on the
  phone. Same honest limit as live location and SOS.

## SOS (Phase 5d)

- **What it does:** hold the button for 1.5s and the phone opens WhatsApp to your emergency
  contact — or the share sheet if you haven't set one — with "I need help", a
  `https://maps.google.com/?q=lat,lng` link and the coordinates written out as text too.
- **What it deliberately does not do.** It doesn't contact the emergency services, doesn't send
  anything by itself, and stores nothing. A button that promised to summon help would have to keep
  working with the app closed and the phone in a pocket, which needs background execution and push
  notifications we don't have yet. Automatic crash detection is worse: get it wrong and you've
  either cried wolf or stayed silent when it counted. So the wording is "share my location", never
  "call for help", and the message never claims help is on the way.
- **Hold, not tap.** A tap is too easy to trigger in a pocket, and a confirmation dialog is the
  wrong answer for something urgent — it adds a second decision at the worst moment. Letting go
  cancels it.
- **No location fix still sends.** In a basement or a tunnel the message goes anyway, saying the
  phone couldn't work out where you are and asking them to call. A silent button is the worst
  possible outcome here.
- **The emergency contact never leaves the phone.** It's in `AsyncStorage`, not Postgres: it's
  somebody else's name and number and they never agreed to being in our database, and the number is
  only ever used to build a message on this device. The cost is honest — a new phone or a reinstall
  means setting it again.
- **No new dependencies.** React Native's own `Share` and `Linking`, and `AsyncStorage`, which is
  already here for the login session.

## Breakdown alerts (Phase 5c)

- **`breakdowns`** holds one row per stopped car on a convoy: where it stopped, an optional short
  note ("flat tyre"), and when it was cleared.
- **This is the only place the app stores a position.** Live convoy positions travel over Realtime
  and are never written down. A breakdown has to survive being missed — somebody who opens the app
  a minute later, or whose phone dropped signal, still needs to know a car is stranded, and a
  Realtime message that already went past can't tell them. It's one point, not a trail, because a
  stopped car doesn't move. Nothing is written unless you press the button and confirm.
- **Realtime is only a nudge.** The broadcast on `convoy:<id>:alerts` carries no location and no
  name, just "something changed on this drive". Every phone then asks the database, which applies
  its own rules. So a tampered-with app can't announce a breakdown that isn't there. A 30-second
  refetch covers a nudge that never arrives.
- **Ghost Mode is deliberately overridden**, and the confirm dialog says so. An alert without a
  position is no use to anyone, but nobody should be surprised by it either.
- **Pressing the button twice** moves your existing alert rather than stacking a second one, which
  a partial unique index enforces.
- **It clears itself** when the drive ends (a trigger on `convoys`), so a forgotten alert doesn't
  follow the crew around. You can also clear it yourself, or delete it outright.
- **Convoy only.** Broken down on your own is the SOS case, not this one.

## Leaderboards (Phase 5a)

- **The Ranks tab** shows two boards — your city and your crew — each either all-time or for the
  current month, ranked on distance driven.
- **Ranking people means reading everyone's drives**, which is exactly what `trips` and
  `explored_squares` are meant to prevent. So instead of loosening those tables, the boards come
  out of `leaderboard_for_city()` and `leaderboard_for_crew()`. They return only what a board
  shows: a name, a main car, distance, squares, drives and whether the row is yours. No routes, no
  individual drives, no timestamps of where anyone was.
- **City boards are open to any signed-in user**; crew boards check membership and refuse an
  outsider. Both refuse a caller who isn't signed in.
- **A month is passed as `'2026-09'`**, and anything else is rejected by the database rather than
  trusted from the app.
- **Somebody with no drives is left off a city board** but stays on their crew's board, because a
  crew is a fixed list of people and a zero is part of the competition.
- **If you're outside the top 100**, the board shows your own totals in a footer instead of your
  position. Working out a rank across a whole city for one person is a database change we don't
  need while the cities are small.

## Hazards, speed cameras and tiers (Phase 5b)

- **`hazards`** holds pothole, waterlogging, fog, speed camera and other reports, each with a
  location and an expiry (fog hours, waterlogging a day, potholes weeks, cameras a year).
- **Reports are anonymous.** The reporter is stored for abuse handling but never returned: the
  table has no general read rule, and every read goes through `hazards_near()`, which returns the
  hazard without the reporter. You can read your own reports, nobody else's.
- **`hazard_votes`**: "still there" or "it's gone". Three "gone" votes retire a hazard.
- **`subscriptions`** records each person's tier (free / pro / premium). **No app code can write
  to it** — there are no insert or update rules — so a billing provider sets it later. For now it's
  set by hand with admin SQL.
- **Speed cameras are gated in the database**, not in the screens: `hazards_near()` leaves them out
  unless the caller's tier is pro or premium. Hiding a button would prove nothing, since anyone can
  call the API directly.
- **Speed limits are deliberately not implemented.** There's no reliable open dataset of Indian
  road speed limits, so the app warns about camera locations rather than claiming to know limits.

## House rules

1. **Server data vs device state.** Anything stored in Supabase goes through TanStack Query.
   Device-only state (auth status, Ghost Mode, data-saver) goes in Redux. Never both.
2. **Wrap third-party SDKs** in `src/services/` so they can be swapped. Maps and background
   location will follow this pattern in Phases 3–4.
3. **Every table has Row Level Security** with explicit policies. The app uses a public key,
   so RLS is what protects user data. When testing a policy through `supabase db query`, the
   connection is the `postgres` role, which **bypasses RLS entirely** — a check written without
   `set local role authenticated` passes however wrong the policy is. Always switch the role and
   set `request.jwt.claims` together.
4. **No personal data in monitoring.** No phone numbers or locations go to Sentry or PostHog.
5. **Env vars starting with `EXPO_PUBLIC_` are public.** Never put secrets in them.
