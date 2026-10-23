import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';
import { seedRealisticCampusOrders } from '../services/seedService';

/**
 * ============================================================================
 * AUDIT LOGGING HELPER
 * ============================================================================
 */
export const recordAuditLog = async (
    adminId: number,
    action: string,
    entity: string,
    entityId?: number | null,
    details?: string | null | Record<string, any>
): Promise<void> => {
    try {
        const detailsString = details && typeof details === 'object'
            ? JSON.stringify(details)
            : (details ? String(details) : null);

        await prisma.auditLog.create({
            data: {
                adminId,
                action,
                entity,
                entityId: entityId !== undefined ? entityId : null,
                details: detailsString
            }
        });
    } catch (err) {
        console.error('Failed to record audit log:', err);
    }
};

/**
 * Valid transitions for order lifecycle
 */
const VALID_ADMIN_TRANSITIONS: Record<string, string[]> = {
    'PAYMENT_PENDING': ['PLACED', 'CANCELLED', 'PAYMENT_FAILED'],
    'PLACED':          ['PREPARING', 'READY', 'CANCELLED'],
    'PREPARING':       ['READY', 'COMPLETED', 'CANCELLED'],
    'READY':           ['COMPLETED', 'CANCELLED'],
    'COMPLETED':       [],
    'CANCELLED':       [],
    'PAYMENT_FAILED':  ['PAYMENT_PENDING', 'CANCELLED']
};

/**
 * ============================================================================
 * 1. ADMIN OVERVIEW & CALCULATED STATISTICS REPORT (DATABASE-AGGREGATED)
 * ============================================================================
 */
