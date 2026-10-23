import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';
import { seedRealisticCampusOrders } from '../services/seedService';

/**
 * ============================================================================
 * 1. ADMIN OVERVIEW & CALCULATED STATISTICS REPORT
 * ============================================================================
 */
export const getAdminOverviewStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Fetch parallel foundational data
        const [
            allOrders,
            allShops,
            totalUsers,
            staffUsers,
            totalFoodItems,
            dynamicPricingItems,
            allOrderItems
        ] = await Promise.all([
            prisma.order.findMany({
                include: {
                    shop: { include: { area: true } },
                    customer: true,
                    items: { include: { item: true } },
                    payments: true
                },
                orderBy: { orderTime: 'desc' }
            }),
            prisma.shop.findMany({
                include: {
                    area: true,
                    staff: { include: { staff: true } },
                    items: true
                }
            }),
            prisma.user.count(),
            prisma.userRole.count({
                where: { role: { name: 'STAFF' } }
            }),
            prisma.foodItem.count(),
            prisma.foodItem.count({ where: { isDynamicPricing: true } }),
            prisma.orderItem.findMany({
                include: {
                    item: { include: { category: true, shop: true } },
                    order: true
                }
            })
        ]);

        // 1. KPI Calculations
        let totalRevenue = 0;
        let todayRevenue = 0;
        let todayOrdersCount = 0;
        let activeOrdersCount = 0;
        let completedOrdersCount = 0;
        let cancelledOrdersCount = 0;

        const statusCounts: Record<string, number> = {
            'PLACED': 0,
            'PREPARING': 0,
            'READY': 0,
            'COMPLETED': 0,
            'CANCELLED': 0,
            'PAYMENT_PENDING': 0,
            'PAYMENT_FAILED': 0
        };

        const paymentMethodCounts: Record<string, { count: number; revenue: number }> = {};
        const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({ hour, ordersCount: 0, revenue: 0 }));

        allOrders.forEach(order => {
            const isCompleted = order.status === 'COMPLETED';
            const isCancelled = order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED';
            const isActive = ['PLACED', 'PREPARING', 'READY', 'PAYMENT_PENDING'].includes(order.status);

            if (isCompleted) {
                totalRevenue += order.totalAmount;
            }

            if (order.orderTime >= startOfToday) {
                todayOrdersCount++;
                if (isCompleted) {
                    todayRevenue += order.totalAmount;
                }
            }

            if (isActive) activeOrdersCount++;
            if (isCompleted) completedOrdersCount++;
            if (isCancelled) cancelledOrdersCount++;

            statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;

            // Payment method breakdown
            const pm = order.paymentMethod || 'ONLINE';
            if (!paymentMethodCounts[pm]) {
                paymentMethodCounts[pm] = { count: 0, revenue: 0 };
            }
            paymentMethodCounts[pm].count++;
            if (isCompleted) {
                paymentMethodCounts[pm].revenue += order.totalAmount;
            }

            // Hourly distribution
            const orderHour = new Date(order.orderTime).getHours();
            if (orderHour >= 0 && orderHour < 24) {
                hourlyDistribution[orderHour].ordersCount++;
                if (isCompleted) {
                    hourlyDistribution[orderHour].revenue += order.totalAmount;
                }
            }
        });

        const averageOrderValue = completedOrdersCount > 0 ? Math.round(totalRevenue / completedOrdersCount) : 0;

        // 2. Stall-wise Breakdown & Performance
        const stallPerformance = allShops.map(shop => {
            const shopOrders = allOrders.filter(o => o.shopId === shop.id);
            const completedShopOrders = shopOrders.filter(o => o.status === 'COMPLETED');
            const activeShopOrders = shopOrders.filter(o => ['PLACED', 'PREPARING', 'READY', 'PAYMENT_PENDING'].includes(o.status));
            const shopRevenue = completedShopOrders.reduce((sum, o) => sum + o.totalAmount, 0);

            const staffNames = shop.staff.map(s => s.staff.fullName);

            const totalPrep = completedShopOrders.reduce((acc, o) => acc + (o.estimatedMinutes || 10), 0);
            const avgPrepTime = completedShopOrders.length > 0 ? Math.round(totalPrep / completedShopOrders.length) : 10;

            return {
                shop_id: shop.id,
                name: shop.name,
                area_name: shop.area.name,
                status: shop.status,
                isClosingSoon: Boolean(shop.isClosingSoon),
                closingDiscount: shop.closingDiscount || 0,
                totalOrders: shopOrders.length,
                completedOrders: completedShopOrders.length,
                activeOrders: activeShopOrders.length,
                revenue: shopRevenue,
                avgPrepTime,
                staffCount: shop.staff.length,
                staffNames,
                menuItemsCount: shop.items.length
            };
        }).sort((a, b) => b.revenue - a.revenue);

        // 3. Top Selling Menu Items
        const itemAggregate: Record<number, {
            id: number;
            name: string;
            category_name: string;
            shop_name: string;
            price: number;
            unitsSold: number;
            revenue: number;
        }> = {};

        allOrderItems.forEach(oi => {
            if (!oi.item) return;
            const isCompleted = oi.order.status === 'COMPLETED';
            if (!itemAggregate[oi.itemId]) {
                itemAggregate[oi.itemId] = {
                    id: oi.item.id,
                    name: oi.item.name,
                    category_name: oi.item.category?.name || 'General',
                    shop_name: oi.item.shop?.name || 'Outlet',
                    price: oi.item.price,
                    unitsSold: 0,
                    revenue: 0
                };
            }
            itemAggregate[oi.itemId].unitsSold += oi.quantity;
            if (isCompleted) {
                itemAggregate[oi.itemId].revenue += oi.priceAtOrder * oi.quantity;
            }
        });

        const topSellingItems = Object.values(itemAggregate)
            .sort((a, b) => b.unitsSold - a.unitsSold)
            .slice(0, 10);

        // 4. Daily Trend for Last 7 Days
        const dailyTrend: { date: string; dayLabel: string; ordersCount: number; revenue: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            const dayOrders = allOrders.filter(o => {
                const odStr = new Date(o.orderTime).toISOString().split('T')[0];
                return odStr === dateStr;
            });

            const dayRevenue = dayOrders
                .filter(o => o.status === 'COMPLETED')
                .reduce((acc, o) => acc + o.totalAmount, 0);

            dailyTrend.push({
                date: dateStr,
                dayLabel,
                ordersCount: dayOrders.length,
                revenue: dayRevenue
            });
        }

        // 5. Payment Methods Array
        const paymentStatsArray = Object.entries(paymentMethodCounts).map(([method, data]) => ({
            method,
            count: data.count,
            revenue: data.revenue,
            percentage: allOrders.length > 0 ? Math.round((data.count / allOrders.length) * 100) : 0
        })).sort((a, b) => b.count - a.count);

        res.json({
            summary: {
                totalRevenue,
                todayRevenue,
                totalOrders: allOrders.length,
                todayOrders: todayOrdersCount,
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
 * 2. LIVE REAL-TIME KITCHEN & ORDER STREAM
 * ============================================================================
 */
export const getLiveOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { status, shopId, limit = '60', search } = req.query;

        const where: any = {};
        if (status && status !== 'ALL') {
            where.status = String(status);
        }
        if (shopId && shopId !== 'ALL') {
            where.shopId = Number(shopId);
        }
        if (search && String(search).trim()) {
            const query = String(search).trim();
            where.OR = [
                { customer: { fullName: { contains: query, mode: 'insensitive' } } },
                { customer: { email: { contains: query, mode: 'insensitive' } } },
                { shop: { name: { contains: query, mode: 'insensitive' } } }
            ];
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                shop: { include: { area: true } },
                customer: true,
                items: { include: { item: true } },
                payments: true
            },
            orderBy: { orderTime: 'desc' },
            take: Math.min(100, Math.max(1, Number(limit) || 60))
        });

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
            paymentStatus: o.payments?.[0]?.status || 'SUCCESS'
        }));

        res.json(mapped);
    } catch (error: any) {
        console.error('Error fetching live orders:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch live orders stream' });
    }
};

