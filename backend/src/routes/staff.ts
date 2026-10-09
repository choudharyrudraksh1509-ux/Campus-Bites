import { Router } from 'express';
import { getStaffOrders, updateOrderStatus } from '../controllers/staffController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
// In a real app we would strictly enforce STAFF role here
// router.use(requireRole('STAFF'));

router.get('/orders', getStaffOrders);
router.patch('/orders/:orderId/status', updateOrderStatus);

export default router;
