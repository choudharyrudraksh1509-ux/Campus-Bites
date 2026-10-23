import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';
import { isCancellableOrderStatus, isValidOrderTransition } from '../services/orderStateMachine';
import { 
    SIMULATION_DISCLAIMER, 
    verifyWebhookSignature, 
    processPaymentWebhook,
    WebhookPayload 
} from '../services/paymentService';

// Re-export Autobook schedules handlers for backward compatibility
export {
    getMyAutobookSchedules as getAutobookSchedules,
    createAutobookSchedule,
    toggleAutobookSchedule,
    deleteAutobookSchedule,
    runAutobookScheduleNow as executeAutobookSchedule,
    runAutobookScheduleNow
} from './autobookController';

export const BACKEND_KNOWN_ITEMS: Record<number, { name: string; price: number }> = {
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

export const getItemPrepTime = (itemId: number, name?: string): number => {
    const n = (name || '').toLowerCase();
    if (n.includes('tea') || n.includes('coffee') || n.includes('sarbath') || n.includes('buttermilk') || n.includes('chai') || n.includes('badam')) return 4;
    if (n.includes('juice') || n.includes('milkshake')) return 6;
    if (n.includes('idli') || n.includes('samosa') || n.includes('cutlet') || n.includes('sundal') || n.includes('paniyaram') || n.includes('vadai') || n.includes('bajji') || n.includes('poori') || n.includes('chaat') || n.includes('vada')) return 7;
    if (n.includes('maggi') || n.includes('puff') || n.includes('fries') || n.includes('pops') || n.includes('potato')) return 8;
    if (n.includes('burger') || n.includes('sandwich') || n.includes('dosa') || n.includes('roll') || n.includes('paratha') || n.includes('bhature') || n.includes('wings')) return 12;
    if (n.includes('pizza') || n.includes('shawarma') || n.includes('biryani') || n.includes('combo') || n.includes('naan')) return 15;
    return 10;
};

/**
 * Helper to format order output consistently
 */
function formatOrderResponse(order: any, maxPrepTime = 8, isDuplicate = false) {
    const pickupToken = `TK-${1000 + (order.id % 9000)}`;
    const estMinutes = order.estimatedMinutes || 15;
    const estimatedReadyTime = new Date(order.orderTime.getTime() + estMinutes * 60 * 1000).toISOString();

    return {
        message: isDuplicate ? 'Order already placed (idempotent replay)' : 'Order placed successfully',
        orderId: order.id,
        id: order.id,
        totalAmount: order.totalAmount,
        total_amount: order.totalAmount,
        pickup_token: pickupToken,
        queue_number: order.queueNumber || 1,
        prep_time_minutes: maxPrepTime,
        estimated_delivery_minutes: estMinutes,
        estimated_ready_time: estimatedReadyTime,
        is_preorder: order.isPreorder,
        pickup_time: order.pickupTime,
        payment_method: order.paymentMethod,
        isSimulated: true,
        simulationNotice: SIMULATION_DISCLAIMER,
        isDuplicate,
        order: {
            id: order.id,
            order_id: order.id,
            shop_id: order.shopId,
            shop_name: order.shop?.name || 'Campus Outlet',
            status: order.status,
            totalAmount: order.totalAmount,
            total_amount: order.totalAmount,
            order_time: order.orderTime,
            created_at: order.orderTime,
            pickup_token: pickupToken,
            queue_number: order.queueNumber || 1,
            prep_time_minutes: maxPrepTime,
            estimated_delivery_minutes: estMinutes,
            estimated_ready_time: estimatedReadyTime,
            is_preorder: order.isPreorder,
            pickup_time: order.pickupTime,
            payment_method: order.paymentMethod,
            items: (order.items || []).map((oi: any) => ({
                id: oi.itemId,
                itemId: oi.itemId,
                item_id: oi.itemId,
                name: oi.item?.name || 'Item',
                price: oi.priceAtOrder,
                price_at_order: oi.priceAtOrder,
                quantity: oi.quantity
            }))
        }
    };
}

/**
 * Place / Create Order
 * - Atomic database transaction wrapping Order and all OrderItem records.
 * - Idempotency support: checks idempotencyKey from header or body.
 * - Authoritative server-side pricing from DB records.
 * - Strict status state machine: starts at PAYMENT_PENDING (or PLACED when autoConfirmed).
 */
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    const { shopId, items, isPreorder, pickupTime, paymentMethod, autoConfirm } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Order must contain at least one item' });
        return;
    }

    // Extract idempotency key from headers or request payload
    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body.idempotencyKey;
    const idempotencyKey = typeof rawKey === 'string' && rawKey.trim().length > 0 ? rawKey.trim() : null;

    // STEP 1: PRE-CHECK IDEMPOTENCY KEY
    if (idempotencyKey) {
        const existingOrder = await prisma.order.findUnique({
            where: { idempotencyKey },
            include: {
                shop: true,
                items: { include: { item: true } },
                payments: true
            }
        });

        if (existingOrder) {
            res.status(200).json(formatOrderResponse(existingOrder, 8, true));
            return;
        }
    }

    const targetShopId = Number(shopId);

    try {
        const orderResult = await prisma.$transaction(async (tx) => {
            // Validate stall
            const shop = await tx.shop.findUnique({ where: { id: targetShopId } });
            if (!shop) {
                throw new Error('NOT_FOUND: Stall does not exist');
            }
            if (shop.status !== 'ACTIVE') {
                throw new Error('STALL_INACTIVE: This stall is currently closed and not accepting orders');
            }

            // Validate user active status
            const customer = await tx.user.findUnique({ where: { id: userId } });
            if (!customer || !customer.isActive) {
                throw new Error('USER_INACTIVE: Customer account is disabled or inactive');
            }

            let calculatedTotal = 0;
            const orderItemsData = [];
            let maxPrepTime = 8;

            const itemIds = items.map((i: any) => Number(i.itemId));
            const foods = await tx.foodItem.findMany({ where: { id: { in: itemIds } } });
            const foodMap = new Map(foods.map(f => [f.id, f]));

            for (const item of items) {
                const itemIdNum = Number(item.itemId);
                const qty = Math.max(1, Math.min(50, Number(item.quantity) || 1));

                // Authoritative lookup from pre-fetched map
                const food = foodMap.get(itemIdNum);

                if (!food) {
                    throw new Error(`INVALID_ITEM: Item #${itemIdNum} does not exist`);
                }

                if (food.shopId !== shop.id) {
                    throw new Error(`MISMATCHED_SHOP: Item "${food.name}" belongs to another outlet, not "${shop.name}"`);
                }

                if (!food.isAvailable) {
                    throw new Error(`UNAVAILABLE: "${food.name}" is currently sold out`);
                }

                // Authoritative server-side price calculation with 2-decimal precision
                let unitPrice = Math.round(food.price * 100) / 100;
                if (food.isDynamicPricing && food.discountPercent && food.discountPercent > 0) {
                    const orig = food.originalPrice || food.price;
                    unitPrice = Math.max(5, Math.round(orig * (1 - food.discountPercent / 100) * 100) / 100);
                } else if (shop.isClosingSoon && shop.closingDiscount && shop.closingDiscount > 0) {
                    unitPrice = Math.max(5, Math.round(food.price * (1 - shop.closingDiscount / 100) * 100) / 100);
                }

                calculatedTotal = Math.round((calculatedTotal + unitPrice * qty) * 100) / 100;

                orderItemsData.push({
                    itemId: food.id,
                    quantity: qty,
                    priceAtOrder: unitPrice
                });

                const curItemPrep = getItemPrepTime(food.id, food.name);
                if (curItemPrep > maxPrepTime) maxPrepTime = curItemPrep;
            }

            // Rapid double-submission protection if no explicit idempotency key provided
            if (!idempotencyKey) {
                const recentDuplicate = await tx.order.findFirst({
                    where: {
                        customerId: userId,
                        shopId: shop.id,
                        totalAmount: calculatedTotal,
                        orderTime: { gte: new Date(Date.now() - 4000) }
                    },
                    include: {
                        shop: true,
                        items: { include: { item: true } },
                        payments: true
                    }
                });

                if (recentDuplicate) {
                    return { newOrder: recentDuplicate, maxPrepTime, isDuplicate: true };
                }
            }

            // Calculate live queue for this shop
            const activeOrdersCount = await tx.order.count({
                where: {
                    shopId: shop.id,
                    status: { in: ['PLACED', 'PREPARING'] }
                }
            });
            const queueNumber = activeOrdersCount + 1;
            const queueWaitMinutes = activeOrdersCount * 3;
            const estimatedMinutes = maxPrepTime + queueWaitMinutes;

            // Fulfillment status: default PAYMENT_PENDING unless explicitly autoConfirmed
            const shouldAutoConfirm = Boolean(autoConfirm);
            const initialStatus = shouldAutoConfirm ? 'PLACED' : 'PAYMENT_PENDING';
            const paymentStatus = shouldAutoConfirm ? 'SUCCESS' : 'PENDING';

            const newOrder = await tx.order.create({
                data: {
                    customerId: userId,
                    shopId: shop.id,
                    status: initialStatus,
                    totalAmount: calculatedTotal,
                    isPreorder: Boolean(isPreorder),
                    pickupTime: pickupTime || null,
                    estimatedMinutes,
                    queueNumber,
                    paymentMethod: paymentMethod || 'ONLINE_DEMO',
                    idempotencyKey: idempotencyKey || null,
                    items: {
                        create: orderItemsData
                    },
                    payments: {
                        create: {
                            amount: calculatedTotal,
                            status: paymentStatus
                        }
                    }
                },
                include: {
                    shop: true,
                    items: {
                        include: { item: true }
                    },
                    payments: true
                }
            });

            return { newOrder, maxPrepTime, isDuplicate: false };
        }, {
            maxWait: 10000,
            timeout: 30000
        });

        res.status(201).json(formatOrderResponse(orderResult.newOrder, orderResult.maxPrepTime, orderResult.isDuplicate));
    } catch (error: any) {
        // Race condition: catch P2002 unique constraint violation on idempotencyKey
        if (error.code === 'P2002' && idempotencyKey) {
            const replayed = await prisma.order.findUnique({
                where: { idempotencyKey },
                include: { shop: true, items: { include: { item: true } }, payments: true }
            });
            if (replayed) {
                res.status(200).json(formatOrderResponse(replayed, 8, true));
                return;
            }
        }

        const msg = error.message || '';
        if (msg.startsWith('NOT_FOUND:')) {
            res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
        } else if (msg.startsWith('STALL_INACTIVE:') || msg.startsWith('INVALID_ITEM:') || msg.startsWith('MISMATCHED_SHOP:') || msg.startsWith('UNAVAILABLE:') || msg.startsWith('USER_INACTIVE:')) {
            res.status(400).json({ error: msg.split(': ')[1] || msg });
        } else {
            console.error('Order creation transaction error:', error);
            res.status(500).json({ error: 'Failed to place order' });
        }
    }
};

