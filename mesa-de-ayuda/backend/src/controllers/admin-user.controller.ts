import { Request, Response, NextFunction } from 'express';
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  resetUserPasswordSchema,
  updateUsageLimitSchema,
  userQuerySchema,
} from '../schemas/user.schema.js';
import { userRepository } from '../repositories/user.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { hashPassword } from '../utils/crypto.js';
import { UserRole, UserStatus } from '@prisma/client';

export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = userQuerySchema.parse(req.query);
    const result = await userRepository.findMany(query);

    res.status(200).json({
      success: true,
      data: {
        items: result.items,
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = createUserSchema.parse(req.body);
    const actor = req.user;

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Ya existe un usuario registrado con este correo electrónico.',
        },
      });
      return;
    }

    const passwordHash = await hashPassword(input.temporaryPassword);

    const newUser = await userRepository.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
      role: input.role,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      monthlyTokenLimit: input.monthlyTokenLimit ?? null,
    });

    if (actor) {
      await auditRepository.create({
        actorUserId: actor.id,
        action: 'USER_CREATED',
        targetType: 'USER',
        targetId: newUser.id,
        metadata: {
          email: newUser.email,
          displayName: newUser.displayName,
          role: newUser.role,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = updateUserSchema.parse(req.body);
    const actor = req.user;

    const user = await userRepository.findSafeById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'El usuario especificado no existe.',
        },
      });
      return;
    }

    // Protección del último Administrador
    if (input.role && input.role !== user.role && user.role === UserRole.ADMIN) {
      const activeAdmins = await userRepository.countActiveAdmins();
      if (activeAdmins <= 1 && user.status === UserStatus.ACTIVE) {
        res.status(400).json({
          success: false,
          error: {
            code: 'LAST_ADMIN_PROTECTED',
            message: 'No es posible revocar los privilegios del único administrador activo del sistema.',
          },
        });
        return;
      }
    }

    const updatedUser = await userRepository.update(id, input);

    if (actor) {
      const isRoleChange = input.role && input.role !== user.role;
      await auditRepository.create({
        actorUserId: actor.id,
        action: isRoleChange ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
        targetType: 'USER',
        targetId: updatedUser.id,
        metadata: {
          previousRole: user.role,
          newRole: updatedUser.role,
          displayName: updatedUser.displayName,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = updateUserStatusSchema.parse(req.body);
    const actor = req.user;

    const user = await userRepository.findSafeById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'El usuario especificado no existe.',
        },
      });
      return;
    }

    // Protección del último Administrador al desactivar
    if (input.status === UserStatus.INACTIVE && user.role === UserRole.ADMIN) {
      const activeAdmins = await userRepository.countActiveAdmins();
      if (activeAdmins <= 1 && user.status === UserStatus.ACTIVE) {
        res.status(400).json({
          success: false,
          error: {
            code: 'LAST_ADMIN_PROTECTED',
            message: 'No es posible desactivar al único administrador activo del sistema.',
          },
        });
        return;
      }
    }

    const updatedUser = await userRepository.updateStatus(id, input.status);

    // Si se desactiva, revocar de inmediato todas las sesiones activas
    if (input.status === UserStatus.INACTIVE) {
      await sessionRepository.revokeAllUserSessions(id);
    }

    if (actor) {
      await auditRepository.create({
        actorUserId: actor.id,
        action: input.status === UserStatus.ACTIVE ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        targetType: 'USER',
        targetId: updatedUser.id,
        metadata: {
          status: updatedUser.status,
          email: updatedUser.email,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = resetUserPasswordSchema.parse(req.body);
    const actor = req.user;

    const user = await userRepository.findSafeById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'El usuario especificado no existe.',
        },
      });
      return;
    }

    const passwordHash = await hashPassword(input.temporaryPassword);
    const updatedUser = await userRepository.updatePassword(id, passwordHash, true);

    // Revocar sesiones previas para forzar nuevo inicio con la clave temporal
    await sessionRepository.revokeAllUserSessions(id);

    if (actor) {
      await auditRepository.create({
        actorUserId: actor.id,
        action: 'USER_PASSWORD_RESET',
        targetType: 'USER',
        targetId: updatedUser.id,
        metadata: {
          email: updatedUser.email,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Contraseña temporal actualizada correctamente. El usuario deberá cambiarla al iniciar sesión.',
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUsageLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = updateUsageLimitSchema.parse(req.body);
    const actor = req.user;

    const user = await userRepository.findSafeById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'El usuario especificado no existe.',
        },
      });
      return;
    }

    const updatedUser = await userRepository.update(id, {
      monthlyTokenLimit: input.monthlyTokenLimit,
    });

    if (actor) {
      await auditRepository.create({
        actorUserId: actor.id,
        action: 'USER_LIMIT_CHANGED',
        targetType: 'USER',
        targetId: updatedUser.id,
        metadata: {
          previousLimit: user.monthlyTokenLimit,
          newLimit: updatedUser.monthlyTokenLimit,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
