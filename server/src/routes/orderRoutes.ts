import express from 'express';
import {
    createOrder,
    getOrders,
    getOrderById,
    updateOrder,
    updateOrderStatus,
    deleteOrder,
    getOrderStats
} from '../controllers/orderController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

// Statistics endpoint
router.get('/stats', getOrderStats);

// CRUD endpoints
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.put('/:id/status', updateOrderStatus);
router.delete('/:id', deleteOrder);

export default router;