/**
 * ============================================================================
 * 3. UPDATE ORDER STATUS (ADMIN OVERRIDE)
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

        const existing = await prisma.order.findUnique({ where: { id: oId } });
        if (!existing) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        const updated = await prisma.order.update({
            where: { id: oId },
            data: { status }
        });

        res.json({
            message: `Order #${oId} status updated to ${status}`,
            order: updated
        });
    } catch (error: any) {
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
                    select: { id: true, status: true, totalAmount: true }
                }
            },
            orderBy: { id: 'asc' }
        });

        const mapped = shops.map(s => {
            const completedOrders = s.orders.filter(o => o.status === 'COMPLETED');
            const activeOrders = s.orders.filter(o => ['PLACED', 'PREPARING', 'READY'].includes(o.status));
            const revenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

            return {
                id: s.id,
                name: s.name,
                status: s.status,
                area_id: s.areaId,
                area_name: s.area?.name || 'Campus Outlet',
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
 * 5. UPDATE STALL SETTINGS (ADMIN)
 * ============================================================================
 */
export const updateStallByAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { shopId } = req.params;
        const sId = Number(shopId);
        const { name, status, isClosingSoon, closingDiscount } = req.body;

        const existing = await prisma.shop.findUnique({ where: { id: sId } });
        if (!existing) {
            res.status(404).json({ error: 'Stall not found' });
            return;
        }

        const updateData: any = {};
        if (name && name.trim()) updateData.name = name.trim();
        if (status) updateData.status = status;
        if (isClosingSoon !== undefined) updateData.isClosingSoon = Boolean(isClosingSoon);
        if (closingDiscount !== undefined) updateData.closingDiscount = Number(closingDiscount);

        const updated = await prisma.shop.update({
            where: { id: sId },
            data: updateData,
            include: { area: true }
        });

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
 * 6. USER DIRECTORY & ACCESS CONTROL
 * ============================================================================
 */
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { search, role } = req.query;

        const where: any = {};
        if (search && String(search).trim()) {
            const q = String(search).trim();
            where.OR = [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } }
            ];
        }

        const users = await prisma.user.findMany({
            where,
            include: {
                roles: { include: { role: true } },
                staffShops: { include: { shop: true } },
                _count: { select: { orders: true } }
            },
            orderBy: { id: 'asc' }
        });

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

        if (role && role !== 'ALL') {
            res.json(mapped.filter(u => u.role === role));
            return;
        }

        res.json(mapped);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
};

