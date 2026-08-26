import crypto from 'crypto';
import { env } from '../config/env.js';

export interface UploadImageResult {
  imagePath: string;
  sizeBytes: number;
  mimeType: string;
}

export class StorageService {
  private maxSizeBytes = 5 * 1024 * 1024; // 5 MB

  /**
   * Valida la cabecera real de bytes (Magic Bytes) para asegurar que el archivo sea una imagen genuina.
   */
  validateImageBuffer(buffer: Buffer): { valid: boolean; detectedMime?: string; error?: string; isSizeLimit?: boolean } {
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: 'El archivo de imagen está vacío.' };
    }

    if (buffer.length > this.maxSizeBytes) {
      return {
        valid: false,
        error: 'La imagen supera el tamaño máximo permitido de 5 MB.',
        isSizeLimit: true,
      };
    }

    // 1. PNG: 89 50 4E 47
    if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { valid: true, detectedMime: 'image/png' };
    }

    // 2. JPEG: FF D8 FF
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, detectedMime: 'image/jpeg' };
    }

    // 3. WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { valid: true, detectedMime: 'image/webp' };
    }

    return { valid: false, error: 'Formato de imagen no permitido. Solo se admiten archivos PNG, JPEG y WEBP.' };
  }

  /**
   * Sube una imagen al bucket de Supabase Storage y retorna la ruta interna generada.
   */
  async uploadGuideImage(buffer: Buffer): Promise<UploadImageResult> {
    const validation = this.validateImageBuffer(buffer);
    if (!validation.valid || !validation.detectedMime) {
      const isSizeError = Boolean(validation.isSizeLimit) || buffer.length > this.maxSizeBytes;
      const err = new Error(validation.error || 'Imagen inválida.');
      (err as any).statusCode = isSizeError ? 413 : 400;
      (err as any).code = isSizeError ? 'PAYLOAD_TOO_LARGE' : 'INVALID_IMAGE_FILE';
      (err as any).source = 'validation';
      throw err;
    }

    const mimeType = validation.detectedMime;
    let ext = 'png';
    if (mimeType === 'image/jpeg') ext = 'jpg';
    if (mimeType === 'image/webp') ext = 'webp';

    // Generar nombre de archivo UUID sanitizado (evita cualquier path traversal)
    const fileId = crypto.randomUUID();
    const imagePath = `guides/${fileId}.${ext}`;

    // Si Supabase Storage está configurado en producción/backend
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const uploadUrl = `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${imagePath}`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const err = new Error(`Error al almacenar imagen en Supabase Storage (HTTP ${response.status}): ${errorText}`);
        (err as any).statusCode = 502;
        (err as any).code = 'STORAGE_UPLOAD_ERROR';
        throw err;
      }
    }

    return {
      imagePath,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  /**
   * Genera una Signed URL temporal para visualización segura de la imagen.
   */
  async getSignedImageUrl(imagePath: string, expiresInSeconds = 3600): Promise<string> {
    if (!imagePath) return '';

    // Sanitizar imagePath contra path traversal
    const cleanPath = imagePath.replace(/\\/g, '/').replace(/\.\./g, '').trim();

    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const signUrl = `${env.SUPABASE_URL}/storage/v1/object/sign/${env.SUPABASE_STORAGE_BUCKET}/${cleanPath}`;
        const res = await fetch(signUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expiresIn: expiresInSeconds }),
        });

        if (res.ok) {
          const data = (await res.json()) as { signedURL?: string };
          if (data && data.signedURL) {
            return `${env.SUPABASE_URL}/storage/v1${data.signedURL}`;
          }
        }
      } catch (err) {
        console.error('Error generando Signed URL en Supabase Storage:', err);
      }
    }

    // Fallback URL o URL simulada en entorno de pruebas/desarrollo
    return `${env.SUPABASE_URL || 'https://storage.local'}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${cleanPath}`;
  }

  /**
   * Elimina un archivo de Supabase Storage.
   */
  async deleteGuideImage(imagePath: string): Promise<boolean> {
    if (!imagePath) return true;
    const cleanPath = imagePath.replace(/\\/g, '/').replace(/\.\./g, '').trim();

    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const deleteUrl = `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}`;
        await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prefixes: [cleanPath] }),
        });
      } catch (err) {
        console.error(`Error al eliminar archivo ${cleanPath} de Supabase Storage:`, err);
      }
    }

    return true;
  }
}

export const storageService = new StorageService();
