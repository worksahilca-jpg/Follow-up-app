# FollowUp — mobile shell

Native iOS/Android wrapper for [followupbase.io](https://www.followupbase.io), so FollowUp can be listed on the
App Store and Play Store. Built with [Capacitor](https://capacitorjs.com/) rather than a native rewrite: FollowUp
is a full server-rendered Next.js app (API routes, NextAuth sessions, Prisma/Postgres) that can't be statically
exported, so the native project here is a thin shell that loads the live web app in a WebView (`server.url` in
`capacitor.config.ts`) — the same approach most web-first products use to get onto the app stores without a
second codebase. A normal product change (anything in `../followup`) needs zero mobile release — it's live for
every installed user the moment it deploys to Vercel. Only a change to `capacitor.config.ts` itself, an added
native plugin/permission, or an app-icon/store-listing update ever needs a new build submitted to either store.

## What's here and what's verified

- `capacitor.config.ts` — the whole app-specific config: app ID (`io.followupbase.app`), name, the live URL it
  loads, background color matching `../followup/src/app/manifest.ts`.
- `android/` — a generated native Android Studio project (`npx cap add android`). Config sync (`npx cap sync
  android`) runs clean in this environment. **Not build-verified here** — this sandbox has no Android SDK, so
  `./gradlew assembleDebug` has never actually been run. Needs Android Studio (or just the command-line SDK
  tools) on a real machine before trusting it builds.
- `ios/` — a generated native Xcode project (`npx cap add ios`). **Not verified at all** — this sandbox is Linux,
  and an iOS build categorically requires a Mac with Xcode; there is no way to check this here. CocoaPods
  (`pod install`) hasn't been run either.
- `www/` — an unused placeholder. Capacitor's CLI requires `webDir` to point at something that exists, but
  `server.url` above means it's never actually served — real static hosting was deliberately not built.

**Bottom line: this is real scaffolding, not a working, tested app yet.** Both platforms need their first real
build attempt on hardware capable of it before either goes anywhere near a store submission.

## To actually ship this, you'll need

1. **A Mac with Xcode** for the iOS side — no way around this, Apple doesn't allow building/signing/submitting
   iOS apps from anywhere else. Android can be built on Linux/Windows/Mac with just Android Studio (or the
   command-line SDK tools + a JDK, both scriptable).
2. **Apple Developer Program** account ($99/year) to sign and submit to the App Store.
3. **Google Play Console** account ($25 one-time) to submit to the Play Store.
4. **A real app icon and splash screen** — `npx @capacitor/assets generate` from a single source image handles
   generating every required size for both platforms once you have one.
5. Before Apple will approve this: **some real native functionality beyond "loads a website."** Apple's App
   Store Review Guideline 4.2 rejects apps that are just a wrapped webpage with nothing native added. Push
   notifications (`@capacitor/push-notifications`) are the natural fit here — "a hot lead just came in" as an
   actual phone notification, not just the in-app bell — and would also be the single most useful native feature
   for FollowUp specifically. Not added yet; a real next step once someone can test on real hardware.
   Android's Play Store is meaningfully more lenient about this (a Trusted Web Activity wrapping the same URL
   would likely pass as-is), but the same wrapper here works for both once you're ready.

## Local dev workflow (once you have the right hardware)

```bash
cd mobile
npm install
npx cap sync              # both platforms
npx cap open android      # opens Android Studio
npx cap open ios          # opens Xcode (Mac only)
```

Since `server.url` points at the live production site, "run" in Android Studio/Xcode is really just "open the
real app in a native shell" — no local dev server needed to see it working.
