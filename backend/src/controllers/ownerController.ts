import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';

export const addMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { shopId, categoryId, name, description, price, isAvailable } = req.body;

        const shop = await prisma.shop.findFirst({ where: { id: Number(shopId), ownerId } });
        if (!shop) { res.status(403).json({ error: 'Not authorized for this shop' }); return; }

        const item = await prisma.foodItem.create({
            data: {
                shopId: Number(shopId),
                categoryId: Number(categoryId),
                name,
                description,
                price: Number(price),
                isAvailable: isAvailable ?? true
            }
        });

        res.status(201).json({ message: 'Item added', itemId: item.id });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add item' });
    }
};

export const updateMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { itemId } = req.params;
        const { price, isAvailable } = req.body;

        const item = await prisma.foodItem.findFirst({
            where: { id: Number(itemId), shop: { ownerId } }
        });

        if (!item) { res.status(403).json({ error: 'Not authorized for this item' }); return; }

        await prisma.foodItem.update({
            where: { id: Number(itemId) },
            data: {
                price: price !== undefined ? Number(price) : item.price,
                isAvailable: isAvailable !== undefined ? isAvailable : item.isAvailable
            }
        });

        res.json({ message: 'Item updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update item' });
    }
};

export const getOwnerSales = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const orders = await prisma.order.findMany({
            where: { shop: { ownerId }, status: 'COMPLETED' },
            orderBy: { orderTime: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
};