export const placeOrder = createOrder;

/**
 * Get My Orders
 * Restricted strictly to the authenticated customer's own orders.
 */
export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const orders = await prisma.order.findMany({
            where: { customerId: userId },
            select: {
                id: true,
                shopId: true,
                status: true,
                totalAmount: true,
                orderTime: true,
                isPreorder: true,
                pickupTime: true,
                estimatedMinutes: true,
                queueNumber: true,
                paymentMethod: true,
                shop: {
                    select: {
                        id: true,
                        name: true
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
                },
                payments: {
                    select: {
                        id: true,
                        amount: true,
                        status: true,
                        attemptTime: true
                    }
                }
            },
            orderBy: [{ orderTime: 'desc' }, { id: 'desc' }]
        });
        
        const mapped = orders.map(o => {
            const estMinutes = o.estimatedMinutes || 15;
            const estimatedReadyTime = new Date(new Date(o.orderTime).getTime() + estMinutes * 60 * 1000).toISOString();
            return {
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
                queue_number: o.queueNumber || 1,
                estimated_delivery_minutes: estMinutes,
                estimated_ready_time: estimatedReadyTime,
                is_preorder: o.isPreorder || false,
                pickup_time: o.pickupTime || null,
                payment_method: o.paymentMethod || 'ONLINE_DEMO',
                isSimulated: true,
                payments: o.payments.map(p => ({
                    id: p.id,
                    amount: p.amount,
                    status: p.status,
                    time: p.attemptTime
                })),
                items: o.items.map(oi => ({
                    id: oi.itemId,
                    itemId: oi.itemId,
                    name: oi.item?.name || 'Food Item',
                    quantity: oi.quantity,
                    price: oi.priceAtOrder,
                    price_at_order: oi.priceAtOrder
                }))
            };
        });
        res.json(mapped);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
};

