import { Request, Response } from 'express';
import { quickTextService } from '../services/quick-text.service.js';
import { createQuickTextSchema, updateQuickTextSchema } from '../schemas/quick-text.schema.js';

export class QuickTextController {
  async getQuickTexts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const items = await quickTextService.getQuickTextsByUser(userId);

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'SERVER_ERROR',
          message: error.message || 'Error al obtener los textos rápidos.',
        },
      });
    }
  }

  async createQuickText(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const parsed = createQuickTextSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message || 'Datos de entrada inválidos.',
            details: parsed.error.format(),
          },
        });
        return;
      }

      const item = await quickTextService.createQuickText({
        userId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'SERVER_ERROR',
          message: error.message || 'Error al crear el texto rápido.',
        },
      });
    }
  }

  async updateQuickText(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const id = String(req.params.id);

      const parsed = updateQuickTextSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message || 'Datos de actualización inválidos.',
            details: parsed.error.format(),
          },
        });
        return;
      }

      const updated = await quickTextService.updateQuickText(id, userId, parsed.data);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'SERVER_ERROR',
          message: error.message || 'Error al actualizar el texto rápido.',
        },
      });
    }
  }

  async deleteQuickText(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const id = String(req.params.id);

      const result = await quickTextService.deleteQuickText(id, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'SERVER_ERROR',
          message: error.message || 'Error al eliminar el texto rápido.',
        },
      });
    }
  }
}

export const quickTextController = new QuickTextController();
