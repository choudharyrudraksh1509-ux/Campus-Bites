import { Router } from 'express';
import { 
    getAdminOverviewStats,
    getLiveOrders,
    updateOrderStatusByAdmin,
    getAllStalls,
    updateStallByAdmin,
    getAllUsers,
    updateUserRole,
    seedRealtimeDataEndpoint
} from '../controllers/adminController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/stats', getAdminOverviewStats);
router.get('/live-orders', getLiveOrders);
router.patch('/orders/:orderId/status', updateOrderStatusByAdmin);
router.get('/stalls', getAllStalls);
router.patch('/stalls/:shopId', updateStallByAdmin);
router.get('/users', getAllUsers);
router.patch('/users/:userId/role', updateUserRole);
router.post('/seed-realtime-data', seedRealtimeDataEndpoint);

export default router;
