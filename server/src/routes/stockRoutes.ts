import express from 'express';
import { createReservation, getReservations } from '../controllers/stockController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

router.post('/reservations', createReservation);
router.get('/reservations', getReservations);

export default router;
