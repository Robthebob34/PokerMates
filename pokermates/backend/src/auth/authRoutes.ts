import { Router, type Request, type Response } from 'express';
import type { AuthRequest } from './authMiddleware';
import { authService } from './authService';

const router = Router();

const COOKIE_NAME = 'pm_token';
const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
};

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const result = await authService.register(username, password);

    res.cookie(COOKIE_NAME, result.token, cookieOptions);

    return res.status(201).json({
      user: {
        id: result.id,
        username: result.username,
        chips: result.chips,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/auth/register:', error);
    return res.status(400).json({ error: error.message ?? 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const result = await authService.login(username, password);

    res.cookie(COOKIE_NAME, result.token, cookieOptions);

    return res.status(200).json({
      user: {
        id: result.id,
        username: result.username,
        chips: result.chips,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/auth/login:', error);
    return res.status(401).json({ error: error.message ?? 'Login failed' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  return res.status(200).json({ success: true });
});

router.get('/me', (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(200).json({ user: null });
  }

  return res.status(200).json({ user: req.user });
});

export default router;
