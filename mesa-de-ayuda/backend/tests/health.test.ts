import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('GET /health', () => {
  it('debe responder HTTP 200 y status ok', async () => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }] as any);

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('service', 'mesa-de-ayuda-api');
    expect(response.body).toHaveProperty('checks');
  });
});
