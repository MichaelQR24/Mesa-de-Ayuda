import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { resolveErrorSource } from '../src/middleware/error-handler.js';

describe('Diagnóstico y Clasificación Estructurada de Errores Seguros', () => {
  describe('1. Función resolveErrorSource', () => {
    it('clasifica errores de validación', () => {
      expect(resolveErrorSource('VALIDATION_ERROR')).toBe('validation');
      expect(resolveErrorSource('INVALID_JSON')).toBe('validation');
      expect(resolveErrorSource('SENSITIVE_DATA_BLOCKED')).toBe('validation');
    });

    it('clasifica errores de autenticación y autorización', () => {
      expect(resolveErrorSource('UNAUTHORIZED')).toBe('auth');
      expect(resolveErrorSource('FORBIDDEN')).toBe('auth');
      expect(resolveErrorSource('ACCOUNT_INACTIVE')).toBe('auth');
      expect(resolveErrorSource('TOKEN_REUSE_DETECTED')).toBe('auth');
      expect(resolveErrorSource('INVALID_REFRESH_TOKEN')).toBe('auth');
      expect(resolveErrorSource('INVALID_CREDENTIALS')).toBe('auth');
    });

    it('clasifica errores de Groq / IA', () => {
      expect(resolveErrorSource('AI_MODEL_NOT_FOUND')).toBe('groq');
      expect(resolveErrorSource('AI_AUTHENTICATION_ERROR')).toBe('groq');
      expect(resolveErrorSource('AI_TIMEOUT')).toBe('groq');
      expect(resolveErrorSource('AI_SERVICE_UNAVAILABLE')).toBe('groq');
      expect(resolveErrorSource('AI_PROVIDER_ERROR')).toBe('groq');
    });

    it('clasifica errores de base de datos y Prisma', () => {
      expect(resolveErrorSource('DATABASE_ERROR')).toBe('database');
      expect(resolveErrorSource('PRISMA_ERROR')).toBe('database');
      expect(resolveErrorSource('P2002')).toBe('database');
    });

    it('clasifica errores de rate limiting', () => {
      expect(resolveErrorSource('RATE_LIMIT_EXCEEDED')).toBe('rate-limit');
      expect(resolveErrorSource('MONTHLY_AI_LIMIT_REACHED')).toBe('rate-limit');
    });

    it('clasifica errores de red y conectividad', () => {
      expect(resolveErrorSource('NETWORK_ERROR')).toBe('network');
      expect(resolveErrorSource('SERVER_UNREACHABLE')).toBe('network');
    });

    it('clasifica errores genéricos de backend', () => {
      expect(resolveErrorSource('INTERNAL_SERVER_ERROR')).toBe('backend');
      expect(resolveErrorSource('API_KEY_MISSING')).toBe('backend');
      expect(resolveErrorSource()).toBe('backend');
    });
  });

  describe('2. Respuestas HTTP con Estructura de Diagnóstico', () => {
    it('error de validación incluye source: validation y requestId', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'no-es-un-email' }); // falta password y email inválido

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.source).toBe('validation');
      expect(response.body.error.requestId).toBeDefined();
    });

    it('error de autenticación incluye source: auth y requestId', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer token_invalido_de_prueba');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.source).toBe('auth');
      expect(response.body.error.requestId).toBeDefined();
    });

    it('JSON malformado incluye source: validation y requestId', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "incompleto"'); // JSON roto

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_JSON');
      expect(response.body.error.source).toBe('validation');
      expect(response.body.error.requestId).toBeDefined();
    });

    it('ningún error expone stack trace ni secretos internos', async () => {
      const response = await request(app)
        .post('/api/v1/ai/process')
        .send({ text: 'prueba' }); // falta token

      expect(response.body.stack).toBeUndefined();
      expect(response.body.error.stack).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('gsk_');
      expect(JSON.stringify(response.body)).not.toContain('postgres://');
    });
  });
});
