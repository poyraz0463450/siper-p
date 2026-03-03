// server/routes/dashboard.js
// Dashboard İstatistikleri - Tek API çağrısıyla tüm veriler
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ─── Dashboard özet verileri (tek endpoint) ───
router.get('/stats', authenticate, async (req, res) => {
  try {
    // Paralel sorgular
    const [
      modelCount,
      partCount,
      criticalPartCount,
      lowStockItems,
      ordersByStatus,
      ordersByPriority,
      recentOrders,
      inventoryAlerts,
      recentMovements,
      unreadNotifications,
    ] = await Promise.all([
      // 1. Model sayısı
      db('models').where('status', 'active').count('id as count').first(),

      // 2. Parça sayısı
      db('parts').where('status', 'active').count('id as count').first(),

      // 3. Emniyet kritik parça sayısı
      db('parts').where({ is_critical: true, status: 'active' }).count('id as count').first(),

      // 4. Düşük stok listesi
      db('inventory')
        .select(
          'inventory.quantity', 'inventory.min_quantity',
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

      // 5. Üretim emirleri durum dağılımı
      db('production_orders')
        .select('status')
        .count('id as count')
        .sum('quantity as total_quantity')
        .groupBy('status'),

      // 6. Üretim emirleri öncelik dağılımı (aktif olanlar)
      db('production_orders')
        .select('priority')
        .count('id as count')
        .whereNotIn('status', ['completed', 'cancelled'])
        .groupBy('priority'),

      // 7. Son 6 üretim emri
      db('production_orders as po')
        .select(
          'po.id', 'po.order_number', 'po.quantity', 'po.status', 'po.priority',
          'po.created_at', 'po.planned_end_date',
          'models.name as model_name', 'models.code as model_code',
          'users.full_name as created_by_name'
        )
        .innerJoin('models', 'po.model_id', 'models.id')
        .leftJoin('users', 'po.created_by', 'users.id')
        .orderBy('po.created_at', 'desc')
        .limit(6),

      // 8. Kritik stok durumu (bar chart verisi)
      db('inventory')
        .select(
          'parts.code as part_code', 'parts.name as part_name',
          'inventory.quantity', 'inventory.min_quantity'
        )
        .innerJoin('parts', 'inventory.part_id', 'parts.id')
        .where('inventory.min_quantity', '>', 0)
        .orderByRaw('CASE WHEN inventory.min_quantity > 0 THEN inventory.quantity::float / inventory.min_quantity ELSE 999 END ASC')
        .limit(12),

      // 9. Son stok hareketleri
      db('inventory_movements')
        .select(
          'inventory_movements.movement_type', 'inventory_movements.quantity',
          'inventory_movements.created_at',
          'parts.name as part_name', 'parts.code as part_code',
          'users.full_name as user_name'
        )
        .innerJoin('parts', 'inventory_movements.part_id', 'parts.id')
        .leftJoin('users', 'inventory_movements.created_by', 'users.id')
        .orderBy('inventory_movements.created_at', 'desc')
        .limit(5),

      // 10. Okunmamış bildirimler
      db('notifications')
        .where(function () {
          this.where('user_id', req.user.id).orWhereNull('user_id');
        })
        .where('is_read', false)
        .count('id as count')
        .first(),
    ]);

    // İstatistikleri hesapla
    const statusMap = {};
    let totalOrders = 0, completedOrders = 0, inProductionOrders = 0, pendingOrders = 0;
    ordersByStatus.forEach(row => {
      const count = parseInt(row.count);
      statusMap[row.status] = count;
      totalOrders += count;
      if (row.status === 'completed') completedOrders = count;
      if (['in_production', 'in_progress'].includes(row.status)) inProductionOrders += count;
      if (['pending', 'pending_approval', 'approved'].includes(row.status)) pendingOrders += count;
    });

    res.json({
      // KPI sayıları
      kpis: {
        models: parseInt(modelCount.count),
        parts: parseInt(partCount.count),
        critical_parts: parseInt(criticalPartCount.count),
        low_stock: lowStockItems.length,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        in_production_orders: inProductionOrders,
        pending_orders: pendingOrders,
        completion_rate: totalOrders > 0 ? Math.round(completedOrders / totalOrders * 100) : 0,
        unread_notifications: parseInt(unreadNotifications.count),
      },

      // Grafik verileri
      charts: {
        orders_by_status: ordersByStatus.map(row => ({
          status: row.status,
          count: parseInt(row.count),
          total_quantity: parseInt(row.total_quantity) || 0,
        })),
        orders_by_priority: ordersByPriority.map(row => ({
          priority: row.priority,
          count: parseInt(row.count),
        })),
        inventory_levels: inventoryAlerts.map(row => ({
          code: row.part_code,
          name: row.part_name,
          current: row.quantity,
          minimum: row.min_quantity,
        })),
      },

      // Liste verileri
      lists: {
        low_stock_items: lowStockItems,
        recent_orders: recentOrders,
        recent_movements: recentMovements,
      },
    });
  } catch (error) {
    console.error('[DASHBOARD] Stats hatası:', error);
    res.status(500).json({ error: 'Dashboard verileri yüklenemedi.' });
  }
});

module.exports = router;
