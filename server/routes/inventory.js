// server/routes/inventory.js
// Stok Yönetimi - PostgreSQL/Knex (Çoklu Depo + Hareket Geçmişi)
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ─── Tüm stok durumu ───
router.get('/', authenticate, async (req, res) => {
  try {
    const { warehouse_id, search, low_stock_only } = req.query;

    let query = db('inventory')
      .select(
        'inventory.*',
        'parts.name as part_name', 'parts.code as part_code', 'parts.image_path',
        'parts.material', 'parts.heat_treatment', 'parts.coating',
        'parts.operation_code', 'parts.unit', 'parts.is_critical',
        'warehouses.name as warehouse_name', 'warehouses.code as warehouse_code'
      )
      .innerJoin('parts', 'inventory.part_id', 'parts.id')
      .leftJoin('warehouses', 'inventory.warehouse_id', 'warehouses.id')
      .orderBy('parts.name');

    if (warehouse_id) query = query.where('inventory.warehouse_id', warehouse_id);
    if (low_stock_only === 'true') {
      query = query.whereRaw('inventory.quantity <= inventory.min_quantity');
    }
    if (search) {
      query = query.where(function () {
        this.where('parts.name', 'ilike', `%${search}%`)
          .orWhere('parts.code', 'ilike', `%${search}%`);
      });
    }

    const inventory = await query;
    res.json(inventory);
  } catch (error) {
    console.error('[INVENTORY] Liste hatası:', error);
    res.status(500).json({ error: 'Stok bilgileri getirilemedi.' });
  }
});

// ─── Düşük stok uyarıları ───
router.get('/alerts/low-stock', authenticate, async (req, res) => {
  try {
    const lowStock = await db('inventory')
      .select(
        'inventory.*',
        'parts.name as part_name', 'parts.code as part_code',
        'parts.is_critical', 'parts.unit',
        'warehouses.name as warehouse_name'
      )
      .innerJoin('parts', 'inventory.part_id', 'parts.id')
      .leftJoin('warehouses', 'inventory.warehouse_id', 'warehouses.id')
      .whereRaw('inventory.quantity <= inventory.min_quantity')
      .where('inventory.min_quantity', '>', 0)
      .orderByRaw('parts.is_critical DESC, inventory.quantity ASC');

    res.json(lowStock);
  } catch (error) {
    console.error('[INVENTORY] Düşük stok hatası:', error);
    res.status(500).json({ error: 'Düşük stok uyarıları getirilemedi.' });
  }
});

// ─── Belirli parçanın stok durumu ───
router.get('/:partId', authenticate, async (req, res) => {
  try {
    const inventory = await db('inventory')
      .select('inventory.*', 'parts.name as part_name', 'parts.code as part_code',
        'warehouses.name as warehouse_name', 'warehouses.code as warehouse_code')
      .innerJoin('parts', 'inventory.part_id', 'parts.id')
      .leftJoin('warehouses', 'inventory.warehouse_id', 'warehouses.id')
      .where('inventory.part_id', req.params.partId);

    if (inventory.length === 0) {
      return res.status(404).json({ error: 'Stok kaydı bulunamadı.' });
    }

    // Toplam stok
    const totalQuantity = inventory.reduce((sum, i) => sum + i.quantity, 0);

    res.json({ items: inventory, total_quantity: totalQuantity });
  } catch (error) {
    console.error('[INVENTORY] Detay hatası:', error);
    res.status(500).json({ error: 'Stok bilgisi getirilemedi.' });
  }
});

// ─── Stok güncelle ───
router.put('/:partId', authenticate, async (req, res) => {
  try {
    const { quantity, min_quantity, max_quantity, reorder_point, reorder_quantity, location, notes, warehouse_id } = req.body;
    const partId = req.params.partId;

    const existing = await db('inventory')
      .where({ part_id: partId, warehouse_id: warehouse_id || null })
      .first();

    if (existing) {
      await db('inventory')
        .where('id', existing.id)
        .update({
          quantity: quantity !== undefined ? quantity : existing.quantity,
          min_quantity: min_quantity !== undefined ? min_quantity : existing.min_quantity,
          max_quantity: max_quantity || existing.max_quantity,
          reorder_point: reorder_point || existing.reorder_point,
          reorder_quantity: reorder_quantity || existing.reorder_quantity,
          location: location || existing.location,
          notes: notes || existing.notes,
          updated_at: db.fn.now(),
        });
    } else {
      await db('inventory').insert({
        part_id: partId,
        warehouse_id: warehouse_id || null,
        quantity: quantity || 0,
        min_quantity: min_quantity || 0,
        max_quantity: max_quantity || 0,
        reorder_point: reorder_point || 0,
        reorder_quantity: reorder_quantity || 0,
        location: location || null,
        notes: notes || null,
      });
    }

    res.json({ message: 'Stok güncellendi.' });
  } catch (error) {
    console.error('[INVENTORY] Güncelleme hatası:', error);
    res.status(500).json({ error: 'Stok güncellenemedi.' });
  }
});

