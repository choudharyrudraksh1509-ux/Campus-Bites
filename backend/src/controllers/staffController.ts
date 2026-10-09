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

        const orders = await prisma.order.findMany({
            where: { status: { notIn: ['COMPLETED', 'CANCELLED', 'PAYMENT_FAILED'] } },
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

        const orders = await prisma.order.findMany({
            where: { status: { in: ['COMPLETED', 'CANCELLED'] } },
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
