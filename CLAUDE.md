# Funkty: working conventions

Funkty is a social platform: Next.js web, Expo native (iOS/Android), Supabase backend, one pnpm + Turborepo monorepo. Production quality is the bar, not a prototype. Decisions live in `docs/adr`.

## Commands

- Install: `pnpm install`
- Typecheck all: `pnpm typecheck`
- Test all: `pnpm test`
- Build web: `pnpm --filter @funkty/web build`
- Bundle check for native: `cd apps/mobile && CI=1 npx expo export --platform android --output-dir /tmp/expo-out`

Run typecheck and tests before every push.

## Layout

- `apps/web` Next.js App Router (desktop experience). `apps/mobile` Expo (iOS and Android).
- `apps/api` and `apps/admin` arrive in later phases. `supabase/` holds migrations and tests.
- `packages/core` (pure rules, no I/O), `packages/validation` (zod), `packages/tokens` (design tokens).

## Rules

- Dependency direction: apps depend on packages; packages never depend on apps; `core` depends on nothing.
- Share logic, not UI components. Web and native implement the same tokens separately.
- Internal packages ship as TypeScript source; apps compile them. No per-package build step.
- One React version across the workspace, pinned in `pnpm-workspace.yaml`. Do not add a second copy.
- Schema changes happen only as migrations in `supabase/migrations`. Never edit the database by hand.
- Every table has Row Level Security. Every RLS rule has a pgTAP test.
- The Supabase service-role key exists only in `apps/api`, workers and CI. Never in a client bundle.
- Every restriction on content or accounts must cite a policy and a user-facing reason (see ADR 0001).
- Expo changes between SDK releases: before writing Expo or React Native API code, read the docs for the installed `expo` major version at https://docs.expo.dev/versions/ and use `npx expo install` for Expo-related packages.
- Features ship as complete vertical slices: schema, policies, API, web, native, tests, wiring. Nothing is left for manual integration.
- Work may be pushed directly to `main` (owner decision, 2026-11-23), but only after `pnpm typecheck`, `pnpm test` and the web build pass.

## Brand

Direction is feed-first with full-screen vertical video, bold and minimal. Funkty's identity must be original: do not copy another company's logos, gradients, icons or assets.
