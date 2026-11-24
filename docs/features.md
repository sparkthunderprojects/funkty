# Funkty: what is built

A running list of every feature and function in the app, so you can see what you have. Kept up to date with each change. Last updated 2026-11-23.

**How to read the status**
- **Live** means it is built, connected to the database and published.
- Everything is tested with automated checks and in a browser with test data. **Nothing has been tested on a real phone yet**, so feel and gestures (haptics, dragging, press and hold) are the first things to check on your device.
- What is not built yet, or waits for a development build, is in `docs/dev-build-backlog.md`.

**Where it runs**
- Phone: Expo Go link (updated with every change).
- Browser: https://sparkthunderprojects.github.io/funkty/
- Backend: Supabase (database, sign-in, file storage), project `wzfdnefxnlrboiwejofz`, London region.

---

## 1. Accounts and sign-in
- Create an account with email, password, username, date of birth and country.
- Log in and log out.
- Finish-setup screen when an account exists but has no profile yet.
- Minimum age 13. EU countries use a higher age until legal review (see `docs/adr/0003-age-and-consent.md`).
- Accounts aged 13 to 17 are teen accounts: private by default and they cannot switch to public.
- Date of birth is stored privately, never on the public profile.
- Username availability check while signing up; reserved names are blocked.

## 2. Profile
- Display name, @username, bio.
- Profile photo shown as a rounded square inside a gradient ring.
- **Cover photo** (choose or remove in Edit profile).
- **Location** and **website** lines. Websites are https only and open behind a "Leave Funkty" confirmation.
- Followers, following and post counts; tap to see the lists.
- Tabs: **Posts**, **Reels**, **Tagged**, and **Saved** (yours only). The tab you last used is remembered while the app is open.
- Masonry post grid with icons for videos, carousels and pinned posts.
- **Highlights** row of rounded tiles (see section 5).
- Tap your profile photo to open your story, if you have one. Press and hold to see the photo large.
- Edit profile, share profile (share sheet), and a menu with settings and log out.
- Private account switch.
- Pull down to refresh.

## 3. Posts
- **Photos**: up to 10 in a carousel, with crop (original, 1:1, 4:5), rotate, flip and 9 original filters.
- **Video**: up to 50 MB and 90 seconds, with a poster frame, mute toggle and tap to play.
- **Reels** mode for video-only posts.
- Captions up to 2,200 characters with **#hashtags** and **@mentions** that link through. Character counter appears near the limit.
- **Alt text** per photo.
- **Spoiler mark**: blurs the post until a viewer taps to reveal it.
- **Before and after**: a two-photo post shown as a drag slider.
- **Credits**: role and name lines under the post (for example "Photo: Sam").
- **Series**: group posts into a named series with its own page.
- **Updates**: add dated notes under a post, up to 10 ("It's finished!").
- **Edit caption**, with an "Edited" label.
- **Turn commenting on or off.**
- **Pin to profile** (up to 3), shown first with a "Pinned" label.
- **Hide like count** (others see the heart only; you still see the number).
- **Archive** a post (visible only to you) and restore it from Settings > Archive.
- **Delete** a post, with confirmation.
- **Tag people** with consent (see section 6).
- Share (system share sheet) and **Copy link**.

## 4. Feed
- Home feed with a **For You / Following** switch.
- Full-width post cards with ring avatar, name, @username, location, photo, like, comment, share and save.
- Double-tap a photo to like.
- Stories tray of tall story cards at the top; seen stories get a grey ring.
- **Suggested people** to follow, which you can dismiss.
- Muted accounts are left out.
- Pull down to refresh.
- The Funkty logo shows while the app and first feed load.

## 5. Stories and highlights
- Post a photo story; it disappears after 24 hours.
- Story viewer with progress bars, tap to go forward or back, and auto-advance.
- Your own story shows **who viewed it** and a view count, and can be deleted.
- **Highlights**: add a story to a new or existing highlight, view a highlight, rename it, remove a story, or delete it. Up to 20 highlights of up to 50 stories. Stories stay in a highlight after they expire.
- On someone else's story, a ⋯ menu lets you **mute** them.

