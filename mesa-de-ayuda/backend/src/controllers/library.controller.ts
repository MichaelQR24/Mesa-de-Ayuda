import { Request, Response, NextFunction } from 'express';
import { libraryQuerySchema, createLibraryItemSchema, updateLibraryItemSchema } from '../schemas/library.schema.js';
import { libraryRepository } from '../repositories/library.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { UserRole } from '@prisma/client';

export const getLibraryItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = libraryQuerySchema.parse(req.query);
    const userId = req.user?.id;

    const items = await libraryRepository.findMany({
      ...filters,
      userId,
    });

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

export const createLibraryItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = createLibraryItemSchema.parse(req.body);
    const user = req.user;

    const categoryExists = await categoryRepository.findById(input.categoryId);
    if (!categoryExists) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'La categoría especificada no existe',
        },
      });
      return;
    }

    // Solo el ADMIN puede crear plantillas compartidas del equipo
    const isShared = user?.role === UserRole.ADMIN ? (input.isShared ?? false) : false;

    const newItem = await libraryRepository.create({
      ...input,
      isShared,
      userId: user?.id ?? null,
    });

    res.status(201).json({
      success: true,
      data: newItem,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLibraryItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID no proporcionado' } });
      return;
    }
    const input = updateLibraryItemSchema.parse(req.body);
    const user = req.user;

    const existing = await libraryRepository.findById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'La plantilla especificada no existe',
        },
      });
      return;
    }

    // Verificar ownership: solo el creador o un ADMIN pueden editar
    if (existing.userId && existing.userId !== user?.id && user?.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No posee permisos para modificar este elemento de la biblioteca.',
        },
      });
      return;
    }

    if (input.categoryId) {
      const categoryExists = await categoryRepository.findById(input.categoryId);
      if (!categoryExists) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'La categoría especificada no existe',
          },
        });
        return;
      }
    }

    // Solo ADMIN puede alterar isShared
    let updateData = { ...input };
    if (user?.role !== UserRole.ADMIN) {
      delete updateData.isShared;
    }

    const updated = await libraryRepository.update(id, updateData);

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLibraryItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID no proporcionado' } });
      return;
    }
    const user = req.user;

    const existing = await libraryRepository.findById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'La plantilla especificada no existe o ya fue eliminada',
        },
      });
      return;
    }

    // Verificar ownership
    if (existing.userId && existing.userId !== user?.id && user?.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No posee permisos para eliminar este elemento de la biblioteca.',
        },
      });
      return;
    }

    await libraryRepository.delete(id);

    res.status(200).json({
      success: true,
      data: {
        message: 'Plantilla eliminada correctamente',
      },
    });
  } catch (error) {
    next(error);
  }
};
