import { guideRepository } from '../repositories/guide.repository.js';
import { storageService } from './storage.service.js';
import { auditRepository } from '../repositories/audit.repository.js';

export class GuideService {
  async getGuides(query?: string) {
    const guides = await guideRepository.findAll(query);

    // Adjuntar signed URLs temporales para visualización
    return Promise.all(
      guides.map(async (g) => ({
        id: g.id,
        title: g.title,
        description: g.description || '',
        keywords: g.keywords,
        imagePath: g.imagePath,
        imageUrl: await storageService.getSignedImageUrl(g.imagePath, 3600),
        createdById: g.createdById,
        authorName: g.createdBy?.displayName || 'Administrador',
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }))
    );
  }

  async getGuideById(id: string) {
    const guide = await guideRepository.findById(id);
    if (!guide) {
      const err = new Error('Guía visual no encontrada.');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    return {
      id: guide.id,
      title: guide.title,
      description: guide.description || '',
      keywords: guide.keywords,
      imagePath: guide.imagePath,
      imageUrl: await storageService.getSignedImageUrl(guide.imagePath, 7200),
      createdById: guide.createdById,
      authorName: guide.createdBy?.displayName || 'Administrador',
      createdAt: guide.createdAt,
      updatedAt: guide.updatedAt,
    };
  }

  async createGuide(
    actorUserId: string,
    data: {
      title: string;
      description?: string;
      keywords: string[];
      imageBuffer: Buffer;
    }
  ) {
    // 1. Subir imagen al Storage seguro
    const uploadResult = await storageService.uploadGuideImage(data.imageBuffer);

    // 2. Persistir metadatos en Base de Datos
    const created = await guideRepository.create({
      title: data.title,
      description: data.description,
      keywords: data.keywords,
      imagePath: uploadResult.imagePath,
      createdById: actorUserId,
    });

    // 3. Registrar auditoría
    try {
      await auditRepository.create({
        actorUserId,
        action: 'GUIDE_CREATED',
        targetType: 'VISUAL_GUIDE',
        targetId: created.id,
        metadata: { title: created.title, keywords: created.keywords },
      });
    } catch {
      // Ignorar fallo secundario de auditoría
    }

    return {
      id: created.id,
      title: created.title,
      description: created.description || '',
      keywords: created.keywords,
      imagePath: created.imagePath,
      imageUrl: await storageService.getSignedImageUrl(created.imagePath, 3600),
      createdById: created.createdById,
      authorName: created.createdBy?.displayName || 'Administrador',
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateGuide(
    actorUserId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      keywords?: string[];
      imageBuffer?: Buffer;
    }
  ) {
    const existing = await guideRepository.findById(id);
    if (!existing) {
      const err = new Error('Guía visual no encontrada.');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    let newImagePath: string | undefined;
    const oldImagePath = existing.imagePath;

    // Si se subió una nueva imagen para reemplazo
    if (data.imageBuffer) {
      const uploadResult = await storageService.uploadGuideImage(data.imageBuffer);
      newImagePath = uploadResult.imagePath;
    }

    // Actualizar metadatos en DB
    const updated = await guideRepository.update(id, {
      title: data.title,
      description: data.description,
      keywords: data.keywords,
      imagePath: newImagePath,
    });

    // Si se actualizó la imagen con éxito, eliminar la imagen anterior de Storage
    if (newImagePath && oldImagePath && newImagePath !== oldImagePath) {
      await storageService.deleteGuideImage(oldImagePath).catch(() => {});
    }

    // Registrar auditoría
    try {
      await auditRepository.create({
        actorUserId,
        action: 'GUIDE_UPDATED',
        targetType: 'VISUAL_GUIDE',
        targetId: id,
        metadata: { title: updated.title, imageReplaced: Boolean(newImagePath) },
      });
    } catch {
      // Ignorar fallo secundario
    }

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description || '',
      keywords: updated.keywords,
      imagePath: updated.imagePath,
      imageUrl: await storageService.getSignedImageUrl(updated.imagePath, 3600),
      createdById: updated.createdById,
      authorName: updated.createdBy?.displayName || 'Administrador',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteGuide(actorUserId: string, id: string) {
    const existing = await guideRepository.findById(id);
    if (!existing) {
      const err = new Error('Guía visual no encontrada.');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    await guideRepository.delete(id);

    // Eliminar archivo físico de Storage
    if (existing.imagePath) {
      await storageService.deleteGuideImage(existing.imagePath).catch(() => {});
    }

    // Registrar auditoría
    try {
      await auditRepository.create({
        actorUserId,
        action: 'GUIDE_DELETED',
        targetType: 'VISUAL_GUIDE',
        targetId: id,
        metadata: { title: existing.title },
      });
    } catch {
      // Ignorar
    }

    return { message: 'Guía visual eliminada correctamente.' };
  }
}

export const guideService = new GuideService();
