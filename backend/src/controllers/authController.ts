import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { fullName, email, password, phone, role } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'Email already in use' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                fullName,
                email,
                phone: phone || null,
                passwordHash
            }
        });

        const assignedRole = role || 'CUSTOMER';
        try {
            const roleRecord = await prisma.role.findUnique({ where: { name: assignedRole } });
            if (roleRecord) {
                await prisma.userRole.create({
                    data: {
                        userId: user.id,
                        roleId: roleRecord.id
                    }
                });
            }
        } catch (roleErr) {
            console.error('Error assigning role:', roleErr);
        }

        const token = jwt.sign(
            { userId: user.id, role: assignedRole },
            process.env.JWT_SECRET || 'super_secret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            userId: user.id,
            token,
            user: { id: user.id, name: user.fullName, email: user.email, role: assignedRole }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const userRoles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
        const role = userRoles.length > 0 ? userRoles[0].role.name : 'CUSTOMER';

        const token = jwt.sign(
            { userId: user.id, role },
            process.env.JWT_SECRET || 'super_secret',
            { expiresIn: '24h' }
        );

        res.json({ message: 'Login successful', token, user: { id: user.id, name: user.fullName, email: user.email, role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const userRoles = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
        const role = userRoles.length > 0 ? userRoles[0].role.name : 'CUSTOMER';
        res.json({ user: { id: user.id, name: user.fullName, email: user.email, phone: user.phone, role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const { fullName, phone, password, currentPassword } = req.body;
        const updateData: { fullName?: string; phone?: string | null; passwordHash?: string } = {};

        if (fullName !== undefined) {
            const trimmedName = fullName.trim();
            if (!trimmedName) {
                res.status(400).json({ error: 'Name cannot be empty' });
                return;
            }
            updateData.fullName = trimmedName;
        }

        if (phone !== undefined) {
            updateData.phone = phone ? phone.trim() : null;
        }

        if (password) {
            if (!currentPassword) {
                res.status(400).json({ error: 'Current password is required to change password' });
                return;
            }

            const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isMatch) {
                res.status(400).json({ error: 'Incorrect current password' });
                return;
            }

            if (password.length < 6) {
                res.status(400).json({ error: 'New password must be at least 6 characters' });
                return;
            }

            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        const userRoles = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
        const role = userRoles.length > 0 ? userRoles[0].role.name : 'CUSTOMER';

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                name: updatedUser.fullName,
                email: updatedUser.email,
                phone: updatedUser.phone,
                role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