export const getAdminOverviewStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Verified paid completed orders filter
        const verifiedPaidFilter = {
            status: 'COMPLETED',
            payments: { some: { status: 'SUCCESS' } }
        };

        // Stage 1: Order volume counts
        const [
            totalOrders,
            todayOrders,
            activeOrdersCount,
            completedOrdersCount,
            cancelledOrdersCount
        ] = await Promise.all([
            prisma.order.count(),
            prisma.order.count({ where: { orderTime: { gte: startOfToday } } }),
            prisma.order.count({ where: { status: { in: ['PLACED', 'PREPARING', 'READY', 'PAYMENT_PENDING'] } } }),
            prisma.order.count({ where: { status: 'COMPLETED' } }),
            prisma.order.count({ where: { status: { in: ['CANCELLED', 'PAYMENT_FAILED'] } } })
        ]);

        // Stage 2: Verified revenue aggregations & user counts
        const [
            revenueAggregate,
            todayRevenueAggregate,
            totalUsers,
            staffUsers
        ] = await Promise.all([
            prisma.order.aggregate({
                where: verifiedPaidFilter,
                _sum: { totalAmount: true },
                _avg: { totalAmount: true }
            }),
            prisma.order.aggregate({
                where: {
                    ...verifiedPaidFilter,
                    orderTime: { gte: startOfToday }
                },
                _sum: { totalAmount: true }
            }),
            prisma.user.count(),
            prisma.userRole.count({ where: { role: { name: 'STAFF' } } })
        ]);

        // Stage 3: Outlets & Catalog metrics
        const [
            allShops,
            totalFoodItems,
            dynamicPricingItems
        ] = await Promise.all([
            prisma.shop.findMany({
                include: {
                    area: true,
                    staff: { include: { staff: true } },
                    _count: { select: { items: true } }
                }
            }),
            prisma.foodItem.count(),
            prisma.foodItem.count({ where: { isDynamicPricing: true } })
        ]);

        // Stage 4: Order status, payment method & shop aggregations
        const [
            statusGroups,
            paymentGroups,
            shopStatusGroups,
            shopCompletedRevenueGroups
        ] = await Promise.all([
            prisma.order.groupBy({
                by: ['status'],
                _count: { id: true }
            }),
            prisma.order.groupBy({
                by: ['paymentMethod'],
                _count: { id: true },
                _sum: { totalAmount: true }
            }),
            prisma.order.groupBy({
                by: ['shopId', 'status'],
                _count: { id: true }
            }),
            prisma.order.groupBy({
                by: ['shopId'],
                where: verifiedPaidFilter,
                _sum: { totalAmount: true },
                _count: { id: true },
                _avg: { estimatedMinutes: true }
            })
        ]);

        // Stage 5: Trend history and top selling items
        const [
            recentOrders,
            topSoldItemGroups
        ] = await Promise.all([
            prisma.order.findMany({
                where: { orderTime: { gte: sevenDaysAgo } },
                select: {
                    orderTime: true,
                    totalAmount: true,
                    status: true,
                    payments: { select: { status: true } }
                }
            }),
            prisma.orderItem.groupBy({
                by: ['itemId'],
                where: {
                    order: verifiedPaidFilter
                },
                _sum: { quantity: true },
                orderBy: {
                    _sum: { quantity: 'desc' }
                },
                take: 10
            })
        ]);

        const totalRevenue = revenueAggregate._sum.totalAmount || 0;
        const todayRevenue = todayRevenueAggregate._sum.totalAmount || 0;
        const averageOrderValue = completedOrdersCount > 0
            ? Math.round(totalRevenue / completedOrdersCount)
            : 0;

        // Status counts mapping
        const statusCounts: Record<string, number> = {
            'PLACED': 0,
            'PREPARING': 0,
            'READY': 0,
            'COMPLETED': 0,
            'CANCELLED': 0,
            'PAYMENT_PENDING': 0,
            'PAYMENT_FAILED': 0
        };
        statusGroups.forEach(g => {
            statusCounts[g.status] = g._count.id;
        });

        // Shop performance computation from database aggregations
        const shopOrderMap = new Map<number, { total: number; active: number }>();
        shopStatusGroups.forEach(sg => {
            const current = shopOrderMap.get(sg.shopId) || { total: 0, active: 0 };
            current.total += sg._count.id;
            if (['PLACED', 'PREPARING', 'READY', 'PAYMENT_PENDING'].includes(sg.status)) {
                current.active += sg._count.id;
            }
            shopOrderMap.set(sg.shopId, current);
        });

        const shopCompletedMap = new Map<number, { revenue: number; completedCount: number; avgPrepTime: number }>();
        shopCompletedRevenueGroups.forEach(cg => {
            shopCompletedMap.set(cg.shopId, {
                revenue: cg._sum.totalAmount || 0,
                completedCount: cg._count.id,
                avgPrepTime: Math.round(cg._avg.estimatedMinutes || 10)
            });
        });

        const stallPerformance = allShops.map(shop => {
            const orderStats = shopOrderMap.get(shop.id) || { total: 0, active: 0 };
            const compStats = shopCompletedMap.get(shop.id) || { revenue: 0, completedCount: 0, avgPrepTime: 10 };
            const staffNames = shop.staff.map(s => s.staff.fullName);

            return {
                shop_id: shop.id,
                name: shop.name,
                area_name: shop.area?.name || 'Campus Outlet',
                status: shop.status,
                isClosingSoon: Boolean(shop.isClosingSoon),
                closingDiscount: shop.closingDiscount || 0,
                totalOrders: orderStats.total,
                completedOrders: compStats.completedCount,
                activeOrders: orderStats.active,
                revenue: compStats.revenue,
                avgPrepTime: compStats.avgPrepTime,
                staffCount: shop.staff.length,
                staffNames,
                menuItemsCount: shop._count.items
            };
        }).sort((a, b) => b.revenue - a.revenue);

        // Top Selling Menu Items details
        let topSellingItems: any[] = [];
        if (topSoldItemGroups.length > 0) {
            const topItemIds = topSoldItemGroups.map(g => g.itemId);
            const items = await prisma.foodItem.findMany({
                where: { id: { in: topItemIds } },
                include: { category: true, shop: true }
            });
            const itemMap = new Map(items.map(it => [it.id, it]));

            topSellingItems = topSoldItemGroups.map(g => {
                const item = itemMap.get(g.itemId);
                const unitsSold = g._sum.quantity || 0;
                const price = item?.price || 0;
                return {
                    id: g.itemId,
                    name: item?.name || 'Menu Item',
                    category_name: item?.category?.name || 'General',
                    shop_name: item?.shop?.name || 'Outlet',
                    price,
                    unitsSold,
                    revenue: unitsSold * price
                };
            });
        }

        // Hourly Distribution (calculated for today)
        const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({ hour, ordersCount: 0, revenue: 0 }));
        recentOrders.forEach(o => {
            const orderTime = new Date(o.orderTime);
            if (orderTime >= startOfToday) {
                const hour = orderTime.getHours();
                if (hour >= 0 && hour < 24) {
                    hourlyDistribution[hour].ordersCount++;
                    const isVerifiedPaid = o.status === 'COMPLETED' && o.payments.some(p => p.status === 'SUCCESS');
                    if (isVerifiedPaid) {
                        hourlyDistribution[hour].revenue += o.totalAmount;
                    }
                }
            }
        });

        // Daily Trend for Last 7 Days
        const dailyTrend: { date: string; dayLabel: string; ordersCount: number; revenue: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            const dayOrders = recentOrders.filter(o => {
                const odStr = new Date(o.orderTime).toISOString().split('T')[0];
                return odStr === dateStr;
            });

            const dayRevenue = dayOrders
                .filter(o => o.status === 'COMPLETED' && o.payments.some(p => p.status === 'SUCCESS'))
                .reduce((acc, o) => acc + o.totalAmount, 0);

            dailyTrend.push({
                date: dateStr,
                dayLabel,
                ordersCount: dayOrders.length,
                revenue: dayRevenue
            });
        }

        // Payment stats breakdown
        const paymentStatsArray = paymentGroups.map(g => {
            const method = g.paymentMethod || 'ONLINE';
            const count = g._count.id;
            const revenue = g._sum.totalAmount || 0;
            return {
                method,
                count,
                revenue,
                percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0
            };
        }).sort((a, b) => b.count - a.count);

        res.json({
            summary: {
                totalRevenue,
                todayRevenue,
                totalOrders,
                todayOrders,
                activeOrdersCount,
                completedOrdersCount,
                cancelledOrdersCount,
                averageOrderValue,
                totalUsers,
                totalStaff: staffUsers,
                totalOutlets: allShops.length,
                totalFoodItems,
                dynamicPricingItems,
                closingSoonOutletsCount: allShops.filter(s => s.isClosingSoon).length
            },
            stallPerformance,
            hourlyDistribution,
            topSellingItems,
            paymentStats: paymentStatsArray,
            statusBreakdown: statusCounts,
            dailyTrend
        });
    } catch (error: any) {
        console.error('Error fetching admin overview stats:', error);
        res.status(500).json({ error: error.message || 'Failed to calculate platform statistics' });
    }
};

