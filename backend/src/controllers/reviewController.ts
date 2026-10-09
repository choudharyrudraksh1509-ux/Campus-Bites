import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../db/prisma';

export const addReview = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const customerId = req.user?.userId;
        if (!customerId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { orderId, shopId, rating, comment } = req.body;

        const order = await prisma.order.findFirst({
            where: { id: Number(orderId), customerId }
        });

        if (!order) { res.status(403).json({ error: 'Order not found or not yours' }); return; }
        if (order.status !== 'COMPLETED') { res.status(400).json({ error: 'Can only review completed orders' }); return; }
        if (order.shopId !== Number(shopId)) { res.status(400).json({ error: 'Shop ID does not match order' }); return; }

        await prisma.review.create({
            data: {
                orderId: Number(orderId),
                customerId,
                shopId: Number(shopId),
                rating: Number(rating),
                comment: comment || null
            }
        });

        res.status(201).json({ message: 'Review added successfully' });
    } catch (error: any) {
        if (error.code === 'P2002') { // Prisma unique constraint
            res.status(400).json({ error: 'You have already reviewed this order' });
        } else {
            res.status(500).json({ error: 'Failed to add review' });
        }
    }
};

export const getShopReviews = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shopId } = req.params;
        const reviews = await prisma.review.findMany({
            where: { shopId: Number(shopId) },
            include: { customer: true },
            orderBy: { createdAt: 'desc' }
        });

        const mapped = reviews.map(r => ({
            ...r,
            reviewer_name: r.customer.fullName
        }));

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
};
