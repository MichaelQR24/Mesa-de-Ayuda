import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { libraryRepository } from '../src/repositories/library.repository.js';
import { historyRepository } from '../src/repositories/history.repository.js';
import { usageService } from '../src/services/usage.service.js';
import { groqService } from '../src/services/groq.service.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('QA Edge Cases, Multiusuario y Estabilidad (Fase 11)', () => {
  const userAToken = generateAccessToken({
    sub: 'user-a-uuid',
    email: 'usera@empresa.com',
    displayName: 'Usuario A',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  const userBToken = generateAccessToken({
    sub: 'user-b-uuid',
    email: 'userb@empresa.com',
    displayName: 'Usuario B',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(usageService, 'getUserMonthlyTokenUsage').mockResolvedValue(0);
    vi.spyOn(historyRepository, 'create').mockResolvedValue({} as any);

    vi.spyOn(userRepository, 'findSafeById').mockImplementation(async (id: string) => {
      if (id === 'user-a-uuid') {
        return {
          id: 'user-a-uuid',
          email: 'usera@empresa.com',
          displayName: 'Usuario A',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          monthlyTokenLimit: 50000,
          saveAiHistory: true,
          lastLoginAt: new Date(),
          passwordChangedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      if (id === 'user-b-uuid') {
        return {
          id: 'user-b-uuid',
          email: 'userb@empresa.com',
          displayName: 'Usuario B',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          monthlyTokenLimit: 50000,
          saveAiHistory: true,
          lastLoginAt: new Date(),
          passwordChangedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    });
  });

  describe('1. Límites Exactos de Caracteres (4999, 5000, 5001)', () => {
    it('debe aceptar y procesar texto con exactamente 4999 caracteres', async () => {
      const text4999 = 'A'.repeat(4999);
      vi.spyOn(groqService, 'generateCompletion').mockResolvedValueOnce({
        result: 'Texto procesado correctamente',
        model: 'llama-3.1-8b-instant',
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      });

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ text: text4999, action: 'professionalize' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('debe aceptar y procesar texto con exactamente 5000 caracteres', async () => {
      const text5000 = 'B'.repeat(5000);
      vi.spyOn(groqService, 'generateCompletion').mockResolvedValueOnce({
        result: 'Texto procesado de 5000 chars',
        model: 'llama-3.1-8b-instant',
        usage: { inputTokens: 110, outputTokens: 25, totalTokens: 135 },
      });

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ text: text5000, action: 'correct' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('debe rechazar estrictamente con HTTP 400 y VALIDATION_ERROR si el texto tiene 5001 caracteres', async () => {
      const text5001 = 'C'.repeat(5001);
      const groqSpy = vi.spyOn(groqService, 'generateCompletion');

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ text: text5001, action: 'summarize' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(groqSpy).not.toHaveBeenCalled();
    });
  });

  describe('2. Integridad de Texto Unicode, Tildes, Emojis y Formato', () => {
    it('debe procesar caracteres especiales, tildes, ñ y emojis sin corrupción', async () => {
      const complexUnicodeText = `
        Estimado señor Pérez: 🚀
        El usuario reporta un problema con la contraseña de la máquina año 2026.
        ¿Podría apoyarnos con la verificación técnica?
        • Punto 1: Redes & Wi-Fi
        • Punto 2: Conexión SSL/TLS 🔒
      `.trim();

      vi.spyOn(groqService, 'generateCompletion').mockResolvedValueOnce({
        result: 'Estimado señor Pérez: Se remite la solicitud de verificación técnica.',
        model: 'llama-3.1-8b-instant',
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
      });

      const response = await request(app)
        .post('/api/v1/ai/process')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ text: complexUnicodeText, action: 'professionalize' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.result).toContain('Pérez');
    });
  });

  describe('3. Aislamiento Estricto de Datos Multiusuario (IDOR Protection)', () => {
    it('USER_B no debe poder eliminar una plantilla privada perteneciente a USER_A (403 FORBIDDEN)', async () => {
      vi.spyOn(libraryRepository, 'findById').mockResolvedValueOnce({
        id: 'item-of-user-a',
        userId: 'user-a-uuid',
        categoryId: 'cat-1',
        title: 'Plantilla Privada de Usuario A',
        content: 'Contenido privado de soporte',
        isShared: false,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'General' },
      });

      const deleteSpy = vi.spyOn(libraryRepository, 'delete');

      const response = await request(app)
        .delete('/api/v1/library/item-of-user-a')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('USER_B no debe poder modificar una plantilla privada perteneciente a USER_A (403 FORBIDDEN)', async () => {
      vi.spyOn(libraryRepository, 'findById').mockResolvedValueOnce({
        id: 'item-of-user-a',
        userId: 'user-a-uuid',
        categoryId: 'cat-1',
        title: 'Plantilla Privada de Usuario A',
        content: 'Contenido privado',
        isShared: false,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'General' },
      });

      const updateSpy = vi.spyOn(libraryRepository, 'update');

      const response = await request(app)
        .patch('/api/v1/library/item-of-user-a')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ title: 'Intento de Hack por Usuario B' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });
});