/**
 * ============================================================================
 * 2. LIVE REAL-TIME KITCHEN & ORDER STREAM (ENHANCED WITH SEARCH & PAGINATION)
 * ============================================================================
 */
export const getLiveOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const {
            status,
            shopId,
            customerId,
            startDate,
            endDate,
            limit = '60',
            page = '1',
            search,
            q
        } = req.query;

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 60));
        const searchQuery = String(search || q || '').trim();

        const where: any = {};
        if (status && status !== 'ALL') {
            where.status = String(status);
        }
        if (shopId && shopId !== 'ALL') {
            where.shopId = Number(shopId);
        }
        if (customerId) {
            where.customerId = Number(customerId);
        }
        if (startDate || endDate) {
            where.orderTime = {};
            if (startDate) where.orderTime.gte = new Date(String(startDate));
            if (endDate) {
                const endD = new Date(String(endDate));
                if (String(endDate).length <= 10) endD.setHours(23, 59, 59, 999);
                where.orderTime.lte = endD;
            }
        }

        if (searchQuery) {
            const searchNum = Number(searchQuery);
            const searchOr: any[] = [
                { customer: { fullName: { contains: searchQuery, mode: 'insensitive' } } },
                { customer: { email: { contains: searchQuery, mode: 'insensitive' } } },
                { shop: { name: { contains: searchQuery, mode: 'insensitive' } } }
            ];
            if (!isNaN(searchNum)) {
                searchOr.push({ id: searchNum });
            }
            where.OR = searchOr;
        }

        const [total, orders] = await Promise.all([
            prisma.order.count({ where }),
            prisma.order.findMany({
                where,
                include: {
                    shop: { include: { area: true } },
                    customer: true,
                    items: { include: { item: true } },
                    payments: true
                },
                orderBy: { orderTime: 'desc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum
            })
        ]);

        const mapped = orders.map(o => ({
            id: o.id,
            shop_id: o.shopId,
            shop_name: o.shop?.name || 'Campus Outlet',
            area_name: o.shop?.area?.name || 'Central Court',
            status: o.status,
            totalAmount: o.totalAmount,
            orderTime: o.orderTime,
            isPreorder: o.isPreorder,
            pickupTime: o.pickupTime,
            estimatedMinutes: o.estimatedMinutes || 10,
            queueNumber: o.queueNumber || 1,
            paymentMethod: o.paymentMethod || 'ONLINE',
            pickup_token: `TK-${1000 + (o.id % 9000)}`,
            customer: {
                id: o.customer?.id,
                name: o.customer?.fullName || 'Campus Student',
                email: o.customer?.email,
                phone: o.customer?.phone
            },
            items: o.items.map(oi => ({
                id: oi.id,
                itemId: oi.itemId,
                name: oi.item?.name || 'Special Item',
                quantity: oi.quantity,
                priceAtOrder: oi.priceAtOrder
            })),
            paymentStatus: o.payments?.[0]?.status || (o.status === 'COMPLETED' ? 'SUCCESS' : 'PENDING')
        }));

        res.json({
            orders: mapped,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        });
    } catch (error: any) {
        console.error('Error fetching live orders:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch live orders stream' });
    }
};

