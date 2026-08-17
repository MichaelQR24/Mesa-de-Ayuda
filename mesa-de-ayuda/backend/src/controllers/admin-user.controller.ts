import { Request, Response, NextFunction } from 'express';
import { createUserSchema, updateUserStatusSchema, resetUserPasswordSchema } from '../schemas/user.schema.js';
import { userRepository } from '../repositories/user.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { hashPassword } from '../utils/crypto.js';
import { UserStatus } from '@prisma/client';

export const getUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await userRepository.findMany();
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, displayName, role, temporaryPassword } = createUserSchema.parse(req.body);

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'El correo electrónico ya se encuentra registrado.',
        },
      });
      return;
    }

    const passwordHash = await hashPassword(temporaryPassword);

    const newUser = await userRepository.create({
      email,
      displayName,
      role,
      passwordHash,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
    });

    res.status(201).json({
      success: true,
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID no proporcionado' } });
      return;
    }

    const { status } = updateUserStatusSchema.parse(req.body);

    const user = await userRepository.findById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
        },
      });
      return;
    }

    const updatedUser = await userRepository.updateStatus(id, status);

    // Si el usuario pasa a inactivo, revocar de inmediato todas sus sesiones activas
    if (status === UserStatus.INACTIVE) {
      await sessionRepository.revokeAllUserSessions(id);
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
    if (!id) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID no proporcionado' } });
      return;
    }

    const { newTemporaryPassword } = resetUserPasswordSchema.parse(req.body);

    const user = await userRepository.findById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
        },
      });
      return;
    }

    const passwordHash = await hashPassword(newTemporaryPassword);
    const updatedUser = await userRepository.updatePassword(id, passwordHash, true);

    // Revocar sesiones activas para obligar a autenticar con la nueva contraseña temporal
    await sessionRepository.revokeAllUserSessions(id);

    res.status(200).json({
      success: true,
      data: {
        message: 'Contraseña temporal asignada correctamente. El usuario deberá cambiarla al iniciar sesión.',
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};
