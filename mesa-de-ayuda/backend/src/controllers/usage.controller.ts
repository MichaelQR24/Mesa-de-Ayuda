import { Request, Response, NextFunction } from 'express';
import { usageService } from '../services/usage.service.js';

export const getUsageSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const summary = await usageService.getSummaryMetrics();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserUsage = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userMetrics = await usageService.getUserUsageList();
    res.status(200).json({
      success: true,
      data: userMetrics,
    });
  } catch (error) {
    next(error);
  }
};
