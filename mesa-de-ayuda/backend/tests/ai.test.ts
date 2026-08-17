import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { groqService } from '../src/services/groq.service.js';
import { historyRepository } from '../src/repositories/history.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('POST /api/v1/ai/process', () => {
  const authToken = generateAccessToken({
    sub: 'user-1',
    email: 'agente@soporte.com',
    displayName: 'Agente Soporte',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(historyRepository, 'create').mockResolvedValue({} as any);
    vi.spyOn(userRepository, 'findSafeById').mockResolvedValue({
      id: 'user-1',
      email: 'agente@soporte.com',
      displayName: 'Agente Soporte',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      lastLoginAt: new Date(),
      passwordChangedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('debe rechazar con HTTP 401 si no se envía token de autenticación', async () => {
    const response = await request(app)
      .post('/api/v1/ai/process')
      .send({
        text: 'usuario no puede ingresar al sistema',
        action: 'professionalize',
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('debe procesar exitosamente una solicitud válida con Groq mockeado y usuario autenticado', async () => {
    const mockResponse = {
      result: 'El usuario se comunica solicitando asistencia debido a inconvenientes de acceso.',
      model: 'llama-3.1-8b-instant',
      usage: {
        inputTokens: 45,
        outputTokens: 22,
        totalTokens: 67,
      },
      latencyMs: 120,
    };

    vi.spyOn(groqService, 'generateCompletion').mockResolvedValueOnce(mockResponse);

    const response = await request(app)
      .post('/api/v1/ai/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'usuario no puede ingresar al sistema',
        action: 'professionalize',
        tone: 'professional',
        paraphraseLevel: 'medium',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        result: mockResponse.result,
        model: 'llama-3.1-8b-instant',
        usage: mockResponse.usage,
      },
    });
  });

  it('debe rechazar con HTTP 400 si la acción no es válida', async () => {
    const response = await request(app)
      .post('/api/v1/ai/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'texto de prueba',
        action: 'invalid_action',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('debe rechazar con HTTP 400 si el texto está vacío', async () => {
    const response = await request(app)
      .post('/api/v1/ai/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: '   ',
        action: 'correct',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('debe rechazar con HTTP 400 si el texto supera 5000 caracteres', async () => {
    const longText = 'a'.repeat(5001);
    const response = await request(app)
      .post('/api/v1/ai/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: longText,
        action: 'summarize',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('debe rechazar con HTTP 400 si el tono no es válido', async () => {
    const response = await request(app)
      .post('/api/v1/ai/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'texto válido',
        action: 'reply',
        tone: 'invalid_tone',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('debe responder HTTP 502 con AI_PROVIDER_ERROR si ocurre un error en el proveedor', async () => {
    vi.spyOn(groqService, 'generateCompletion').mockRejectedValueOnce(new Error('Groq network error'));

    const response = await request(app)
      .post('/api/v1/ai/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'texto de prueba',
        action: 'correct',
      });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'AI_PROVIDER_ERROR',
        message: 'No fue posible procesar el texto con el servicio de IA en este momento.',
      },
    });
  });
});
