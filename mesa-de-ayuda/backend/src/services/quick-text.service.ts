import { quickTextRepository, CreateQuickTextData, UpdateQuickTextData } from '../repositories/quick-text.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';

export class QuickTextService {
  async getQuickTextsByUser(userId: string) {
    return quickTextRepository.findByUserId(userId);
  }

  async createQuickText(data: CreateQuickTextData) {
    const created = await quickTextRepository.create(data);

    try {
      await auditRepository.create({
        actorUserId: data.userId,
        action: 'QUICK_TEXT_CREATED',
        targetType: 'QUICK_TEXT',
        targetId: created.id,
        metadata: { title: created.title },
      });
    } catch {
      // No bloquear flujo principal si auditoría falla
    }

    return created;
  }

  async updateQuickText(id: string, userId: string, data: UpdateQuickTextData) {
    const existing = await quickTextRepository.findById(id);
    if (!existing) {
      const err = new Error('Texto rápido no encontrado.');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Ownership estricto
    if (existing.userId !== userId) {
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
        metadata: { title: updated.title },
      });
    } catch {
      // Ignorar fallo de auditoría
    }

    return updated;
  }

  async deleteQuickText(id: string, userId: string) {
    const existing = await quickTextRepository.findById(id);
    if (!existing) {
      const err = new Error('Texto rápido no encontrado.');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Ownership estricto
    if (existing.userId !== userId) {
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
