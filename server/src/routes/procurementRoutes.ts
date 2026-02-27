import express from 'express';
import {
    createPurchaseRequest,
    createBulkPurchaseRequests,
    getPurchaseRequests,
    updatePurchaseRequestStatus,
    updatePurchaseRequestDetails,
    updateBulkPurchaseRequestStatus,
    getSuppliers
} from '../controllers/procurementController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken); // Protect routes

// Purchase Requests
router.post('/requests', createPurchaseRequest);
router.post('/requests/bulk', createBulkPurchaseRequests);
router.patch('/requests/bulk/status', updateBulkPurchaseRequestStatus);
router.get('/requests', getPurchaseRequests);
router.patch('/requests/:id/status', updatePurchaseRequestStatus);
router.patch('/requests/:id', updatePurchaseRequestDetails);

// Suppliers
router.get('/suppliers', getSuppliers);

export default router;
