import { z } from 'zod';

export const createQuickTextSchema = z.object({
  title: z
    .string({ required_error: 'El título es obligatorio.' })
    .trim()
    .min(1, 'El título no puede estar vacío.')
    .max(150, 'El título no puede exceder los 150 caracteres.'),
  header: z
    .string({ required_error: 'La cabecera es obligatoria.' })
    .trim()
    .min(1, 'La cabecera no puede estar vacía.')
    .max(1000, 'La cabecera no puede exceder los 1000 caracteres.'),
  body: z
    .string({ required_error: 'El cuerpo es obligatorio.' })
    .trim()
    .min(1, 'El cuerpo no puede estar vacío.')
    .max(5000, 'El cuerpo no puede exceder los 5000 caracteres.'),
  solution: z
    .string()
    .trim()
    .max(5000, 'La solución no puede exceder los 5000 caracteres.')
    .optional()
    .default(''),
});

export const updateQuickTextSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'El título no puede estar vacío.')
      .max(150, 'El título no puede exceder los 150 caracteres.')
      .optional(),
    header: z
      .string()
      .trim()
      .min(1, 'La cabecera no puede estar vacía.')
      .max(1000, 'La cabecera no puede exceder los 1000 caracteres.')
      .optional(),
    body: z
      .string()
      .trim()
      .min(1, 'El cuerpo no puede estar vacío.')
      .max(5000, 'El cuerpo no puede exceder los 5000 caracteres.')
      .optional(),
    solution: z
      .string()
      .trim()
      .max(5000, 'La solución no puede exceder los 5000 caracteres.')
      .optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.header !== undefined ||
      data.body !== undefined ||
      data.solution !== undefined,
    {
      message: 'Debes proporcionar al menos un campo para actualizar (title, header, body o solution).',
    }
  );

export type CreateQuickTextInput = z.infer<typeof createQuickTextSchema>;
export type UpdateQuickTextInput = z.infer<typeof updateQuickTextSchema>;
