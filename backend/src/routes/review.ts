import { Router } from 'express';
import { addReview, getShopReviews, getShopItemReviews } from '../controllers/reviewController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/shop/:shopId', getShopReviews);
router.get('/shop/:shopId/items', getShopItemReviews);

router.use(authenticateToken);
router.post('/', addReview);
router.post('/shop/:shopId', addReview);

export default router;
