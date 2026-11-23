/** Product limits shared by clients, API and database constraints. Keep in sync with migrations. */
export const LIMITS = {
  username: { min: 3, max: 30 },
  displayName: { max: 50 },
  bio: { max: 150 },
  caption: { max: 2200 },
  commentBody: { max: 2200 },
  messageBody: { max: 4000 },
  mediaPerPost: { min: 1, max: 10 },
  groupChatMembers: { max: 50 },
  /** Pixel and byte limits for launch; tighter for new accounts is a later rule. */
  image: { maxBytes: 20 * 1024 * 1024 },
  video: { maxBytes: 500 * 1024 * 1024, maxDurationSeconds: 90 },
} as const;

/** Username pattern mirrors the check constraint on profiles.username. */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
