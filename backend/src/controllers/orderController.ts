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
            let shop = await tx.shop.findUnique({ where: { id: Number(shopId) } });
            if (!shop) {
                shop = await tx.shop.findFirst({ where: { status: 'ACTIVE' } });
                if (!shop) {
                    shop = await tx.shop.findFirst();
                }
                if (!shop) {
                    let area = await tx.area.findFirst();
                    if (!area) {
                        area = await tx.area.create({
                            data: { name: 'Main Campus Court', description: 'Central food court stalls' }
                        });
                    }
                    shop = await tx.shop.create({
                        data: {
                            ownerId: userId,
                            areaId: area.id,
                            name: `Campus Outlet #${shopId}`,
                            status: 'ACTIVE'
                        }
                    });
                }
            } else if (shop.status !== 'ACTIVE') {
                shop = await tx.shop.update({
                    where: { id: shop.id },
                    data: { status: 'ACTIVE' }
                });
            }

            let defaultCategory = await tx.category.findFirst();
            if (!defaultCategory) {
                defaultCategory = await tx.category.create({ data: { name: 'Specialties' } });
            }

            let totalAmount = 0;
            const orderItemsData = [];

            for (const item of items) {
                const itemIdNum = Number(item.itemId);
                const qty = Math.max(1, Number(item.quantity) || 1);
                let food = await tx.foodItem.findUnique({ where: { id: itemIdNum } });

                if (!food || food.shopId !== shop.id) {
                    const fallbackName = (item.name && String(item.name).trim())
                        ? String(item.name).trim()
                        : (food ? food.name : `Campus Special #${itemIdNum}`);
                    const fallbackPrice = (item.price && Number(item.price) > 0)
                        ? Number(item.price)
                        : (food && food.price > 0 ? food.price : 60);

                    let existingItemInShop = await tx.foodItem.findFirst({
                        where: { shopId: shop.id, name: fallbackName }
                    });

                    if (!existingItemInShop) {
                        existingItemInShop = await tx.foodItem.create({
                            data: {
                                shopId: shop.id,
                                categoryId: food?.categoryId || defaultCategory.id,
                                name: fallbackName,
                                description: food?.description || 'Fresh campus meal prepared to order',
                                price: fallbackPrice,
                                isAvailable: true
                            }
                        });
                    }
                    food = existingItemInShop;
                }

                if (!food.isAvailable) {
                    food = await tx.foodItem.update({
                        where: { id: food.id },
                        data: { isAvailable: true }
                    });
                }

                const itemPrice = (item.price && Number(item.price) > 0) ? Number(item.price) : food.price;
                totalAmount += itemPrice * qty;
                orderItemsData.push({
                    itemId: food.id,
                    quantity: qty,
                    priceAtOrder: itemPrice
                });
            }

            const newOrder = await tx.order.create({
                data: {
                    customerId: userId,
                    shopId: shop.id,
                    status: 'PAYMENT_PENDING',
                    totalAmount,
                    items: {
                        create: orderItemsData
                    },
                    payments: {
                        create: { amount: totalAmount, status: 'PENDING' }
                    }
                },
                include: {
                    shop: true,
                    items: {
                        include: { item: true }
                    }
                }
            });

            return newOrder;
        });

        const pickupToken = `TK-${1000 + (order.id % 9000)}`;

        res.status(201).json({
            message: 'Order placed',
            orderId: order.id,
            id: order.id,
            totalAmount: order.totalAmount,
            total_amount: order.totalAmount,
            pickup_token: pickupToken,
            order: {
                id: order.id,
                order_id: order.id,
                shop_id: order.shopId,
                shop_name: order.shop?.name || 'Campus Outlet',
                status: order.status,
                total_amount: order.totalAmount,
                order_time: order.orderTime,
                created_at: order.orderTime,
                pickup_token: pickupToken,
                items: order.items.map(oi => ({
                    id: oi.itemId,
                    itemId: oi.itemId,
                    name: oi.item?.name || 'Food Item',
                    quantity: oi.quantity,
                    price: oi.priceAtOrder
                }))
            }
        });
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
            id: o.id,
            order_id: o.id,
            shop_id: o.shopId,
            shop_name: o.shop?.name || 'Campus Outlet',
            status: o.status,
            total_amount: o.totalAmount,
            totalAmount: o.totalAmount,
            order_time: o.orderTime,
            created_at: o.orderTime,
            pickup_token: `TK-${1000 + (o.id % 9000)}`,
            items: o.items.map(oi => ({
                id: oi.itemId,
                itemId: oi.itemId,
                name: oi.item?.name || 'Food Item',
                quantity: oi.quantity,
                price: oi.priceAtOrder,
                price_at_order: oi.priceAtOrder
            }))
        }));
        res.json(mapped);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { orderId } = req.params;
        const oId = Number(orderId);

        const order = await prisma.order.findFirst({
            where: { id: oId, customerId: userId },
            include: { items: { include: { item: true } }, shop: true, payments: true }
        });

        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        const pickupToken = `TK-${1000 + (order.id % 9000)}`;

        res.json({
            id: order.id,
            order_id: order.id,
            shop_id: order.shopId,
            shop_name: order.shop?.name || 'Campus Outlet',
            status: order.status,
            total_amount: order.totalAmount,
            totalAmount: order.totalAmount,
            order_time: order.orderTime,
            created_at: order.orderTime,
            pickup_token: pickupToken,
            order: {
                id: order.id,
                order_id: order.id,
                shop_name: order.shop?.name || 'Campus Outlet',
                status: order.status,
                total_amount: order.totalAmount,
                order_time: order.orderTime,
                pickup_token: pickupToken
            },
            items: order.items.map(oi => ({
                id: oi.itemId,
                item_id: oi.itemId,
                itemId: oi.itemId,
                quantity: oi.quantity,
                price: oi.priceAtOrder,
                price_at_order: oi.priceAtOrder,
                name: oi.item?.name || 'Food Item'
            })),
            payments: order.payments.map(p => ({
                id: p.id,
                amount: p.amount,
                status: p.status,
                time: p.attemptTime
            }))
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch order details' });
    }
};

