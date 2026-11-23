import { describe, expect, it } from 'vitest';
import { ageInYears, checkSignupAge, isValidUsername, minimumSignupAge, normalizeUsername } from './index';

describe('age rules', () => {
  const now = new Date('2026-11-23T12:00:00Z');

  it('computes whole years before and after a birthday', () => {
    expect(ageInYears(new Date('2013-11-24T00:00:00Z'), now)).toBe(12);
    expect(ageInYears(new Date('2013-11-23T00:00:00Z'), now)).toBe(13);
  });

  it('blocks under 13 everywhere', () => {
    const result = checkSignupAge(new Date('2014-01-01T00:00:00Z'), 'US', now);
    expect(result).toEqual({ allowed: false, reason: 'under_minimum_age', minimumAge: 13 });
  });

  it('allows a 13 year old in the US and flags a teen account', () => {
    const result = checkSignupAge(new Date('2013-01-01T00:00:00Z'), 'US', now);
    expect(result).toEqual({ allowed: true, teen: true, age: 13 });
  });

  it('applies the conservative EU default of 16 until counsel verifies national values', () => {
    expect(minimumSignupAge('de')).toBe(16);
    expect(minimumSignupAge('GB')).toBe(13);
    const result = checkSignupAge(new Date('2012-01-01T00:00:00Z'), 'FR', now);
    expect(result.allowed).toBe(false);
  });

  it('never lets an override go below the global minimum', () => {
    expect(minimumSignupAge('XX', { XX: 10 })).toBe(13);
  });

  it('treats 18 and over as adult accounts', () => {
    const result = checkSignupAge(new Date('2000-01-01T00:00:00Z'), 'US', now);
    expect(result).toMatchObject({ allowed: true, teen: false });
  });
});

describe('usernames', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeUsername('  FunkyUser ')).toBe('funkyuser');
  });

  it('accepts valid names and rejects invalid ones', () => {
    expect(isValidUsername('funky.user_1')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('.leading')).toBe(false);
    expect(isValidUsername('trailing.')).toBe(false);
    expect(isValidUsername('dou..ble')).toBe(false);
    expect(isValidUsername('has space')).toBe(false);
    expect(isValidUsername('x'.repeat(31))).toBe(false);
  });
});
