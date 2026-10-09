import { Router } from 'express';
import { addReview, getShopReviews } from '../controllers/reviewController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/shop/:shopId', getShopReviews);

router.use(authenticateToken);
router.post('/', addReview);

export default router;
