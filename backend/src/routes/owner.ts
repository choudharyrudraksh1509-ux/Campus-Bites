import { Router } from 'express';
import { addMenuItem, updateMenuItem, getOwnerSales } from '../controllers/ownerController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);
// router.use(requireRole('OWNER'));

router.post('/items', addMenuItem);
router.patch('/items/:itemId', updateMenuItem);
router.get('/sales', getOwnerSales);

export default router;
