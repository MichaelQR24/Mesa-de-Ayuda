import { prisma } from '../lib/prisma.js';
import { LibraryItem, Prisma } from '@prisma/client';

export interface CreateLibraryItemDto {
  userId?: string | null;
  categoryId: string;
  title: string;
  content: string;
  isShared?: boolean;
  isFavorite?: boolean;
}

export interface UpdateLibraryItemDto {
  categoryId?: string;
  title?: string;
  content?: string;
  isShared?: boolean;
  isFavorite?: boolean;
}

export interface LibraryFilterOptions {
  userId?: string;
  categoryId?: string;
  isShared?: boolean;
  isFavorite?: boolean;
}

export class LibraryRepository {
  async findMany(filters: LibraryFilterOptions = {}): Promise<Array<LibraryItem & { category: { id: string; name: string } }>> {
    const conditions: Prisma.LibraryItemWhereInput[] = [];

    // Ownership: el usuario ve sus elementos personales O los elementos compartidos
    if (filters.userId) {
      conditions.push({
        OR: [
          { userId: filters.userId },
          { isShared: true },
        ],
      });
    }

    if (filters.categoryId) {
      conditions.push({ categoryId: filters.categoryId });
    }
    if (typeof filters.isShared === 'boolean') {
      conditions.push({ isShared: filters.isShared });
    }
    if (typeof filters.isFavorite === 'boolean') {
      conditions.push({ isFavorite: filters.isFavorite });
    }

    const where: Prisma.LibraryItemWhereInput = conditions.length > 0 ? { AND: conditions } : {};

    return prisma.libraryItem.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<(LibraryItem & { category: { id: string; name: string } }) | null> {
    return prisma.libraryItem.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async create(data: CreateLibraryItemDto): Promise<LibraryItem & { category: { id: string; name: string } }> {
    return prisma.libraryItem.create({
      data: {
        userId: data.userId ?? null,
        categoryId: data.categoryId,
        title: data.title,
        content: data.content,
        isShared: data.isShared ?? false,
        isFavorite: data.isFavorite ?? false,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateLibraryItemDto): Promise<(LibraryItem & { category: { id: string; name: string } }) | null> {
    const existing = await prisma.libraryItem.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.libraryItem.update({
      where: { id },
      data,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async delete(id: string): Promise<boolean> {
    const existing = await prisma.libraryItem.findUnique({ where: { id } });
    if (!existing) return false;

    await prisma.libraryItem.delete({ where: { id } });
    return true;
  }
}

export const libraryRepository = new LibraryRepository();
