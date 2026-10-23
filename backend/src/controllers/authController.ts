import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';
import { env } from '../config/env';
import { ensureStallStaffSeeded } from '../services/seedService';
import { AuthRequest } from '../middleware/auth';

/**
 * Public User Registration
 * Enforces role = 'CUSTOMER' to prevent unauthorized privilege escalation.
 */
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { fullName, email, password, phone } = req.body;
        const normalizedEmail = email ? email.trim().toLowerCase() : '';

        const existing = await prisma.user.findFirst({
            where: { email: normalizedEmail }
        });
        if (existing) {
            res.status(400).json({ error: 'This email ID already exists' });
            return;
        }

        let formattedPhone: string | null = null;
        if (phone && typeof phone === 'string' && phone.trim()) {
            const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
            const indianRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
            const generalRegex = /^\+?[1-9]\d{9,14}$/;
            if (!indianRegex.test(cleanPhone) && !generalRegex.test(cleanPhone)) {
                res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
                return;
            }
            formattedPhone = cleanPhone;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                fullName: fullName.trim(),
                email: normalizedEmail,
                phone: formattedPhone,
                passwordHash
            }
        });

        // Always assign CUSTOMER role for public registration
        const assignedRole = 'CUSTOMER';
        const roleRecord = await prisma.role.findUnique({ where: { name: assignedRole } });
        if (roleRecord) {
            await prisma.userRole.create({
                data: {
                    userId: user.id,
                    roleId: roleRecord.id
                }
            });
        }

        const token = jwt.sign(
            { userId: user.id, role: assignedRole, email: user.email },
            env.JWT_SECRET,
            { expiresIn: '24h', algorithm: 'HS256' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            userId: user.id,
            token,
            user: { id: user.id, name: user.fullName, email: user.email, role: assignedRole }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * User & Staff Authentication
 * Strictly validates passwords using bcrypt. Zero hardcoded bypasses.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email: rawEmail, password, shopId } = req.body;

        if (!rawEmail || !password) {
            res.status(400).json({ error: 'Email / Staff ID and password are required' });
            return;
        }

        const inputIdentifier = rawEmail.trim().toLowerCase();

        // If staff identifier or shopId provided, ensure stall staff accounts are seeded
        if (shopId || inputIdentifier.startsWith('staff.') || inputIdentifier.includes('staff') || inputIdentifier.includes('admin') || inputIdentifier.includes('owner')) {
            await ensureStallStaffSeeded();
        }

        // 1. Resolve user: exact email or stall slug alias
        let user = await prisma.user.findUnique({ where: { email: inputIdentifier } });

        if (!user && !inputIdentifier.includes('@')) {
            user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: `staff.${inputIdentifier}@campusbites.com` },
                        { email: `${inputIdentifier}@campusbites.com` },
                        { email: `${inputIdentifier}@vitstudent.ac.in` }
                    ]
                }
            });
        }

        // If user not found yet and shopId is provided, check shop's staff
        if (!user && shopId) {
            const stallStaffRecords = await prisma.shopStaff.findMany({
                where: { shopId: Number(shopId) },
                include: { staff: true }
            });
            if (stallStaffRecords.length > 0) {
                user = stallStaffRecords[0].staff;
            }
        }

        if (!user || !user.isActive) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // 2. Authoritative Bcrypt Password Validation (No bypasses)
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);

        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const userRoles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
        const role = (userRoles.length > 0 ? userRoles[0].role.name : 'CUSTOMER') as 'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';

        // 3. Resolve assigned stall / shop
        let assignedShop: { id: number; name: string } | null = null;
        if (role === 'STAFF' || role === 'OWNER') {
            const staffShop = await prisma.shopStaff.findFirst({
                where: { staffId: user.id },
                include: { shop: true }
            });
            if (staffShop) {
                assignedShop = { id: staffShop.shop.id, name: staffShop.shop.name };
            } else if (role === 'OWNER') {
                const ownedShop = await prisma.shop.findFirst({
                    where: { ownerId: user.id }
                });
                if (ownedShop) {
                    assignedShop = { id: ownedShop.id, name: ownedShop.name };
                }
            }
        }

        // 4. Validate selected stall matches staff's assigned stall
        if (shopId && role === 'STAFF') {
            const requestedShopId = Number(shopId);
            const isAssigned = await prisma.shopStaff.findFirst({
                where: { staffId: user.id, shopId: requestedShopId }
            });

            if (!isAssigned) {
                const targetShop = await prisma.shop.findUnique({ where: { id: requestedShopId } });
                res.status(403).json({
                    error: `These staff credentials do not belong to ${targetShop?.name || 'the selected stall'}. Please select your assigned stall.`
                });
                return;
            }
        }

        const effectiveShopId = assignedShop?.id || (shopId ? Number(shopId) : undefined);
        const effectiveShopName = assignedShop?.name;

        const token = jwt.sign(
            { 
                userId: user.id, 
                role,
                shopId: effectiveShopId,
                shopName: effectiveShopName,
                email: user.email
            },
            env.JWT_SECRET,
            { expiresIn: '24h', algorithm: 'HS256' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.fullName,
                email: user.email,
                role,
                shopId: effectiveShopId,
                shopName: effectiveShopName
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Hydrates current authenticated user session.
 */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.isActive) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const userRoles = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
        const role = userRoles.length > 0 ? userRoles[0].role.name : 'CUSTOMER';

        let shopId: number | undefined;
        let shopName: string | undefined;

        if (role === 'STAFF' || role === 'OWNER') {
            const staffShop = await prisma.shopStaff.findFirst({
                where: { staffId: user.id },
                include: { shop: true }
            });
            if (staffShop) {
                shopId = staffShop.shop.id;
                shopName = staffShop.shop.name;
            } else if (role === 'OWNER') {
                const ownedShop = await prisma.shop.findFirst({
                    where: { ownerId: user.id }
                });
                if (ownedShop) {
                    shopId = ownedShop.id;
                    shopName = ownedShop.name;
                }
            }
        }

        res.json({
            user: {
                id: user.id,
                name: user.fullName,
                email: user.email,
                phone: user.phone,
                role,
                shopId,
                shopName
            }
        });
    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Updates profile details with password verification. Zero backdoors.
 */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const { fullName, phone, password, currentPassword, confirmPassword } = req.body;
        const updateData: { fullName?: string; phone?: string | null; passwordHash?: string } = {};

        if (fullName !== undefined) {
            const trimmedName = String(fullName).trim();
            if (!trimmedName) {
                res.status(400).json({ error: 'Name cannot be empty' });
                return;
            }
            updateData.fullName = trimmedName;
        }

        if (phone !== undefined) {
            if (phone === null || (typeof phone === 'string' && !phone.trim())) {
                updateData.phone = null;
            } else if (typeof phone === 'string') {
                const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
                const indianRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
                const generalRegex = /^\+?[1-9]\d{9,14}$/;
                if (!indianRegex.test(cleanPhone) && !generalRegex.test(cleanPhone)) {
                    res.status(400).json({ error: 'Please enter a valid 10-digit phone number (e.g. 9876543210)' });
                    return;
                }
                updateData.phone = cleanPhone;
            }
        }

        if (password || currentPassword || confirmPassword) {
            if (!currentPassword) {
                res.status(400).json({ error: 'Current password is required to change password' });
                return;
            }

            if (!password) {
                res.status(400).json({ error: 'New password is required' });
                return;
            }

            // Strict bcrypt verification (no bypasses)
            const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

            if (!isMatch) {
                res.status(400).json({ error: 'Current password is incorrect' });
                return;
            }

            if (password.length < 6) {
                res.status(400).json({ error: 'New password must be at least 6 characters' });
                return;
            }

            if (confirmPassword && password !== confirmPassword) {
                res.status(400).json({ error: 'New password and confirm new password do not match' });
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
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
