// server/routes/productionOrders.js
// Üretim Emri Yönetimi - PostgreSQL/Knex (Gelişmiş İş Akışı)
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

// Geçerli durum geçişleri
const STATUS_TRANSITIONS = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'draft', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['quality_check', 'completed', 'cancelled'],
  quality_check: ['completed', 'in_production'],
  completed: [],
  cancelled: ['draft'],
};

// ─── Tüm üretim emirleri ───
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, model_id, search } = req.query;

    let query = db('production_orders as po')
      .select(
        'po.*',
        'models.name as model_name', 'models.code as model_code', 'models.caliber',
        'u1.full_name as created_by_name',
        'u2.full_name as approved_by_name'
      )
      .innerJoin('models', 'po.model_id', 'models.id')
      .leftJoin('users as u1', 'po.created_by', 'u1.id')
      .leftJoin('users as u2', 'po.approved_by', 'u2.id')
      .orderBy('po.created_at', 'desc');

    if (status) query = query.where('po.status', status);
    if (priority) query = query.where('po.priority', priority);
    if (model_id) query = query.where('po.model_id', model_id);
    if (search) {
      query = query.where(function () {
        this.where('po.order_number', 'ilike', `%${search}%`)
          .orWhere('po.customer_name', 'ilike', `%${search}%`)
          .orWhere('models.name', 'ilike', `%${search}%`);
      });
    }

    const orders = await query;
    res.json(orders);
  } catch (error) {
    console.error('[PRODUCTION] Liste hatası:', error);
    res.status(500).json({ error: 'Üretim emirleri getirilemedi.' });
  }
});

// ─── Üretim emri detayı ───
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await db('production_orders as po')
      .select(
        'po.*',
        'models.name as model_name', 'models.code as model_code', 'models.caliber',
        'u1.full_name as created_by_name',
        'u2.full_name as approved_by_name'
      )
      .innerJoin('models', 'po.model_id', 'models.id')
      .leftJoin('users as u1', 'po.created_by', 'u1.id')
      .leftJoin('users as u2', 'po.approved_by', 'u2.id')
      .where('po.id', req.params.id)
      .first();

    if (!order) {
      return res.status(404).json({ error: 'Üretim emri bulunamadı.' });
    }

    // Emir parçaları
    const parts = await db('production_order_parts as pop')
      .select(
        'pop.*',
        'parts.name as part_name', 'parts.code as part_code',
        'parts.unit', 'parts.is_critical'
      )
      .innerJoin('parts', 'pop.part_id', 'parts.id')
      .where('pop.order_id', order.id);

    // Her parça için toplam stok
    for (const part of parts) {
      const stock = await db('inventory')
        .where('part_id', part.part_id)
        .sum('quantity as total')
        .first();
      part.available_quantity = parseInt(stock.total) || 0;
    }

    // Mümkün durum geçişleri
    const allowedTransitions = STATUS_TRANSITIONS[order.status] || [];

    res.json({ ...order, parts, allowed_status_transitions: allowedTransitions });
  } catch (error) {
    console.error('[PRODUCTION] Detay hatası:', error);
    res.status(500).json({ error: 'Üretim emri getirilemedi.' });
  }
});

// ─── Yeni üretim emri oluştur ───
router.post('/', authenticate, async (req, res) => {
  try {
    const { model_id, quantity, priority, notes, planned_start_date, planned_end_date, customer_name, customer_order_ref } = req.body;

    if (!model_id || !quantity) {
      return res.status(400).json({ error: 'Model ve miktar gereklidir.' });
    }

    // Model var mı kontrol et
    const model = await db('models').where('id', model_id).first();
    if (!model) {
      return res.status(404).json({ error: 'Model bulunamadı.' });
    }

    // Sipariş numarası oluştur
    const prefix = 'UE';
    const year = new Date().getFullYear();
    const lastOrder = await db('production_orders')
      .where('order_number', 'like', `${prefix}-${year}-%`)
      .orderBy('order_number', 'desc')
      .first();

    let seq = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.order_number.split('-').pop());
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const orderNumber = `${prefix}-${year}-${String(seq).padStart(5, '0')}`;

    // Transaction ile oluştur
    const result = await db.transaction(async (trx) => {
      const [newOrder] = await trx('production_orders')
        .insert({
          order_number: orderNumber,
          model_id,
          quantity,
          status: 'draft',
          priority: priority || 'normal',
          notes: notes || null,
          planned_start_date: planned_start_date || null,
          planned_end_date: planned_end_date || null,
          customer_name: customer_name || null,
          customer_order_ref: customer_order_ref || null,
          created_by: req.user.id,
        })
        .returning('*');

      // Modelin parçalarını üretim emri parçalarına ekle
      const modelParts = await trx('model_parts').where('model_id', model_id);

      if (modelParts.length > 0) {
        const orderParts = modelParts.map(mp => ({
          order_id: newOrder.id,
          part_id: mp.part_id,
          required_quantity: mp.quantity * quantity,
          allocated_quantity: 0,
          consumed_quantity: 0,
          status: 'pending',
        }));
        await trx('production_order_parts').insert(orderParts);
      }

      return newOrder;
    });

    await req.audit('create', 'production_orders', result.id, orderNumber,
      null, { model: model.name, quantity, priority });

    res.status(201).json(result);
  } catch (error) {
    console.error('[PRODUCTION] Oluşturma hatası:', error);
    res.status(500).json({ error: 'Üretim emri oluşturulamadı.' });
  }
});