/**
 * ============================================================================
 * 7. UPDATE USER ROLE & STALL ASSIGNMENT
 * ============================================================================
 */
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const uId = Number(userId);
        const { role, shopId, isActive } = req.body;

        const user = await prisma.user.findUnique({ where: { id: uId } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (isActive !== undefined) {
            await prisma.user.update({
                where: { id: uId },
                data: { isActive: Boolean(isActive) }
            });
        }

        if (role) {
            const roleRecord = await prisma.role.upsert({
                where: { name: role },
                update: {},
                create: { name: role }
            });

            // Remove existing roles
            await prisma.userRole.deleteMany({ where: { userId: uId } });

            // Assign new role
            await prisma.userRole.create({
                data: { userId: uId, roleId: roleRecord.id }
            });

            // If assigned to a shop as STAFF
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

        res.json({ message: `User ${user.fullName} updated successfully` });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update user role' });
    }
};

/**
 * ============================================================================
 * 8. INJECT REAL-TIME ORDERS & REPORT DATA (ON-DEMAND SEEDER)
 * ============================================================================
 */
export const seedRealtimeDataEndpoint = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const createdCount = await seedRealisticCampusOrders();
        res.json({
            message: `Successfully populated ${createdCount} realistic real-time and historical orders for platform calculations!`,
            ordersCreated: createdCount
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to seed real-time data' });
    }
};
