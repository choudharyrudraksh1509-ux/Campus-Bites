import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';
import { claimAndExecuteSchedule, executeDueAutobookSchedules } from '../services/autobookScheduler';

/**
 * Get all Autobook schedules for the authenticated user
 */
export const getMyAutobookSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const schedules = await prisma.autobookSchedule.findMany({
            where: { userId },
            select: {
                id: true,
                userId: true,
                shopId: true,
                itemId: true,
                quantity: true,
                scheduledTime: true,
                isActive: true,
                lastRunDate: true,
                createdAt: true,
                shop: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                item: {
                    select: {
                        id: true,
                        name: true,
                        price: true
                    }
                },
                executionLogs: {
                    select: {
                        id: true,
                        attemptTime: true,
                        status: true,
                        orderId: true,
                        errorMessage: true
                    },
                    orderBy: { attemptTime: 'desc' },
                    take: 5
                }
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        });

        const formatted = schedules.map(s => ({
            id: s.id,
            userId: s.userId,
            shopId: s.shopId,
            shopName: s.shop?.name || `Campus Outlet #${s.shopId}`,
            itemId: s.itemId,
            itemName: s.item?.name || `Food Item #${s.itemId}`,
            price: s.item?.price || 50,
            quantity: s.quantity,
            scheduledTime: s.scheduledTime,
            isActive: s.isActive,
            lastRunDate: s.lastRunDate,
            createdAt: s.createdAt,
            recentLogs: s.executionLogs.map(l => ({
                id: l.id,
                attemptTime: l.attemptTime,
                status: l.status,
                orderId: l.orderId,
                errorMessage: l.errorMessage
            }))
        }));

        res.json(formatted);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch autobook schedules' });
    }
};

/**
 * Create a new recurring Autobook schedule
 */
export const createAutobookSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { shopId, itemId, quantity, scheduledTime, isActive } = req.body;
        const sId = Number(shopId);
        const iId = Number(itemId);

        if (!sId || !iId || !scheduledTime) {
            res.status(400).json({ error: 'shopId, itemId, and scheduledTime are required' });
            return;
        }

        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(String(scheduledTime).trim())) {
            res.status(400).json({ error: 'scheduledTime must be in 24-hour HH:MM format (e.g. "12:30")' });
            return;
        }

        const shop = await prisma.shop.findUnique({ where: { id: sId } });
        if (!shop) {
            res.status(404).json({ error: 'Stall not found' });
            return;
        }

        const foodItem = await prisma.foodItem.findUnique({ where: { id: iId } });
        if (!foodItem || foodItem.shopId !== sId) {
            res.status(400).json({ error: 'Item not found in this stall' });
            return;
        }

        const schedule = await prisma.autobookSchedule.create({
            data: {
                userId,
                shopId: sId,
                itemId: iId,
                quantity: Math.max(1, Math.min(20, Number(quantity) || 1)),
                scheduledTime: String(scheduledTime).trim(),
                isActive: isActive !== undefined ? Boolean(isActive) : true
            },
            include: { shop: true, item: true }
        });

        res.status(201).json({
            message: 'Autobook schedule registered successfully',
            schedule
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to create autobook schedule' });
    }
};

/**
 * Get a specific Autobook schedule by ID
 */
export const getAutobookScheduleById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const scheduleId = Number(req.params.scheduleId);
        const schedule = await prisma.autobookSchedule.findUnique({
            where: { id: scheduleId },
            include: { shop: true, item: true, executionLogs: { orderBy: { attemptTime: 'desc' } } }
        });

        if (!schedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }

        if (schedule.userId !== userId && req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Forbidden: You do not own this schedule' });
            return;
        }

        res.json(schedule);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch schedule' });
    }
};

/**
 * Toggle / Pause / Resume Autobook schedule
 */
