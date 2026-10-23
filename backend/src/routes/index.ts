import { Router } from 'express';
import authRoutes from './auth';
import areaRoutes from './area';
import shopRoutes from './shop';
import orderRoutes from './order';
import staffRoutes from './staff';
import ownerRoutes from './owner';
import reviewRoutes from './review';
import adminRoutes from './admin';

const router = Router();

router.use('/auth', authRoutes);
router.use('/areas', areaRoutes);
router.use('/shops', shopRoutes);
router.use('/orders', orderRoutes);
router.use('/staff', staffRoutes);
router.use('/owner', ownerRoutes);
router.use('/reviews', reviewRoutes);
router.use('/admin', adminRoutes);

export default router;
