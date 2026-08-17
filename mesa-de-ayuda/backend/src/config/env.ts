import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
  JWT_ACCESS_SECRET: z.string().default('mesa_de_ayuda_access_secret_development_key_32chars_min'),
  JWT_REFRESH_SECRET: z.string().default('mesa_de_ayuda_refresh_secret_development_key_32chars_min'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Variables de entorno inválidas:', result.error.format());
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
