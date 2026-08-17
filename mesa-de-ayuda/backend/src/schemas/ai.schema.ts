import { z } from 'zod';

export const aiProcessSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, { message: 'El texto debe contener al menos 1 carácter útil' })
    .max(5000, { message: 'El texto no puede exceder 5000 caracteres' }),
  action: z.enum(['correct', 'paraphrase', 'professionalize', 'summarize', 'reply'], {
    errorMap: () => ({ message: 'Acción no válida. Opciones permitidas: correct, paraphrase, professionalize, summarize, reply' }),
  }),
  tone: z
    .enum(['professional', 'formal', 'friendly', 'technical', 'casual'], {
      errorMap: () => ({ message: 'Tono no válido. Opciones: professional, formal, friendly, technical, casual' }),
    })
    .optional()
    .default('professional'),
  paraphraseLevel: z
    .enum(['soft', 'medium', 'complete'], {
      errorMap: () => ({ message: 'Nivel de parafraseo no válido. Opciones: soft, medium, complete' }),
    })
    .optional()
    .default('medium'),
});

export type AiProcessSchemaType = z.infer<typeof aiProcessSchema>;
