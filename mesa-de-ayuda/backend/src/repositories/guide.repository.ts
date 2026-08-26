import { prisma } from '../lib/prisma.js';

export interface CreateGuideData {
  title: string;
  description?: string;
  keywords: string[];
  imagePath: string;
  createdById: string;
}

export interface UpdateGuideData {
  title?: string;
  description?: string;
  keywords?: string[];
  imagePath?: string;
}

export class GuideRepository {
  async findAll(query?: string) {
    if (query && query.trim()) {
      const q = query.trim();
      return prisma.visualGuide.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { keywords: { hasSome: [q, q.toLowerCase(), q.toUpperCase()] } },
          ],
        },
        include: {
          createdBy: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return prisma.visualGuide.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.visualGuide.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  async create(data: CreateGuideData) {
    return prisma.visualGuide.create({
      data: {
        title: data.title,
        description: data.description ?? '',
        keywords: data.keywords,
        imagePath: data.imagePath,
        createdById: data.createdById,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateGuideData) {
    return prisma.visualGuide.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.visualGuide.delete({
      where: { id },
    });
  }
}

export const guideRepository = new GuideRepository();
