import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Formato de correo electrónico inválido')
    .max(100, 'El correo no puede exceder 100 caracteres'),
  displayName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  temporaryPassword: z
    .string()
    .min(10, 'La contraseña temporal debe tener al menos 10 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres')
    .regex(/[a-zA-Z]/, 'La contraseña debe contener al menos una letra')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  monthlyTokenLimit: z.number().int().positive().nullable().optional(),
});

export const updateUserSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const resetUserPasswordSchema = z.object({
  temporaryPassword: z
    .string()
    .min(10, 'La nueva contraseña temporal debe tener al menos 10 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres')
    .regex(/[a-zA-Z]/, 'La contraseña debe contener al menos una letra')
    .regex(/[0-9]/, 'La contraseña debe contener al menos un número'),
});

export const updateUsageLimitSchema = z.object({
  monthlyTokenLimit: z
    .number()
    .int('El límite debe ser un número entero')
    .min(0, 'El límite no puede ser negativo')
    .max(10_000_000, 'El límite no puede exceder 10 millones de tokens')
    .nullable(),
});

export const userQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type UpdateUsageLimitInput = z.infer<typeof updateUsageLimitSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
