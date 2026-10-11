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
    getCategories
} from '../controllers/staffController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Order Management
router.get('/orders', getStaffOrders);
router.get('/orders/history', getStaffOrderHistory);
router.patch('/orders/:orderId/status', updateOrderStatus);
router.put('/orders/:orderId/status', updateOrderStatus);

// Stall Menu Management
router.get('/menu', getStaffMenu);
router.post('/menu', addStaffMenuItem);
router.put('/menu/:itemId', updateStaffMenuItem);
router.patch('/menu/:itemId', updateStaffMenuItem);
router.delete('/menu/:itemId', deleteStaffMenuItem);

// Stall & Profile Management
router.get('/stall', getStaffStallInfo);
router.put('/stall', updateStaffStallInfo);
router.get('/categories', getCategories);

export default router;

