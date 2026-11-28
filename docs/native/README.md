# Nosca in the App Store and Google Play

The phone apps are the web app itself, carried by **Capacitor 8**: the
same build that Netlify serves is copied into an iPhone project (`ios/`)
and an Android project (`android/`), and the phone shows it full screen
with the phone's own camera, haptics, share sheet, notifications and back
button. There is one app to change; the stores get it when a new build is
sent. Nothing in the browser or on a Home Screen changes: every native
path is behind `isNative()` in `src/lib/native.js`.

No Mac is needed. **Codemagic** builds both apps on its own Macs and Linux
machines from this repository (`codemagic.yaml`), signs them and sends
them to TestFlight and to Google Play's internal testing. Xcode on a Mac
and Android Studio do the same by hand, if one is ever to hand.

## What is in the repository

| | |
|---|---|
| `capacitor.config.json` | the app's id (`ie.nosca.app`), its name, the launch screen, the keyboard, the bars |
| `ios/` | the Xcode project (Swift Package Manager, no CocoaPods), its icon and launch screen, `Info.plist` with the camera, microphone and photo wording |
| `android/` | the Gradle project, its icons and launch screen, the permissions |
| `codemagic.yaml` | the two builds: iOS to TestFlight, Android to Play's internal track |
| `src/lib/native.js` | everything the app does differently inside the shell |
| `scripts/icons.mjs` | draws every icon and launch screen from the mark's own numbers |
| `scripts/native-id.mjs` | changes the app's id everywhere at once |
| `docs/native/store/` | the Play Store's feature graphic (its 512 icon is `public/icons/icon-512.png`) |

The built web app inside `ios/App/App/public` and
`android/app/src/main/assets/public` is never committed: every build
makes it fresh.

## Building

```sh
npm install
npm run native:sync      # builds the web app for the shell and copies it into ios/ and android/
```

`native:sync` reads the database's public address and key off the live
site, as a Netlify build with none does, or takes `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` from the shell or a `.env` file; with neither it
stops rather than make an app that opens on a blank page.

- **Codemagic** (no Mac): start *iOS · TestFlight* or *Android · Play
  internal testing* from the dashboard. Each runs `npm install`,
  `npm run native:sync`, signs, builds and uploads.
- **Xcode** (a Mac): open `ios/App/App.xcodeproj`, choose the team under
  Signing & Capabilities, Product › Archive, then Distribute App.
- **Android Studio**: open `android/`, Build › Generate Signed App Bundle.

After changing the mark, run `node scripts/icons.mjs` and commit what it
writes. After adding a Capacitor plugin, run `npm run native:sync` and
commit `ios/App/CapApp-SPM/Package.swift` and `android/*.gradle`.

## The app's id

`ie.nosca.app` — reverse of nosca.ie, the support address's domain. It is
the bundle ID on the App Store and the package name on Google Play, and
**once the app is in a store it can never change**. To use another, before
the first upload:

```sh
npm run native:id -- ie.nosca.coach
```

That writes it into `capacitor.config.json`, the Xcode project, Android's
`build.gradle` and strings, and `codemagic.yaml`.

## Version numbers

Each store keeps two:

- **the version a person reads** — `1.0`. iOS: `MARKETING_VERSION` in the
  Xcode project. Android: `versionName` in `android/app/build.gradle`.
  Raise both together for a release worth naming (1.1, 2.0).
- **the build number**, which must only ever go up — Codemagic's own count
  of the workflow's builds (`$BUILD_NUMBER`), written in at build time. A
  build sent by hand from Xcode must use a number above Codemagic's last.

## Signing

**Apple.** Codemagic signs with an App Store Connect API key: from it, it
makes the distribution certificate and the provisioning profile and
uploads to TestFlight. The App ID needs **Push Notifications** ticked
(Certificates, Identifiers & Profiles › Identifiers › ie.nosca.app):
`ios/App/App/App.entitlements` asks for it, and signing fails without it.

**Google.** The `.aab` is signed with an **upload key** — a keystore held in
Codemagic as `nosca_upload`, read by `android/app/build.gradle` from
Codemagic's `CM_KEYSTORE_*`. **Play App Signing** (the default for a new
app) signs what people download with Google's own key, so a lost upload
key can be reset through Play support; keep a copy of it somewhere safe
all the same. No keystore, `.p8` or `.p12` ever goes in the repository
(`.gitignore`).

## Inside the shell (`src/lib/native.js`)

