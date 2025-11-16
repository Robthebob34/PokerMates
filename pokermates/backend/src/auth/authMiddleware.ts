import type { Request, Response, NextFunction } from 'express';
import type { AuthUser } from './authService';
import { authService } from './authService';
import prisma from '../db/db';

export interface AuthRequest extends Request {
  user?: AuthUser & { chips?: number };
}

const COOKIE_NAME = 'pm_token';

export const attachUserFromCookie = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = (req as any).cookies?.[COOKIE_NAME] as string | undefined;

    if (!token) {
      return next();
    }

    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return next();
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, chips: true },
    });

    if (!dbUser) {
      return next();
    }

    req.user = { id: dbUser.id, username: dbUser.username, chips: dbUser.chips };
    return next();
  } catch (error) {
    console.error('Failed to attach user from cookie:', error);
    return next();
  }
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
};
