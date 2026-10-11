import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';

// Valid state transitions per architecture Section 8
const VALID_TRANSITIONS: Record<string, string[]> = {
    'PAYMENT_PENDING': ['PLACED', 'PAYMENT_FAILED', 'CANCELLED'],
    'PLACED':          ['PREPARING', 'CANCELLED'],
    'PREPARING':       ['READY', 'CANCELLED'],
    'READY':           ['COMPLETED'],
    'COMPLETED':       [],
    'CANCELLED':       [],
    'PAYMENT_FAILED':  ['PAYMENT_PENDING', 'CANCELLED']
};

export const getStaffOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        let shopId = req.user?.shopId;
        if (!shopId) {
            const ss = await prisma.shopStaff.findFirst({ where: { staffId } });
            shopId = ss?.shopId;
        }

        // Owners can pass ?shopId=... or view all; Staff is strictly scoped to their stall
        const queryShopId = req.query.shopId ? Number(req.query.shopId) : undefined;
        const targetShopId = (req.user?.role === 'OWNER' && queryShopId) ? queryShopId : shopId;

        const whereClause: any = {
            status: { notIn: ['COMPLETED', 'CANCELLED', 'PAYMENT_FAILED'] }
        };
        if (targetShopId) {
            whereClause.shopId = targetShopId;
        }

        const orders = await prisma.order.findMany({
            where: whereClause,
            include: { shop: true, items: { include: { item: true } }, customer: true },
            orderBy: { orderTime: 'asc' }
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch staff orders' });
    }
};

export const getStaffOrderHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        let shopId = req.user?.shopId;
        if (!shopId) {
            const ss = await prisma.shopStaff.findFirst({ where: { staffId } });
            shopId = ss?.shopId;
        }

        const queryShopId = req.query.shopId ? Number(req.query.shopId) : undefined;
        const targetShopId = (req.user?.role === 'OWNER' && queryShopId) ? queryShopId : shopId;

        const whereClause: any = {
            status: { in: ['COMPLETED', 'CANCELLED'] }
        };
        if (targetShopId) {
            whereClause.shopId = targetShopId;
        }

        const orders = await prisma.order.findMany({
            where: whereClause,
            include: { shop: true, items: { include: { item: true } }, customer: true },
            orderBy: { orderTime: 'desc' },
            take: 50
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order history' });
    }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { orderId } = req.params;
        const { status } = req.body;

        if (!status) { res.status(400).json({ error: 'Status is required' }); return; }

        // Fetch the current order
        const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
        if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

        // Verify stall authorization if staff
        if (req.user?.role === 'STAFF') {
            let shopId = req.user?.shopId;
            if (!shopId) {
                const ss = await prisma.shopStaff.findFirst({ where: { staffId } });
                shopId = ss?.shopId;
            }
            if (shopId && order.shopId !== shopId) {
                res.status(403).json({ error: 'Unauthorized: You can only update orders for your assigned stall' });
                return;
            }
        }

        // Validate state machine transition
        const allowed = VALID_TRANSITIONS[order.status];
        if (!allowed || !allowed.includes(status)) {
            res.status(400).json({ 
                error: `Invalid transition: ${order.status} → ${status}. Allowed: ${(allowed || []).join(', ') || 'none'}` 
            });
            return;
        }

        await prisma.order.update({
            where: { id: Number(orderId) },
            data: { status }
        });
        
        res.json({ message: `Order status updated: ${order.status} → ${status}` });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update order status' });
    }
};
