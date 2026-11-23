/** Minimum age to hold an account anywhere. Under this age sign-up is always blocked. */
export const GLOBAL_MINIMUM_AGE = 13;

/** Age below which an account is treated as a teen account with protective defaults. */
export const TEEN_ACCOUNT_MAX_AGE = 17;

/**
 * EU member states. GDPR Article 8 sets the digital age of consent at 16 unless a
 * member state lowers it (to no lower than 13). Until counsel verifies each national
 * value, Funkty applies the conservative default of 16 to every EU member state.
 */
const EU_MEMBER_STATES: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/**
 * Verified per-country overrides. EMPTY until legal review confirms each value.
 * Do not add entries without a written legal confirmation (see docs/adr/0003).
 */
export const VERIFIED_CONSENT_AGE_OVERRIDES: Readonly<Record<string, number>> = {};

/** Minimum sign-up age for an ISO 3166-1 alpha-2 country code. */
export function minimumSignupAge(
  countryCode: string,
  overrides: Readonly<Record<string, number>> = VERIFIED_CONSENT_AGE_OVERRIDES,
): number {
  const code = countryCode.trim().toUpperCase();
  const override = overrides[code];
  if (override !== undefined) return Math.max(override, GLOBAL_MINIMUM_AGE);
  if (EU_MEMBER_STATES.has(code)) return 16;
  return GLOBAL_MINIMUM_AGE;
}

/** Whole years between a birth date and a reference date (UTC). */
export function ageInYears(birthDate: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() &&
      now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export type SignupAgeCheck =
  | { allowed: true; teen: boolean; age: number }
  | { allowed: false; reason: 'under_minimum_age'; minimumAge: number };

/** Decide whether someone may sign up, and whether teen protections apply. */
export function checkSignupAge(
  birthDate: Date,
  countryCode: string,
  now: Date = new Date(),
): SignupAgeCheck {
  const age = ageInYears(birthDate, now);
  const minimumAge = minimumSignupAge(countryCode);
  if (age < minimumAge) return { allowed: false, reason: 'under_minimum_age', minimumAge };
  return { allowed: true, teen: age <= TEEN_ACCOUNT_MAX_AGE, age };
}
