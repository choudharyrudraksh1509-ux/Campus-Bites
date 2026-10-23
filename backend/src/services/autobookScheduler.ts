import prisma from '../db/prisma';

let schedulerIntervalTimer: NodeJS.Timeout | null = null;

export interface ExecutionResult {
    scheduleId: number;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    orderId?: number;
    errorMessage?: string;
}

/**
 * Atomically claim and execute a single Autobook schedule.
 * Implements strict pre-condition verification and double-execution prevention.
 */
export async function claimAndExecuteSchedule(
    scheduleId: number,
    options?: { forceDate?: string; bypassClaim?: boolean }
): Promise<ExecutionResult> {
    const todayDateStr = options?.forceDate || new Date().toISOString().split('T')[0];

    // STEP 1: ATOMIC JOB CLAIMING
    // Using conditional atomic update to guarantee that only ONE worker can claim this schedule for today.
    if (!options?.bypassClaim) {
        const claim = await prisma.autobookSchedule.updateMany({
            where: {
                id: scheduleId,
                isActive: true,
                OR: [
                    { lastRunDate: null },
                    { lastRunDate: { not: todayDateStr } }
                ]
            },
            data: {
                lastRunDate: todayDateStr
            }
        });

        if (claim.count === 0) {
            // Schedule already executed today, or claimed by another worker, or inactive
            return {
                scheduleId,
                status: 'SKIPPED',
                errorMessage: 'Schedule already executed today or claimed by another concurrent worker'
            };
        }
    }

    // STEP 2: LOAD SCHEDULE DETAILS
    const schedule = await prisma.autobookSchedule.findUnique({
        where: { id: scheduleId }
    });

    if (!schedule) {
        return {
            scheduleId,
            status: 'FAILED',
            errorMessage: 'Schedule record not found'
        };
    }

    // STEP 3: PRE-EXECUTION VERIFICATION & ORDER PLACEMENT INSIDE TRANSACTION
    try {
        const result = await prisma.$transaction(async (tx) => {
            // Verification A: User active status
            const user = await tx.user.findUnique({ where: { id: schedule.userId } });
            if (!user || !user.isActive) {
                throw new Error('USER_INACTIVE: Customer account is disabled or missing');
            }

            // Verification B: Shop status
            const shop = await tx.shop.findUnique({ where: { id: schedule.shopId } });
            if (!shop) {
                throw new Error('STALL_NOT_FOUND: Stall does not exist');
            }
            if (shop.status !== 'ACTIVE') {
                throw new Error('STALL_INACTIVE: Stall is currently closed');
            }

            // Verification C: Food item existence and stock availability
            const food = await tx.foodItem.findUnique({ where: { id: schedule.itemId } });
            if (!food) {
                throw new Error('ITEM_NOT_FOUND: Food item does not exist');
            }
            if (food.shopId !== shop.id) {
                throw new Error('ITEM_MISMATCH: Food item does not belong to target stall');
            }
            if (!food.isAvailable) {
                throw new Error('ITEM_UNAVAILABLE: Item is currently sold out');
            }

            // Verification D: Server-side pricing calculation (including dynamic & closing discounts)
            let unitPrice = food.price;
            if (food.isDynamicPricing && food.discountPercent && food.discountPercent > 0) {
                const orig = food.originalPrice || food.price;
                unitPrice = Math.max(5, Math.round(orig * (1 - food.discountPercent / 100)));
            } else if (shop.isClosingSoon && shop.closingDiscount && shop.closingDiscount > 0) {
                unitPrice = Math.max(5, Math.round(food.price * (1 - shop.closingDiscount / 100)));
            }

            const totalAmount = unitPrice * schedule.quantity;
            const idempotencyKey = `autobook-${schedule.id}-${todayDateStr}`;

            // Check if an order already exists with this idempotency key
            const existingOrder = await tx.order.findUnique({
                where: { idempotencyKey }
            });

            if (existingOrder) {
                return {
                    orderId: existingOrder.id,
                    replayed: true
                };
            }

            // Calculate live queue estimate
            const activeOrders = await tx.order.count({
                where: { shopId: shop.id, status: { in: ['PLACED', 'PREPARING'] } }
            });
            const queueNumber = activeOrders + 1;
            const estimatedMinutes = 10 + (activeOrders * 3);

            // Create Order and initial Payment record atomically
            const newOrder = await tx.order.create({
                data: {
                    customerId: schedule.userId,
                    shopId: shop.id,
                    status: 'PLACED',
                    totalAmount,
                    isPreorder: false,
                    estimatedMinutes,
                    queueNumber,
                    paymentMethod: 'AUTOBOOK_RECURRING',
                    idempotencyKey,
                    items: {
                        create: [
                            {
                                itemId: food.id,
                                quantity: schedule.quantity,
                                priceAtOrder: unitPrice
                            }
                        ]
                    },
                    payments: {
                        create: {
                            amount: totalAmount,
                            status: 'SUCCESS'
                        }
                    }
                }
            });

            return {
                orderId: newOrder.id,
                replayed: false
            };
        });

        // STEP 4: RECORD SUCCESSFUL EXECUTION AUDIT LOG
        await prisma.autobookExecutionLog.create({
            data: {
                scheduleId: schedule.id,
                status: 'SUCCESS',
                orderId: result.orderId,
                errorMessage: null
            }
        });

        return {
            scheduleId: schedule.id,
            status: 'SUCCESS',
            orderId: result.orderId
        };
    } catch (err: any) {
        const errorMsg = err.message || 'Unknown autobook execution error';
        const isSkip = errorMsg.startsWith('STALL_INACTIVE:') || errorMsg.startsWith('ITEM_UNAVAILABLE:');
        const status = isSkip ? 'SKIPPED' : 'FAILED';

        // Record execution failure/skip in audit log
        await prisma.autobookExecutionLog.create({
            data: {
                scheduleId: schedule.id,
                status,
                orderId: null,
                errorMessage: errorMsg
            }
        });

        return {
            scheduleId: schedule.id,
            status,
            errorMessage: errorMsg
        };
    }
}

