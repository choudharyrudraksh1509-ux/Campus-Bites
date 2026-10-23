import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';
import { ALLOWED_ORDER_TRANSITIONS } from '../services/orderStateMachine';

// Valid state transitions per architecture Section 8
const VALID_TRANSITIONS: Record<string, string[]> = ALLOWED_ORDER_TRANSITIONS;

/**
 * Helper to resolve the staff member's assigned shop reliably
 */
export const getStaffAssignedShop = async (staffId: number, reqUserShopId?: number) => {
    if (reqUserShopId) {
        const shop = await prisma.shop.findUnique({ where: { id: reqUserShopId }, include: { area: true } });
        if (shop) return shop;
    }
    const ss = await prisma.shopStaff.findFirst({
        where: { staffId },
        include: { shop: { include: { area: true } } }
    });
    if (ss?.shop) return ss.shop;

    // Fallback: match by email slug if shopStaff link is missing
    const user = await prisma.user.findUnique({ where: { id: staffId } });
    if (user) {
        const slug = user.email.toLowerCase().split('@')[0].replace('staff.', '');
        const allShops = await prisma.shop.findMany({ include: { area: true } });
        const matched = allShops.find(s => {
            const sSlug = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return sSlug.includes(slug) || slug.includes(sSlug);
        });
        if (matched) {
            await prisma.shopStaff.upsert({
                where: { shopId_staffId: { shopId: matched.id, staffId } },
                update: {},
                create: { shopId: matched.id, staffId }
            });
            return matched;
        }
    }
    return null;
};

// ==========================================
// 1. LIVE ACTIVE ORDERS (STRICTLY SCOPED TO STAFF'S STALL)
// ==========================================
export const getStaffOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        if (!shop) {
            // Staff is not assigned to any stall - strictly return empty list
            res.json([]);
            return;
        }

        const orders = await prisma.order.findMany({
            where: {
                shopId: shop.id,
                status: { in: ['PLACED', 'PREPARING', 'READY'] }
            },
            select: {
                id: true,
                customerId: true,
                shopId: true,
                status: true,
                totalAmount: true,
                orderTime: true,
                isPreorder: true,
                pickupTime: true,
                estimatedMinutes: true,
                queueNumber: true,
                paymentMethod: true,
                customer: {
                    select: {
                        fullName: true,
                        phone: true
                    }
                },
                items: {
                    select: {
                        id: true,
                        itemId: true,
                        quantity: true,
                        priceAtOrder: true,
                        item: {
                            select: {
                                id: true,
                                name: true,
                                price: true
                            }
                        }
                    }
                }
            },
            orderBy: [{ orderTime: 'asc' }, { id: 'asc' }]
        });

        const mapped = orders.map(o => ({
            ...o,
            pickup_token: `TK-${1000 + (o.id % 9000)}`,
            customer_name: o.customer?.fullName || 'Campus Student',
            customer_phone: o.customer?.phone || null
        }));

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch staff orders' });
    }
};

// ==========================================
// 2. ORDER HISTORY (STRICTLY SCOPED TO STAFF'S STALL)
// ==========================================
export const getStaffOrderHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        if (!shop) {
            res.json([]);
            return;
        }

        const orders = await prisma.order.findMany({
            where: {
                shopId: shop.id,
                status: { in: ['COMPLETED', 'CANCELLED'] }
            },
            include: {
                shop: true,
                items: { include: { item: true } },
                customer: true,
                payments: true
            },
            orderBy: { orderTime: 'desc' },
            take: 100
        });

        const mapped = orders.map(o => ({
            ...o,
            pickup_token: `TK-${1000 + (o.id % 9000)}`,
            customer_name: o.customer?.fullName || 'Campus Student'
        }));

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order history' });
    }
};

// ==========================================
// 3. UPDATE ORDER STATUS (2-STEP VERIFIED IN UI)
// ==========================================
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { orderId } = req.params;
        const { status } = req.body;

        if (!status) { res.status(400).json({ error: 'Status is required' }); return; }

        const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
        if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

        // Verify stall authorization: staff can ONLY update orders for their assigned stall
        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        if (!shop || order.shopId !== shop.id) {
            res.status(403).json({ error: 'Unauthorized: You can only update orders for your assigned stall' });
            return;
        }

        // Validate state machine transition
        const allowed = VALID_TRANSITIONS[order.status];
        if (!allowed || !allowed.includes(status)) {
            res.status(400).json({ 
                error: `Invalid transition: ${order.status} → ${status}. Allowed: ${(allowed || []).join(', ') || 'none'}` 
            });
            return;
        }

        const updated = await prisma.order.update({
            where: { id: Number(orderId) },
            data: { status }
        });
        
        res.json({ message: `Order status updated: ${order.status} → ${status}`, orderId: updated.id, status: updated.status, order: updated });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update order status' });
    }
};

