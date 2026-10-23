import { Router } from 'express';
import { 
    placeOrder, 
    createOrder,
    getMyOrders, 
    getOrderById, 
    cancelOrder, 
    confirmPayment,
    handlePaymentWebhook,
    getShopQueueEstimate,
    getAutobookSchedules,
    createAutobookSchedule,
    toggleAutobookSchedule,
    deleteAutobookSchedule,
    executeAutobookSchedule
} from '../controllers/orderController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, placeOrderSchema, autobookScheduleSchema } from '../validators';
import { orderLimiter } from '../middleware/rateLimiters';

const router = Router();

// ==========================================
// PUBLIC WEBHOOK ENDPOINTS (Signature Verified)
// ==========================================
router.post('/webhook/payment', handlePaymentWebhook);
router.post('/webhook', handlePaymentWebhook);

// ==========================================
// PROTECTED CUSTOMER & STAFF ROUTES
// ==========================================
router.use(authenticateToken);

// Order placement & tracking
router.post('/', orderLimiter, validateRequest(placeOrderSchema), createOrder);
router.get('/', getMyOrders);
router.get('/my-orders', getMyOrders);

// Queue & Time estimation per shop
router.get('/queue-estimate/:shopId', getShopQueueEstimate);

// Daily Autobook recurring schedules (maintained for backward-compatibility)
router.get('/autobook/schedules', getAutobookSchedules);
router.post('/autobook/schedules', validateRequest(autobookScheduleSchema), createAutobookSchedule);
router.patch('/autobook/schedules/:scheduleId/toggle', toggleAutobookSchedule);
router.delete('/autobook/schedules/:scheduleId', deleteAutobookSchedule);
router.post('/autobook/schedules/:scheduleId/execute', executeAutobookSchedule);

// Specific order routes
router.get('/:orderId', getOrderById);
router.patch('/:orderId/cancel', cancelOrder);
router.put('/:orderId/cancel', cancelOrder);
router.post('/:orderId/payment', confirmPayment);

export default router;
