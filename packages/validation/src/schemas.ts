import { z } from 'zod';
import { LIMITS, checkSignupAge, isValidUsername, normalizeUsername } from '@funkty/core';

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .refine(isValidUsername, { message: 'invalid_username' });

export const countryCodeSchema = z
  .string()
  .length(2)
  .transform((value) => value.toUpperCase());

/** Sign-up input. Age is enforced here and again in the database and API. */
export const signUpSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(10).max(128),
    username: usernameSchema,
    birthDate: z.coerce.date(),
    country: countryCodeSchema,
  })
  .superRefine((input, ctx) => {
    const result = checkSignupAge(input.birthDate, input.country);
    if (!result.allowed) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthDate'],
        message: 'under_minimum_age',
        params: { minimumAge: result.minimumAge },
      });
    }
  });

export const visibilitySchema = z.enum(['public', 'followers', 'private']);

export const createPostSchema = z.object({
  caption: z.string().max(LIMITS.caption.max).default(''),
  mediaIds: z
    .array(z.string().uuid())
    .min(LIMITS.mediaPerPost.min)
    .max(LIMITS.mediaPerPost.max),
  visibility: visibilitySchema.default('public'),
  altTexts: z.array(z.string().max(1000)).optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
