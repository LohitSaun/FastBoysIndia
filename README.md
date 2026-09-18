# Fast Boys India

A community app for car enthusiasts in Mumbai, Delhi and Bangalore.

- A garage for your cars, with their photos and every mod
- Crews, and convoys that put everyone on a live map, with Ghost Mode for when you'd rather not be seen
- An explored map where every road you drive unlocks a square, fog-of-war style
- City and crew leaderboards
- Hazard reports for potholes, waterlogging and fog, plus speed camera alerts on Pro
- Breakdown alerts for your crew, and an SOS you send by holding one button
- A feed of short car clips, with reporting and blocking built in

Built with React Native, Expo and Supabase.

---

## Getting started

This gets the app running on your own phone in about 15 minutes. You don't need Xcode, Android
Studio or a developer account, because the free Expo Go app does the work.

### What you need

- A computer (Mac, Windows or Linux)
- An iPhone or an Android phone
- Both on the same Wi-Fi network
- Access to this repository. It's private, so you need to have been invited.

### Step 1: Install Node.js

Node.js runs the tools that build the app. You need version 24.

1. Download the **LTS** version from [nodejs.org](https://nodejs.org)
2. Run the installer and click through it
3. To check it worked, open Terminal (Mac) or Command Prompt (Windows) and type:

```bash
node --version
```

You should see something starting with `v24`.

> If you already use `fnm` or `nvm`, the `.node-version` file in this folder switches you to the
> right version automatically.

### Step 2: Get the code

```bash
git clone https://github.com/LohitSaun/FastBoysIndia.git
```

```bash
cd FastBoysIndia
```

```bash
npm install
```

The last command downloads everything the app depends on, which takes a few minutes the first
time.

> No `git`? Install it from [git-scm.com](https://git-scm.com), or use
> [GitHub Desktop](https://desktop.github.com) and choose **Clone a repository**.

### Step 3: Add the settings file

The app needs to know which backend to talk to, and that goes in a file called `.env`. It never
gets uploaded to GitHub.

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in these two lines:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Where you get the values depends on your situation:

- If you own the project, open the Supabase dashboard, go to your project and click **Connect**.
  Copy the **Project URL** and the **Publishable key**.
- If someone invited you, ask them for the two values.
- If you're starting from scratch, follow [Setting up your own backend](#setting-up-your-own-backend)
  first.

Leave everything else in `.env` empty. Sentry and PostHog are optional and switch themselves off
when their values are blank.

> Only ever put the publishable key here, never the secret key or the database password. Anything
> in this file ends up inside the app, where anyone could read it.

### Step 4: Start the app

Log in to Expo once, using the same account you'll sign in to Expo Go with on your phone:

```bash
npx expo login
```

Then start the app:

```bash
npx expo start
```

A QR code appears in the terminal. Leave the window open, because the app runs from here while you
use it.

### Step 5: Open it on your phone

1. Install Expo Go from the [App Store](https://apps.apple.com/app/expo-go/id982107779) or
   [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. Open Expo Go and sign in with the same Expo account you used in step 4
3. Scan the QR code. On an iPhone, point the normal Camera app at it and tap the banner that
   appears. On Android, tap **Scan QR code** inside Expo Go.
4. If your phone asks to find devices on your local network, tap **Allow**

The app loads on your phone, and it reloads by itself whenever you change code on your computer.

### Step 6: Sign in

The backend has a test phone number set up, so you can sign in without receiving a real SMS:

| | |
| --- | --- |
| **Phone number** | `98765 43210` |
| **Code** | `123456` |

No text message is sent, and any code other than `123456` is rejected. After that, pick a display
name and a home city and you're in.

> Testing from outside India? The Map tab has a simulated drive that replays a route through
> Mumbai, so you can try drives, the explored map and hazards from anywhere. It only shows up in
> development, never in a real build.

---

## If something goes wrong

| What you see | What to do |
| --- | --- |
| Expo Go says "sign in to Expo CLI as lohitsaun" | Run `npx expo login` on your computer with the same account that's signed in to Expo Go, then restart with `npx expo start`. If you're not the owner, you need to be added to the Expo project first. |
| Expo Go can't connect, or times out | Your phone and computer have to be on the same Wi-Fi. Office and hotel networks often block this, so try a phone hotspot. On iPhone, check that **Settings → Expo Go → Local Network** is on. |
| "Phone sign-in is not switched on" | The backend's Phone provider is off. See step 3 of [Setting up your own backend](#setting-up-your-own-backend). |
| The test number stopped working | Test numbers expire on a date set in Supabase. Move it forward under **Test OTPs Valid Until**. |
| A blank page at `localhost:8081` in your browser | This is expected. It's a phone app rather than a website, so open it with Expo Go. |
| `npm install` prints warnings | Warnings are fine. Only a line starting with `ERR!` is a real problem. |
| `node --version` shows something other than 24 | Install Node 24 from [nodejs.org](https://nodejs.org), then close and reopen the terminal. |
| "Unable to resolve module" after pulling new code | Someone added a package, so run `npm install` again. |
| TypeScript complains about a route that exists | The dev server rebuilds the route types. Run `npx expo start` once and the error goes away. |

---

## Setting up your own backend

You only need this if you're starting a brand new Supabase project instead of using an existing
one.

<details>
<summary><strong>Show the steps</strong></summary>

### 1. Create the project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**.
2. Choose the **South Asia (Mumbai)** region, so the app is fast for people in India.
3. Under **Security**, tick **Enable automatic RLS**. One of the migrations locks down a function
   this option creates, so setting up the database fails without it.
4. Save the database password somewhere safe. The app itself never needs it.

### 2. Create the tables

These three commands create every table, security rule and storage bucket:

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

In the dashboard, go to **Authentication → Sign In / Providers**. Switch **Phone** on, then set:

- **Test Phone Numbers and OTPs** to `919876543210=123456`
- **Test OTPs Valid Until** to a date a few months ahead, since test numbers stop working after it
- **SMS OTP Expiry** to `300`. The default of 60 seconds is too short when a text arrives late on a
  weak signal.
- The three Twilio boxes to `placeholder`. The dashboard won't save Phone without them, even if you
  only use test numbers.

Then switch **Email** off. Phone is the only way into this app, and leaving email on would let
people create accounts another way. Click **Save**.

> Real phone numbers won't get a text yet. That needs a real SMS provider, and in India it also
> needs DLT registration, which usually requires a registered business.

### 4. Copy the keys into `.env`

Click **Connect**, then copy the Project URL and Publishable key into `.env` as described in
[Step 3](#step-3-add-the-settings-file).

### 5. Check it

```bash
npx expo start
```

Sign in with the test number. If you get to the screen asking for your name and city, everything
is connected.

</details>

---

## Building a real app for the App Store

Expo Go is for development. To put the app in the App Store or Play Store, or to use features Expo
Go can't run (such as tracking location with the app closed), you build the app itself with EAS,
Expo's build service. That needs an Apple Developer account ($99 a year) for iPhone and a Google
Play Console account ($25, paid once) for Android.

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas build --profile development --platform ios
```

`eas.json` defines three profiles: `development`, `preview` and `production`. Each one installs as a
separate app (Fast Boys (Dev), Fast Boys (Preview) and Fast Boys India), so all three can sit on
one phone side by side.

You only need a new build after adding a package with native code, or after changing
`app.config.ts`, permissions or icons. Everything else reloads instantly.

> The production bundle ID `in.fastboys.app` becomes permanent once the app is published. Changing
> it later means starting a brand-new store listing.

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

These notes cover what each part of the app does, and the decisions behind it that the code
doesn't make obvious. Read the relevant one before changing that part.

## The garage (Phase 2)

Cars live in `vehicles`, with `vehicle_photos` and `modifications` hanging off them. Photos and mods
don't have an owner of their own; permission is checked through the car they belong to.

Photos go in a private `vehicle-photos` storage bucket under `<user id>/<car id>/`. The storage
rules check that first folder, so people can only write into their own space. The app shows photos
through short-lived signed links, which it refreshes hourly.

Every photo is resized to 1600px and saved at 70% quality before upload. That turns a 4MB camera
photo into roughly 300KB, which matters on Indian mobile data. Each car can have 10 photos (a
database trigger enforces this, not just the app), and each file can be up to 5MB.

Mod categories are a fixed list in the database, so adding one means a migration plus a label in
`MOD_CATEGORY_LABELS`. The main car is switched through the `set_primary_vehicle` database
function, so there's never a moment with two main cars.

## Crews and convoys (Phase 3)

A crew is a row in `crews` plus its members in `crew_members`. People join through the
`join_crew_by_code` database function. `crew_members` has no insert rule at all, so nobody can add
themselves to a crew just because they learned its id.

Crew mates can see each other's display name, main car and that car's photos, and nothing else.
Other cars, their photos and all mods stay private. An owner can't leave their crew, only delete
it, and the database enforces that.

Convoys use `convoys` and `convoy_participants`. A partial unique index allows one running convoy
per crew, and only the person who started it or the crew owner can end it.

Live positions are never stored. They travel over a Supabase Realtime presence channel called
`convoy:<id>` and disappear when phones stop publishing. (Recording drives is Phase 4.) Ghost Mode
stops publishing and withdraws the position that's already out there, so your dot vanishes for
everyone within a couple of seconds. Switching it off republishes straight away.

Location is foreground only for now, through `src/services/location/`. Swapping in the paid
background tracker later means writing one more file there and changing a single line. Maps go
through `src/services/maps/AppMap.tsx`, which currently uses react-native-maps (Apple Maps on
iPhone, and it works in Expo Go). Trying Mapbox later is a change to that one file.

## Drives and the explored map (Phase 4)

`trips` has one row per recorded drive: the car, times, distance, duration, top speed and a
simplified route line. Individual GPS readings are not stored, so there's no second-by-second log
of anyone's movements.

`explored_squares` is the fog-of-war. The world is cut into 0.001° squares, about 110m across in
India, and any square you drive through stays unlocked forever. Driving the same road again costs
nothing, because the primary key already covers it.

Saving a drive goes through the `record_trip` function, which writes the drive and its squares
together and refuses a drive recorded in a car that isn't yours. Totals come from the
`my_trip_stats` and `my_explored_stats` views. They use `security_invoker`, so each person only
ever sees their own numbers.

You can delete a drive, or wipe the whole explored map. The map only draws squares inside the
visible region, with a cap, and stops drawing them when you zoom too far out.

In development there's a switch that replays a Bandra → Sea Link → Worli route through the same
location wrapper the real GPS uses. It lets you test on Indian roads wherever you are, and it never
appears in a real build (it's behind `__DEV__`).

## Leaderboards (Phase 5a)

The Ranks tab has two boards, your city and your crew, and each can show all time or just the
current month. People are ranked on distance driven.

Ranking people means reading everyone's drives, which is exactly what `trips` and
`explored_squares` are meant to prevent. So those tables stay locked, and the boards come out of
`leaderboard_for_city()` and `leaderboard_for_crew()` instead. These return only what a board
shows: a name, a main car, distance, squares, drives, and whether the row is yours. They never
return routes, individual drives or timestamps of where anyone was.

Any signed-in user can see a city board. Crew boards check membership and refuse outsiders, and
both refuse anyone who isn't signed in. A month is passed as `'2026-09'`, and the database rejects
anything else rather than trusting the app.

Someone with no drives doesn't appear on a city board but does stay on their crew's board, since a
crew is a fixed list of people and a zero is part of the competition. If you're outside the top
100, the board shows your own totals in a footer instead of your position. Working out one person's
rank across a whole city would need a database change that isn't worth making while the cities are
small.

## Hazards, speed cameras and tiers (Phase 5b)

`hazards` holds reports of potholes, waterlogging, fog, speed cameras and other things. Each has a
location and an expiry: hours for fog, a day for waterlogging, weeks for potholes and a year for
cameras.

Reports are anonymous. The reporter is stored for handling abuse but never returned. The table has
no general read rule, and every read goes through `hazards_near()`, which returns the hazard
without the reporter. You can read your own reports but nobody else's.

`hazard_votes` records "still there" or "it's gone", and three "gone" votes retire a hazard.

`subscriptions` records each person's tier (free, pro or premium). It has no insert or update
rules, so no app code can write to it; a billing provider will set it later. For now it's set by
hand with admin SQL.

Speed cameras are gated in the database rather than in the screens. `hazards_near()` leaves them
out unless the caller's tier is pro or premium. Hiding a button wouldn't prove anything, since
anyone can call the API directly.

Speed limits aren't implemented. There's no reliable open dataset of Indian road speed limits, so
the app warns about camera locations instead of claiming to know the limits.

## Breakdown alerts (Phase 5c)

`breakdowns` has one row per stopped car on a convoy, recording where it stopped, an optional short
note ("flat tyre") and when the alert was cleared.

This is the only place the app stores a position. Live convoy positions travel over Realtime and
are never written down, but a breakdown has to survive being missed. Someone who opens the app a
minute later, or whose phone dropped signal, still needs to know a car is stranded, and a Realtime
message that has already gone past can't tell them. Only one point is stored, since a stopped car
doesn't move, and nothing is written unless you press the button and confirm.

The Realtime broadcast on `convoy:<id>:alerts` is only a nudge. It carries no location and no name,
just "something changed on this drive", and every phone then asks the database, which applies its
own rules. That way a tampered-with app can't announce a breakdown that isn't there. A 30-second
refetch covers any nudge that never arrives.

Reporting a breakdown overrides Ghost Mode, and the confirm dialog says so. An alert without a
position is no use to anyone, but nobody should be caught out by it either. Pressing the button
twice moves your existing alert instead of adding a second one, which a partial unique index
enforces.

The alert clears itself when the drive ends (a trigger on `convoys` handles this), so a forgotten
alert doesn't follow the crew around. You can also clear it yourself or delete it outright.
Breakdown alerts only work in a convoy; if you break down on your own, that's what SOS is for.

## SOS (Phase 5d)

Hold the button for 1.5s and your phone opens WhatsApp to your emergency contact, or the share
sheet if you haven't set one. The message says "I need help" and includes a
`https://maps.google.com/?q=lat,lng` link, with the coordinates written out as text as well.

It doesn't contact the emergency services, doesn't send anything on its own and doesn't store
anything. A button that promised to summon help would have to keep working with the app closed and
the phone in a pocket, which needs background execution and push notifications we don't have yet.
Automatic crash detection would be worse, because getting it wrong means either crying wolf or
staying silent when it mattered. So the button says "share my location", never "call for help",
and the message never claims help is on the way.

You hold the button rather than tap it because a tap is too easy to trigger in a pocket. A
confirmation dialog would be the wrong fix for something urgent, since it adds a second decision at
the worst possible moment. Letting go cancels the hold.

If the phone can't get a location fix, in a basement or a tunnel say, the message still goes. It
says the phone couldn't work out where you are and asks them to call, because a button that does
nothing at that moment would be far worse.

The emergency contact never leaves the phone. It's kept in `AsyncStorage` rather than Postgres:
it's somebody else's name and number, they never agreed to be in our database, and the number is
only ever used to build a message on this device. The downside is that a new phone or a reinstall
means setting it up again.

SOS added no new dependencies. It uses React Native's own `Share` and `Linking`, plus
`AsyncStorage`, which the app already uses for the login session.

## The video feed (Phase 6a)

Each row in `posts` is one short clip: a path into the private `post-videos` bucket, an optional
caption and car, and the author's city. The city is copied in when the clip is posted, so the feed
can be filtered by city without rewriting history when someone moves.

The feed comes with moderation built in, because it isn't optional:

- You can report a clip privately. Nobody can see who reported what, because a row in
  `post_reports` is only readable by the person who wrote it.
- Three reports take a clip down automatically, through a trigger. The threshold is low because
  nobody is watching a queue overnight, and briefly hiding something costs far less than leaving it
  up.
- Blocking someone hides clips in both directions inside `feed_page()`, so neither of you sees the
  other. People usually block because someone is targeting them, and letting that person keep
  watching everything you post would protect the wrong side. They aren't told; from their side it
  looks as though you stopped posting.
- You can always see your own clip, even after it's been taken down, so the app can tell you what
  happened instead of the clip silently vanishing.

The feed pages by timestamp rather than by offset. New clips arrive at the top while you scroll,
and an offset would show you the same clip twice.

Clips are private files, played through signed links that last an hour. Once a clip is taken down
it stops being reachable, instead of living on at a public URL someone saved.

There's no compression. Re-encoding video on the phone would need a heavy native library, so the
picker, the app and the bucket all enforce hard limits of 30 seconds and 60MB instead, and a file
that's too big is refused with an explanation.

Playback goes through `src/services/video/AppVideo.tsx`, the same wrapper pattern maps and location
use. Moving to a hosted video service later (one that can drop quality on a weak signal, which this
can't) means changing that file and the upload path, not the feed.

Clips start muted and only the one on screen plays. Sound that arrives without warning is annoying,
and on mobile data a single muted loop costs less too.

Likes, comments and follows aren't in v1. A feed people can post to and report is enough for now,
and the social features can be added later without touching any of this.

## The offline drive queue (Phase 6b)

If you press stop in a dead zone, `record_trip` fails. Without a queue the whole drive would be
lost, and Indian highways have plenty of places with no signal.

So a failed save is queued on the phone and retried when the app opens and whenever it comes back
to the foreground. The drive keeps its real `started_at`, so a late upload still lands in the right
month on the leaderboards.

A drive in progress is checkpointed every 30 seconds as well. If the app is killed partway through
(iOS reclaiming memory, a flat battery or a crash), you lose half a minute instead of 200km. A
checkpoint found at startup is turned into a finished drive waiting to upload.

The two kinds of failure get opposite treatment. No answer at all is temporary, so the drive stays
queued. An answer that refuses the drive won't fix itself: usually the car was deleted in the
meantime, which `record_trip` rejects, so the car is dropped and the drive is sent again. You keep
the distance and the squares.

A drive is never thrown away without asking. After `MAX_ATTEMPTS` the app stops retrying and shows
the drive with a Discard button, and you decide what happens to it.

There's no network-detection library. Trying and failing costs less than asking the phone whether
it's online, and it can't get the answer wrong. There's no background uploading either: with the
app closed nothing runs, and the drive waits safely on the phone. Live location and SOS work under
the same limit.

## Data Saver (Phase 6c)

Mobile data in India is cheap but not unlimited, and plenty of people drive on a fixed daily pack.
Data Saver is there so the app doesn't quietly use it up.

It's a switch on the Profile tab. It lives in Redux rather than the database, because it's a choice
about this phone and has to be readable the instant a screen renders. It's also mirrored into
device storage, since a data-saving setting that silently resets on restart is worse than not
having one.

Everything it changes is listed together in `settingsSlice.ts` rather than scattered across
screens. With Data Saver on:

- the garage list stops downloading a cover photo per car, showing a placeholder and loading the
  photos when you open a car
- nearby-hazard checks drop from every minute to every five minutes
- the explored map draws 600 squares instead of 2000
- the feed asks for shorter pages and never autoplays

It's off by default, so nobody ends up with a stripped-down app without choosing it.

## Deleting your account

Apple rejects any app that lets you create an account but not delete it, and the deletion has to
be real rather than a deactivation. India's DPDP Act points the same way. The option is on the
Profile tab, behind two confirmations, because there's no undo and no grace period.

Files go first, then rows. Photos and clips live in Storage, which the database can't reach, so the
app removes them itself. It's allowed to, because every storage rule checks that the first folder
of the path is your own user id. Then one database function removes the auth row, and every table's
foreign key takes the rest with it. The order matters: a few leftover files are a much smaller
problem than an account that's half deleted and can still sign in.

This needs no Edge Function and no service key in the app. `delete_my_account()` is SECURITY
DEFINER and runs with the migration owner's rights, which are enough to remove the auth row.

Two of the delete rules work differently from a plain cascade:

- A crew you own is handed to whoever joined it first instead of being destroyed, because leaving
  should never delete other people's things. The crew is only deleted if you were the last one in
  it.
- Hazards you reported stay on the map with the link to you removed (`on delete set null`). A
  pothole or a speed camera is community safety data that's already anonymous, so wiping it when
  someone leaves wouldn't help anyone. What deletion needs to remove is the link to the person.

## House rules

1. Anything stored in Supabase goes through TanStack Query. Device-only state (auth status, Ghost
   Mode, Data Saver) goes in Redux. Never both.
2. Third-party SDKs are wrapped in `src/services/` so they can be swapped. Maps, location and video
   already work this way, so trying Mapbox, the paid background location tracker or a hosted video
   service means changing one file there rather than the screens that use it.
3. Every table has Row Level Security with explicit policies. The app uses a public key, so RLS is
   what protects user data. When you test a policy through `supabase db query`, remember that the
   connection uses the `postgres` role, which bypasses RLS entirely. A check written without
   `set local role authenticated` passes however wrong the policy is, so always switch the role and
   set `request.jwt.claims` together.
4. No personal data goes to monitoring. Sentry and PostHog never receive phone numbers or
   locations.
5. Env vars starting with `EXPO_PUBLIC_` are public, so never put secrets in them.
