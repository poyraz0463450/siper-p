import express from 'express';
import { createPart, deletePart, getParts, updatePart } from '../controllers/partController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken); // Protect all routes

router.get('/', getParts);
router.post('/', createPart);
router.put('/:id', updatePart);
router.delete('/:id', deletePart);

export default router;
