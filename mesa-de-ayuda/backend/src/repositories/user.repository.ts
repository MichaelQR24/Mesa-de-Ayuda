import { prisma } from '../lib/prisma.js';
import { User, UserRole, UserStatus } from '@prisma/client';

export interface CreateUserData {
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  status?: UserStatus;
  mustChangePassword?: boolean;
}

export type SafeUser = Omit<User, 'passwordHash'>;

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
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
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
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
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
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<SafeUser> {
    return prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async findMany(): Promise<SafeUser[]> {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(): Promise<number> {
    return prisma.user.count();
  }
}

export const userRepository = new UserRepository();
