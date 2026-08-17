import { prisma } from '../lib/prisma.js';
import { Category } from '@prisma/client';

export class CategoryRepository {
  async findAll(): Promise<Category[]> {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { id },
    });
  }
}

export const categoryRepository = new CategoryRepository();
