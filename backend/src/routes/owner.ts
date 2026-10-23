import { Router } from 'express';
import { 
    addMenuItem, 
    updateMenuItem, 
    deleteMenuItem, 
    getOwnerSales,
    getOwnerShop,
    updateOwnerShopStatus
} from '../controllers/ownerController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest, menuItemSchema } from '../validators';

const router = Router();

// Strictly require authentication and OWNER or ADMIN role
router.use(authenticateToken);
router.use(requireRole(['OWNER', 'ADMIN']));

router.post('/items', validateRequest(menuItemSchema), addMenuItem);
router.patch('/items/:itemId', updateMenuItem);
router.delete('/items/:itemId', deleteMenuItem);
router.get('/sales', getOwnerSales);
router.get('/shop', getOwnerShop);
router.patch('/shop/status', updateOwnerShopStatus);

// Staff alias
router.put('/menu/:itemId', updateMenuItem);

export default router;
