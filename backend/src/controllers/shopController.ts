import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { ensureStallStaffSeeded } from '../services/seedService';
import { appCache } from '../services/cacheService';

export const getShops = async (req: Request, res: Response): Promise<void> => {
    try {
        const mapped = await appCache.getOrSet('shops:active', 15000, async () => {
            let shops = await prisma.shop.findMany({
                where: { status: 'ACTIVE' },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    areaId: true,
                    isClosingSoon: true,
                    closingDiscount: true,
                    area: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: { id: 'asc' }
            });

            if (shops.length === 0) {
                // Guard against accidental mock/seed data injection in production
                if (process.env.NODE_ENV !== 'production' && process.env.AUTO_SEED === 'true') {
                    await ensureStallStaffSeeded();
                    shops = await prisma.shop.findMany({
                        where: { status: 'ACTIVE' },
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            areaId: true,
                            isClosingSoon: true,
                            closingDiscount: true,
                            area: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        },
                        orderBy: { id: 'asc' }
                    });
                }
            }

            return shops.map(s => ({
                id: s.id,
                shop_id: s.id,
                name: s.name,
                status: s.status,
                area_id: s.areaId,
                area_name: s.area.name,
                isClosingSoon: Boolean(s.isClosingSoon),
                closingDiscount: s.closingDiscount || 0
            }));
        });

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shops' });
    }
};

export const getShopById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shopId } = req.params;
        const sId = Number(shopId);
        const shop = await appCache.getOrSet(`shops:detail:${sId}`, 15000, () =>
            prisma.shop.findUnique({ where: { id: sId } })
        );
        if (!shop) {
            res.status(404).json({ error: 'Shop not found' });
            return;
        }
        res.json({
            id: shop.id,
            shop_id: shop.id,
            name: shop.name,
            status: shop.status,
            isClosingSoon: Boolean(shop.isClosingSoon),
            closingDiscount: shop.closingDiscount || 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shop' });
    }
};

export const getShopMenu = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shopId } = req.params;
        const sId = Number(shopId);
        const mapped = await appCache.getOrSet(`shops:menu:${sId}`, 15000, async () => {
            const items = await prisma.foodItem.findMany({
                where: { shopId: sId, isAvailable: true },
                select: {
                    id: true,
                    shopId: true,
                    categoryId: true,
                    name: true,
                    description: true,
                    price: true,
                    originalPrice: true,
                    discountPercent: true,
                    isDynamicPricing: true,
                    isAvailable: true,
                    category: {
                        select: {
                            name: true
                        }
                    },
                    shop: {
                        select: {
                            name: true,
                            isClosingSoon: true,
                            closingDiscount: true
                        }
                    }
                }
            });
            return items.map(item => {
                let cleanDescription = item.description || '';
                let quantityAvailable: number | null = null;
                const match = cleanDescription.match(/\[Qty:\s*(\d+)\]/i);
                if (match) {
                    quantityAvailable = parseInt(match[1], 10);
                    cleanDescription = cleanDescription.replace(/\[Qty:\s*(\d+)\]/i, '').trim();
                }

                return {
                    item_id: item.id,
                    shop_id: item.shopId,
                    shop_name: item.shop.name,
                    item_name: item.name,
                    description: cleanDescription,
                    quantityAvailable,
                    category_name: item.category.name,
                    price: item.price,
                    originalPrice: item.originalPrice || item.price,
                    discountPercent: item.discountPercent || 0,
                    isDynamicPricing: Boolean(item.isDynamicPricing),
                    isClosingSoon: Boolean(item.shop?.isClosingSoon),
                    closingDiscount: item.shop?.closingDiscount || 0
                };
            });
        });
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
};

export const getShopTiming = async (req: Request, res: Response): Promise<void> => {
    res.json([]);
};
