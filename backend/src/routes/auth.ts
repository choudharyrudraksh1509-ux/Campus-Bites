import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { validateRequest, registerSchema, loginSchema } from '../validators';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);

export default router;