- **Launch**: the brand green with the mark, held until the app has drawn
  its first screen, then faded — never a white flash. The sport splash is
  still the app's own.
- **Status bar**: light over a dark ground (the splash, the feed, the
  camera, the dark stages), dark over the white app, read off what is drawn
  under it.
- **Haptics**: the phone's own engine, in place of the switch trick.
- **Sharing**: a lesson log, a season report and the calendar file go out
  through the phone's share sheet; codes too. Links handed on carry
  `https://nosca.netlify.app`, never the shell's own localhost.
- **About Nosca** opens the website in the phone's browser; email, text
  and WhatsApp links open their apps.
- **Android's back** presses the app's own Back (or closes the camera or
  the open sheet); at the first screen the app goes to the background.
- **A clip's copy**: on an iPhone in Files › On My iPhone › Nosca; on
  Android 11 and later in Documents/Nosca.
- **Never** a service worker, the Add to Home Screen guide or row, or the
  first address's hop to the second.
- **Nothing sells.** No price, no plan, no link to buy anything — Apple's
  3.1.3(f) and Google's payments policy. The design harness's mock plan
  picker exists only behind `?demo`, which the shell cannot open. Keep it
  so.

## Push

Web push is unchanged. Inside the shell the phone's push service gives the
app a device token, filed in `push_subscriptions` the way a browser's
subscription is — one row per device, under the person's account,
removed on sign-out:

| platform | `endpoint` | `p256dh`, `auth` |
|---|---|---|
| iPhone | `apns:<hex token>` | empty |
| Android | `fcm:<token>` | empty |

No new column. The web relay (`netlify/functions/lib/push-shared.mjs`)
sends only to `https://` endpoints, so these rows wait, untouched, for the
native sender. A tapped notification opens the app where the web one does,
from the same keys in its data: `screen`, `id`, `remind_day`.

Android's push needs the app's Firebase file built in: Codemagic writes
`GOOGLE_SERVICES_JSON` to `android/app/google-services.json` before the
build, and the app offers push on Android only when it was there (the
push library would otherwise take the app down). The iPhone needs nothing
more than the Push Notifications tick above.

### What the server needs, later (not built)

The sender belongs beside `sendTo` in `push-shared.mjs`, on the first site
(`nosca-pilot-2`), which sends every push and summary today: branch on the
endpoint's prefix, keep `notifyPreference`, the digest and `tally` as they
are, and remove a row when the service says the token is gone.

**APNs (iPhone).** One key serves every app on the account: Apple
Developer › Keys › + › Apple Push Notifications service → a `.p8` file,
its Key ID and the Team ID. On the first site's environment:
`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (the `.p8`'s text),
`APNS_TOPIC=ie.nosca.app`. Each send is an HTTP/2 POST (Node's own
`http2`, no package) to `https://api.push.apple.com/3/device/<token>` with:

- `authorization: bearer <JWT>` — ES256, header `{alg, kid: KEY_ID}`,
  claims `{iss: TEAM_ID, iat}`, made at most once every 20 minutes and
  kept under an hour
- `apns-topic: ie.nosca.app`, `apns-push-type: alert`, `apns-priority: 10`
- `apns-collapse-id: <screen>:<id>` — one per thing, as the web's tag
- body `{"aps": {"alert": {"title", "body"}, "sound": "default",
  "thread-id": "<screen>:<id>"}, "screen", "id", "remind_day"}`

A 410, or a 400 `BadDeviceToken`, means the token is gone: delete the row.
TestFlight and App Store builds use `api.push.apple.com`; a build run from
Xcode answers only `api.sandbox.push.apple.com`.

**FCM (Android).** A Firebase project with an Android app of package
`ie.nosca.app` gives `google-services.json` (to Codemagic, above) and,
under Project settings › Service accounts, a private key JSON for the
server: `FCM_SERVICE_ACCOUNT` on the first site's environment. Each send:
an OAuth token from that key (an RS256 JWT for scope
`https://www.googleapis.com/auth/firebase.messaging`, exchanged at
`https://oauth2.googleapis.com/token`, kept for its hour), then a POST to
`https://fcm.googleapis.com/v1/projects/<project_id>/messages:send`:

```json
{ "message": {
    "token": "<token>",
    "notification": { "title": "…", "body": "…" },
    "data": { "screen": "…", "id": "…", "remind_day": "…" },
    "android": { "priority": "high", "collapse_key": "<screen>:<id>",
      "notification": { "tag": "<screen>:<id>", "icon": "ic_stat_nosca", "color": "#123C30" } } } }
```