## 6. Tagging (with consent)
- Authors tag people from the post menu; up to 10 per post, 20 new tags an hour.
- The tagged person gets an **Approve / Decline** notification. The tag only shows once they approve.
- A declined tag stays declined, so it cannot be repeated.
- Approved tags show as "With @name" on the post and in the person's **Tagged** tab.
- Tagged people can remove themselves later.

## 7. Comments and likes
- Like and unlike posts.
- Comments with one level of replies, and delete your own comments (or any comment on your own post).
- Post page shows all comments, updates and your private note.
- Posts you have liked are listed in Settings.

## 8. Saving and collections
- Save and unsave posts (the bookmark).
- **Collections**: named folders for saved posts; add a post to several.
- **Private notes** on saved posts, searchable, listed in Settings > Your private notes.
- The post menu shows which collections a post is saved to.

## 9. Search and Explore
- Explore grid ranked on the server by engagement and freshness, with limits per author.
- Search tabs: **Top**, **Accounts**, **Tags**.
- **Hashtag pages**.
- Recent searches, which you can remove or clear.
- Pull down to refresh Explore.

## 10. Reels
- Full-screen vertical video feed, one video at a time.
- Like, save, mute and open the author.
- Pull down to refresh.

## 11. Messages
- Direct messages between two people, with an unread count.
- **Message requests**: messages from people you do not follow go to a Requests tab until you accept or delete them. The sender gets no "read" signal until you accept.
- Mark read when you open a thread.
- The thread refreshes by polling every few seconds (live updates come later).

## 12. Notifications (Activity)
- Likes, comments, new followers, follow requests and tag requests.
- Accept or decline follow requests, approve or decline tags, right from the list.
- Unread dot, and everything is marked read when you open it.
- Push notifications to the phone are **not built yet** (needs a development build; see the backlog).

## 13. Following and privacy
- Follow and unfollow; private accounts need approval.
- **Remove a follower** from your Followers list.
- **Block** an account (they cannot find your profile, posts or stories) and manage blocked accounts.
- **Mute** an account from a post or a story and manage muted accounts.
- Private-account rules apply to posts, stories, highlights and tags.

## 14. Safety and moderation
- **Report** a post with a reason.
- Restrictions on content or accounts, each with a policy and a user-facing reason (see ADR 0001).
- **Account status** screen with an appeal option (open, upheld or overturned).
- Internal audit log and staff roles in the database for the future admin tool.
- Content scanning for illegal material is **not built yet** and is a launch blocker.

## 15. Settings
- Private account switch.
- Posts you have liked, Your week on Funkty (activity stats), Your private notes, Collections, Saved, Archive.
- Muted and blocked accounts, Edit profile, Account status and appeals, Log out.
- **Appearance**: Device, Light or Dark, remembered between launches.
- Build number at the bottom, so you can confirm which version you are on.

## 16. Look and feel
- Cream and black theme with a Funkty-original violet, magenta and amber accent. Light and dark modes.
- Floating pill tab bar: Home, Search, Create, Reels, Profile.
- Original Funkty "F" logo and wordmark, drawn as vectors.
- Frosted-glass controls where buttons sit over photos and video.
- Haptic taps on likes, saves, follows, pins and similar actions (phone only).

## 17. Behind the scenes
- **Database**: 16 migrations in `supabase/migrations`. Every table has row-level security. 9 pgTAP test files in `supabase/tests/database` (run by hand, not in CI yet).
- **Shared rules** in `packages/core`, validation in `packages/validation`, design tokens in `packages/tokens`.
- **Publishing**: every push to `main` runs checks, deploys the web build to GitHub Pages and publishes a new Expo Go update.
- **Web app** (`apps/web`, Next.js) exists but is paused; the Expo app is the main build.
- **Decisions** are recorded in `docs/adr`.

---

## 18. Find friends and invites
- Find friends screen (Settings, or "Find friends" on the Suggested strip): search by name or username, Follow back list, People you may know (from mutual follows, server function `friend_suggestions`).
- Invite friends: one-tap WhatsApp, Telegram, X, Facebook, Messages, Email, Copy link, and the phone share sheet for every other app. Links open your profile.
- QR code: show your profile code, scan a friend's code with the camera.

---

