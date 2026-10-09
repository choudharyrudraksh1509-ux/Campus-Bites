import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';

export const getStaffOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const shops = await prisma.shopStaff.findMany({
            where: { staffId },
            select: { shopId: true }
        });
        const shopIds = shops.map(s => s.shopId);

        const orders = await prisma.order.findMany({
            where: { shopId: { in: shopIds }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            orderBy: { orderTime: 'asc' }
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch staff orders' });
    }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const staffId = req.user?.userId;
        if (!staffId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { orderId } = req.params;
        const { status } = req.body;

        if (!status) { res.status(400).json({ error: 'Status is required' }); return; }

        await prisma.order.update({
            where: { id: Number(orderId) },
            data: { status }
        });
        
        res.json({ message: 'Order status updated successfully' });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to update order status' });
    }
};
