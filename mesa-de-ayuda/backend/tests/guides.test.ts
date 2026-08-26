import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { guideRepository } from '../src/repositories/guide.repository.js';
import { auditRepository } from '../src/repositories/audit.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Módulo de Guías Visuales (Visual Guides)', () => {
  const adminToken = generateAccessToken({
    sub: 'admin-user',
    email: 'admin@empresa.com',
    displayName: 'Administrador',
    role: UserRole.ADMIN,
    mustChangePassword: false,
  });

  const userToken = generateAccessToken({
    sub: 'normal-user',
    email: 'user@empresa.com',
    displayName: 'Operador Soporte',
    role: UserRole.USER,
    mustChangePassword: false,
  });

  // Buffer PNG válido sintético (16 bytes con Magic Bytes 0x89 50 4E 47 0D 0A 1A 0A)
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const validPngBase64 = `data:image/png;base64,${validPngBuffer.toString('base64')}`;

  // Buffer falso renombrado a PNG (contenido HTML)
  const fakePngBuffer = Buffer.from('<html><body>Contenido malicioso falso</body></html>');
  const fakePngBase64 = `data:image/png;base64,${fakePngBuffer.toString('base64')}`;

  // Buffer inválido SVG
  const invalidBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>SVG</text></svg>');
  const invalidBase64 = `data:image/svg+xml;base64,${invalidBuffer.toString('base64')}`;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditRepository, 'create').mockResolvedValue({} as any);

    vi.spyOn(userRepository, 'findSafeById').mockImplementation(async (id: string) => {
      if (id === 'admin-user') {
        return {
          id: 'admin-user',
          email: 'admin@empresa.com',
          displayName: 'Administrador',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          monthlyTokenLimit: null,
          saveAiHistory: true,
          lastLoginAt: new Date(),
          passwordChangedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      if (id === 'normal-user') {
        return {
          id: 'normal-user',
          email: 'user@empresa.com',
          displayName: 'Operador Soporte',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          monthlyTokenLimit: null,
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

  // 1. GET /api/v1/guides sin token -> 401
  it('1. Rechaza peticiones no autenticadas a GET /api/v1/guides con 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/guides');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // 2. GET /api/v1/guides con USER -> 200
  it('2. Permite a un usuario USER listar guías con 200 OK', async () => {
    vi.spyOn(guideRepository, 'findAll').mockResolvedValue([
      {
        id: 'guide-1',
        title: 'Renovación de Certificado Digital',
        description: 'Paso a paso para renovar token',
        keywords: ['certificado', 'firma'],
        imagePath: 'guides/mock.png',
        createdById: 'admin-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: { id: 'admin-user', displayName: 'Administrador' },
      } as any,
    ]);

    const res = await request(app)
      .get('/api/v1/guides')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].title).toBe('Renovación de Certificado Digital');
  });

  // 3. GET /api/v1/guides con ADMIN -> 200
  it('3. Permite a un usuario ADMIN listar guías con 200 OK', async () => {
    vi.spyOn(guideRepository, 'findAll').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/guides')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // 4. POST /api/v1/admin/guides con USER -> 403
  it('4. Impide a un usuario USER crear guías con 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/admin/guides')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Test Guía por User',
        keywords: ['firma', 'digital'],
        imageBase64: validPngBase64,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // 5. POST /api/v1/admin/guides con ADMIN -> 201
  it('5. Permite a un ADMIN crear una guía correctamente', async () => {
    vi.spyOn(guideRepository, 'create').mockResolvedValue({
      id: 'guide-new-uuid',
      title: 'Configuración de VPN',
      description: 'Procedimiento visual para clientes remotos',
      keywords: ['vpn', 'redes', 'fortinet'],
      imagePath: 'guides/vpn-guide.png',
      createdById: 'admin-user',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { id: 'admin-user', displayName: 'Administrador' },
    } as any);

    const res = await request(app)
      .post('/api/v1/admin/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Configuración de VPN',
        description: 'Procedimiento visual para clientes remotos',
        keywords: ['vpn', 'redes', 'fortinet'],
        imageBase64: validPngBase64,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('guide-new-uuid');
    expect(res.body.data.title).toBe('Configuración de VPN');
  });

  // 6. Imagen válida pequeña -> aceptada
  it('6. Acepta una imagen pequeña con magic bytes válidos', async () => {
    vi.spyOn(guideRepository, 'create').mockResolvedValue({
      id: 'guide-small-uuid',
      title: 'Imagen PNG pequeña',
      description: '',
      keywords: ['pequeña'],
      imagePath: 'guides/small.png',
      createdById: 'admin-user',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { id: 'admin-user', displayName: 'Administrador' },
    } as any);

    const res = await request(app)
      .post('/api/v1/admin/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Imagen PNG pequeña',
        keywords: ['pequeña'],
        imageBase64: validPngBase64,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // 7. Imagen >5 MB -> 413 PAYLOAD_TOO_LARGE
  it('7. Rechaza imágenes decodificadas mayores a 5 MB con HTTP 413 PAYLOAD_TOO_LARGE', async () => {
    // Buffer sintético mayor a 5 MB (5.1 MB = 5,347,737 bytes) con cabecera PNG válida
    const oversizeBuffer = Buffer.alloc(5.1 * 1024 * 1024);
    oversizeBuffer[0] = 0x89;
    oversizeBuffer[1] = 0x50;
    oversizeBuffer[2] = 0x4e;
    oversizeBuffer[3] = 0x47;
    const oversizeBase64 = `data:image/png;base64,${oversizeBuffer.toString('base64')}`;

    const res = await request(app)
      .post('/api/v1/admin/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Imagen Grande 5.1MB',
        keywords: ['pesada'],
        imageBase64: oversizeBase64,
      });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.message).toBe('La imagen supera el tamaño máximo permitido de 5 MB.');
    expect(res.body.error.source).toBe('validation');
  });

  // 8. Archivo falso renombrado .png -> rechazado por magic bytes
  it('8. Rechaza archivo falso con extensión .png pero sin magic bytes válidos con 400 INVALID_IMAGE_FILE', async () => {
    const res = await request(app)
      .post('/api/v1/admin/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Falso PNG con HTML',
        keywords: ['seguridad'],
        imageBase64: fakePngBase64,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_IMAGE_FILE');
  });

  // 9. MIME no admitido -> rechazado con 400
  it('9. Rechaza formatos no permitidos (ej. SVG) con 400 INVALID_IMAGE_FILE', async () => {
    const res = await request(app)
      .post('/api/v1/admin/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test SVG Malicioso',
        keywords: ['svg'],
        imageBase64: invalidBase64,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_IMAGE_FILE');
  });

  // 10. Payload HTTP masivo que exceda el límite del parser -> 413 estructurado y NO 500
  it('10. Responde 413 PAYLOAD_TOO_LARGE estructurado (y NO 500) si el body HTTP excede el límite', async () => {
    // Payload masivo de 12 MB que supera el límite de body-parser
    const hugeBuffer = Buffer.alloc(12 * 1024 * 1024, 'a');

    const res = await request(app)
      .post('/api/v1/admin/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send(`{"title":"Huge","keywords":["huge"],"imageBase64":"${hugeBuffer.toString('base64')}"}`);

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.source).toBe('validation');
    expect(res.body.error.message).toBe('La imagen supera el tamaño máximo permitido de 5 MB.');
  });
});
