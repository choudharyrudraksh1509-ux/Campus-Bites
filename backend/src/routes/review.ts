import { Router } from 'express';
import { addReview, getShopReviews, getShopItemReviews } from '../controllers/reviewController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, reviewSchema } from '../validators';
import { reviewLimiter } from '../middleware/rateLimiters';

const router = Router();

// Public review reading
router.get('/shop/:shopId', getShopReviews);
router.get('/shop/:shopId/items', getShopItemReviews);

// Protected review submission
router.use(authenticateToken);
router.post('/', reviewLimiter, validateRequest(reviewSchema), addReview);
router.post('/shop/:shopId', reviewLimiter, validateRequest(reviewSchema), addReview);

export default router;
