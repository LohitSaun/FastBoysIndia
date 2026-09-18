# Fast Boys India

A community app for car enthusiasts in **Mumbai, Delhi and Bangalore**.

- **Garage** — your cars, their photos and every mod
- **Crews and convoys** — drive together on a live map, with Ghost Mode when you want to disappear
- **Explored map** — every road you drive unlocks a square, fog-of-war style
- **Ranks** — city and crew leaderboards
- **Hazards** — report potholes, waterlogging and fog; speed camera alerts for Pro
- **Safety** — breakdown alerts for your crew, and a one-hold SOS
- **Feed** — short clips of cars, with reporting and blocking built in

Built with React Native, Expo and Supabase.

---

## Getting started

This gets the app running on your own phone in about 15 minutes. You don't need Xcode, Android
Studio or a developer account — the free **Expo Go** app does the work.

### What you need

- A computer — Mac, Windows or Linux
- An **iPhone** or an **Android** phone
- Both on the **same Wi-Fi network**
- Access to this repository (it's private, so you need to have been invited)

### Step 1 — Install Node.js

Node.js runs the tools that build the app. You need **version 24**.

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version
2. Open the installer and click through it
3. Check it worked — open **Terminal** (Mac) or **Command Prompt** (Windows) and type:

```bash
node --version
```

You should see something starting with `v24`.

> Already use `fnm` or `nvm`? This folder has a `.node-version` file, so they'll switch to the
> right version automatically.

### Step 2 — Get the code

```bash
git clone https://github.com/LohitSaun/FastBoysIndia.git
```

```bash
cd FastBoysIndia
```

```bash
npm install
```

The last one downloads everything the app depends on. It takes a few minutes the first time.

> **No `git`?** Install it from [git-scm.com](https://git-scm.com), or use
> [GitHub Desktop](https://desktop.github.com) and choose **Clone a repository**.

### Step 3 — Add the settings file

The app needs to know which backend to talk to. That goes in a file called `.env`, which is never
uploaded to GitHub.

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in these two lines:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

**Where the values come from:**

- **You own the project:** Supabase dashboard → your project → **Connect**. Copy the **Project URL**
  and the **Publishable key**.
- **Someone invited you:** ask them for these two values.
- **Starting from scratch:** follow [Setting up your own backend](#setting-up-your-own-backend)
  below first.

Leave everything else in `.env` empty. Sentry and PostHog are optional and switch themselves off
when their values are blank.

> Only ever put the **publishable** key here. Never the secret key or the database password —
> anything in this file ends up inside the app, where anyone could read it.

### Step 4 — Start the app

Log in to Expo once, with the same account you'll use in Expo Go on your phone:

```bash
npx expo login
```

Then start it:

```bash
npx expo start
```

A **QR code** appears in the terminal. Leave this window open — the app runs from here while you
use it.

### Step 5 — Open it on your phone

1. Install **Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779) or
   [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. Open Expo Go and **sign in with the same Expo account** as Step 4
3. Scan the QR code:
   - **iPhone:** open the normal **Camera** app, point it at the code, and tap the banner
   - **Android:** tap **Scan QR code** inside Expo Go
4. If your phone asks to find devices on your local network, tap **Allow**

The app loads on your phone. Change any code on your computer and it reloads by itself.

### Step 6 — Sign in

The backend has a **test phone number** set up, so you can sign in without a real SMS:

| | |
| --- | --- |
| **Phone number** | `98765 43210` |
| **Code** | `123456` |

No text message is sent — any code other than `123456` is rejected.

Then pick a display name and a home city, and you're in.

> **Testing from outside India?** The simulated drive on the **Map** tab replays a route through
> Mumbai, so you can try drives, the explored map and hazards from anywhere. It only appears in
> development, never in a real build.

---

## If something goes wrong

| What you see | What to do |
| --- | --- |
| Expo Go says **"sign in to Expo CLI as lohitsaun"** | Run `npx expo login` on your computer with the **same account** that's signed into Expo Go, then restart with `npx expo start`. If you're not the owner, you need to be added to the Expo project first. |
| Expo Go **can't connect** or times out | Phone and computer must be on the **same Wi-Fi**. Office and hotel networks often block this — try a phone hotspot. On iPhone, check **Settings → Expo Go → Local Network** is on. |
| **"Phone sign-in is not switched on"** | The backend's Phone provider is off. See step 3 of [Setting up your own backend](#setting-up-your-own-backend). |
| The **test number stopped working** | Test numbers have an expiry date in Supabase. Move it forward under **Test OTPs Valid Until**. |
| A **blank page** at `localhost:8081` in your browser | That's expected. It's a phone app, not a website — open it with Expo Go instead. |
| `npm install` shows **warnings** | Warnings are fine. Only a line starting with `ERR!` is a real problem. |
| `node --version` shows **something other than 24** | Install Node 24 from [nodejs.org](https://nodejs.org), then close and reopen the terminal. |
| **"Unable to resolve module"** after pulling new code | Someone added a package. Run `npm install` again. |
| TypeScript complains about a **route that exists** | Route types are rebuilt by the dev server. Run `npx expo start` once and the error goes away. |

---

## Setting up your own backend

Only needed if you're starting a **brand new** Supabase project rather than using an existing one.

<details>
<summary><strong>Show the steps</strong></summary>

### 1. Create the project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**
2. Region: **South Asia (Mumbai)**, so the app is fast for people in India
3. Under **Security**, tick **Enable automatic RLS**. A migration locks down a function this option
   creates, so setting up the database fails without it.
4. Save the **database password** somewhere safe. You won't need it in the app.

### 2. Create the tables

This creates every table, security rule and storage bucket in one go:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npm run db:push
```

Your project ref is the part of the Project URL before `.supabase.co`.

### 3. Turn on phone sign-in

In the dashboard: **Authentication → Sign In / Providers**.

**Phone** — switch it on, then set:

- **Test Phone Numbers and OTPs:** `919876543210=123456`
- **Test OTPs Valid Until:** a date a few months ahead. Test numbers stop working after it.
- **SMS OTP Expiry:** `300`. The default of 60 seconds is too short when a text arrives late on a
  weak signal.
- **The three Twilio boxes:** type `placeholder` in each. The dashboard won't save Phone without
  them, even when you only use test numbers.

**Email** — switch it **off**. Phone is the only way into this app, and leaving email on would let
people create accounts another way.

Click **Save**.

> **Real phone numbers won't get a text yet.** That needs a real SMS provider, and in India it also
> needs **DLT registration**, which usually requires a registered business.

### 4. Copy the keys into `.env`

**Connect** → copy the **Project URL** and **Publishable key** into `.env`, as in
[Step 3](#step-3--add-the-settings-file) above.

### 5. Check it

```bash
npx expo start
```

Sign in with the test number. If you reach the name and city screen, everything is connected.

</details>

---

## Building a real app for the App Store

Expo Go is for development. To put the app in the App Store or Play Store — or to use features Expo
Go can't run, like location tracking with the app closed — you build the app itself with **EAS**,
Expo's build service.

That needs:

- An **Apple Developer** account ($99/year) for iPhone
- A **Google Play Console** account ($25 once) for Android

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas build --profile development --platform ios
```

`development`, `preview` and `production` are set up in `eas.json`. Each installs as a separate app
(**Fast Boys (Dev)**, **Fast Boys (Preview)**, **Fast Boys India**), so they can sit side by side.

You need a **new build** only after adding a package with native code, or changing
`app.config.ts`, permissions or icons. Everything else reloads instantly.

> ⚠️ The production bundle ID `in.fastboys.app` becomes **permanent** the moment the app is
> published. Changing it later means a brand-new store listing.

---

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
                      new-post.tsx is in here too, but hidden from the tab bar
src/
  features/<name>/    Everything for one feature: api.ts (Supabase calls), hooks.ts, Redux slice
                      garage/ also has photos.ts (pick, shrink, upload) and components/ (forms)
                      sos/ has no api.ts: nothing about it touches the server
  services/           The ONLY place third-party SDKs are imported
    supabase/         The one Supabase client
    maps/             AppMap: every map in the app goes through this
    location/         GPS, plus the simulated Mumbai drive used in development
    video/            AppVideo: every clip in the feed plays through this
    monitoring/       Sentry and PostHog
  store/              Redux store
  lib/                Small helpers: env vars, query client, phone numbers
  components/         Shared UI: Screen, Button, TextField, ChipGroup, HoldButton
  theme/              Colours, spacing, text sizes
  types/database.ts   Generated database types
supabase/migrations/  Database changes as SQL, applied in order
```

# How it works

Notes on each part of the app — what it does, and the decisions behind it that aren't obvious from the code. Read the relevant one before changing that part.

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

## The video feed (Phase 6a)

- **`posts`** is one short clip: a path into the private `post-videos` bucket, an optional caption
  and car, and the author's city copied in at posting time so the feed can be filtered without
  rewriting history when somebody moves.
- **Moderation is not optional**, so it shipped with the feature rather than after it:
  - **Report** a clip, privately. Nobody can see who reported what — `post_reports` is readable
    only by the person who wrote the row.
  - **Three reports and it comes down by itself**, via a trigger. Low on purpose: with nobody
    watching a queue overnight, briefly hiding something costs far less than leaving it up.
  - **Block** somebody and the clips are hidden **both ways** inside `feed_page()`, so neither of
    you sees the other. People block because somebody is targeting them, and leaving that person
    able to keep watching everything you post would fix the wrong half. They are not told; from
    their side it just looks as though you stopped posting.
  - **The author can always see their own clip**, including one that's been taken down, so it can
    say what happened instead of silently vanishing.
- **Paging is by timestamp, not an offset.** The feed gains rows at the top while you scroll, and
  an offset would show the same clip twice.
- **Clips are private files played through one-hour signed links**, so a clip taken down stops
  being reachable rather than living on at a public URL somebody saved.
- **Hard limits instead of compression:** 30 seconds, 60MB, enforced by the picker, the app and
  the bucket. We can't re-encode video on the phone without a heavy native library, so the honest
  answer is to refuse a file that's too big and say why.
- **Playback goes through `src/services/video/AppVideo.tsx`**, the same wrapper pattern as maps and
  location. Moving to a hosted video service later — one that can drop quality on a weak signal,
  which this cannot — is a change to that file and the upload path, not to the feed.
- **Muted by default, and only the clip on screen plays.** Sound arriving unannounced is the rudest
  thing a feed can do, and on mobile data a muted single loop is the cheaper one.
- **Deliberately absent:** likes, comments and follows. A feed people can post to and report is all
  of v1; the social layer can be added later without touching any of this.

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

## Data Saver (Phase 6c)

- **Why it exists:** mobile data in India is cheap but not unlimited, and plenty of people drive on
  a fixed daily pack. Data Saver is a promise the app won't quietly spend it.
- **A switch on the Profile tab.** It's Redux, not a database row, because it's a choice about this
  phone and has to be readable the instant a screen renders — and it's mirrored into device storage,
  because a data-saving setting that silently resets on restart is worse than not having one.
- **What it changes**, all listed together in `settingsSlice.ts` rather than scattered across
  screens: the garage list stops downloading a cover photo per car (it shows the placeholder and
  loads the photos when you open a car), nearby-hazard checks drop from every minute to every five,
  the explored map draws 600 squares instead of 2000, and the feed asks for shorter pages and never
  autoplays.
- **Default off.** Nobody should meet a degraded app without choosing it.

## Deleting your account

- **Apple rejects an app that lets you create an account but not delete one**, and it has to really
  delete rather than deactivate. India's DPDP Act points the same way. It's on the Profile tab,
  behind two confirmations because there is no undo and no grace period.
- **Files first, then rows.** Photos and clips live in Storage, which the database can't reach, so
  the app removes those itself (it's allowed to: every storage rule checks that the first folder of
  the path is your own user id). Then one database function removes the auth row and every table's
  foreign key takes the rest. Files first on purpose — a few leftover files are a far smaller
  problem than an account that is half deleted and can still sign in.
- **No Edge Function and no service key in the app.** `delete_my_account()` is SECURITY DEFINER and
  runs with the migration owner's rights, which are enough to remove the auth row.
- **Two cascades were wrong and had to be fixed first:**
  - **A crew you own is handed to whoever joined it first**, not destroyed. Leaving should never
    delete other people's things. It's only deleted if you were the last one in it.
  - **Hazards you reported stay on the map**, with the link to you removed (`on delete set null`).
    A pothole or a speed camera is community safety data that is already anonymous; wiping it when
    somebody leaves helps nobody, and what deletion is actually about is the link to the person.

## House rules

1. **Server data vs device state.** Anything stored in Supabase goes through TanStack Query.
   Device-only state (auth status, Ghost Mode, data-saver) goes in Redux. Never both.
2. **Wrap third-party SDKs** in `src/services/` so they can be swapped. Maps, location and video
   already work this way: trying Mapbox, the paid background location tracker, or a hosted video
   service is a change to one file there, not to the screens that use it.
3. **Every table has Row Level Security** with explicit policies. The app uses a public key,
   so RLS is what protects user data. When testing a policy through `supabase db query`, the
   connection is the `postgres` role, which **bypasses RLS entirely** — a check written without
   `set local role authenticated` passes however wrong the policy is. Always switch the role and
   set `request.jwt.claims` together.
4. **No personal data in monitoring.** No phone numbers or locations go to Sentry or PostHog.
5. **Env vars starting with `EXPO_PUBLIC_` are public.** Never put secrets in them.
