import { Router } from 'express';
import { placeOrder, getMyOrders, getOrderById, cancelOrder, confirmPayment } from '../controllers/orderController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, placeOrderSchema } from '../validators';

const router = Router();
router.use(authenticateToken);

router.post('/', validateRequest(placeOrderSchema), placeOrder);
router.get('/my-orders', getMyOrders);
router.get('/:orderId', getOrderById);
router.patch('/:orderId/cancel', cancelOrder);
router.post('/:orderId/payment', confirmPayment);

export default router;
