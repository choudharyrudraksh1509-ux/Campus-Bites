import { Router } from 'express';
import { 
    placeOrder, 
    getMyOrders, 
    getOrderById, 
    cancelOrder, 
    confirmPayment,
    getShopQueueEstimate,
    getAutobookSchedules,
    createAutobookSchedule,
    toggleAutobookSchedule,
    deleteAutobookSchedule
} from '../controllers/orderController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, placeOrderSchema, autobookScheduleSchema } from '../validators';

const router = Router();
router.use(authenticateToken);

// Order placement & tracking
router.post('/', validateRequest(placeOrderSchema), placeOrder);
router.get('/', getMyOrders);
router.get('/my-orders', getMyOrders);

// Queue & Time estimation per shop
router.get('/queue-estimate/:shopId', getShopQueueEstimate);

// Daily Autobook recurring schedules
router.get('/autobook/schedules', getAutobookSchedules);
router.post('/autobook/schedules', validateRequest(autobookScheduleSchema), createAutobookSchedule);
router.patch('/autobook/schedules/:scheduleId/toggle', toggleAutobookSchedule);
router.delete('/autobook/schedules/:scheduleId', deleteAutobookSchedule);

// Specific order routes
router.get('/:orderId', getOrderById);
router.patch('/:orderId/cancel', cancelOrder);
router.put('/:orderId/cancel', cancelOrder);
router.post('/:orderId/payment', confirmPayment);

export default router;