/**
 * ============================================================================
 * 3. UPDATE ORDER STATUS (ADMIN OVERRIDE WITH STATE TRANSITION ENFORCEMENT)
 * ============================================================================
 */
export const updateOrderStatusByAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const oId = Number(orderId);

        if (!status) {
            res.status(400).json({ error: 'Status is required' });
            return;
        }

        const existing = await prisma.order.findUnique({
            where: { id: oId },
            include: { payments: true }
        });

        if (!existing) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        // Enforce state transitions
        const allowedNext = VALID_ADMIN_TRANSITIONS[existing.status] || [];
        if (!allowedNext.includes(status)) {
            res.status(400).json({
                error: `Illegal state transition: Cannot change order status from "${existing.status}" to "${status}". Allowed next transitions: [${allowedNext.join(', ')}]`
            });
            return;
        }

        // Enforce payment verification: Do not allow marking paid merely by changing status
        if (['PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(existing.status) && ['PLACED', 'PREPARING', 'READY', 'COMPLETED'].includes(status)) {
            const hasVerifiedPayment = existing.payments.some(p => p.status === 'SUCCESS');
            if (!hasVerifiedPayment) {
                res.status(400).json({
                    error: 'Cannot advance order without verified payment transaction. Changing status does not bypass payment verification.'
                });
                return;
            }
        }

        const updated = await prisma.order.update({
            where: { id: oId },
            data: { status }
        });

        // Record audit log
        if (req.user?.userId) {
            await recordAuditLog(
                req.user.userId,
                'UPDATE_ORDER_STATUS',
                'ORDER',
                oId,
                `Admin changed status of Order #${oId} from ${existing.status} to ${status}`
            );
        }

        res.json({
            message: `Order #${oId} status updated to ${status}`,
            order: updated
        });
    } catch (error: any) {
        console.error('Error updating order status by admin:', error);
        res.status(500).json({ error: error.message || 'Failed to update order status' });
    }
};

/**
 * ============================================================================
 * 4. ALL STALLS MANAGEMENT (ADMIN)
 * ============================================================================
 */
export const getAllStalls = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const shops = await prisma.shop.findMany({
            include: {
                area: true,
                owner: true,
                staff: { include: { staff: true } },
                items: true,
                orders: {
                    select: { id: true, status: true, totalAmount: true, payments: { select: { status: true } } }
                }
            },
            orderBy: { id: 'asc' }
        });

        const mapped = shops.map(s => {
            const completedOrders = s.orders.filter(o => o.status === 'COMPLETED' && o.payments.some(p => p.status === 'SUCCESS'));
            const activeOrders = s.orders.filter(o => ['PLACED', 'PREPARING', 'READY', 'PAYMENT_PENDING'].includes(o.status));
            const revenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

            return {
                id: s.id,
                name: s.name,
                status: s.status,
                area_id: s.areaId,
                area_name: s.area?.name || 'Campus Outlet',
                owner_id: s.ownerId,
                owner_name: s.owner?.fullName || 'Stall Owner',
                owner_email: s.owner?.email,
                isClosingSoon: Boolean(s.isClosingSoon),
                closingDiscount: s.closingDiscount || 0,
                totalOrders: s.orders.length,
                activeOrders: activeOrders.length,
                revenue,
                menuItemsCount: s.items.length,
                staff: s.staff.map(st => ({
                    id: st.staff.id,
                    name: st.staff.fullName,
                    email: st.staff.email,
                    phone: st.staff.phone
                }))
            };
        });

        res.json(mapped);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch stalls' });
    }
};