// ==========================================
// 4. STALL MENU MANAGEMENT
// ==========================================
export const getStaffMenu = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        if (!shop) { res.status(404).json({ error: 'No stall found for staff' }); return; }

        const items = await prisma.foodItem.findMany({
            where: { shopId: shop.id },
            include: { category: true, shop: true },
            orderBy: [{ categoryId: 'asc' }, { name: 'asc' }]
        });

        const mapped = items.map(item => {
            let cleanDescription = item.description || '';
            let quantityAvailable: number | null = null;
            const match = cleanDescription.match(/\[Qty:\s*(\d+)\]/i);
            if (match) {
                quantityAvailable = parseInt(match[1], 10);
                cleanDescription = cleanDescription.replace(/\[Qty:\s*(\d+)\]/i, '').trim();
            }

            return {
                id: item.id,
                item_id: item.id,
                shop_id: item.shopId,
                shop_name: item.shop.name,
                name: item.name,
                item_name: item.name,
                description: cleanDescription,
                price: item.price,
                originalPrice: item.originalPrice || item.price,
                discountPercent: item.discountPercent || 0,
                isDynamicPricing: Boolean(item.isDynamicPricing),
                isAvailable: item.isAvailable,
                quantityAvailable,
                category_id: item.categoryId,
                category_name: item.category.name,
                isClosingSoon: Boolean(item.shop?.isClosingSoon),
                closingDiscount: item.shop?.closingDiscount || 0
            };
        });

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stall menu' });
    }
};

