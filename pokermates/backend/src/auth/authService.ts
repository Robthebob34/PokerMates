import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db/db';

const JWT_SECRET = process.env.JWT_SECRET || 'DEV_ONLY_CHANGE_ME';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 10;

export interface AuthUser {
  id: string;
  username: string;
  chips: number;
}

export interface AuthTokens {
  token: string;
}

export class AuthService {
  async register(username: string, password: string): Promise<AuthUser & AuthTokens> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      throw new Error('Username must not be empty');
    }

    const existing = await prisma.user.findUnique({ where: { username: trimmedUsername } });
    if (existing) {
      throw new Error('Username is already taken');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        passwordHash,
      },
    });

    const token = this.generateToken(user.id, user.username);

    return {
      id: user.id,
      username: user.username,
      chips: user.chips,
      token,
    };
  }

  async login(username: string, password: string): Promise<AuthUser & AuthTokens> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      throw new Error('Invalid credentials');
    }

    const user = await prisma.user.findUnique({ where: { username: trimmedUsername } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user.id, user.username);

    return {
      id: user.id,
      username: user.username,
      chips: user.chips,
      token,
    };
  }

  verifyToken(token: string): { userId: string; username: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      return decoded;
    } catch {
      return null;
    }
  }

  private generateToken(userId: string, username: string): string {
    return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }
}

export const authService = new AuthService();