// ─── Durum güncelle ───
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const orderId = req.params.id;

    const order = await db('production_orders').where('id', orderId).first();
    if (!order) {
      return res.status(404).json({ error: 'Üretim emri bulunamadı.' });
    }

    // Geçiş kontrolü
    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `'${order.status}' durumundan '${status}' durumuna geçiş yapılamaz.`,
        allowed_transitions: allowed,
      });
    }

    const updateData = {
      status,
      updated_at: db.fn.now(),
    };

    // Durum bazlı ek işlemler
    if (status === 'approved') {
      updateData.approved_by = req.user.id;
      updateData.approved_at = db.fn.now();
    }
    if (status === 'in_production' && !order.actual_start_date) {
      updateData.actual_start_date = db.fn.now();
    }
    if (status === 'completed') {
      updateData.completed_at = db.fn.now();
      updateData.actual_end_date = db.fn.now();
      updateData.completed_quantity = order.quantity;
    }
    if (notes) {
      updateData.notes = notes;
    }

    await db('production_orders').where('id', orderId).update(updateData);

    await req.audit('update', 'production_orders', orderId, order.order_number,
      { status: order.status }, { status }, `Durum değişikliği: ${order.status} → ${status}`);

    res.json({ message: `Üretim emri durumu '${status}' olarak güncellendi.` });
  } catch (error) {
    console.error('[PRODUCTION] Durum güncelleme hatası:', error);
    res.status(500).json({ error: 'Durum güncellenemedi.' });
  }
});

// ─── Üretim emri güncelle ───
router.put('/:id', authenticate, async (req, res) => {
  try {
    const order = await db('production_orders').where('id', req.params.id).first();
    if (!order) {
      return res.status(404).json({ error: 'Üretim emri bulunamadı.' });
    }

    if (!['draft', 'pending_approval'].includes(order.status)) {
      return res.status(400).json({ error: 'Sadece taslak veya onay bekleyen emirler düzenlenebilir.' });
    }

    const { quantity, priority, notes, planned_start_date, planned_end_date, customer_name, customer_order_ref } = req.body;

    await db('production_orders').where('id', req.params.id).update({
      quantity: quantity || order.quantity,
      priority: priority || order.priority,
      notes: notes !== undefined ? notes : order.notes,
      planned_start_date: planned_start_date || order.planned_start_date,
      planned_end_date: planned_end_date || order.planned_end_date,
      customer_name: customer_name !== undefined ? customer_name : order.customer_name,
      customer_order_ref: customer_order_ref !== undefined ? customer_order_ref : order.customer_order_ref,
      updated_at: db.fn.now(),
    });

    // Miktar değiştiyse parça gereksinimlerini güncelle
    if (quantity && quantity !== order.quantity) {
      const modelParts = await db('model_parts').where('model_id', order.model_id);
      for (const mp of modelParts) {
        await db('production_order_parts')
          .where({ order_id: order.id, part_id: mp.part_id })
          .update({ required_quantity: mp.quantity * quantity });
      }
    }

    res.json({ message: 'Üretim emri güncellendi.' });
  } catch (error) {
    console.error('[PRODUCTION] Güncelleme hatası:', error);
    res.status(500).json({ error: 'Üretim emri güncellenemedi.' });
  }
});

// ─── Üretim emri sil ───
router.delete('/:id', authenticate, requireRole('admin', 'production_manager'), async (req, res) => {
  try {
    const order = await db('production_orders').where('id', req.params.id).first();
    if (!order) {
      return res.status(404).json({ error: 'Üretim emri bulunamadı.' });
    }

    if (!['draft', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: 'Sadece taslak veya iptal edilmiş emirler silinebilir.' });
    }

    await db('production_orders').where('id', req.params.id).del();
    await req.audit('delete', 'production_orders', order.id, order.order_number, order, null);

    res.json({ message: 'Üretim emri silindi.' });
  } catch (error) {
    console.error('[PRODUCTION] Silme hatası:', error);
    res.status(500).json({ error: 'Üretim emri silinemedi.' });
  }
});

// ─── İstatistikler ───
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const stats = await db('production_orders')
      .select('status')
      .count('id as count')
      .sum('quantity as total_quantity')
      .groupBy('status');

    const priorityStats = await db('production_orders')
      .select('priority')
      .count('id as count')
      .whereNotIn('status', ['completed', 'cancelled'])
      .groupBy('priority');

    res.json({ by_status: stats, by_priority: priorityStats });
  } catch (error) {
    res.status(500).json({ error: 'İstatistikler getirilemedi.' });
  }
});

module.exports = router;
