import { z } from 'zod';

export const passwordPolicy = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(128, 'La contraseña no puede exceder 128 caracteres')
  .regex(/[a-zA-Z]/, 'La contraseña debe contener al menos una letra')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token requerido'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().trim().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: passwordPolicy,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
