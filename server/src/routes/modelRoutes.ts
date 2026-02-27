import express from 'express';
import { createModel, getModelById, getModels, updateModelPart, deleteModelPart } from '../controllers/modelController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getModels);
router.post('/', createModel);
router.get('/:id', getModelById);
router.put('/:modelId/parts/:partId', updateModelPart);
router.delete('/:modelId/parts/:partId', deleteModelPart);

export default router;

