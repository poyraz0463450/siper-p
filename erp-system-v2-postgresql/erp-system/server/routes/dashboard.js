// server/routes/dashboard.js
// Dashboard İstatistik API - Tüm veriler tek endpoint'te
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ─── Ana Dashboard Verisi ───
router.get('/', authenticate, async (req, res) => {
  try {
    const [
      modelCount,
      partCount,
      criticalPartCount,
      lowStockItems,
      inventoryValue,
      ordersByStatus,
      ordersByPriority,
      recentOrders,
      recentMovements,
      warehouseStats,
      notifications,
      monthlyProduction,
    ] = await Promise.all([
      // 1. Model sayısı
      db('models').where('status', 'active').count('id as count').first(),

      // 2. Parça sayısı
      db('parts').where('status', 'active').count('id as count').first(),

      // 3. Kritik parça sayısı
      db('parts').where({ is_critical: true, status: 'active' }).count('id as count').first(),

      // 4. Düşük stok (ilk 10)
      db('inventory')
        .select(
          'inventory.id', 'inventory.quantity', 'inventory.min_quantity',
          'parts.name as part_name', 'parts.code as part_code',
          'parts.is_critical', 'parts.unit',
          'warehouses.name as warehouse_name'
        )
        .innerJoin('parts', 'inventory.part_id', 'parts.id')
        .leftJoin('warehouses', 'inventory.warehouse_id', 'warehouses.id')
        .whereRaw('inventory.quantity <= inventory.min_quantity')
        .where('inventory.min_quantity', '>', 0)
        .orderByRaw('parts.is_critical DESC, inventory.quantity ASC')
        .limit(10),

      // 5. Toplam stok değeri
      db('inventory')
        .innerJoin('parts', 'inventory.part_id', 'parts.id')
        .sum(db.raw('inventory.quantity * parts.unit_cost as total_value'))
        .first(),

      // 6. Emirler duruma göre
      db('production_orders')
        .select('status')
        .count('id as count')
        .sum('quantity as total_quantity')
        .groupBy('status'),

      // 7. Aktif emirler önceliğe göre
      db('production_orders')
        .select('priority')
        .count('id as count')
        .whereNotIn('status', ['completed', 'cancelled'])
        .groupBy('priority'),

      // 8. Son 10 üretim emri
      db('production_orders as po')
        .select(
          'po.id', 'po.order_number', 'po.quantity', 'po.status',
          'po.priority', 'po.created_at', 'po.planned_end_date',
          'po.completed_quantity', 'po.customer_name',
          'models.name as model_name', 'models.code as model_code',
          'users.full_name as created_by_name'
        )
        .innerJoin('models', 'po.model_id', 'models.id')
        .leftJoin('users', 'po.created_by', 'users.id')
        .orderBy('po.created_at', 'desc')
        .limit(10),

      // 9. Son 10 stok hareketi
      db('inventory_movements')
        .select(
          'inventory_movements.*',
          'parts.name as part_name', 'parts.code as part_code',
          'users.full_name as created_by_name',
          'warehouses.name as warehouse_name'
        )
        .innerJoin('parts', 'inventory_movements.part_id', 'parts.id')
        .leftJoin('users', 'inventory_movements.created_by', 'users.id')
        .leftJoin('warehouses', 'inventory_movements.warehouse_id', 'warehouses.id')
        .orderBy('inventory_movements.created_at', 'desc')
        .limit(10),

      // 10. Depo durumu
      db('warehouses')
        .select('warehouses.id', 'warehouses.name', 'warehouses.code', 'warehouses.type')
        .count('inventory.id as item_count')
        .sum('inventory.quantity as total_items')
        .leftJoin('inventory', 'warehouses.id', 'inventory.warehouse_id')
        .where('warehouses.is_active', true)
        .groupBy('warehouses.id', 'warehouses.name', 'warehouses.code', 'warehouses.type'),

      // 11. Okunmamış bildirimler
      db('notifications')
        .where(function () {
          this.where('user_id', req.user.id).orWhereNull('user_id');
        })
        .where('is_read', false)
        .orderBy('created_at', 'desc')
        .limit(5),

      // 12. Aylık üretim trendi (6 ay)
      db.raw(`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month_short,
          COUNT(*) as order_count,
          COALESCE(SUM(quantity), 0) as total_quantity,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN quantity ELSE 0 END), 0) as completed_quantity
        FROM production_orders
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
      `),
    ]);

    // Hesaplamalar
    const activeStatuses = ['pending_approval', 'approved', 'in_production', 'quality_check'];
    const activeOrders = ordersByStatus
      .filter(o => activeStatuses.includes(o.status))
      .reduce((sum, o) => sum + parseInt(o.count), 0);

    const completedOrders = ordersByStatus
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseInt(o.count), 0);

    const totalProduced = ordersByStatus
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseInt(o.total_quantity || 0), 0);

    res.json({
      kpis: {
        total_models: parseInt(modelCount.count),
        total_parts: parseInt(partCount.count),
        critical_parts: parseInt(criticalPartCount.count),
        low_stock_count: lowStockItems.length,
        active_orders: activeOrders,
        completed_orders: completedOrders,
        total_produced: totalProduced,
        inventory_value: parseFloat(inventoryValue?.total_value || 0),
      },
      charts: {
        orders_by_status: ordersByStatus.map(o => ({
          status: o.status,
          label: getStatusLabel(o.status),
          count: parseInt(o.count),
          quantity: parseInt(o.total_quantity || 0),
          color: getStatusColor(o.status),
        })),
        orders_by_priority: ordersByPriority.map(p => ({
          priority: p.priority,
          label: getPriorityLabel(p.priority),
          count: parseInt(p.count),
          color: getPriorityColor(p.priority),
        })),
        monthly_production: monthlyProduction.rows.map(m => ({
          month: m.month,
          month_short: m.month_short,
          orders: parseInt(m.order_count),
          quantity: parseInt(m.total_quantity),
          completed: parseInt(m.completed_quantity),
        })),
        warehouse_stats: warehouseStats.map(w => ({
          name: w.name,
          code: w.code,
          type: w.type,
          item_count: parseInt(w.item_count || 0),
          total_items: parseInt(w.total_items || 0),
        })),
      },
      tables: {
        recent_orders: recentOrders,
        recent_movements: recentMovements,
        low_stock_alerts: lowStockItems,
      },
      notifications,
    });
  } catch (error) {
    console.error('[DASHBOARD] Veri hatası:', error);
    res.status(500).json({ error: 'Dashboard verileri yüklenemedi.' });
  }
});

function getStatusLabel(s) {
  const m = { draft: 'Taslak', pending_approval: 'Onay Bekliyor', approved: 'Onaylandı', in_production: 'Üretimde', quality_check: 'Kalite Kontrol', completed: 'Tamamlandı', cancelled: 'İptal' };
  return m[s] || s;
}
function getStatusColor(s) {
  const m = { draft: '#95a5a6', pending_approval: '#f39c12', approved: '#3498db', in_production: '#e67e22', quality_check: '#9b59b6', completed: '#27ae60', cancelled: '#e74c3c' };
  return m[s] || '#95a5a6';
}
function getPriorityLabel(p) {
  const m = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };
  return m[p] || p;
}
function getPriorityColor(p) {
  const m = { low: '#3498db', normal: '#27ae60', high: '#f39c12', urgent: '#e74c3c' };
  return m[p] || '#95a5a6';
}

module.exports = router;
