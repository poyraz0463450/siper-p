// server/routes/reports.js
// Raporlama Modülü - Özet istatistikler, grafikler
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ─── Üretim Trendi (Son 12 ay) ───
router.get('/production-trend', authenticate, async (req, res) => {
    try {
        const months = parseInt(req.query.months) || 12;
        const rows = await db('production_orders')
            .select(
                db.raw("TO_CHAR(created_at, 'YYYY-MM') as month"),
                db.raw('COUNT(*) as total'),
                db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed"),
                db.raw("COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled"),
                db.raw("SUM(quantity) FILTER (WHERE status = 'completed') as units_produced")
            )
            .where('created_at', '>=', db.raw(`NOW() - INTERVAL '${months} months'`))
            .groupBy(db.raw("TO_CHAR(created_at, 'YYYY-MM')"))
            .orderBy('month');
        res.json(rows);
    } catch (error) {
        console.error('[REPORTS] Üretim trendi hatası:', error);
        res.status(500).json({ error: 'Üretim trendi getirilemedi.' });
    }
});

// ─── Stok Durumu Özeti ───
router.get('/inventory-summary', authenticate, async (req, res) => {
    try {
        const summary = await db('inventory')
            .select(
                'parts.category_id',
                'part_categories.name as category_name',
                db.raw('COUNT(DISTINCT inventory.part_id) as part_count'),
                db.raw('SUM(inventory.quantity) as total_quantity'),
                db.raw("COUNT(*) FILTER (WHERE inventory.quantity <= inventory.min_quantity AND inventory.min_quantity > 0) as low_stock_count"),
                db.raw('SUM(inventory.quantity * parts.unit_cost) as total_value')
            )
            .innerJoin('parts', 'inventory.part_id', 'parts.id')
            .leftJoin('part_categories', 'parts.category_id', 'part_categories.id')
            .groupBy('parts.category_id', 'part_categories.name')
            .orderBy('total_value', 'desc');
        res.json(summary);
    } catch (error) {
        console.error('[REPORTS] Stok özeti hatası:', error);
        res.status(500).json({ error: 'Stok özeti getirilemedi.' });
    }
});

// ─── Düşük Stok Parçalar ───
router.get('/low-stock', authenticate, async (req, res) => {
    try {
        const parts = await db('inventory')
            .select(
                'parts.name', 'parts.code', 'parts.is_critical', 'parts.unit',
                db.raw('SUM(inventory.quantity) as total_qty'),
                db.raw('MAX(inventory.min_quantity) as min_qty')
            )
            .innerJoin('parts', 'inventory.part_id', 'parts.id')
            .whereRaw('inventory.quantity <= inventory.min_quantity')
            .where('inventory.min_quantity', '>', 0)
            .groupBy('parts.id', 'parts.name', 'parts.code', 'parts.is_critical', 'parts.unit')
            .orderByRaw('parts.is_critical DESC, total_qty ASC')
            .limit(20);
        res.json(parts);
    } catch (error) {
        console.error('[REPORTS] Düşük stok hatası:', error);
        res.status(500).json({ error: 'Düşük stok raporu getirilemedi.' });
    }
});

// ─── Seri Numarası Durumu ───
router.get('/serial-status', authenticate, async (req, res) => {
    try {
        const rows = await db('serial_numbers')
            .select('status', db.raw('COUNT(*) as count'))
            .groupBy('status');

        const byModel = await db('serial_numbers')
            .select(
                'models.name as model_name',
                db.raw('COUNT(*) as total'),
                db.raw("COUNT(*) FILTER (WHERE serial_numbers.status = 'completed') as completed"),
                db.raw("COUNT(*) FILTER (WHERE serial_numbers.status = 'in_production') as in_production")
            )
            .leftJoin('models', 'serial_numbers.model_id', 'models.id')
            .groupBy('models.name')
            .orderBy('total', 'desc')
            .limit(10);

        res.json({ by_status: rows, by_model: byModel });
    } catch (error) {
        console.error('[REPORTS] Seri durumu hatası:', error);
        res.status(500).json({ error: 'Seri durumu raporu getirilemedi.' });
    }
});

// ─── Kalite Kontrol Özeti ───
router.get('/qc-summary', authenticate, async (req, res) => {
    try {
        const overall = await db('qc_records')
            .select(
                db.raw('COUNT(*) as total'),
                db.raw("COUNT(*) FILTER (WHERE pass = true) as passed"),
                db.raw("COUNT(*) FILTER (WHERE pass = false) as failed")
            )
            .first();

        const byType = await db('qc_records')
            .select(
                'test_type',
                db.raw('COUNT(*) as total'),
                db.raw("COUNT(*) FILTER (WHERE pass = true) as passed")
            )
            .groupBy('test_type')
            .orderBy('total', 'desc');

        res.json({ overall, by_type: byType });
    } catch (error) {
        console.error('[REPORTS] QC özeti hatası:', error);
        res.status(500).json({ error: 'QC raporu getirilemedi.' });
    }
});

// ─── Operasyon Analizi ───
router.get('/operation-analysis', authenticate, async (req, res) => {
    try {
        const byOp = await db('operation_logs')
            .select('operation', db.raw('COUNT(*) as count'))
            .groupBy('operation')
            .orderBy('count', 'desc');

        const byPersonnel = await db('operation_logs')
            .select('personnel_name', db.raw('COUNT(*) as count'))
            .whereNotNull('personnel_name')
            .groupBy('personnel_name')
            .orderBy('count', 'desc')
            .limit(10);

        res.json({ by_operation: byOp, by_personnel: byPersonnel });
    } catch (error) {
        console.error('[REPORTS] Operasyon analizi hatası:', error);
        res.status(500).json({ error: 'Operasyon analizi getirilemedi.' });
    }
});

// ─── Genel KPI Özeti ───
router.get('/kpi', authenticate, async (req, res) => {
    try {
        const [orders, parts, serials, qc, lowStock] = await Promise.all([
            db('production_orders').count('id as count').first(),
            db('parts').count('id as count').first(),
            db('serial_numbers').count('id as count').first(),
            db('qc_records').select(
                db.raw('COUNT(*) as total'),
                db.raw("COUNT(*) FILTER (WHERE pass = true) as passed")
            ).first(),
            db('inventory')
                .whereRaw('quantity <= min_quantity')
                .where('min_quantity', '>', 0)
                .count('id as count')
                .first(),
        ]);

        const completedOrders = await db('production_orders')
            .where('status', 'completed')
            .count('id as count')
            .first();

        const totalInventoryValue = await db('inventory')
            .join('parts', 'inventory.part_id', 'parts.id')
            .sum(db.raw('inventory.quantity * parts.unit_cost as value'))
            .first();

        res.json({
            total_orders: parseInt(orders?.count || 0),
            completed_orders: parseInt(completedOrders?.count || 0),
            total_parts: parseInt(parts?.count || 0),
            total_serials: parseInt(serials?.count || 0),
            qc_pass_rate: qc?.total > 0 ? Math.round((qc.passed / qc.total) * 100) : 0,
            low_stock_count: parseInt(lowStock?.count || 0),
            inventory_value: parseFloat(totalInventoryValue?.value || 0),
        });
    } catch (error) {
        console.error('[REPORTS] KPI hatası:', error);
        res.status(500).json({ error: 'KPI getirilemedi.' });
    }
});

module.exports = router;
