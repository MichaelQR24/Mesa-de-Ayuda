import { Request, Response, NextFunction } from 'express';
import { aiProcessSchema } from '../schemas/ai.schema.js';
import { aiService } from '../services/ai.service.js';

export const processAiText = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedInput = aiProcessSchema.parse(req.body);
    const userId = req.user?.id ?? null;

    const result = await aiService.processText({
      ...validatedInput,
      userId,
    });

    res.status(200).json({
      success: true,
      data: {
        result: result.result,
        model: result.model,
        usage: result.usage,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleAiProcess = processAiText;