## 19. Feed controls, Friends tab and reposts
- Feed tabs: For You, Following, Friends (people you follow who follow you back).
- Not interested on any post hides it from your feed.
- "Don't show #topic" hides the first hashtag in a caption; Settings > Feed preferences lists hidden topics, lets you add or remove them, and has Refresh my feed (brings back posts marked Not interested).
- Repost with an optional 150-character note: shows in your followers' Following and Friends feeds with a "reposted" banner. Public accounts only, not your own posts, 30 an hour.

---

## 20. Close friends, story replies and message tools
- Close friends: Settings > Close friends. Pick people you follow; the list is private. When you share a story, "Close friends only" limits it to them; they see a green "Close friends" tag and a green star on the story card.
- Reply to a story or react with one tap (heart, laugh, wow, sad, fire, thumbs up). Replies arrive in Messages marked "Replied to your story".
- Story archive: Settings > Story archive keeps expired stories for you only; add them to a highlight or delete them.
- Messages: press and hold a message to react, remove your reaction, or unsend it (unsent messages show as "Message unsent").

---

## 21. Drafts, scheduled posts, comment likes and streaks
- Create > details (photo posts): "When to post" chips (Now, In 1 hour, This evening, Tomorrow 9am, Saturday 10am) and Save as draft. Scheduled posts are published by the server every minute, even with the app closed.
- Settings > Drafts and scheduled posts: post now, edit the caption, move the time, or delete. A post that could not go out is marked with the reason.
- Comment likes: a heart and count on every comment.
- Posting streak: consecutive days (UTC) with a post, with your best, on Your week.
- Limits: photo posts only (videos, reels and before/after posts post now); 50 drafts; up to 30 days ahead.

---

## 22. Wellbeing, comment controls and accessibility
- Settings > Wellbeing and screen time: time today and the last 7 days, a daily limit (off, 30m, 1h, 1.5h, 2h; accounts under 18 start at 1 hour), a take-a-break nudge (10, 20 or 30 minutes of continuous use), and a sleep reminder (from 8pm to 11pm until 7am). Reminders are full-screen and can be dismissed; the daily limit can be snoozed for 15 minutes. Time is counted on this device only.
- Reduce motion: a switch in Wellbeing, also on automatically when the phone's Reduce Motion is on. Turns off screen slide animations and the loading pulse.
- Settings > Comment and repost controls: approve comments first, hidden words and phrases (comments containing them are held), and Allow reposts.
- Held comments: only the commenter and the post owner can see them; the owner gets Approve and Remove on the post screen. Held comments don't count or notify until approved.
- Reposts switched off: other people see "This person has turned off reposts".

---

## 23. More notifications
- Activity now shows: someone reposted your post, liked your comment, replied to your story (with a View link to the message), and a comment waiting for your approval. Approving a held comment turns its notice into a normal comment notice; removing it clears the notice. Unliking or unreposting removes the notice. No notice for your own actions or from blocked people.

---

## 24. Shared collections
- Open a collection and tap Invite to ask people who follow you back (up to 10). They get an Activity notice and a Join / Decline card at the top of Collections.
- Members add posts from the "…" menu (Save to collection lists shared collections too). Members remove only posts they added; the owner can remove anything or remove a person; members can leave. Posts a person added stay when they leave.
- Sharing never widens who can see a post: people who can't see a post just don't see it in the grid. Only the owner can delete the collection.
- Limits: 10 people, 500 posts.

---

## 25. Find contacts
- Find and invite friends > Find contacts: after you allow contacts access, Funkty scrambles (SHA-256) the email addresses in your contacts on your phone and sends only the scrambled values; names and numbers never leave the phone and nothing is stored. You see people who opted in, with a Follow button.
- Opt-in: "Let contacts find me" (also in Comment and repost controls). Off by default. Turning it on stores a scrambled version of your account email, never shown to anyone; turning it off deletes it.
- Limits: 1000 addresses per check, 5 checks a day. Works in the phone app only.

---

## Not built yet
See `docs/dev-build-backlog.md` for the full list. Headlines:
- Push notifications, video compression, deep links, biometric lock (need a development build).
- Content scanning, message-request logic on the server, pgTAP in CI.