export const addStaffMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        if (!shop) { res.status(404).json({ error: 'No stall found for staff' }); return; }

        const { name, price, description, categoryId, categoryName, isAvailable, quantityAvailable, originalPrice, discountPercent, isDynamicPricing } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Item name is required' });
            return;
        }
        if (price === undefined || isNaN(Number(price))) {
            res.status(400).json({ error: 'Valid item price is required' });
            return;
        }

        // Resolve or create category
        let finalCategoryId = Number(categoryId);
        if (isNaN(finalCategoryId) || !finalCategoryId) {
            const catName = (categoryName && String(categoryName).trim()) || 'Specialties';
            const cat = await prisma.category.upsert({
                where: { name: catName },
                update: {},
                create: { name: catName }
            });
            finalCategoryId = cat.id;
        }

        let finalDescription = (description || '').trim();
        let parsedQty: number | null = null;
        if (quantityAvailable !== undefined && quantityAvailable !== null && quantityAvailable !== '') {
            const num = parseInt(String(quantityAvailable), 10);
            if (!isNaN(num) && num >= 0) {
                parsedQty = num;
                finalDescription = finalDescription.replace(/\[Qty:\s*(\d+)\]/i, '').trim();
                finalDescription = finalDescription ? `${finalDescription} [Qty: ${parsedQty}]` : `[Qty: ${parsedQty}]`;
            }
        }

        const newItem = await prisma.foodItem.create({
            data: {
                shopId: shop.id,
                categoryId: finalCategoryId,
                name: name.trim(),
                description: finalDescription,
                price: Number(price),
                isAvailable: isAvailable !== false
            },
            include: { category: true }
        });

        res.status(201).json({
            message: 'Menu item created successfully',
            item: {
                id: newItem.id,
                item_id: newItem.id,
                name: newItem.name,
                item_name: newItem.name,
                price: newItem.price,
                description: (description || '').trim(),
                quantityAvailable: parsedQty,
                isAvailable: newItem.isAvailable,
                category_name: newItem.category.name
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to add menu item' });
    }
};

export const updateStaffMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        const { itemId } = req.params;
        const iId = Number(itemId);

        const existing = await prisma.foodItem.findUnique({ where: { id: iId } });
        if (!existing) { res.status(404).json({ error: 'Menu item not found' }); return; }

        if (req.user?.role === 'STAFF' && shop && existing.shopId !== shop.id) {
            res.status(403).json({ error: 'Unauthorized: Cannot modify items of another stall' });
            return;
        }

        const { name, price, description, categoryId, categoryName, isAvailable, quantityAvailable, originalPrice, discountPercent, isDynamicPricing } = req.body;
        const updateData: any = {};

        if (name !== undefined) updateData.name = name.trim();
        if (price !== undefined && !isNaN(Number(price))) updateData.price = Number(price);
        if (originalPrice !== undefined && !isNaN(Number(originalPrice))) updateData.originalPrice = Number(originalPrice);
        if (discountPercent !== undefined && !isNaN(Number(discountPercent))) updateData.discountPercent = Number(discountPercent);
        if (isDynamicPricing !== undefined) updateData.isDynamicPricing = Boolean(isDynamicPricing);
        if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);

        if (description !== undefined || quantityAvailable !== undefined) {
            let baseDesc = description !== undefined
                ? description.trim().replace(/\[Qty:\s*(\d+)\]/i, '').trim()
                : (existing.description || '').replace(/\[Qty:\s*(\d+)\]/i, '').trim();

            if (quantityAvailable !== undefined) {
                if (quantityAvailable !== null && quantityAvailable !== '') {
                    const qNum = parseInt(String(quantityAvailable), 10);
                    if (!isNaN(qNum) && qNum >= 0) {
                        baseDesc = baseDesc ? `${baseDesc} [Qty: ${qNum}]` : `[Qty: ${qNum}]`;
                    }
                }
            } else {
                const existingMatch = (existing.description || '').match(/\[Qty:\s*(\d+)\]/i);
                if (existingMatch) {
                    baseDesc = baseDesc ? `${baseDesc} ${existingMatch[0]}` : existingMatch[0];
                }
            }
            updateData.description = baseDesc;
        }

        if (categoryId !== undefined && !isNaN(Number(categoryId))) {
            updateData.categoryId = Number(categoryId);
        } else if (categoryName && String(categoryName).trim()) {
            const cat = await prisma.category.upsert({
                where: { name: String(categoryName).trim() },
                update: {},
                create: { name: String(categoryName).trim() }
            });
            updateData.categoryId = cat.id;
        }

        const updated = await prisma.foodItem.update({
            where: { id: iId },
            data: updateData,
            include: { category: true }
        });

        let cleanDescription = updated.description || '';
        let retQty: number | null = null;
        const match = cleanDescription.match(/\[Qty:\s*(\d+)\]/i);
        if (match) {
            retQty = parseInt(match[1], 10);
            cleanDescription = cleanDescription.replace(/\[Qty:\s*(\d+)\]/i, '').trim();
        }

        res.json({
            message: 'Menu item updated successfully',
            item: {
                id: updated.id,
                item_id: updated.id,
                name: updated.name,
                item_name: updated.name,
                price: updated.price,
                originalPrice: updated.originalPrice || updated.price,
                discountPercent: updated.discountPercent || 0,
                isDynamicPricing: Boolean(updated.isDynamicPricing),
                description: cleanDescription,
                quantityAvailable: retQty,
                isAvailable: updated.isAvailable,
                category_name: updated.category.name
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update menu item' });
    }
};

export const deleteStaffMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        const { itemId } = req.params;
        const iId = Number(itemId);

        const existing = await prisma.foodItem.findUnique({ where: { id: iId } });
        if (!existing) { res.status(404).json({ error: 'Menu item not found' }); return; }

        if (req.user?.role === 'STAFF' && shop && existing.shopId !== shop.id) {
            res.status(403).json({ error: 'Unauthorized: Cannot delete items of another stall' });
            return;
        }

        // If item has order references, soft delete by toggling isAvailable to false
        const orderCount = await prisma.orderItem.count({ where: { itemId: iId } });
        if (orderCount > 0) {
            await prisma.foodItem.update({
                where: { id: iId },
                data: { isAvailable: false }
            });
            res.json({ message: 'Item has prior orders; marked as unavailable' });
        } else {
            await prisma.foodItem.delete({ where: { id: iId } });
            res.json({ message: 'Menu item deleted successfully' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to delete menu item' });
    }
};

// ==========================================
// 5. STALL PROFILE & SETTINGS
// ==========================================
export const getStaffStallInfo = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        if (!shop) { res.status(404).json({ error: 'No stall found' }); return; }

        const staffUser = await prisma.user.findUnique({ where: { id: staffId } });

        res.json({
            stall: {
                id: shop.id,
                name: shop.name,
                status: shop.status,
                area: shop.area?.name || 'Campus Outlet',
                areaDescription: shop.area?.description || '',
                isClosingSoon: Boolean(shop.isClosingSoon),
                closingDiscount: shop.closingDiscount || 0
            },
            staff: {
                id: staffUser?.id,
                name: staffUser?.fullName,
                email: staffUser?.email,
                phone: staffUser?.phone
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stall info' });
    }
};

export const updateStaffStallInfo = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        if (!shop) { res.status(404).json({ error: 'No stall found' }); return; }

        const { name, status } = req.body;
        const updateData: any = {};
        if (name && name.trim()) updateData.name = name.trim();
        if (status) updateData.status = status;

        const updated = await prisma.shop.update({
            where: { id: shop.id },
            data: updateData,
            include: { area: true }
        });

        res.json({
            message: 'Stall updated successfully',
            stall: {
                id: updated.id,
                name: updated.name,
                status: updated.status,
                area: updated.area?.name || 'Campus Outlet'
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update stall info' });
    }
};

export const getCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

// ==========================================
// 6. DYNAMIC PRICING & CLOSING CLEARANCE
// ==========================================
export const toggleClosingClearance = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        if (!shop) { res.status(404).json({ error: 'No stall found for staff' }); return; }

        const { isClosingSoon, discountPercent, onlySurplus } = req.body;
        const closingDiscount = Number(discountPercent) || 25;

        if (isClosingSoon) {
            await prisma.shop.update({
                where: { id: shop.id },
                data: {
                    isClosingSoon: true,
                    closingDiscount: closingDiscount
                }
            });

            const items = await prisma.foodItem.findMany({
                where: { shopId: shop.id, isAvailable: true }
            });

            for (const item of items) {
                let hasSurplus = true;
                if (onlySurplus) {
                    const match = (item.description || '').match(/\[Qty:\s*(\d+)\]/i);
                    const qty = match ? parseInt(match[1], 10) : 0;
                    // If description doesn't explicitly mark a quantity limit, treat it as general surplus stock
                    hasSurplus = match ? qty > 0 : true;
                }

                if (hasSurplus) {
                    const baseOriginal = (item.originalPrice && item.originalPrice > 0) ? item.originalPrice : item.price;
                    const discounted = Math.max(5, Math.round(baseOriginal * (1 - closingDiscount / 100)));

                    await prisma.foodItem.update({
                        where: { id: item.id },
                        data: {
                            originalPrice: baseOriginal,
                            price: discounted,
                            discountPercent: closingDiscount,
                            isDynamicPricing: true
                        }
                    });
                }
            }

            res.json({
                message: `Closing clearance sale active: ${closingDiscount}% discount applied to items`,
                isClosingSoon: true,
                closingDiscount
            });
        } else {
            await prisma.shop.update({
                where: { id: shop.id },
                data: {
                    isClosingSoon: false,
                    closingDiscount: 0
                }
            });

            const items = await prisma.foodItem.findMany({
                where: { shopId: shop.id }
            });

            for (const item of items) {
                const regularPrice = (item.originalPrice && item.originalPrice > 0) ? item.originalPrice : item.price;
                await prisma.foodItem.update({
                    where: { id: item.id },
                    data: {
                        price: regularPrice,
                        discountPercent: 0,
                        isDynamicPricing: false
                    }
                });
            }

            res.json({
                message: 'Closing clearance ended. Regular menu prices restored.',
                isClosingSoon: false,
                closingDiscount: 0
            });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to toggle closing clearance' });
    }
};

export const toggleItemDynamicPricing = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shop = await getStaffAssignedShop(staffId, req.user?.shopId);
        const { itemId } = req.params;
        const iId = Number(itemId);

        const existing = await prisma.foodItem.findUnique({ where: { id: iId } });
        if (!existing) { res.status(404).json({ error: 'Menu item not found' }); return; }

        if (req.user?.role === 'STAFF' && shop && existing.shopId !== shop.id) {
            res.status(403).json({ error: 'Unauthorized: Cannot modify items of another stall' });
            return;
        }

        const { isDynamicPricing, discountPercent, customPrice } = req.body;

        if (isDynamicPricing) {
            const pct = Number(discountPercent) || 20;
            const originalPrice = (existing.originalPrice && existing.originalPrice > 0) ? existing.originalPrice : existing.price;
            const discountedPrice = (customPrice !== undefined && Number(customPrice) > 0)
                ? Number(customPrice)
                : Math.max(5, Math.round(originalPrice * (1 - pct / 100)));

            const updated = await prisma.foodItem.update({
                where: { id: iId },
                data: {
                    originalPrice: originalPrice,
                    price: discountedPrice,
                    discountPercent: pct,
                    isDynamicPricing: true
                },
                include: { category: true }
            });

            res.json({
                message: `Surplus discount of ${pct}% applied to ${updated.name}`,
                item: {
                    id: updated.id,
                    name: updated.name,
                    price: updated.price,
                    originalPrice: updated.originalPrice,
                    discountPercent: updated.discountPercent,
                    isDynamicPricing: updated.isDynamicPricing
                }
            });
        } else {
            const regularPrice = (existing.originalPrice && existing.originalPrice > 0) ? existing.originalPrice : existing.price;
            const updated = await prisma.foodItem.update({
                where: { id: iId },
                data: {
                    price: regularPrice,
                    discountPercent: 0,
                    isDynamicPricing: false
                },
                include: { category: true }
            });

            res.json({
                message: `Surplus discount removed for ${updated.name}`,
                item: {
                    id: updated.id,
                    name: updated.name,
                    price: updated.price,
                    originalPrice: updated.originalPrice,
                    discountPercent: updated.discountPercent,
                    isDynamicPricing: updated.isDynamicPricing
                }
            });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to toggle dynamic pricing on item' });
    }
};
