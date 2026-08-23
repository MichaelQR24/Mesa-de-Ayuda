import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default(''),
  ALLOWED_EXTENSION_IDS: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres').default('mesa_de_ayuda_access_secret_development_key_32chars_min'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres').default('mesa_de_ayuda_refresh_secret_development_key_32chars_min'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minuto
  AI_RATE_LIMIT_MAX: z.coerce.number().default(20), // 20 solicitudes por minuto
  AI_HISTORY_RETENTION_DAYS: z.coerce.number().default(90),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Variables de entorno inválidas:', result.error.format());
    process.exit(1);
  }

  const data = result.data;

  // Validación de seguridad estricta para entorno de Producción
  if (data.NODE_ENV === 'production') {
    if (data.JWT_ACCESS_SECRET.includes('development') || data.JWT_ACCESS_SECRET.length < 32) {
      console.error('❌ ERROR CRÍTICO DE SEGURIDAD: JWT_ACCESS_SECRET inseguro o por defecto en producción.');
      process.exit(1);
    }
    if (data.JWT_REFRESH_SECRET.includes('development') || data.JWT_REFRESH_SECRET.length < 32) {
      console.error('❌ ERROR CRÍTICO DE SEGURIDAD: JWT_REFRESH_SECRET inseguro o por defecto en producción.');
      process.exit(1);
    }
    if (!data.GROQ_API_KEY) {
      console.error('❌ ERROR CRÍTICO: GROQ_API_KEY requerida en producción.');
      process.exit(1);
    }
  }

  return data;
};

export const env = parseEnv();
