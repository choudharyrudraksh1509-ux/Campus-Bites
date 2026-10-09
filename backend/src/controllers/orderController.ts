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
                if (food.shopId !== Number(shopId)) throw new Error(`Item ${item.itemId} does not belong to shop`);
                if (!food.isAvailable) throw new Error(`Item ${item.itemId} is sold out`);

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
            include: { shop: true },
            orderBy: { orderTime: 'desc' }
        });
        
        const mapped = orders.map(o => ({
            order_id: o.id,
            shop_name: o.shop.name,
            status: o.status,
            total_amount: o.totalAmount,
            order_time: o.orderTime
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
            include: { items: { include: { item: true } } }
        });

        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        const mappedOrder = { order_id: order.id, status: order.status, total_amount: order.totalAmount };
        const mappedItems = order.items.map(oi => ({
            item_id: oi.itemId,
            quantity: oi.quantity,
            price_at_order: oi.priceAtOrder,
            name: oi.item.name
        }));

        res.json({ order: mappedOrder, items: mappedItems });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
};