/**
 * ============================================================================
 * 5. CREATE NEW OUTLET (ADMIN)
 * ============================================================================
 */
export const createStallByAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, areaId, ownerId } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ error: 'Valid outlet name is required' });
            return;
        }
        if (!areaId) {
            res.status(400).json({ error: 'areaId is required' });
            return;
        }
        if (!ownerId) {
            res.status(400).json({ error: 'ownerId is required' });
            return;
        }

        const area = await prisma.area.findUnique({ where: { id: Number(areaId) } });
        if (!area) {
            res.status(400).json({ error: 'Specified area not found' });
            return;
        }

        const owner = await prisma.user.findUnique({ where: { id: Number(ownerId) } });
        if (!owner) {
            res.status(400).json({ error: 'Specified owner user not found' });
            return;
        }

        const stall = await prisma.shop.create({
            data: {
                name: name.trim(),
                areaId: Number(areaId),
                ownerId: Number(ownerId),
                status: 'ACTIVE'
            },
            include: { area: true, owner: true }
        });

        if (req.user?.userId) {
            await recordAuditLog(
                req.user.userId,
                'CREATE_STALL',
                'SHOP',
                stall.id,
                `Created new outlet "${stall.name}" in area "${area.name}" with owner "${owner.fullName}"`
            );
        }

        res.status(201).json({
            message: `Outlet "${stall.name}" created successfully`,
            stall
        });
    } catch (error: any) {
        console.error('Error creating stall:', error);
        res.status(500).json({ error: error.message || 'Failed to create stall' });
    }
};

/**
 * ============================================================================
 * 6. UPDATE STALL SETTINGS (ADMIN)
 * ============================================================================
 */
export const updateStallByAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { shopId } = req.params;
        const sId = Number(shopId);
        const { name, areaId, status, isClosingSoon, closingDiscount } = req.body;

        const existing = await prisma.shop.findUnique({ where: { id: sId } });
        if (!existing) {
            res.status(404).json({ error: 'Stall not found' });
            return;
        }

        const updateData: any = {};
        if (name && typeof name === 'string' && name.trim()) {
            updateData.name = name.trim();
        }
        if (areaId !== undefined) {
            const area = await prisma.area.findUnique({ where: { id: Number(areaId) } });
            if (!area) {
                res.status(400).json({ error: 'Specified area not found' });
                return;
            }
            updateData.areaId = Number(areaId);
        }
        if (status) {
            if (!['ACTIVE', 'INACTIVE', 'CLOSED'].includes(status)) {
                res.status(400).json({ error: 'Status must be ACTIVE, INACTIVE, or CLOSED' });
                return;
            }
            updateData.status = status;
        }
        if (isClosingSoon !== undefined) {
            updateData.isClosingSoon = Boolean(isClosingSoon);
        }
        if (closingDiscount !== undefined) {
            const discountNum = Number(closingDiscount);
            if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
                res.status(400).json({ error: 'Closing discount must be a percentage between 0 and 100' });
                return;
            }
            updateData.closingDiscount = discountNum;
        }

        const updated = await prisma.shop.update({
            where: { id: sId },
            data: updateData,
            include: { area: true, owner: true }
        });

        if (req.user?.userId) {
            await recordAuditLog(
                req.user.userId,
                'UPDATE_STALL',
                'SHOP',
                sId,
                `Updated outlet "${updated.name}" settings: ${JSON.stringify(updateData)}`
            );
        }

        res.json({
            message: `Stall ${updated.name} updated successfully`,
            stall: updated
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update stall' });
    }
};

/**
 * ============================================================================
 * 7. VIEW STAFF ASSIGNED TO OUTLET
 * ============================================================================
 */
export const getStallStaff = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const sId = Number(req.params.shopId);
        const shop = await prisma.shop.findUnique({ where: { id: sId } });
        if (!shop) {
            res.status(404).json({ error: 'Outlet not found' });
            return;
        }

        const staffRecords = await prisma.shopStaff.findMany({
            where: { shopId: sId },
            include: {
                staff: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        isActive: true,
                        createdAt: true
                    }
                }
            }
        });

        res.json(staffRecords.map(s => s.staff));
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch stall staff' });
    }
};

/**
 * ============================================================================
 * 8. VIEW MENU ITEMS FOR OUTLET
 * ============================================================================
 */
