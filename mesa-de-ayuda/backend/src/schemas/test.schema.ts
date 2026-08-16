import { z } from 'zod';

export const testSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, { message: 'El texto debe contener al menos 1 carácter útil' })
    .max(5000, { message: 'El texto no puede exceder 5000 caracteres' }),
});

export type TestInput = z.infer<typeof testSchema>;
