"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = exports.attachUserFromCookie = void 0;
const authService_1 = require("./authService");
const COOKIE_NAME = 'pm_token';
const attachUserFromCookie = (req, _res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
        return next();
    }
    const decoded = authService_1.authService.verifyToken(token);
    if (!decoded) {
        return next();
    }
    req.user = { id: decoded.userId, username: decoded.username };
    return next();
};
exports.attachUserFromCookie = attachUserFromCookie;
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
};
exports.requireAuth = requireAuth;
//# sourceMappingURL=authMiddleware.js.map