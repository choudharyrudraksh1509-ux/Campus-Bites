import { Router } from 'express';
import { placeOrder, getMyOrders, getOrderById } from '../controllers/orderController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, placeOrderSchema } from '../validators';

const router = Router();
router.use(authenticateToken);

router.post('/', validateRequest(placeOrderSchema), placeOrder);
router.get('/my-orders', getMyOrders);
router.get('/:orderId', getOrderById);

export default router;
