import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
    try {
        // Count active production orders (not completed or cancelled)
        const activeOrders = await prisma.productionOrder.count({
            where: {
                status: {
                    notIn: ['completed', 'cancelled']
                }
            }
        });

        // Count critical stock items using raw query for comparison
        const criticalStockResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count 
            FROM Part 
            WHERE stock_quantity <= min_stock_level
        `;
        const criticalStock = Number(criticalStockResult[0].count);

        // Count total parts
        const totalParts = await prisma.part.count();

        res.json({
            activeOrders,
            criticalStock,
            totalParts
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

export default router;
