import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { historyRepository } from '../src/repositories/history.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { AiAction, Tone, ParaphraseLevel, UserRole, UserStatus } from '@prisma/client';

describe('GET /api/v1/history', () => {
  const authToken = generateAccessToken({
    sub: 'user-1',
    email: 'agente@soporte.com',
    displayName: 'Agente Soporte',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('debe devolver 401 si no se envía token de autenticación', async () => {
    const response = await request(app).get('/api/v1/history');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('debe devolver la lista paginada de historial del usuario autenticado', async () => {
    const mockItems = [
      {
        id: 'hist-1',
        userId: 'user-1',
        action: AiAction.PROFESSIONALIZE,
        originalText: 'usuario no puede ingresar',
        resultText: 'El usuario se comunica...',
        tone: Tone.PROFESSIONAL,
        paraphraseLevel: ParaphraseLevel.MEDIUM,
        model: 'llama-3.1-8b-instant',
        inputTokens: 40,
        outputTokens: 20,
        totalTokens: 60,
        latencyMs: 350,
        createdAt: new Date(),
      },
    ];

    vi.spyOn(historyRepository, 'findMany').mockResolvedValueOnce({
      items: mockItems,
      total: 1,
    });

    const response = await request(app)
      .get('/api/v1/history?limit=10&offset=0')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.limit).toBe(10);
    expect(response.body.data.offset).toBe(0);
  });
});
