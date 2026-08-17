import { Request, Response, NextFunction } from 'express';
import { loginSchema, refreshSchema, logoutSchema, changePasswordSchema } from '../schemas/auth.schema.js';
import { authService } from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { z } from 'zod';

const privacySchema = z.object({
  saveAiHistory: z.boolean(),
});

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = logoutSchema.parse(req.body);
    await authService.logout(refreshToken);

    res.status(200).json({
      success: true,
      data: {
        message: 'Sesión cerrada correctamente',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No autenticado' },
      });
      return;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const updatedUser = await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      data: {
        message: 'Contraseña actualizada exitosamente.',
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePrivacy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No autenticado' },
      });
      return;
    }

    const { saveAiHistory } = privacySchema.parse(req.body);
    const updatedUser = await userRepository.updatePrivacyPreferences(req.user.id, saveAiHistory);

    res.status(200).json({
      success: true,
      data: {
        message: 'Preferencia de privacidad actualizada.',
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};
