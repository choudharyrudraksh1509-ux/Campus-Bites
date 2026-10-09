import { Router } from 'express';
import { getShops, getShopById, getShopMenu, getShopTiming } from '../controllers/shopController';

const router = Router();
router.get('/', getShops);
router.get('/:shopId', getShopById);
router.get('/:shopId/menu', getShopMenu);
router.get('/:shopId/timing', getShopTiming);

export default router;
