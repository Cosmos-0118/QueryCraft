import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9 ]+$/, 'Display name can only contain letters, numbers, and spaces'),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9 ]+$/)
    .optional(),
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export const progressUpdateSchema = z.object({
  topicSlug: z.string().max(100),
  lessonSlug: z.string().max(100).optional(),
  currentStep: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

export const sessionSaveSchema = z.object({
  sessionType: z.enum(['sandbox', 'algebra', 'normalizer', 'er-builder']),
  sessionName: z.string().max(200).optional(),
  stateJson: z.record(z.unknown()),
});

export const exerciseSubmitSchema = z.object({
  answer: z.string().max(10000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ProgressUpdateInput = z.infer<typeof progressUpdateSchema>;
export type SessionSaveInput = z.infer<typeof sessionSaveSchema>;
export type ExerciseSubmitInput = z.infer<typeof exerciseSubmitSchema>;
