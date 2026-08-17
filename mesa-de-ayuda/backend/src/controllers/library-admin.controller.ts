import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { createLibraryItemSchema, updateLibraryItemSchema } from '../schemas/library.schema.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';

export const listSharedLibrary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const items = await prisma.libraryItem.findMany({
      where: { isShared: true },
      include: {
        category: { select: { id: true, name: true } },
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

export const createSharedLibraryItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = createLibraryItemSchema.parse(req.body);
    const actor = req.user;

    const categoryExists = await categoryRepository.findById(input.categoryId);
    if (!categoryExists) {
      res.status(400).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'La categoría especificada no existe.' },
      });
      return;
    }

    const newItem = await prisma.libraryItem.create({
      data: {
        title: input.title,
        content: input.content,
        categoryId: input.categoryId,
        isShared: true, // Forzado a true en endpoint admin
        isFavorite: input.isFavorite ?? false,
        userId: actor?.id ?? null,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (actor) {
      await auditRepository.create({
        actorUserId: actor.id,
        action: 'SHARED_TEMPLATE_CREATED',
        targetType: 'LIBRARY_ITEM',
        targetId: newItem.id,
        metadata: {
          title: newItem.title,
          categoryName: newItem.category.name,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: newItem,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSharedLibraryItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = updateLibraryItemSchema.parse(req.body);
    const actor = req.user;

    const existing = await prisma.libraryItem.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'ITEM_NOT_FOUND', message: 'La plantilla especificada no existe.' },
      });
      return;
    }

    const updated = await prisma.libraryItem.update({
      where: { id },
      data: {
        title: input.title,
        content: input.content,
        categoryId: input.categoryId,
        isShared: true,
        isFavorite: input.isFavorite,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (actor) {
      await auditRepository.create({
        actorUserId: actor.id,
        action: 'SHARED_TEMPLATE_UPDATED',
        targetType: 'LIBRARY_ITEM',
        targetId: updated.id,
        metadata: {
          title: updated.title,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSharedLibraryItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actor = req.user;

    const existing = await prisma.libraryItem.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'ITEM_NOT_FOUND', message: 'La plantilla no existe o ya fue eliminada.' },
      });
      return;
    }

    await prisma.libraryItem.delete({ where: { id } });

    if (actor) {
      await auditRepository.create({
        actorUserId: actor.id,
        action: 'SHARED_TEMPLATE_DELETED',
        targetType: 'LIBRARY_ITEM',
        targetId: id,
        metadata: {
          title: existing.title,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Plantilla compartida eliminada correctamente.',
      },
    });
  } catch (error) {
    next(error);
  }
};
