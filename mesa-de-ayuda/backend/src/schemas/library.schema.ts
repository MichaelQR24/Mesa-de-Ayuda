import { z } from 'zod';

export const libraryQuerySchema = z.object({
  categoryId: z.string().optional(),
  isShared: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  isFavorite: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export const createLibraryItemSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(255, 'El título no puede exceder 255 caracteres'),
  content: z.string().trim().min(1, 'El contenido no puede estar vacío').max(10000, 'El contenido no puede exceder 10000 caracteres'),
  categoryId: z.string().trim().min(1, 'La categoría es obligatoria'),
  isShared: z.boolean().optional().default(false),
  isFavorite: z.boolean().optional().default(false),
});

export const updateLibraryItemSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().trim().min(1).max(10000).optional(),
  categoryId: z.string().trim().min(1).optional(),
  isShared: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export type LibraryQueryType = z.infer<typeof libraryQuerySchema>;
export type CreateLibraryItemType = z.infer<typeof createLibraryItemSchema>;
export type UpdateLibraryItemType = z.infer<typeof updateLibraryItemSchema>;
