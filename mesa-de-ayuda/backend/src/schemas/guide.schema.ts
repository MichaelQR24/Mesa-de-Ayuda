import { z } from 'zod';

export const createGuideSchema = z.object({
  title: z
    .string()
    .min(2, 'El título debe tener al menos 2 caracteres.')
    .max(150, 'El título no puede exceder los 150 caracteres.')
    .trim(),
  description: z
    .string()
    .max(5000, 'La descripción no puede exceder los 5000 caracteres.')
    .optional()
    .default(''),
  keywords: z
    .union([
      z.array(z.string().min(1).max(50).trim()),
      z.string().transform((val) =>
        val
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      ),
    ])
    .refine((val) => Array.isArray(val) && val.length > 0, {
      message: 'Debe ingresar al menos una palabra clave o etiqueta.',
    }),
  imageBase64: z
    .string()
    .min(10, 'Se requiere la imagen de la guía (formato base64 o archivo).'),
});

export const updateGuideSchema = z.object({
  title: z
    .string()
    .min(2, 'El título debe tener al menos 2 caracteres.')
    .max(150, 'El título no puede exceder los 150 caracteres.')
    .trim()
    .optional(),
  description: z
    .string()
    .max(5000, 'La descripción no puede exceder los 5000 caracteres.')
    .optional(),
  keywords: z
    .union([
      z.array(z.string().min(1).max(50).trim()),
      z.string().transform((val) =>
        val
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      ),
    ])
    .optional(),
  imageBase64: z
    .string()
    .min(10, 'La imagen debe ser válida si se desea reemplazar.')
    .optional(),
});

export type CreateGuideInput = z.infer<typeof createGuideSchema>;
export type UpdateGuideInput = z.infer<typeof updateGuideSchema>;
