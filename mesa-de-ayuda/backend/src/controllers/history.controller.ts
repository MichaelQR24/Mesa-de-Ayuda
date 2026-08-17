import { Request, Response, NextFunction } from 'express';
import { historyQuerySchema } from '../schemas/history.schema.js';
import { historyRepository } from '../repositories/history.repository.js';

export const getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit, offset } = historyQuerySchema.parse(req.query);
    const userId = req.user?.id;

    const { items, total } = await historyRepository.findMany({ userId, limit, offset });

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
};
