import { prisma } from '../lib/prisma.js';

export interface CreateQuickTextData {
  userId: string;
  title: string;
  header: string;
  body: string;
  solution?: string | null;
  isShared?: boolean;
}

export interface UpdateQuickTextData {
  title?: string;
  header?: string;
  body?: string;
  solution?: string | null;
  isShared?: boolean;
}

export class QuickTextRepository {
  async findVisibleForUser(userId: string) {
    return prisma.quickText.findMany({
      where: {
        OR: [
          { userId },
          { isShared: true },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserId(userId: string) {
    return prisma.quickText.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.quickText.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
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
        isShared: data.isShared ?? false,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateQuickTextData) {
    return prisma.quickText.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.quickText.delete({
      where: { id },
    });
  }
}

export const quickTextRepository = new QuickTextRepository();
