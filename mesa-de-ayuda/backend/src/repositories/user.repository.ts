import { prisma } from '../lib/prisma.js';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';

export interface CreateUserData {
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  status?: UserStatus;
  mustChangePassword?: boolean;
  monthlyTokenLimit?: number | null;
  saveAiHistory?: boolean;
}

export interface SafeUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  monthlyTokenLimit: number | null;
  saveAiHistory: boolean;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FindUsersOptions {
  limit?: number;
  offset?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  mustChangePassword: true,
  monthlyTokenLimit: true,
  saveAiHistory: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
};

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findSafeById(id: string): Promise<SafeUser | null> {
    return prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  }

  async countActiveAdmins(): Promise<number> {
    return prisma.user.count({
      where: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async create(data: CreateUserData): Promise<SafeUser> {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        role: data.role,
        status: data.status ?? UserStatus.ACTIVE,
        mustChangePassword: data.mustChangePassword ?? true,
        monthlyTokenLimit: data.monthlyTokenLimit ?? null,
        saveAiHistory: data.saveAiHistory ?? true,
      },
      select: safeUserSelect,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<SafeUser> {
    return prisma.user.update({
      where: { id },
      data,
      select: safeUserSelect,
    });
  }

  async updatePrivacyPreferences(id: string, saveAiHistory: boolean): Promise<SafeUser> {
    return prisma.user.update({
      where: { id },
      data: { saveAiHistory },
      select: safeUserSelect,
    });
  }

  async updatePassword(id: string, passwordHash: string, mustChangePassword = false): Promise<SafeUser> {
    return prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword,
        passwordChangedAt: new Date(),
      },
      select: safeUserSelect,
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<SafeUser> {
    return prisma.user.update({
      where: { id },
      data: { status },
      select: safeUserSelect,
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async findMany(options: FindUsersOptions = {}): Promise<{ items: SafeUser[]; total: number }> {
    const limit = Math.min(options.limit ?? 50, 100);
    const offset = options.offset ?? 0;

    const where: Prisma.UserWhereInput = {};

    if (options.role) {
      where.role = options.role;
    }
    if (options.status) {
      where.status = options.status;
    }
    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        select: safeUserSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async count(): Promise<number> {
    return prisma.user.count();
  }
}

export const userRepository = new UserRepository();
