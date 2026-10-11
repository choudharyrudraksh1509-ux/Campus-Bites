import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';

const BACKEND_KNOWN_ITEMS: Record<number, { name: string; price: number }> = {
    101: { name: 'Crispy Veg Cheese Burger', price: 85 },
    102: { name: 'Paneer Loaded Fries', price: 95 },
    103: { name: 'Double Cheese Pizza', price: 150 },
    104: { name: 'Cold Coffee with Ice Cream', price: 70 },
    201: { name: 'Chicken Kathi Roll', price: 110 },
    202: { name: 'Chicken Cheese Burger', price: 110 },
    203: { name: 'Hot & Spicy Wings', price: 140 },
    301: { name: 'Hot Tea', price: 15 },
    302: { name: 'Hot Coffee', price: 15 },
    303: { name: 'Filter Coffee', price: 25 },
    304: { name: 'Badam Malt', price: 30 },
    305: { name: 'Nannari Sarbath', price: 30 },
    306: { name: 'Fresh Buttermilk', price: 30 },
    307: { name: 'Rosemilk', price: 50 },
    308: { name: 'Sugarcane Juice', price: 40 },
    309: { name: 'Vazhaithandu Juice', price: 50 },
    310: { name: 'Carrot Juice', price: 50 },
    311: { name: 'Beetroot Juice', price: 50 },
    312: { name: 'Pineapple Milkshake', price: 70 },
    313: { name: 'Banana Milkshake', price: 70 },
    314: { name: 'Strawberry Milkshake', price: 80 },
    315: { name: 'Pomegranate Milkshake', price: 80 },
    316: { name: 'Chiku Milkshake', price: 80 },
    317: { name: 'Mango Milkshake', price: 80 },
    318: { name: 'Idli (2 Pcs)', price: 35 },
    319: { name: 'Set Dosa', price: 50 },
    320: { name: 'Adai Dosa (4 Dhalls)', price: 60 },
    321: { name: 'Curry Leaf Dosa', price: 60 },
    322: { name: 'Drumstick Leaf Dosa', price: 60 },
    323: { name: 'Ragi Dosa', price: 60 },
    324: { name: 'Kambu Dosa', price: 60 },
    325: { name: 'Dhall Podi Dosa (Sesame)', price: 70 },
    326: { name: 'Egg Dosa', price: 70 },
    327: { name: 'Regular Chicken Shawarma', price: 90 },
    328: { name: 'Spl. Whole Chicken Shawarma', price: 130 },
    329: { name: 'Masala Poori', price: 50 },
    330: { name: 'Dahi Bhel Poori', price: 60 },
    331: { name: 'Pani Poori', price: 50 },
    332: { name: 'Sev Poori', price: 50 },
    333: { name: 'Channa Samosa', price: 50 },
    334: { name: 'Dahi Samosa', price: 50 },
    335: { name: 'Cutlet Channa', price: 50 },
    336: { name: 'Aloo Chaat', price: 50 },
    337: { name: 'Mushroom Fry Masala', price: 50 },
    338: { name: 'Vada Pav', price: 50 },
    339: { name: 'Pav Bhaji', price: 70 },
    340: { name: 'Sundal (Channa)', price: 30 },
    341: { name: 'Vegetable Cutlet (2 Pcs)', price: 30 },
    342: { name: 'Veg Samosa (2 Pcs)', price: 30 },
    343: { name: 'Kuzhi Paniyaram (4 Pcs)', price: 30 },
    344: { name: 'Keerai Vadai (2 Pcs)', price: 30 },
    345: { name: 'Veg Bajji (3 Pcs)', price: 30 },
    346: { name: 'Spring Potato', price: 50 },
    347: { name: 'Potato Pops', price: 50 },
    401: { name: 'Masala Maggi', price: 45 },
    402: { name: 'Cheese Butter Maggi', price: 65 },
    403: { name: 'Veg Puff', price: 25 },
    404: { name: 'Egg Puff', price: 30 },
    405: { name: 'Ginger Chai', price: 20 },
    501: { name: 'Chole Bhature (2 Pcs)', price: 90 },
    502: { name: 'Special Pav Bhaji', price: 80 },
    503: { name: 'Aloo Paratha with Curd', price: 70 },
    601: { name: 'Grilled Veg Sandwich', price: 60 },
    602: { name: 'Paneer Tikka Sandwich', price: 85 },
    603: { name: 'Chocolate Brownie', price: 50 },
    701: { name: 'Masala Dosa', price: 60 },
    702: { name: 'Ghee Podi Idli (4 Pcs)', price: 55 },
    703: { name: 'Medu Vada (2 Pcs)', price: 40 },
    801: { name: 'Veg Manchurian Roll', price: 75 },
    802: { name: 'Honey Chilli Potato', price: 90 },
    803: { name: 'Crispy Veg Burger', price: 70 },
    901: { name: 'Paneer Butter Masala Combo', price: 140 },
    902: { name: 'Butter Naan (2 Pcs)', price: 50 },
    903: { name: 'Veg Dum Biryani', price: 130 },
};

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
            if (!shop && Number(shopId) >= 1 && Number(shopId) <= 9) {
                const STALL_NAMES = [
                    'Gazebo 1', 'Gazebo 2', 'Fresh Juices - Healthy & Tasty',
                    'Sri Outlet', 'North Square Diner', 'Campus Bakers',
                    'South Corner', 'Hunger Express', 'Gymkhana Food Club'
                ];
                const targetName = STALL_NAMES[Number(shopId) - 1];
                shop = await tx.shop.findFirst({ where: { name: targetName } });
            }
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
                    const knownItem = BACKEND_KNOWN_ITEMS[itemIdNum];
                    const fallbackName = (item.name && String(item.name).trim() && !String(item.name).startsWith('Campus Special'))
                        ? String(item.name).trim()
                        : (knownItem ? knownItem.name : (food ? food.name : 'Takeaway Special'));
                    const fallbackPrice = (item.price && Number(item.price) > 0)
                        ? Number(item.price)
                        : (knownItem ? knownItem.price : (food && food.price > 0 ? food.price : 60));

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
                    status: 'PLACED',
                    totalAmount,
                    items: {
                        create: orderItemsData
                    },
                    payments: {
                        create: { amount: totalAmount, status: 'SUCCESS' }
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