export const getStallMenu = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const sId = Number(req.params.shopId);
        const shop = await prisma.shop.findUnique({ where: { id: sId } });
        if (!shop) {
            res.status(404).json({ error: 'Outlet not found' });
            return;
        }

        const items = await prisma.foodItem.findMany({
            where: { shopId: sId },
            include: { category: true },
            orderBy: { id: 'asc' }
        });

        res.json(items);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch stall menu' });
    }
};

/**
 * ============================================================================
 * 9. USER DIRECTORY & ACCESS CONTROL (SEARCH, FILTER & PAGINATION)
 * ============================================================================
 */
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { search, q, role, page = '1', limit = '20' } = req.query;
        const searchQuery = String(search || q || '').trim();
        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

        const where: any = {};
        if (searchQuery) {
            where.OR = [
                { fullName: { contains: searchQuery, mode: 'insensitive' } },
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { phone: { contains: searchQuery, mode: 'insensitive' } }
            ];
        }

        if (role && role !== 'ALL') {
            where.roles = {
                some: {
                    role: { name: String(role) }
                }
            };
        }

        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                include: {
                    roles: { include: { role: true } },
                    staffShops: { include: { shop: true } },
                    _count: { select: { orders: true } }
                },
                orderBy: { id: 'asc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum
            })
        ]);

        const mapped = users.map(u => {
            const userRole = u.roles.length > 0 ? u.roles[0].role.name : 'CUSTOMER';
            const assignedShop = u.staffShops.length > 0 ? u.staffShops[0].shop.name : null;

            return {
                id: u.id,
                fullName: u.fullName,
                email: u.email,
                phone: u.phone,
                role: userRole,
                isActive: u.isActive,
                createdAt: u.createdAt,
                ordersCount: u._count.orders,
                assignedShop
            };
        });

        res.json({
            users: mapped,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
};

/**
 * ============================================================================
 * 10. UPDATE USER ROLE & STALL ASSIGNMENT (WITH ADMIN LOCKOUT PROTECTION)
 * ============================================================================
 */
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const uId = Number(userId);
        const { role, shopId, isActive } = req.body;

        const user = await prisma.user.findUnique({
            where: { id: uId },
            include: { roles: { include: { role: true } } }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const isCurrentlyAdmin = user.roles.some(r => r.role.name === 'ADMIN');

        // Prevent accidental lockout of the last remaining active administrator
        if (isCurrentlyAdmin && ((role && role !== 'ADMIN') || isActive === false)) {
            const activeAdminCount = await prisma.userRole.count({
                where: {
                    role: { name: 'ADMIN' },
                    user: { isActive: true }
                }
            });

            if (activeAdminCount <= 1) {
                res.status(400).json({
                    error: 'Cannot modify or demote the last remaining active administrator. At least one ADMIN must remain active.'
                });
                return;
            }
        }

        if (isActive !== undefined) {
            await prisma.user.update({
                where: { id: uId },
                data: { isActive: Boolean(isActive) }
            });
        }

        if (role) {
            if (!['CUSTOMER', 'STAFF', 'OWNER', 'ADMIN'].includes(role)) {
                res.status(400).json({ error: 'Invalid role specified. Must be CUSTOMER, STAFF, OWNER, or ADMIN' });
                return;
            }

            const roleRecord = await prisma.role.upsert({
                where: { name: role },
                update: {},
                create: { name: role }
            });

            // Remove existing roles and assign new role
            await prisma.userRole.deleteMany({ where: { userId: uId } });
            await prisma.userRole.create({
                data: { userId: uId, roleId: roleRecord.id }
            });

            // Handle stall assignment for STAFF
            if (role === 'STAFF' && shopId) {
                await prisma.shopStaff.upsert({
                    where: { shopId_staffId: { shopId: Number(shopId), staffId: uId } },
                    update: {},
                    create: { shopId: Number(shopId), staffId: uId }
                });
            } else if (role !== 'STAFF') {
                await prisma.shopStaff.deleteMany({ where: { staffId: uId } });
            }
        }

        if (req.user?.userId) {
            await recordAuditLog(
                req.user.userId,
                'UPDATE_USER_ROLE',
                'USER',
                uId,
                `Updated role for user ${user.fullName} (${user.email}): new role=${role || 'unchanged'}, isActive=${isActive !== undefined ? isActive : user.isActive}`
            );
        }

        res.json({ message: `User ${user.fullName} updated successfully` });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update user role' });
    }
};

/**
 * ============================================================================
 * 11. TOGGLE USER ACTIVE STATUS (WITH ADMIN LOCKOUT PROTECTION)
 * ============================================================================
 */
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const uId = Number(req.params.userId);
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            res.status(400).json({ error: 'isActive must be a boolean value' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: uId },
            include: { roles: { include: { role: true } } }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Lockout protection: Cannot deactivate the last remaining active administrator
        const isCurrentlyAdmin = user.roles.some(r => r.role.name === 'ADMIN');
        if (isCurrentlyAdmin && isActive === false) {
            const activeAdminCount = await prisma.userRole.count({
                where: {
                    role: { name: 'ADMIN' },
                    user: { isActive: true }
                }
            });

            if (activeAdminCount <= 1) {
                res.status(400).json({
                    error: 'Cannot deactivate the last remaining active administrator. At least one ADMIN must remain active.'
                });
                return;
            }
        }

        const updated = await prisma.user.update({
            where: { id: uId },
            data: { isActive }
        });

        if (req.user?.userId) {
            await recordAuditLog(
                req.user.userId,
                'UPDATE_USER_STATUS',
                'USER',
                uId,
                `${isActive ? 'Activated' : 'Deactivated'} account for ${user.fullName} (${user.email})`
            );
        }

        res.json({
            message: `User ${updated.fullName} account has been ${isActive ? 'activated' : 'deactivated'}`,
            user: updated
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update user status' });
    }
};

/**
 * ============================================================================
 * 12. AUDIT LOGS QUERY ENDPOINT (FILTER & PAGINATION)
 * ============================================================================
 */
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { page = '1', limit = '20', entity, action, search } = req.query;
        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

        const where: any = {};
        if (entity && entity !== 'ALL') {
            where.entity = String(entity);
        }
        if (action && action !== 'ALL') {
            where.action = String(action);
        }
        if (search && String(search).trim()) {
            const q = String(search).trim();
            where.OR = [
                { action: { contains: q, mode: 'insensitive' } },
                { details: { contains: q, mode: 'insensitive' } },
                { admin: { fullName: { contains: q, mode: 'insensitive' } } },
                { admin: { email: { contains: q, mode: 'insensitive' } } }
            ];
        }

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                include: {
                    admin: {
                        select: { id: true, fullName: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum
            })
        ]);

        res.json({
            logs,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        });
    } catch (error: any) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
};

