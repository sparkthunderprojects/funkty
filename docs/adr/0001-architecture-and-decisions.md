# ADR 0001: Architecture and product decisions

Status: accepted, 2026-11-23.

## Context

Funkty is an Instagram-scale social platform with first-class desktop web and native iOS/Android experiences sharing one set of accounts, content, followers, messages and notifications.

## Decisions

- **Stack:** Next.js (web), Expo (iOS/Android), Supabase (Postgres, Auth, Realtime) as system of record, one pnpm + Turborepo monorepo.
- **Added service:** a Node/TypeScript API and worker service (`apps/api`, Phase 1) for fan-out, ranking, media callbacks, push and moderation jobs. Edge functions are for webhooks and light glue only.
- **Media:** Cloudflare R2 plus CDN for storage and delivery; managed transcoding (Cloudflare Stream or Mux) for video. Supabase Storage is not used for post media.
- **Feed:** hybrid fan-out (push for normal accounts, pull for very large accounts), Redis for hot feeds, a strictly chronological Following tab at every stage.
- **Realtime:** Supabase Broadcast on one private channel per user. The database is the source of truth; realtime is only a fast path.
- **Sharing:** share types, validation, tokens and (later) API client and data hooks. UI components are separate per platform.
- **Moderation and transparency:** reports, blocks and a review queue ship in Phase 1. A restriction cannot be stored without a policy reference and a user-facing reason; users see every restriction and can appeal.
- **Messaging:** no end-to-end encryption at launch; revisit after launch.

## Product decisions from the owner

- Launch markets: global.
- Minimum age: 13 and over, as Instagram, with the country exceptions in ADR 0003.
- Legal entity: Funkty Group.
- Brand direction: same as Instagram and TikTok (feed-first, full-screen vertical video, bold and minimal), with an original identity.
- Launch scope: photos, stories and DMs first; video and Explore in Phase 3; reels, live and creator tools after launch.
- Delivery: pull requests.

## Consequences

Global launch brings EU Digital Services Act, UK Online Safety Act, GDPR and US state privacy duties into scope at launch. Legal review per region is a gate for public launch.
