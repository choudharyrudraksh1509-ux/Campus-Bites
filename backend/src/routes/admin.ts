import { Router } from 'express';
import { 
    getAdminOverviewStats,
    getLiveOrders,
    updateOrderStatusByAdmin,
    getAllStalls,
    createStallByAdmin,
    updateStallByAdmin,
    getStallStaff,
    getStallMenu,
    getAllUsers,
    updateUserRole,
    updateUserStatus,
    getAuditLogs,
    getAdminReports,
    seedRealtimeDataEndpoint
} from '../controllers/adminController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateRequest, updateOrderStatusSchema } from '../validators';

const router = Router();

// Strictly require authentication and global ADMIN role
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard overview stats & reports
router.get('/stats', getAdminOverviewStats);
router.get('/reports', getAdminReports);

// Live kitchen orders stream & order management
router.get('/live-orders', getLiveOrders);
router.patch('/orders/:orderId/status', validateRequest(updateOrderStatusSchema), updateOrderStatusByAdmin);

// Stall & outlet management
router.get('/stalls', getAllStalls);
router.post('/stalls', createStallByAdmin);
router.patch('/stalls/:shopId', updateStallByAdmin);
router.get('/stalls/:shopId/staff', getStallStaff);
router.get('/stalls/:shopId/menu', getStallMenu);

// User access & role management
router.get('/users', getAllUsers);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/status', updateUserStatus);

// Structured audit logs
router.get('/audit-logs', getAuditLogs);

// Realtime testing seeder
router.post('/seed-realtime-data', seedRealtimeDataEndpoint);

export default router;
