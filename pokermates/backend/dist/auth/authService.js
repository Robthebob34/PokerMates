"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../db/db"));
const JWT_SECRET = process.env.JWT_SECRET || 'DEV_ONLY_CHANGE_ME';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 10;
class AuthService {
    async register(username, password) {
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
            throw new Error('Username must not be empty');
        }
        const existing = await db_1.default.user.findUnique({ where: { username: trimmedUsername } });
        if (existing) {
            throw new Error('Username is already taken');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, BCRYPT_ROUNDS);
        const user = await db_1.default.user.create({
            data: {
                username: trimmedUsername,
                passwordHash,
            },
        });
        const token = this.generateToken(user.id, user.username);
        return {
            id: user.id,
            username: user.username,
            token,
        };
    }
    async login(username, password) {
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
            throw new Error('Invalid credentials');
        }
        const user = await db_1.default.user.findUnique({ where: { username: trimmedUsername } });
        if (!user) {
            throw new Error('Invalid credentials');
        }
        if (!user.passwordHash) {
            throw new Error('Invalid credentials');
        }
        const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!ok) {
            throw new Error('Invalid credentials');
        }
        const token = this.generateToken(user.id, user.username);
        return {
            id: user.id,
            username: user.username,
            token,
        };
    }
    verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            return decoded;
        }
        catch {
            return null;
        }
    }
    generateToken(userId, username) {
        return jsonwebtoken_1.default.sign({ userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=authService.js.map