/**
 * ============================================================================
 * 13. COMPREHENSIVE REPORTS ENDPOINT
 * ============================================================================
 */
export const getAdminReports = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { startDate, endDate, shopId } = req.query;

        const where: any = {};
        if (shopId && shopId !== 'ALL') {
            where.shopId = Number(shopId);
        }
        if (startDate || endDate) {
            where.orderTime = {};
            if (startDate) where.orderTime.gte = new Date(String(startDate));
            if (endDate) {
                const endD = new Date(String(endDate));
                if (String(endDate).length <= 10) endD.setHours(23, 59, 59, 999);
                where.orderTime.lte = endD;
            }
        }

        // 1. Status breakdown
        const statusGroups = await prisma.order.groupBy({
            by: ['status'],
            where,
            _count: { id: true }
        });

        // 2. Orders per outlet
        const outletOrders = await prisma.order.groupBy({
            by: ['shopId'],
            where,
            _count: { id: true }
        });

        const verifiedRevenueByOutlet = await prisma.order.groupBy({
            by: ['shopId'],
            where: {
                ...where,
                status: 'COMPLETED',
                payments: { some: { status: 'SUCCESS' } }
            },
            _sum: { totalAmount: true },
            _count: { id: true }
        });

        const cancelledByOutlet = await prisma.order.groupBy({
            by: ['shopId'],
            where: {
                ...where,
                status: { in: ['CANCELLED', 'PAYMENT_FAILED'] }
            },
            _count: { id: true }
        });

        const shops = await prisma.shop.findMany({
            include: { area: true }
        });
        const shopMap = new Map(shops.map(s => [s.id, s]));

        const revMap = new Map(verifiedRevenueByOutlet.map(r => [r.shopId, r._sum.totalAmount || 0]));
        const compMap = new Map(verifiedRevenueByOutlet.map(r => [r.shopId, r._count.id || 0]));
        const cancMap = new Map(cancelledByOutlet.map(c => [c.shopId, c._count.id || 0]));

        const outletPerformance = outletOrders.map(o => {
            const s = shopMap.get(o.shopId);
            return {
                shopId: o.shopId,
                shopName: s?.name || `Outlet #${o.shopId}`,
                areaName: s?.area?.name || 'Campus',
                totalOrders: o._count.id,
                completedOrders: compMap.get(o.shopId) || 0,
                cancelledOrders: cancMap.get(o.shopId) || 0,
                verifiedRevenue: revMap.get(o.shopId) || 0
            };
        }).sort((a, b) => b.verifiedRevenue - a.verifiedRevenue);

        // 3. Orders per day & Verified revenue trend
        const ordersForDaily = await prisma.order.findMany({
            where,
            select: {
                orderTime: true,
                totalAmount: true,
                status: true,
                payments: { select: { status: true } }
            },
            orderBy: { orderTime: 'asc' }
        });

        const dailyAgg: Record<string, {
            date: string;
            dayLabel: string;
            totalOrders: number;
            completedOrders: number;
            cancelledOrders: number;
            verifiedRevenue: number;
        }> = {};

        ordersForDaily.forEach(o => {
            const d = new Date(o.orderTime);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            if (!dailyAgg[dateStr]) {
                dailyAgg[dateStr] = {
                    date: dateStr,
                    dayLabel,
                    totalOrders: 0,
                    completedOrders: 0,
                    cancelledOrders: 0,
                    verifiedRevenue: 0
                };
            }

            dailyAgg[dateStr].totalOrders++;
            const isVerifiedPaid = o.status === 'COMPLETED' && o.payments.some(p => p.status === 'SUCCESS');
            if (isVerifiedPaid) {
                dailyAgg[dateStr].completedOrders++;
                dailyAgg[dateStr].verifiedRevenue += o.totalAmount;
            }
            if (o.status === 'CANCELLED' || o.status === 'PAYMENT_FAILED') {
                dailyAgg[dateStr].cancelledOrders++;
            }
        });

        const ordersPerDay = Object.values(dailyAgg).sort((a, b) => a.date.localeCompare(b.date));

        // 4. Status distribution summary
        const totalFilteredOrders = ordersForDaily.length;
        const statusDistribution = statusGroups.map(g => ({
            status: g.status,
            count: g._count.id,
            percentage: totalFilteredOrders > 0 ? Math.round((g._count.id / totalFilteredOrders) * 100) : 0
        }));

        // 5. Total verified revenue in this period
        const totalVerifiedRevenue = ordersForDaily
            .filter(o => o.status === 'COMPLETED' && o.payments.some(p => p.status === 'SUCCESS'))
            .reduce((sum, o) => sum + o.totalAmount, 0);

        // 6. Cancellation trends
        const totalCancelled = ordersForDaily.filter(o => o.status === 'CANCELLED' || o.status === 'PAYMENT_FAILED').length;
        const cancellationRate = totalFilteredOrders > 0 ? Math.round((totalCancelled / totalFilteredOrders) * 100) : 0;

        res.json({
            period: {
                startDate: startDate || null,
                endDate: endDate || null,
                shopId: shopId || 'ALL'
            },
            summary: {
                totalOrders: totalFilteredOrders,
                totalVerifiedRevenue,
                totalCancelled,
                cancellationRate
            },
            ordersPerDay,
            outletPerformance,
            statusDistribution,
            verifiedRevenueOverTime: ordersPerDay.map(d => ({
                date: d.date,
                dayLabel: d.dayLabel,
                revenue: d.verifiedRevenue
            }))
        });
    } catch (error: any) {
        console.error('Error generating admin reports:', error);
        res.status(500).json({ error: error.message || 'Failed to generate admin reports' });
    }
};

/**
 * ============================================================================
 * 14. INJECT REAL-TIME ORDERS & REPORT DATA (ON-DEMAND SEEDER WITH AUDIT LOG)
 * ============================================================================
 */
export const seedRealtimeDataEndpoint = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const createdCount = await seedRealisticCampusOrders();

        if (req.user?.userId) {
            await recordAuditLog(
                req.user.userId,
                'SEED_REALTIME_DATA',
                'SYSTEM',
                null,
                `Admin triggered operational data seeder: generated ${createdCount} realistic orders`
            );
        }

        res.json({
            message: `Successfully populated ${createdCount} realistic real-time and historical orders for platform calculations!`,
            ordersCreated: createdCount
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to seed real-time data' });
    }
};