/**
 * Evaluates all due Autobook schedules for a given time window.
 */
export async function executeDueAutobookSchedules(
    targetTimeStr?: string,
    targetDateStr?: string
): Promise<ExecutionResult[]> {
    const now = new Date();
    const currentTime = targetTimeStr || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDate = targetDateStr || now.toISOString().split('T')[0];

    // Find all active schedules matching the current time and not yet run today
    const dueSchedules = await prisma.autobookSchedule.findMany({
        where: {
            isActive: true,
            scheduledTime: currentTime,
            OR: [
                { lastRunDate: null },
                { lastRunDate: { not: currentDate } }
            ]
        }
    });

    const results: ExecutionResult[] = [];

    for (const schedule of dueSchedules) {
        try {
            const res = await claimAndExecuteSchedule(schedule.id, { forceDate: currentDate });
            if (res) {
                results.push(res);
            }
        } catch (err: any) {
            console.error(`[AutobookScheduler] Unhandled error executing schedule #${schedule.id}:`, err);
            results.push({
                scheduleId: schedule.id,
                status: 'FAILED',
                errorMessage: err.message
            });
        }
    }

    return results;
}

/**
 * Starts the continuous background scheduler worker.
 * Checks every 60 seconds (or configured interval).
 */
export function startAutobookScheduler(intervalMs = 60000): void {
    if (schedulerIntervalTimer) {
        return; // Already running
    }

    console.log(`[AutobookScheduler] Background scheduler worker started (interval: ${intervalMs}ms)`);

    schedulerIntervalTimer = setInterval(async () => {
        try {
            const results = await executeDueAutobookSchedules();
            if (results.length > 0) {
                console.log(`[AutobookScheduler] Cycle processed ${results.length} schedule(s):`, results);
            }
        } catch (err) {
            console.error('[AutobookScheduler] Cycle error:', err);
        }
    }, intervalMs);
}

/**
 * Stops the background scheduler worker cleanly.
 */
export function stopAutobookScheduler(): void {
    if (schedulerIntervalTimer) {
        clearInterval(schedulerIntervalTimer);
        schedulerIntervalTimer = null;
        console.log('[AutobookScheduler] Background scheduler worker stopped');
    }
}
