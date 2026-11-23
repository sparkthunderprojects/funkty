# ADR 0003: Minimum age and digital consent

Status: accepted, 2026-11-23. Needs legal confirmation before public launch.

## Decision

- Minimum age is 13 everywhere. Under 13, sign-up is blocked (`GLOBAL_MINIMUM_AGE`).
- GDPR Article 8 sets the default digital age of consent at 16; each EU member state may lower it to as low as 13. Until counsel verifies each national value, Funkty applies 16 to every EU member state and blocks sign-up below that age instead of building parental consent.
- Verified national values go in `VERIFIED_CONSENT_AGE_OVERRIDES` in `packages/core/src/age.ts`, only with written legal confirmation. Overrides can never go below 13.
- Accounts aged 13 to 17 are teen accounts: private by default, restricted messaging, limited discovery, no precise location.

## Enforcement

The age rule runs in the shared sign-up schema, again in the API, and again in a database function. Date of birth is stored in `profile_private`, not on the public profile.
