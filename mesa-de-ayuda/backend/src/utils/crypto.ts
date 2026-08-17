import argon2 from 'argon2';
import crypto from 'crypto';

/**
 * Hashea una contraseña utilizando Argon2id (estándar recomendado y resistente a GPU/side-channel).
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verifica una contraseña en texto plano contra su hash Argon2id.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Genera un hash SHA-256 para tokens (como refresh tokens) para almacenarlos de forma segura en PostgreSQL.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Genera una cadena criptográficamente segura y aleatoria.
 */
export function generateRandomToken(bytes = 64): string {
  return crypto.randomBytes(bytes).toString('hex');
}
