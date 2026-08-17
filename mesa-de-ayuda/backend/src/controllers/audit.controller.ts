import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { auditRepository } from '../repositories/audit.repository.js';

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.string().trim().optional(),
  actorUserId: z.string().trim().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = auditQuerySchema.parse(req.query);
    const result = await auditRepository.findMany(query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
