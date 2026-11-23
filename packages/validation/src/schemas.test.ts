import { describe, expect, it } from 'vitest';
import { createPostSchema, signUpSchema } from './index';

const adult = {
  email: 'user@example.com',
  password: 'correct-horse-battery',
  username: 'Funky.User',
  birthDate: '2000-05-01',
  country: 'us',
};

describe('signUpSchema', () => {
  it('normalizes username and country', () => {
    const parsed = signUpSchema.parse(adult);
    expect(parsed.username).toBe('funky.user');
    expect(parsed.country).toBe('US');
  });

  it('rejects under-age sign-up with a stable error code', () => {
    const result = signUpSchema.safeParse({ ...adult, birthDate: '2020-01-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === 'under_minimum_age')).toBe(true);
    }
  });

  it('rejects short passwords', () => {
    expect(signUpSchema.safeParse({ ...adult, password: 'short' }).success).toBe(false);
  });
});

describe('createPostSchema', () => {
  const id = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';

  it('requires at least one media item', () => {
    expect(createPostSchema.safeParse({ caption: 'hi', mediaIds: [] }).success).toBe(false);
  });

  it('applies defaults', () => {
    const parsed = createPostSchema.parse({ mediaIds: [id] });
    expect(parsed.visibility).toBe('public');
    expect(parsed.caption).toBe('');
  });

  it('caps the number of media items at ten', () => {
    const mediaIds = Array.from({ length: 11 }, () => id);
    expect(createPostSchema.safeParse({ mediaIds }).success).toBe(false);
  });
});
