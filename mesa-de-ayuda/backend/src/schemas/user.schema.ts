import { z } from 'zod';
import { passwordPolicy } from './auth.schema.js';
import { UserRole, UserStatus } from '@prisma/client';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
  displayName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  temporaryPassword: passwordPolicy,
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const resetUserPasswordSchema = z.object({
  newTemporaryPassword: passwordPolicy,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
