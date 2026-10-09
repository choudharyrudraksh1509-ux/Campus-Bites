import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { validateRequest, registerSchema, loginSchema } from '../validators';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.get('/me', authenticateToken, getMe);

export default router;
