import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';

export const placeOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    const { shopId, items } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const order = await prisma.$transaction(async (tx) => {
            const shop = await tx.shop.findUnique({ where: { id: Number(shopId) } });
            if (!shop || shop.status !== 'ACTIVE') throw new Error('Shop is not available');

            let totalAmount = 0;
            const orderItemsData = [];

            for (const item of items) {
                const food = await tx.foodItem.findUnique({ where: { id: Number(item.itemId) } });
                if (!food) throw new Error(`Item ${item.itemId} not found`);
                if (food.shopId !== Number(shopId)) throw new Error(`Item ${item.itemId} does not belong to this shop`);
                if (!food.isAvailable) throw new Error(`Item "${food.name}" is currently unavailable`);

                totalAmount += food.price * item.quantity;
                orderItemsData.push({
                    itemId: food.id,
                    quantity: item.quantity,
                    priceAtOrder: food.price
                });
            }

            const newOrder = await tx.order.create({
                data: {
                    customerId: userId,
                    shopId: Number(shopId),
                    status: 'PAYMENT_PENDING',
                    totalAmount,
                    items: {
                        create: orderItemsData
                    },
                    payments: {
                        create: { amount: totalAmount, status: 'PENDING' }
                    }
                }
            });

            return newOrder;
        });

        res.status(201).json({ message: 'Order placed', orderId: order.id, totalAmount: order.totalAmount });
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to place order' });
    }
};

export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const orders = await prisma.order.findMany({
            where: { customerId: userId },
            include: { shop: true, items: { include: { item: true } } },
            orderBy: { orderTime: 'desc' }
        });
        
        const mapped = orders.map(o => ({
            order_id: o.id,
            shop_name: o.shop.name,
            status: o.status,
            total_amount: o.totalAmount,
            order_time: o.orderTime,
            items: o.items.map(oi => ({
                name: oi.item.name,
                quantity: oi.quantity,
                price_at_order: oi.priceAtOrder
            }))
        }));
        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { orderId } = req.params;

        const order = await prisma.order.findFirst({
            where: { id: Number(orderId), customerId: userId },
            include: { items: { include: { item: true } }, shop: true, payments: true }
        });

        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        res.json({
            order: {
                order_id: order.id,
                shop_name: order.shop.name,
                status: order.status,
                total_amount: order.totalAmount,
                order_time: order.orderTime
            },
            items: order.items.map(oi => ({
                item_id: oi.itemId,
                quantity: oi.quantity,
                price_at_order: oi.priceAtOrder,
                name: oi.item.name
            })),
            payments: order.payments.map(p => ({
                id: p.id,
                amount: p.amount,
                status: p.status,
                time: p.attemptTime
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
};

export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { orderId } = req.params;

        const order = await prisma.order.findFirst({
            where: { id: Number(orderId), customerId: userId }
        });

        if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

        // Customers can only cancel before preparation starts
        const cancellable = ['PAYMENT_PENDING', 'PLACED'];
        if (!cancellable.includes(order.status)) {
            res.status(400).json({ error: `Cannot cancel order in ${order.status} state. Only PAYMENT_PENDING or PLACED orders can be cancelled.` });
            return;
        }

        await prisma.order.update({
            where: { id: Number(orderId) },
            data: { status: 'CANCELLED' }
        });

        res.json({ message: 'Order cancelled successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel order' });
    }
};

export const confirmPayment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { orderId } = req.params;

        const order = await prisma.order.findFirst({
            where: { id: Number(orderId), customerId: userId }
        });

        if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
        if (order.status !== 'PAYMENT_PENDING') {
            res.status(400).json({ error: `Order is not in PAYMENT_PENDING state (current: ${order.status})` });
            return;
        }

        // Simulate payment confirmation — in prod this would verify with a gateway
        await prisma.$transaction(async (tx) => {
            // Update payment attempt to SUCCESS
            const payment = await tx.paymentAttempt.findFirst({
                where: { orderId: Number(orderId), status: 'PENDING' }
            });
            if (payment) {
                await tx.paymentAttempt.update({
                    where: { id: payment.id },
                    data: { status: 'SUCCESS' }
                });
            }

            // Move order to PLACED
            await tx.order.update({
                where: { id: Number(orderId) },
                data: { status: 'PLACED' }
            });
        });

        res.json({ message: 'Payment confirmed. Order is now PLACED.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
};