/**
 * Get Order Details by ID
 * Enforces ownership: only customer owner, stall staff, or admin can view details.
 */
export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const { orderId } = req.params;
        const oId = Number(orderId);

        const order = await prisma.order.findUnique({
            where: { id: oId },
            include: { items: { include: { item: true } }, shop: true, payments: true }
        });

        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        // Ownership and authorization guard
        const isCustomer = order.customerId === userId;
        const isAdmin = req.user?.role === 'ADMIN';
        const isStaffForShop = (req.user?.role === 'STAFF' || req.user?.role === 'OWNER') && req.user?.shopId === order.shopId;

        if (!isCustomer && !isAdmin && !isStaffForShop) {
            res.status(403).json({ error: 'Forbidden: You do not have permission to view this order' });
            return;
        }

        const pickupToken = `TK-${1000 + (order.id % 9000)}`;
        const estMinutes = order.estimatedMinutes || 15;
        const estimatedReadyTime = new Date(new Date(order.orderTime).getTime() + estMinutes * 60 * 1000).toISOString();

        res.json({
            id: order.id,
            order_id: order.id,
            shop_id: order.shopId,
            shop_name: order.shop?.name || 'Campus Outlet',
            status: order.status,
            totalAmount: order.totalAmount,
            total_amount: order.totalAmount,
            order_time: order.orderTime,
            created_at: order.orderTime,
            pickup_token: pickupToken,
            queue_number: order.queueNumber || 1,
            estimated_delivery_minutes: estMinutes,
            estimated_ready_time: estimatedReadyTime,
            is_preorder: order.isPreorder || false,
            pickup_time: order.pickupTime || null,
            payment_method: order.paymentMethod || 'ONLINE_DEMO',
            isSimulated: true,
            simulationNotice: SIMULATION_DISCLAIMER,
            order: {
                id: order.id,
                order_id: order.id,
                shop_name: order.shop?.name || 'Campus Outlet',
                status: order.status,
                total_amount: order.totalAmount,
                order_time: order.orderTime,
                pickup_token: pickupToken,
                queue_number: order.queueNumber || 1,
                estimated_delivery_minutes: estMinutes,
                estimated_ready_time: estimatedReadyTime,
                is_preorder: order.isPreorder || false,
                pickup_time: order.pickupTime || null,
                payment_method: order.paymentMethod || 'ONLINE_DEMO'
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

/**
 * Customer Self-Service Order Cancellation
 * Strictly allows cancellation ONLY if status is PAYMENT_PENDING or PLACED.
 * Rejects cancellation if cooking has commenced (PREPARING) or if already READY/COMPLETED.
 */
export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { orderId } = req.params;
        const oId = Number(orderId);

        const order = await prisma.order.findUnique({
            where: { id: oId },
            include: { payments: true }
        });

        if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

        if (order.customerId !== userId && req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Forbidden: You can only cancel your own orders' });
            return;
        }

        // Strict state machine guard: only PAYMENT_PENDING or PLACED
        if (!isCancellableOrderStatus(order.status)) {
            res.status(400).json({
                error: `Cannot cancel order in ${order.status} state. Only orders in PAYMENT_PENDING or PLACED can be cancelled.`
            });
            return;
        }

        const updated = await prisma.$transaction(async (tx) => {
            // Update order status
            const o = await tx.order.update({
                where: { id: oId },
                data: { status: 'CANCELLED' }
            });

            // Update associated payments: PENDING becomes CANCELLED; SUCCESS becomes REFUNDED
            const pendingPayment = order.payments.find(p => p.status === 'PENDING');
            if (pendingPayment) {
                await tx.paymentAttempt.update({
                    where: { id: pendingPayment.id },
                    data: { status: 'CANCELLED' }
                });
            } else {
                const successPayment = order.payments.find(p => p.status === 'SUCCESS');
                if (successPayment) {
                    await tx.paymentAttempt.update({
                        where: { id: successPayment.id },
                        data: { status: 'REFUNDED' }
                    });
                }
            }

            return o;
        });

        res.json({
            message: 'Order cancelled successfully',
            orderId: updated.id,
            status: updated.status,
            order: updated,
            isSimulated: true
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to cancel order' });
    }
};

/**
 * Confirm Payment (State Transition from PAYMENT_PENDING to PLACED)
 * Idempotent: safe replay if already placed.
 */
export const confirmPayment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { orderId } = req.params;
        const oId = Number(orderId);

        const order = await prisma.order.findUnique({
            where: { id: oId }
        });

        if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

        if (order.customerId !== userId && req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Forbidden: You can only confirm payment for your own orders' });
            return;
        }

        // Idempotency: if already PLACED, safely return success
        if (order.status === 'PLACED') {
            res.json({
                message: 'Order is already PLACED',
                orderId: order.id,
                status: 'PLACED',
                isDuplicate: true,
                isSimulated: true
            });
            return;
        }

        if (order.status !== 'PAYMENT_PENDING') {
            res.status(400).json({
                error: `Order is not in PAYMENT_PENDING state (current: ${order.status})`
            });
            return;
        }

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

            await tx.order.update({
                where: { id: oId },
                data: { status: 'PLACED' }
            });
        });

        res.json({
            message: 'Payment confirmed. Order is now PLACED.',
            orderId: oId,
            status: 'PLACED',
            isSimulated: true,
            simulationNotice: SIMULATION_DISCLAIMER
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to confirm payment' });
    }
};

/**
 * Payment Webhook Endpoint
 * Supports simulated signature verification and idempotent order/payment state processing.
 */
export const handlePaymentWebhook = async (req: any, res: Response): Promise<void> => {
    try {
        const signature = (
            req.headers['x-razorpay-signature'] || 
            req.headers['x-webhook-signature'] || 
            req.headers['webhook-signature']
        ) as string;

        const payloadStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

        // Verify simulated signature
        const isValid = verifyWebhookSignature(payloadStr, signature);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid webhook signature' });
            return;
        }

        const payload: WebhookPayload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        if (!payload.event || !payload.orderId) {
            res.status(400).json({ error: 'Webhook payload missing required event or orderId' });
            return;
        }

        const result = await processPaymentWebhook(payload);
        res.status(200).json(result);
    } catch (error: any) {
        const msg = error.message || '';
        if (msg.startsWith('NOT_FOUND:')) {
            res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
        } else if (msg.startsWith('UNSUPPORTED_EVENT:')) {
            res.status(400).json({ error: msg.replace('UNSUPPORTED_EVENT: ', '') });
        } else {
            console.error('Webhook processing error:', error);
            res.status(500).json({ error: 'Internal webhook error' });
        }
    }
};

/**
 * Queue & Estimation per Shop
 */
export const getShopQueueEstimate = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const shopId = Number(req.params.shopId);
        const activeOrdersCount = await prisma.order.count({
            where: {
                shopId,
                status: { in: ['PLACED', 'PREPARING'] }
            }
        });
        const queueNumber = activeOrdersCount + 1;
        const basePrepMinutes = 10;
        const queueDelayMinutes = activeOrdersCount * 3;
        const estimatedMinutes = basePrepMinutes + queueDelayMinutes;
        const estimatedReadyTime = new Date(Date.now() + estimatedMinutes * 60 * 1000).toISOString();

        res.json({
            shopId,
            activeOrdersCount,
            queueNumber,
            basePrepMinutes,
            queueDelayMinutes,
            estimatedMinutes,
            estimatedReadyTime
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch queue estimate' });
    }
};
