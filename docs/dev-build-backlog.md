# Funkty: waiting for a development build

Things we can't build or test properly in Expo Go. We pick these up once there is an EAS development build installed on the phone. New items are added here as they come up, in the same commit as the work that revealed them. Last updated 2026-11-23.

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
- **Explore ranking, next level:** a first version is live (engagement over age, two posts per author, muted authors left out). Later: personalise by who you follow and what you like, and add diversity and safety signals once scanning exists.
- **pgTAP in CI:** database tests are written but only run by hand.
- **Supabase auth settings:** email confirmation and the Site URL need checking before launch.
- **Supabase advisor review (2026-11-23):** no real security findings. Notes for later:
  - `username_available` is deliberately callable before sign-in (the sign-up screen checks names). Keep it, but rate-limit it at the edge when the API exists.
  - The "signed-in users can run SECURITY DEFINER functions" warnings are the intended RPC pattern. Each function checks `auth.uid()` itself.
  - `audit_log`, `outbox_events`, `reserved_usernames` and `staff_roles` have RLS on and no policies on purpose (service role only).
  - Auth server uses an absolute connection count (10). Switch to a percentage in the dashboard when the instance is upsized.
  - Unused-index notices are expected while there is almost no data. Review again with real traffic.
- **Expo token cleanup:** rotate or remove the access token used during setup.

## Ideas not built yet (buildable now)

- Drafts and scheduling for videos and reels, a custom date and time picker, and notifying authors about comment likes.
- Story reply notifications, reactions shown on the story viewer for the author, close friends for posts.

### From the TikTok audit (2026-11-23)

Buildable now (Expo Go + Supabase):
- Repost notifications for the author, a Reposts tab on profiles, and unrepost from the feed banner.
- Find contacts (match phone contacts to Funkty accounts): needs an opt-in "let people find me by email or phone" setting and hashed matching on the server first.
- Invite counts (how many people joined from your invite).
- Shared collections (invite friends to one saved collection).
- Privacy toggles still to do: who can download, who can remix, activity status, post and profile view history.
- Accessibility still to do: captions on by default (needs captions on video first). Comments with media filter.
- Screen time is kept per device; syncing across devices and a parent-set limit need server work.
- Notify authors when a comment is held for approval.
- Series planner for creators.

Needs a development build or heavy media work:
- Remix (Duet/Stitch style) side-by-side and clip-in video.
- Effects, filters, sounds library, in-app video editor.
- Live streaming, Live replays.
- Photo mode with music.

Needs server or safety groundwork first:
- Context notes on posts (Footnotes style) needs a moderation flow.
- Family pairing and teen defaults (60 min limit, DMs off, night mute).
- Shop and commerce.
- AI features (captions, dubbing).

Decided not to build: playlists, sounds library and any music features (no music licensing, owner decision 2026-11-23). Decided not to copy: TikTok Shop, Campus Hub, Nearby feed, AI dubbing.

## Blocked on a decision

- **Links in captions and a followers export:** held back until the safety work exists (link scanning, abuse limits).
- **Profile website scanning:** profile websites are https-only and open behind a leaving-Funkty confirm, but destinations are not scanned. Add link scanning with the content-scanning work.
