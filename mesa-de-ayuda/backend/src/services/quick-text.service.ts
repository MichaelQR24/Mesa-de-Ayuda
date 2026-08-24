import { quickTextRepository, CreateQuickTextData, UpdateQuickTextData } from '../repositories/quick-text.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { UserRole } from '@prisma/client';

export class QuickTextService {
  async getQuickTexts(userId: string) {
    const items = await quickTextRepository.findVisibleForUser(userId);

    return items.map((item) => ({
      id: item.id,
      userId: item.userId,
      title: item.title,
      header: item.header,
      body: item.body,
      solution: item.solution || '',
      isShared: item.isShared,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isOwner: item.userId === userId,
      ownerDisplayName: item.user?.displayName || 'Usuario',
    }));
  }

  async createQuickText(data: CreateQuickTextData) {
    const created = await quickTextRepository.create(data);

    try {
      await auditRepository.create({
        actorUserId: data.userId,
        action: 'QUICK_TEXT_CREATED',
        targetType: 'QUICK_TEXT',
        targetId: created.id,
        metadata: { title: created.title, isShared: created.isShared },
      });
    } catch {
      // No bloquear flujo principal si auditoría falla
    }

    return {
      id: created.id,
      userId: created.userId,
      title: created.title,
      header: created.header,
      body: created.body,
      solution: created.solution || '',
      isShared: created.isShared,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      isOwner: true,
      ownerDisplayName: created.user?.displayName || 'Usuario',
    };
  }

  async updateQuickText(id: string, userId: string, userRole: UserRole, data: UpdateQuickTextData) {
    const existing = await quickTextRepository.findById(id);
    if (!existing) {
      const err = new Error('Texto rápido no encontrado.');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Ownership estricto: solo el creador (o un ADMIN) puede modificar el texto
    if (existing.userId !== userId && userRole !== UserRole.ADMIN) {
      const err = new Error('No tienes permisos para modificar este texto rápido.');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const updated = await quickTextRepository.update(id, data);

    try {
      await auditRepository.create({
        actorUserId: userId,
        action: 'QUICK_TEXT_UPDATED',
        targetType: 'QUICK_TEXT',
        targetId: id,
        metadata: { title: updated.title, isShared: updated.isShared },
      });
    } catch {
      // Ignorar fallo de auditoría
    }

    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      header: updated.header,
      body: updated.body,
      solution: updated.solution || '',
      isShared: updated.isShared,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      isOwner: updated.userId === userId,
      ownerDisplayName: updated.user?.displayName || 'Usuario',
    };
  }

  async deleteQuickText(id: string, userId: string, userRole: UserRole) {
    const existing = await quickTextRepository.findById(id);
    if (!existing) {
      const err = new Error('Texto rápido no encontrado.');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Ownership estricto: solo el creador (o un ADMIN) puede eliminar el texto
    if (existing.userId !== userId && userRole !== UserRole.ADMIN) {
      const err = new Error('No tienes permisos para eliminar este texto rápido.');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    await quickTextRepository.delete(id);

    try {
      await auditRepository.create({
        actorUserId: userId,
        action: 'QUICK_TEXT_DELETED',
        targetType: 'QUICK_TEXT',
        targetId: id,
        metadata: { title: existing.title },
      });
    } catch {
      // Ignorar fallo de auditoría
    }

    return { message: 'Texto rápido eliminado correctamente.' };
  }
}

export const quickTextService = new QuickTextService();