// ─── Stok hareketi (artırma/azaltma) ───
router.post('/:partId/adjust', authenticate, async (req, res) => {
  try {
    const { quantity, type, notes, warehouse_id, lot_number, reference_type, reference_id } = req.body;
    const partId = req.params.partId;

    if (!quantity || !type) {
      return res.status(400).json({ error: 'Miktar ve hareket tipi gereklidir.' });
    }

    const whId = warehouse_id || null;

    // Mevcut stok
    let inventory = await db('inventory')
      .where({ part_id: partId, warehouse_id: whId })
      .first();

    if (!inventory) {
      // Stok kaydı yoksa oluştur
      const [newInv] = await db('inventory')
        .insert({ part_id: partId, warehouse_id: whId, quantity: 0 })
        .returning('*');
      inventory = newInv;
    }

    const quantityBefore = inventory.quantity;
    let newQuantity;

    switch (type) {
      case 'in':
      case 'increase':
      case 'return':
        newQuantity = quantityBefore + parseInt(quantity);
        break;
      case 'out':
      case 'decrease':
      case 'scrap':
        newQuantity = quantityBefore - parseInt(quantity);
        if (newQuantity < 0) {
          return res.status(400).json({ error: `Yetersiz stok. Mevcut: ${quantityBefore}` });
        }
        break;
      case 'adjustment':
        newQuantity = parseInt(quantity);
        break;
      default:
        return res.status(400).json({ error: 'Geçersiz hareket tipi.' });
    }

    // Stok güncelle
    await db('inventory')
      .where('id', inventory.id)
      .update({ quantity: newQuantity, updated_at: db.fn.now() });

    // Hareket kaydı oluştur
    await db('inventory_movements').insert({
      part_id: partId,
      warehouse_id: whId,
      movement_type: type,
      quantity: parseInt(quantity),
      quantity_before: quantityBefore,
      quantity_after: newQuantity,
      reference_type: reference_type || 'manual',
      reference_id: reference_id || null,
      lot_number: lot_number || null,
      notes: notes || null,
      created_by: req.user.id,
    });

    await req.audit('update', 'inventory', inventory.id, `Stok: ${partId}`,
      { quantity: quantityBefore }, { quantity: newQuantity }, `${type}: ${quantity}`);

    // Düşük stok kontrolü
    if (newQuantity <= inventory.min_quantity && inventory.min_quantity > 0) {
      const part = await db('parts').where('id', partId).first();
      await db('notifications').insert({
        user_id: null, // Tüm admin'lere (null = herkes)
        type: 'low_stock',
        title: 'Düşük Stok Uyarısı',
        message: `${part.name} (${part.code}) stok seviyesi kritik: ${newQuantity} ${part.unit}`,
        severity: part.is_critical ? 'error' : 'warning',
        link: `/inventory?partId=${partId}`,
      });
    }

    res.json({
      message: 'Stok hareketi kaydedildi.',
      quantity_before: quantityBefore,
      quantity_after: newQuantity,
    });
  } catch (error) {
    console.error('[INVENTORY] Hareket hatası:', error);
    res.status(500).json({ error: 'Stok hareketi kaydedilemedi.' });
  }
});

// ─── Stok hareket geçmişi ───
router.get('/:partId/movements', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const movements = await db('inventory_movements')
      .select('inventory_movements.*', 'users.full_name as created_by_name',
        'warehouses.name as warehouse_name')
      .leftJoin('users', 'inventory_movements.created_by', 'users.id')
      .leftJoin('warehouses', 'inventory_movements.warehouse_id', 'warehouses.id')
      .where('inventory_movements.part_id', req.params.partId)
      .orderBy('inventory_movements.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json(movements);
  } catch (error) {
    console.error('[INVENTORY] Hareket geçmişi hatası:', error);
    res.status(500).json({ error: 'Hareket geçmişi getirilemedi.' });
  }
});

// ─── Depolar ───
router.get('/meta/warehouses', authenticate, async (req, res) => {
  try {
    const warehouses = await db('warehouses').where('is_active', true).orderBy('name');
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ error: 'Depolar getirilemedi.' });
  }
});

module.exports = router;
