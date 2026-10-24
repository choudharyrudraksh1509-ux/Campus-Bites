import { Response } from 'express';
import { AuthRequest, isAuthorizedForShop } from '../middleware/auth';
import prisma from '../db/prisma';
import { appCache } from '../services/cacheService';

export const addMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { shopId, categoryId, name, description, price, isAvailable } = req.body;
        const targetShopId = Number(shopId);

        if (!isAuthorizedForShop(user, targetShopId)) {
            res.status(403).json({ error: 'Forbidden: You do not own or manage this stall' });
            return;
        }

        const [shop, category] = await Promise.all([
            prisma.shop.findUnique({ where: { id: targetShopId } }),
            prisma.category.findUnique({ where: { id: Number(categoryId) } })
        ]);
        if (!shop) { res.status(404).json({ error: 'Stall not found' }); return; }
        if (!category) { res.status(404).json({ error: 'Category not found' }); return; }

        const item = await prisma.foodItem.create({
            data: {
                shopId: targetShopId,
                categoryId: Number(categoryId),
                name: String(name).trim(),
                description: description ? String(description).trim() : '',
                price: Number(price),
                isAvailable: isAvailable ?? true
            }
        });

        appCache.invalidate('shops:', 'staff:', 'admin:');

        res.status(201).json({ message: 'Item added successfully', itemId: item.id });
    } catch (error) {
        console.error('Add menu item error:', error);
        res.status(500).json({ error: 'Failed to add item' });
    }
};

export const updateMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const itemId = Number(req.params.itemId);
        const { price, isAvailable, name, description } = req.body;

        const item = await prisma.foodItem.findUnique({
            where: { id: itemId }
        });

        if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

        if (!isAuthorizedForShop(user, item.shopId)) {
            res.status(403).json({ error: 'Forbidden: You do not have permission to modify items for this stall' });
            return;
        }

        const updated = await prisma.foodItem.update({
            where: { id: itemId },
            data: {
                price: price !== undefined ? Number(price) : item.price,
                isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : item.isAvailable,
                name: name !== undefined ? String(name).trim() : item.name,
                description: description !== undefined ? String(description).trim() : item.description
            }
        });

        appCache.invalidate('shops:', 'staff:', 'admin:');

        res.json({ message: 'Item updated successfully', item: updated });
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
};

export const deleteMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const itemId = Number(req.params.itemId);

        const item = await prisma.foodItem.findUnique({
            where: { id: itemId }
        });

        if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

        if (!isAuthorizedForShop(user, item.shopId)) {
            res.status(403).json({ error: 'Forbidden: You do not have permission to delete items for this stall' });
            return;
        }

        // Check if item has existing order references — soft delete by disabling
        const orderItemCount = await prisma.orderItem.count({
            where: { itemId }
        });

        if (orderItemCount > 0) {
            // Soft delete: mark as unavailable to protect order history integrity
            await prisma.foodItem.update({
                where: { id: itemId },
                data: { isAvailable: false }
            });
            appCache.invalidate('shops:', 'staff:', 'admin:');
            res.json({ message: 'Item has order history — marked as unavailable instead of deleting' });
        } else {
            await prisma.foodItem.delete({ where: { id: itemId } });
            appCache.invalidate('shops:', 'staff:', 'admin:');
            res.json({ message: 'Item deleted successfully' });
        }
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
};

export const getOwnerSales = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

        // Scope to stall if user is not global ADMIN
        const filter = (user.role === 'ADMIN')
            ? { status: 'COMPLETED' }
            : { status: 'COMPLETED', shopId: user.shopId || -1 };

        const orders = await prisma.order.findMany({
            where: filter,
            include: { shop: true, items: { include: { item: true } }, customer: true },
            orderBy: { orderTime: 'desc' }
        });

        const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalOrders = orders.length;

        res.json({ totalRevenue, totalOrders, orders });
    } catch (error) {
        console.error('Get owner sales error:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
};

export const getOwnerShop = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

        let shop = null;
        if (user.shopId) {
            shop = await prisma.shop.findUnique({ where: { id: user.shopId }, include: { area: true, items: true } });
        }
        if (!shop) {
            shop = await prisma.shop.findFirst({ where: { ownerId: user.userId }, include: { area: true, items: true } });
        }
        if (!shop && user.role === 'ADMIN') {
            shop = await prisma.shop.findFirst({ include: { area: true, items: true } });
        }
        if (!shop) {
            res.status(404).json({ error: 'No stall found for this owner' });
            return;
        }
        res.json(shop);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch owner shop' });
    }
};

export const updateOwnerShopStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { status } = req.body;
        let shop = null;
        if (user.shopId) {
            shop = await prisma.shop.findUnique({ where: { id: user.shopId } });
        }
        if (!shop) {
            shop = await prisma.shop.findFirst({ where: { ownerId: user.userId } });
        }
        if (!shop && user.role === 'ADMIN') {
            shop = await prisma.shop.findFirst();
        }
        if (!shop) {
            res.status(404).json({ error: 'No stall found for this owner' });
            return;
        }

        const updated = await prisma.shop.update({
            where: { id: shop.id },
            data: { status: status || 'ACTIVE' }
        });

        appCache.invalidate('shops:', 'staff:', 'admin:');

        res.json({ message: `Stall status updated to ${updated.status}`, shop: updated });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update owner shop status' });
    }
};
