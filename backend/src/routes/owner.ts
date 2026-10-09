import { Router } from 'express';
import { addMenuItem, updateMenuItem, deleteMenuItem, getOwnerSales } from '../controllers/ownerController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.post('/items', addMenuItem);
router.patch('/items/:itemId', updateMenuItem);
router.delete('/items/:itemId', deleteMenuItem);
router.get('/sales', getOwnerSales);

// Staff can also use PUT for toggle availability (alias)
router.put('/menu/:itemId', updateMenuItem);

export default router;
