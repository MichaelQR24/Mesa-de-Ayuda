import { prisma } from '../lib/prisma.js';

export interface CreateQuickTextData {
  userId: string;
  title: string;
  header: string;
  body: string;
  solution?: string | null;
}

export interface UpdateQuickTextData {
  title?: string;
  header?: string;
  body?: string;
  solution?: string | null;
}

export class QuickTextRepository {
  async findByUserId(userId: string) {
    return prisma.quickText.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.quickText.findUnique({
      where: { id },
    });
  }

  async create(data: CreateQuickTextData) {
    return prisma.quickText.create({
      data: {
        userId: data.userId,
        title: data.title,
        header: data.header,
        body: data.body,
        solution: data.solution ?? '',
      },
    });
  }

  async update(id: string, data: UpdateQuickTextData) {
    return prisma.quickText.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.quickText.delete({
      where: { id },
    });
  }
}

export const quickTextRepository = new QuickTextRepository();