export const toggleAutobookSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const scheduleId = Number(req.params.scheduleId);
        const existing = await prisma.autobookSchedule.findFirst({
            where: { id: scheduleId, userId }
        });

        if (!existing) {
            res.status(404).json({ error: 'Schedule not found or not owned by you' });
            return;
        }

        const nextActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : !existing.isActive;

        const updated = await prisma.autobookSchedule.update({
            where: { id: scheduleId },
            data: { isActive: nextActive }
        });

        res.json({
            message: updated.isActive ? 'Autobook schedule resumed' : 'Autobook schedule paused',
            schedule: updated
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to toggle schedule' });
    }
};

/**
 * Edit / Update Autobook schedule (e.g. quantity, scheduledTime, isActive)
 */
export const updateAutobookSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const scheduleId = Number(req.params.scheduleId);
        const existing = await prisma.autobookSchedule.findFirst({
            where: { id: scheduleId, userId }
        });

        if (!existing) {
            res.status(404).json({ error: 'Schedule not found or not owned by you' });
            return;
        }

        const { quantity, scheduledTime, isActive } = req.body;
        const updateData: any = {};

        if (quantity !== undefined) {
            updateData.quantity = Math.max(1, Math.min(20, Number(quantity)));
        }

        if (scheduledTime !== undefined) {
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(String(scheduledTime).trim())) {
                res.status(400).json({ error: 'scheduledTime must be in 24-hour HH:MM format' });
                return;
            }
            updateData.scheduledTime = String(scheduledTime).trim();
        }

        if (isActive !== undefined) {
            updateData.isActive = Boolean(isActive);
        }

        const updated = await prisma.autobookSchedule.update({
            where: { id: scheduleId },
            data: updateData
        });

        res.json({
            message: 'Autobook schedule updated successfully',
            schedule: updated
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update schedule' });
    }
};

/**
 * Cancel / Delete an Autobook schedule
 */
export const deleteAutobookSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const scheduleId = Number(req.params.scheduleId);
        const existing = await prisma.autobookSchedule.findFirst({
            where: { id: scheduleId, userId }
        });

        if (!existing) {
            res.status(404).json({ error: 'Schedule not found or not owned by you' });
            return;
        }

        await prisma.autobookSchedule.delete({
            where: { id: scheduleId }
        });

        res.json({ message: 'Autobook schedule removed successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to delete schedule' });
    }
};

/**
 * Trigger immediate manual execution of a schedule (e.g. Test Run / Order Now)
 */
export const runAutobookScheduleNow = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const scheduleId = Number(req.params.scheduleId);
        const existing = await prisma.autobookSchedule.findFirst({
            where: { id: scheduleId, userId }
        });

        if (!existing) {
            res.status(404).json({ error: 'Schedule not found or not owned by you' });
            return;
        }

        const result = await claimAndExecuteSchedule(scheduleId, { bypassClaim: true });

        res.json({
            message: result.status === 'SUCCESS' ? 'Autobook order placed successfully' : 'Autobook execution completed',
            result
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to execute schedule' });
    }
};

/**
 * Fetch execution audit logs for a schedule
 */
export const getAutobookLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const scheduleId = Number(req.params.scheduleId);
        const schedule = await prisma.autobookSchedule.findFirst({
            where: { id: scheduleId, userId }
        });

        if (!schedule && req.user?.role !== 'ADMIN') {
            res.status(404).json({ error: 'Schedule not found or not owned by you' });
            return;
        }

        const logs = await prisma.autobookExecutionLog.findMany({
            where: { scheduleId },
            orderBy: { attemptTime: 'desc' },
            take: 50
        });

        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to fetch logs' });
    }
};

/**
 * Trigger a scheduler check cycle on demand (admin / cron runner / test runner)
 */
export const triggerSchedulerCycle = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { targetTime, targetDate } = req.body;
        const results = await executeDueAutobookSchedules(targetTime, targetDate);

        res.json({
            message: `Autobook cycle executed for ${targetTime || 'now'}`,
            processedCount: results.length,
            results
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to trigger scheduler cycle' });
    }
};
