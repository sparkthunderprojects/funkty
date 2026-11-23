# Funkty: waiting for a development build

Things we can't build or test properly in Expo Go. We pick these up once there is an EAS development build installed on the phone. New items are added here as they come up, in the same commit as the work that revealed them. Last updated 2026-11-23 (build 59434c4).

## Needs a development build

### 1. Push notifications
- **Done already:** `push_tokens` table with RLS, and the `register_push_token(token, platform)` RPC (migration `20261123000012`).
- **Why it waits:** Expo Go can't receive remote push on current SDKs, so we can't get a real device token or test delivery.
- **To build:**
  - Add `expo-notifications` via `npx expo install`, with the config plugin and Android channel.
  - Ask for permission at a sensible moment (after the first like or follow, not on launch). Register the token on sign-in and remove it on log out.
  - Server side: an outbox worker that reads `notifications` rows and sends through the Expo push service. It belongs in `apps/api` or a worker, since the service-role key must never be in a client.
  - Settings: per-type toggles (likes, comments, follows, messages) and quiet hours.
  - Tapping a notification deep-links to the post, profile or thread.
  - Clean up invalid tokens when Expo reports `DeviceNotRegistered`.
- **Needs from the owner:** an Apple developer account and Apple push key, plus Firebase (FCM) credentials for Android.

### 2. Video compression before upload
- **Why it waits:** videos upload as-is (50 MB and 90 s limits). Re-encoding needs a native module that isn't in Expo Go.
- **To build:** compress on device to roughly 720p or 1080p H.264 before upload, with a progress bar. Longer term, server-side transcoding to HLS.

### 3. Deep links and universal links
- **Why it waits:** links shared from the app currently open the web app. Opening the native app from a link needs a registered scheme and associated domains in a real build.
- **To build:** `funkty://` scheme, iOS associated domains, Android app links, and a custom domain for the web app.

### 4. Real device verification of native-only paths
Not yet tested on a phone, only in a browser with mocked data. Check once the dev build is installed:
- Photo and video upload from the library.
- The before/after slider's drag gesture (PanResponder) inside the scrolling feed.
- The glass blur on Android (expo-blur uses an experimental method there).
- App icon, splash screen and Android adaptive icon from the new logo (Expo Go always shows its own).
- Haptics feel and timing.

### 5. Biometric lock and secure screens (idea)
- Optional Face ID or fingerprint lock for the app, and hiding the app preview in the app switcher. Needs `expo-local-authentication`, which is better tested in a real build.

## Needs server work, not a development build

- **Content scanning (launch blocker):** image and video scanning for illegal content before anything goes public.
- **Message requests on the server:** the request/non-request split is calculated in the app today. Move it into a database view or RPC.
- **Explore ranking:** a real recommendation feed.
- **pgTAP in CI:** database tests are written but only run by hand.
- **Supabase auth settings:** email confirmation and the Site URL need checking before launch.
- **Expo token cleanup:** rotate or remove the access token used during setup.

## Blocked on a decision

- **Links in captions and a followers export:** held back until the safety work exists (link scanning, abuse limits).
- **Tagging people in posts:** needs consent and anti-harassment rules first. Credits are plain text for this reason.
