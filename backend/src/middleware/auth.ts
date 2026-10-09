import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        role: string; // simplifying for now, can be array of roles
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }

    jwt.verify(token, process.env.JWT_SECRET || 'super_secret', (err: any, decoded: any) => {
        if (err) {
            res.status(403).json({ error: 'Invalid or expired token' });
            return;
        }
        req.user = decoded;
        next();
    });
};

export const requireRole = (requiredRole: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || req.user.role !== requiredRole) {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            return;
        }
        next();
    };
};
