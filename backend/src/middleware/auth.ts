import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../db/prisma';
import appCache from '../services/cacheService';

export interface AuthUser {
    userId: number;
    role: 'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
    shopId?: number;
    shopName?: string;
    email?: string;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}

/**
 * Validates the JWT Bearer token on incoming requests.
 * Uses strict algorithm verification (HS256) and verified env secret.
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }, async (err: any, decoded: any) => {
        if (err || !decoded || !decoded.userId || !decoded.role) {
            res.status(403).json({ error: 'Invalid or expired token' });
            return;
        }

        const userId = Number(decoded.userId);

        try {
            const isActive = await appCache.getOrSet(`user:status:${userId}`, 10000, async () => {
                const u = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { isActive: true }
                });
                return u ? u.isActive : false;
            });

            if (!isActive) {
                res.status(403).json({ error: 'Your account has been deactivated. Please contact administrator.' });
                return;
            }
        } catch {
            // Fallback: continue if cache check encounters unexpected issue
        }

        req.user = {
            userId,
            role: decoded.role,
            shopId: decoded.shopId ? Number(decoded.shopId) : undefined,
            shopName: decoded.shopName,
            email: decoded.email
        };

        next();
    });
};

/**
 * Enforces role-based access control.
 * Accepts a single role string or array of allowed roles.
 */
export const requireRole = (allowedRoles: string | string[]) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
            return;
        }

        next();
    };
};

/**
 * Strictly requires the global system ADMIN role.
 * (OWNER role is restricted to outlet-specific management and cannot access global admin tools).
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Requires staff, owner, or admin role.
 */
export const requireStaffOrAdmin = requireRole(['STAFF', 'OWNER', 'ADMIN']);

/**
 * Helper to verify that an authenticated user has permission to operate on a specific shop.
 * ADMIN has global access across all shops.
 * STAFF and OWNER must have an assigned shopId matching the target shopId.
 */
export const isAuthorizedForShop = (user: AuthUser | undefined, shopId: number): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if ((user.role === 'STAFF' || user.role === 'OWNER') && user.shopId === shopId) {
        return true;
    }
    return false;
};
