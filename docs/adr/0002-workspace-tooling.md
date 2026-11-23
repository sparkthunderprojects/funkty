# ADR 0002: Workspace tooling

Status: accepted, 2026-11-23.

- pnpm workspaces with `node-linker=hoisted` (`.npmrc`). Hoisting is the safest layout for React Native's Metro bundler; revisit isolated installs once Phase 0 spikes are stable.
- Turborepo orchestrates `build`, `typecheck`, `lint`, `test`.
- One React version (19.3.0) is pinned through `overrides` in `pnpm-workspace.yaml` so Next.js and Expo resolve the same copy.
- Internal packages export TypeScript source (`main` and `types` point at `src/index.ts`). Next.js compiles them with `transpilePackages`; Metro compiles them natively. No per-package build.
- TypeScript is pinned to `~6.0.3` everywhere, matching the Expo SDK template.

## Spike 1 result

`@funkty/core`, `@funkty/validation` and `@funkty/tokens` are consumed by both apps. `next build` succeeds and `expo export --platform android` bundles successfully with all three packages.
