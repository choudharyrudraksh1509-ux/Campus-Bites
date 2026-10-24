import { Router } from 'express';
import { 
    getStaffOrders, 
    getStaffOrderHistory, 
    updateOrderStatus,
    getStaffMenu,
    addStaffMenuItem,
    updateStaffMenuItem,
    deleteStaffMenuItem,
    getStaffStallInfo,
    updateStaffStallInfo,
    getCategories,
    toggleClosingClearance,
    toggleItemDynamicPricing,
    getStaffAnalytics
} from '../controllers/staffController';
import { authenticateToken, requireStaffOrAdmin } from '../middleware/auth';
import { validateRequest, updateOrderStatusSchema, menuItemSchema } from '../validators';

const router = Router();

// Strictly require authentication and staff/owner/admin role for all staff routes
router.use(authenticateToken);
router.use(requireStaffOrAdmin);

// Dashboard Analytics & Performance
router.get('/analytics', getStaffAnalytics);

// Order Management
router.get('/orders', getStaffOrders);
router.get('/orders/history', getStaffOrderHistory);
router.patch('/orders/:orderId/status', validateRequest(updateOrderStatusSchema), updateOrderStatus);
router.put('/orders/:orderId/status', validateRequest(updateOrderStatusSchema), updateOrderStatus);

// Stall Menu Management
router.get('/menu', getStaffMenu);
router.post('/menu', validateRequest(menuItemSchema), addStaffMenuItem);
router.put('/menu/:itemId', updateStaffMenuItem);
router.patch('/menu/:itemId', updateStaffMenuItem);
router.delete('/menu/:itemId', deleteStaffMenuItem);

// Dynamic Pricing & Closing Clearance
router.post('/dynamic-pricing/closing-clearance', toggleClosingClearance);
router.post('/dynamic-pricing/item/:itemId', toggleItemDynamicPricing);

// Stall & Profile Management
router.get('/stall', getStaffStallInfo);
router.put('/stall', updateStaffStallInfo);
router.get('/categories', getCategories);

export default router;
