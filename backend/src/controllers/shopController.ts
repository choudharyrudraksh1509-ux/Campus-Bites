import { Request, Response } from 'express';
import prisma from '../db/prisma';

export const getShops = async (req: Request, res: Response): Promise<void> => {
    try {
        const shops = await prisma.shop.findMany({
            where: { status: 'ACTIVE' },
            include: { area: true }
        });
        const mapped = shops.map(s => ({
            shop_id: s.id,
            name: s.name,
            status: s.status,
            area_id: s.areaId,
            area_name: s.area.name
        }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shops' });
    }
};

export const getShopById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shopId } = req.params;
        const shop = await prisma.shop.findUnique({ where: { id: Number(shopId) } });
        if (!shop) {
            res.status(404).json({ error: 'Shop not found' });
            return;
        }
        res.json({ shop_id: shop.id, name: shop.name, status: shop.status });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shop' });
    }
};

export const getShopMenu = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shopId } = req.params;
        const items = await prisma.foodItem.findMany({
            where: { shopId: Number(shopId), isAvailable: true },
            include: { category: true, shop: true }
        });
        const mapped = items.map(item => ({
            item_id: item.id,
            shop_id: item.shopId,
            shop_name: item.shop.name,
            item_name: item.name,
            category_name: item.category.name,
            price: item.price
        }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
};

export const getShopTiming = async (req: Request, res: Response): Promise<void> => {
    // SQLite dummy response for timing
    res.json([]);
};
