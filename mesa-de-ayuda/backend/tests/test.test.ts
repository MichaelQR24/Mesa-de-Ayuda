import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('POST /api/v1/test', () => {
  it('debe responder HTTP 200 cuando el texto es válido', async () => {
    const response = await request(app)
      .post('/api/v1/test')
      .send({ text: 'Texto de prueba' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        receivedText: 'Texto de prueba',
        message: 'Backend conectado correctamente',
      },
    });
  });

  it('debe responder HTTP 400 cuando no se envía la propiedad text', async () => {
    const response = await request(app)
      .post('/api/v1/test')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('debe responder HTTP 400 cuando text está vacío o son solo espacios', async () => {
    const response = await request(app)
      .post('/api/v1/test')
      .send({ text: '   ' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('debe responder HTTP 400 cuando text supera los 5000 caracteres', async () => {
    const longText = 'a'.repeat(5001);
    const response = await request(app)
      .post('/api/v1/test')
      .send({ text: longText });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });
});

describe('Rutas inexistentes (404)', () => {
  it('debe responder HTTP 404 con JSON consistente para endpoints no encontrados', async () => {
    const response = await request(app).get('/ruta-que-no-existe');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Ruta no encontrada',
      },
    });
  });
});
