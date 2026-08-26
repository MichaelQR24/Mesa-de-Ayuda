import { Request, Response } from 'express';
import { guideService } from '../services/guide.service.js';
import { createGuideSchema, updateGuideSchema } from '../schemas/guide.schema.js';

const parseBase64ToBuffer = (base64String: string): Buffer => {
  const cleanBase64 = base64String.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  return Buffer.from(cleanBase64, 'base64');
};

export class GuideController {
  async getGuides(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId;
    try {
      const query = (req.query.q as string) || (req.query.search as string) || undefined;
      const guides = await guideService.getGuides(query);

      res.status(200).json({
        success: true,
        data: guides,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      const code = error.code || 'SERVER_ERROR';
      const source = error.source || 'backend';
      res.status(statusCode).json({
        success: false,
        error: {
          code,
          message: error.message || 'Error al obtener las guías visuales.',
          source,
          requestId,
        },
      });
    }
  }

  async getGuideById(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId;
    try {
      const id = String(req.params.id);
      const guide = await guideService.getGuideById(id);

      res.status(200).json({
        success: true,
        data: guide,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      const code = error.code || 'SERVER_ERROR';
      const source = error.source || 'backend';
      res.status(statusCode).json({
        success: false,
        error: {
          code,
          message: error.message || 'Error al obtener la guía visual.',
          source,
          requestId,
        },
      });
    }
  }

  async createGuide(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId;
    try {
      const actorUserId = req.user!.id;
      const parsed = createGuideSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message || 'Datos de la guía inválidos.',
            source: 'validation',
            details: parsed.error.format(),
            requestId,
          },
        });
        return;
      }

      const imageBuffer = parseBase64ToBuffer(parsed.data.imageBase64);

      const guide = await guideService.createGuide(actorUserId, {
        title: parsed.data.title,
        description: parsed.data.description,
        keywords: parsed.data.keywords,
        imageBuffer,
      });

      res.status(201).json({
        success: true,
        data: guide,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      const code = error.code || 'SERVER_ERROR';
      const source = error.source || 'backend';
      res.status(statusCode).json({
        success: false,
        error: {
          code,
          message: error.message || 'Error al crear la guía visual.',
          source,
          requestId,
        },
      });
    }
  }

  async updateGuide(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId;
    try {
      const actorUserId = req.user!.id;
      const id = String(req.params.id);
      const parsed = updateGuideSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message || 'Datos de actualización inválidos.',
            source: 'validation',
            details: parsed.error.format(),
            requestId,
          },
        });
        return;
      }

      let imageBuffer: Buffer | undefined;
      if (parsed.data.imageBase64) {
        imageBuffer = parseBase64ToBuffer(parsed.data.imageBase64);
      }

      const updated = await guideService.updateGuide(actorUserId, id, {
        title: parsed.data.title,
        description: parsed.data.description,
        keywords: parsed.data.keywords,
        imageBuffer,
      });

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      const code = error.code || 'SERVER_ERROR';
      const source = error.source || 'backend';
      res.status(statusCode).json({
        success: false,
        error: {
          code,
          message: error.message || 'Error al actualizar la guía visual.',
          source,
          requestId,
        },
      });
    }
  }

  async deleteGuide(req: Request, res: Response): Promise<void> {
    const requestId = (req as any).requestId;
    try {
      const actorUserId = req.user!.id;
      const id = String(req.params.id);

      const result = await guideService.deleteGuide(actorUserId, id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      const code = error.code || 'SERVER_ERROR';
      const source = error.source || 'backend';
      res.status(statusCode).json({
        success: false,
        error: {
          code,
          message: error.message || 'Error al eliminar la guía visual.',
          source,
          requestId,
        },
      });
    }
  }
}

export const guideController = new GuideController();
