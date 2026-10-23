import { Router } from 'express';
import { register, login, getMe, updateProfile } from '../controllers/authController';
import { validateRequest, registerSchema, loginSchema } from '../validators';
import { authenticateToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiters';

const router = Router();

router.post('/register', authLimiter, validateRequest(registerSchema), register);
router.post('/login', authLimiter, validateRequest(loginSchema), login);
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.put('/me', authenticateToken, updateProfile);

export default router;