export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { orderId } = req.params;
        const oId = Number(orderId);

        const order = await prisma.order.findFirst({
            where: { id: oId, customerId: userId }
        });

        if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

        // Customers can only cancel before preparation starts
        const cancellable = ['PAYMENT_PENDING', 'PLACED'];
        if (!cancellable.includes(order.status)) {
            res.status(400).json({ error: `Cannot cancel order in ${order.status} state. Only PAYMENT_PENDING or PLACED orders can be cancelled.` });
            return;
        }

        const updated = await prisma.order.update({
            where: { id: oId },
            data: { status: 'CANCELLED' }
        });

        res.json({ message: 'Order cancelled successfully', orderId: updated.id, status: updated.status });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to cancel order' });
    }
};

export const confirmPayment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { orderId } = req.params;
        const oId = Number(orderId);

        const order = await prisma.order.findFirst({
            where: { id: oId, customerId: userId }
        });

        if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

        if (order.status === 'PLACED') {
            res.json({ message: 'Order is already PLACED', orderId: order.id, status: 'PLACED' });
            return;
        }

        if (order.status !== 'PAYMENT_PENDING') {
            res.status(400).json({ error: `Order is not in PAYMENT_PENDING state (current: ${order.status})` });
            return;
        }

        // Simulate payment confirmation — in prod this would verify with a gateway
        await prisma.$transaction(async (tx) => {
            const payment = await tx.paymentAttempt.findFirst({
                where: { orderId: oId, status: 'PENDING' }
            });
            if (payment) {
                await tx.paymentAttempt.update({
                    where: { id: payment.id },
                    data: { status: 'SUCCESS' }
                });
            } else {
                await tx.paymentAttempt.create({
                    data: {
                        orderId: oId,
                        amount: order.totalAmount,
                        status: 'SUCCESS'
                    }
                });
            }

            // Move order to PLACED
            await tx.order.update({
                where: { id: oId },
                data: { status: 'PLACED' }
            });
        });

        res.json({ message: 'Payment confirmed. Order is now PLACED.', orderId: oId, status: 'PLACED' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to confirm payment' });
    }
};
