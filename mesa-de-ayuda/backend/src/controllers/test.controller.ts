import { Request, Response, NextFunction } from 'express';
import { testSchema } from '../schemas/test.schema.js';

export const handleTestPost = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const validatedData = testSchema.parse(req.body);

    res.status(200).json({
      success: true,
      data: {
        receivedText: validatedData.text,
        message: 'Backend conectado correctamente',
      },
    });
  } catch (error) {
    next(error);
  }
};
