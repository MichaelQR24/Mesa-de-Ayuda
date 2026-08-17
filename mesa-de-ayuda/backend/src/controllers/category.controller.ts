import { Request, Response, NextFunction } from 'express';
import { categoryRepository } from '../repositories/category.repository.js';

export const getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await categoryRepository.findAll();

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};
