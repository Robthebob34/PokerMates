"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_1 = require("./authService");
const router = (0, express_1.Router)();
const COOKIE_NAME = 'pm_token';
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
};
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }
        const result = await authService_1.authService.register(username, password);
        res.cookie(COOKIE_NAME, result.token, cookieOptions);
        return res.status(201).json({
            user: {
                id: result.id,
                username: result.username,
            },
        });
    }
    catch (error) {
        console.error('Error in /api/auth/register:', error);
        return res.status(400).json({ error: error.message ?? 'Registration failed' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }
        const result = await authService_1.authService.login(username, password);
        res.cookie(COOKIE_NAME, result.token, cookieOptions);
        return res.status(200).json({
            user: {
                id: result.id,
                username: result.username,
            },
        });
    }
    catch (error) {
        console.error('Error in /api/auth/login:', error);
        return res.status(401).json({ error: error.message ?? 'Login failed' });
    }
});
router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    return res.status(200).json({ success: true });
});
router.get('/me', (req, res) => {
    if (!req.user) {
        return res.status(200).json({ user: null });
    }
    return res.status(200).json({ user: req.user });
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map