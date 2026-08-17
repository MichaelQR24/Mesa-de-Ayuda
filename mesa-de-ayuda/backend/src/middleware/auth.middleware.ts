import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { userRepository } from '../repositories/user.repository.js';
import { UserRole, UserStatus } from '@prisma/client';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Acceso no autorizado. Se requiere token Bearer válido.',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    const user = await userRepository.findSafeById(payload.sub);
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'El usuario asociado a esta sesión no existe.',
        },
      });
      return;
    }

    if (user.status !== UserStatus.ACTIVE) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'La cuenta de usuario se encuentra inactiva.',
        },
      });
      return;
    }

    req.user = user;
    next();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
        message: isExpired ? 'El token de acceso ha expirado.' : 'Token de acceso inválido.',
      },
    });
  }
};

export const requireRole = (role: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Usuario no autenticado.',
        },
      });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No posee los permisos necesarios para realizar esta acción.',
        },
      });
      return;
    }

    next();
  };
};

export const checkPasswordChangeRequired = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && req.user.mustChangePassword) {
    res.status(403).json({
      success: false,
      error: {
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Debe cambiar su contraseña antes de continuar utilizando el asistente.',
      },
    });
    return;
  }
  next();
};
