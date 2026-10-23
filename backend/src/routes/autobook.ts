import { Router } from 'express';
import {
    getMyAutobookSchedules,
    createAutobookSchedule,
    getAutobookScheduleById,
    toggleAutobookSchedule,
    updateAutobookSchedule,
    deleteAutobookSchedule,
    runAutobookScheduleNow,
    getAutobookLogs,
    triggerSchedulerCycle
} from '../controllers/autobookController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, autobookScheduleSchema } from '../validators';

const router = Router();
router.use(authenticateToken);

router.get('/schedules', getMyAutobookSchedules);
router.post('/schedules', validateRequest(autobookScheduleSchema), createAutobookSchedule);
router.get('/schedules/:scheduleId', getAutobookScheduleById);
router.patch('/schedules/:scheduleId/toggle', toggleAutobookSchedule);
router.put('/schedules/:scheduleId', updateAutobookSchedule);
router.patch('/schedules/:scheduleId', updateAutobookSchedule);
router.delete('/schedules/:scheduleId', deleteAutobookSchedule);
router.post('/schedules/:scheduleId/run', runAutobookScheduleNow);
router.get('/schedules/:scheduleId/logs', getAutobookLogs);

// Trigger evaluation cycle (authenticated)
router.post('/trigger-cycle', triggerSchedulerCycle);

export default router;
