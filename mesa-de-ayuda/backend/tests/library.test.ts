import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { libraryRepository } from '../src/repositories/library.repository.js';
import { categoryRepository } from '../src/repositories/category.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('Library and Category Endpoints', () => {
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

  describe('GET /api/v1/categories', () => {
    it('debe devolver 401 si no está autenticado', async () => {
      const response = await request(app).get('/api/v1/categories');
      expect(response.status).toBe(401);
    });

    it('debe devolver la lista de categorías cuando está autenticado', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Contraseñas', createdAt: new Date(), updatedAt: new Date() },
        { id: 'cat-2', name: 'Accesos', createdAt: new Date(), updatedAt: new Date() },
      ];

      vi.spyOn(categoryRepository, 'findAll').mockResolvedValueOnce(mockCategories);

      const response = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Contraseñas');
    });
  });

  describe('GET /api/v1/library', () => {
    it('debe devolver la lista de plantillas de biblioteca del usuario', async () => {
      const mockItems = [
        {
          id: 'item-1',
          userId: 'user-1',
          categoryId: 'cat-1',
          title: 'Plantilla 1',
          content: 'Contenido de prueba',
          isShared: true,
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: 'cat-1', name: 'Contraseñas' },
        },
      ];

      vi.spyOn(libraryRepository, 'findMany').mockResolvedValueOnce(mockItems);

      const response = await request(app)
        .get('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/v1/library', () => {
    it('debe crear un nuevo item de biblioteca asociado al usuario autenticado', async () => {
      vi.spyOn(categoryRepository, 'findById').mockResolvedValueOnce({
        id: 'cat-1',
        name: 'Contraseñas',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockCreated = {
        id: 'item-new',
        userId: 'user-1',
        categoryId: 'cat-1',
        title: 'Nueva plantilla',
        content: 'Texto guardado',
        isShared: false,
        isFavorite: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'Contraseñas' },
      };

      vi.spyOn(libraryRepository, 'create').mockResolvedValueOnce(mockCreated);

      const response = await request(app)
        .post('/api/v1/library')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Nueva plantilla',
          content: 'Texto guardado',
          categoryId: 'cat-1',
          isFavorite: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Nueva plantilla');
    });
  });

  describe('PATCH /api/v1/library/:id', () => {
    it('debe actualizar isFavorite si el item pertenece al usuario', async () => {
      vi.spyOn(libraryRepository, 'findById').mockResolvedValueOnce({
        id: 'item-1',
        userId: 'user-1',
        categoryId: 'cat-1',
        title: 'Plantilla 1',
        content: 'Contenido',
        isShared: false,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'Contraseñas' },
      });

      const mockUpdated = {
        id: 'item-1',
        userId: 'user-1',
        categoryId: 'cat-1',
        title: 'Plantilla 1',
        content: 'Contenido',
        isShared: false,
        isFavorite: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'Contraseñas' },
      };

      vi.spyOn(libraryRepository, 'update').mockResolvedValueOnce(mockUpdated);

      const response = await request(app)
        .patch('/api/v1/library/item-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isFavorite: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isFavorite).toBe(true);
    });

    it('debe devolver 403 si un usuario intenta modificar un item privado de otro usuario', async () => {
      vi.spyOn(libraryRepository, 'findById').mockResolvedValueOnce({
        id: 'item-other',
        userId: 'user-other-person',
        categoryId: 'cat-1',
        title: 'Plantilla Ajena',
        content: 'Contenido privado',
        isShared: false,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'Contraseñas' },
      });

      const response = await request(app)
        .patch('/api/v1/library/item-other')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isFavorite: true });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});
