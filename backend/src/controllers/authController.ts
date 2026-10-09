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

        res.status(201).json({ message: 'User registered successfully', userId: user.id });
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

        const role = 'CUSTOMER'; // Dummy

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
