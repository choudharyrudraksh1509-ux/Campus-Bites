import { Request, Response } from 'express';
import prisma from '../db/prisma';

export const getAreas = async (req: Request, res: Response): Promise<void> => {
    try {
        const areas = await prisma.area.findMany();
        res.json(areas);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch areas' });
    }
};
