import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';

export const addMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { shopId, categoryId, name, description, price, isAvailable } = req.body;

        const item = await prisma.foodItem.create({
            data: {
                shopId: Number(shopId),
                categoryId: Number(categoryId),
                name,
                description: description || '',
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
        const { price, isAvailable, name, description } = req.body;

        const item = await prisma.foodItem.findFirst({
            where: { id: Number(itemId) }
        });

        if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

        await prisma.foodItem.update({
            where: { id: Number(itemId) },
            data: {
                price: price !== undefined ? Number(price) : item.price,
                isAvailable: isAvailable !== undefined ? isAvailable : item.isAvailable,
                name: name !== undefined ? name : item.name,
                description: description !== undefined ? description : item.description
            }
        });

        res.json({ message: 'Item updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update item' });
    }
};

export const deleteMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { itemId } = req.params;

        const item = await prisma.foodItem.findFirst({
            where: { id: Number(itemId) }
        });

        if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

        // Check if item has existing order references — soft delete by disabling
        const orderItemCount = await prisma.orderItem.count({
            where: { itemId: Number(itemId) }
        });

        if (orderItemCount > 0) {
            // Soft delete: mark as unavailable instead of removing
            await prisma.foodItem.update({
                where: { id: Number(itemId) },
                data: { isAvailable: false }
            });
            res.json({ message: 'Item has order history — marked as unavailable instead of deleting' });
        } else {
            await prisma.foodItem.delete({ where: { id: Number(itemId) } });
            res.json({ message: 'Item deleted successfully' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
};

export const getOwnerSales = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const ownerId = req.user?.userId;
        if (!ownerId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const orders = await prisma.order.findMany({
            where: { status: 'COMPLETED' },
            include: { shop: true, items: { include: { item: true } }, customer: true },
            orderBy: { orderTime: 'desc' }
        });

        const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalOrders = orders.length;

        res.json({ totalRevenue, totalOrders, orders });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
};
