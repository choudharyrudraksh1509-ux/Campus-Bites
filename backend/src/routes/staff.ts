import { Router } from 'express';
import { getStaffOrders, getStaffOrderHistory, updateOrderStatus } from '../controllers/staffController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/orders', getStaffOrders);
router.get('/orders/history', getStaffOrderHistory);
router.patch('/orders/:orderId/status', updateOrderStatus);

export default router;