`data` values are strings. A 404 `UNREGISTERED` (or 400 on the token)
means the token is gone: delete the row.

## What each store asks for

**App Store Connect** — the app record (name, bundle ID `ie.nosca.app`,
SKU, English (U.K.)); screenshots for the 6.9-inch iPhone (1320 × 2868),
iPhone only, since the app is set to iPhone (`TARGETED_DEVICE_FAMILY = 1`,
portrait); a description, keywords, a support URL and a **privacy policy
URL**; the App Privacy answers (email, name, phone, date of birth,
photos and videos, messages, all tied to the person, none for tracking);
the age rating; and review notes with a coach's and a player's sign-in
that have lessons in them. Export compliance is answered in `Info.plist`
(standard encryption only). Account deletion is in Settings (5.1.1(v));
Sign in with Apple is not required, since there is no social sign-in.
A web app in a wrapper is turned away under 4.2 when it does nothing a
website cannot: say in the notes that it films and marks up lessons with
the camera, notifies, works offline with downloaded lessons and uses the
phone's haptics and share sheet.

**Google Play Console** — the app (name, English (UK), free, app not
game); the 512 icon (`public/icons/icon-512.png`) and the 1024 × 500
feature graphic (`docs/native/store/play-feature-graphic.png`); two to
eight phone screenshots; short and full descriptions; a **privacy policy
URL**; the Data safety form (the same data as Apple's); the content
rating questionnaire; target audience (juniors use Nosca, so say which
ages honestly — under-13s bring the Families policy); app access (the
same review sign-ins); no ads. A new personal developer account must run
a **closed test with at least 12 testers for 14 days** before it may
publish to production; an organisation account need not.

## What only the founder can do

1. **Apple Developer Program** (€99 a year), as yourself or as the company
   (a company needs a D-U-N-S number, free, a few days).
2. **App Store Connect**: create the app (Nosca, `ie.nosca.app`); create
   an **App Store Connect API key** (Users and Access › Integrations,
   role App Manager) and add it to Codemagic as **Nosca**.
3. Tick **Push Notifications** on the App ID `ie.nosca.app`.
4. In Codemagic (Team settings › Code signing identities): **generate the
   iOS distribution certificate** and **fetch the App Store profile** for
   `ie.nosca.app`.
5. **Google Play Console** account ($25 once; identity verification).
   Create the app.
6. Make the **upload keystore** (Android Studio's Generate Signed Bundle,
   or `keytool -genkeypair -v -keystore nosca-upload.jks -keyalg RSA
   -keysize 2048 -validity 10000 -alias upload` on any computer with
   Java), keep a copy safe, and upload it to Codemagic as `nosca_upload`;
   make a Google Cloud **service account** with access to the Play Console
   (Release manager), and put its JSON in a Codemagic group
   **google_play** as `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`.
7. Upload the **first `.aab` by hand** in the Play Console (internal
   testing): Google takes uploads from Codemagic only after the first.
8. Write the **privacy policy** and publish it at a public address (the
   website can carry it).
9. Make the **review accounts** — a coach and a player with lessons — and
   the screenshots, descriptions and store answers above.
10. For push, when the time comes: the APNs `.p8` key and a Firebase
    project (`google-services.json` into the google_play group as
    `GOOGLE_SERVICES_JSON`, the service account onto the first Netlify
    site), and the sender above built.
11. Choose: keep the id `ie.nosca.app`; keep iPhone only and portrait.

## Not done here, and why

- **Compiling either app.** iOS needs Xcode, which runs only on macOS:
  Codemagic's Macs do it. Android needs the Android SDK, whose download
  host this build machine cannot reach; Codemagic's Linux machines carry
  it. The projects were generated by Capacitor's own tools and checked as
  far as Linux allows (the property lists, the storyboard and the XML
  parse; the web build and its tests pass).
- **Join links open the website**, not the app, until universal links and
  app links are set up (an `apple-app-site-association` and an
  `assetlinks.json` on the domain, and an Associated Domains entitlement).
  An email's confirmation or reset link opens the website too; the person
  then signs in in the app.
- **Settings › Sync** says "Up to date" inside the shell: a new app comes
  through the store.

## First things to check on a phone

The launch screen handing over to the splash with no flash; the status
bar over the splash, the white app and the feed; Chat's composer above
the keyboard; the camera's and the microphone's first questions and a
recorded clip; a lesson log shared from Saved; About Nosca and Email
support; Android's back through a sheet, the camera and a pushed screen;
the haptics on Log it.
