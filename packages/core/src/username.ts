import { USERNAME_PATTERN } from './limits';

/** Lowercase and trim; the canonical stored form. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(input: string): boolean {
  const name = normalizeUsername(input);
  if (!USERNAME_PATTERN.test(name)) return false;
  // No leading, trailing or consecutive dots: they break profile URLs and mentions.
  if (name.startsWith('.') || name.endsWith('.') || name.includes('..')) return false;
  return true;
}
