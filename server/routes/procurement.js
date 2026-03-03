// server/routes/procurement.js
// Satın Alma / Tedarik Zinciri - PostgreSQL/Knex
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ─── Otomatik PR numarası üret ───
async function generatePRNumber() {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `PR-${year}${month}`;

    const last = await db('purchase_requests')
        .where('pr_number', 'like', `${prefix}-%`)
        .orderBy('pr_number', 'desc')
        .first();

    let seq = 1;
    if (last) {
        const parts = last.pr_number.split('-');
        seq = parseInt(parts[parts.length - 1]) + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// ════════════════════════════
// TEDARİKÇİLER
// ════════════════════════════

router.get('/suppliers', authenticate, async (req, res) => {
    try {
        const { status, search } = req.query;
        let query = db('suppliers').orderBy('name');
        if (status) query = query.where('status', status);
        if (search) query = query.where('name', 'ilike', `%${search}%`);
        const suppliers = await query;
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ error: 'Tedarikçiler getirilemedi.' });
    }
});

router.post('/suppliers', authenticate, async (req, res) => {
    try {
        const { name, code, contact_person, phone, email, address, city, tax_number, category, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Tedarikçi adı gereklidir.' });
        const [supplier] = await db('suppliers').insert({
            name, code: code || null, contact_person: contact_person || null,
            phone: phone || null, email: email || null,
            address: address || null, city: city || null,
            tax_number: tax_number || null, category: category || null,
            notes: notes || null,
        }).returning('*');
        await req.audit('create', 'suppliers', supplier.id, name, null, supplier);
        res.status(201).json(supplier);
    } catch (error) {
        if (error.constraint?.includes('unique')) return res.status(400).json({ error: 'Bu tedarikçi kodu zaten kullanılıyor.' });
        res.status(500).json({ error: 'Tedarikçi oluşturulamadı.' });
    }
});

router.put('/suppliers/:id', authenticate, async (req, res) => {
    try {
        const { name, code, contact_person, phone, email, address, city, tax_number, category, status, rating, notes } = req.body;
        const existing = await db('suppliers').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Tedarikçi bulunamadı.' });
        const [updated] = await db('suppliers').where('id', req.params.id).update({
            name: name || existing.name, code, contact_person, phone, email, address, city,
            tax_number, category, status: status || existing.status,
            rating: rating || existing.rating, notes, updated_at: db.fn.now(),
        }).returning('*');
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Tedarikçi güncellenemedi.' });
    }
});

router.delete('/suppliers/:id', authenticate, async (req, res) => {
    try {
        const supplier = await db('suppliers').where('id', req.params.id).first();
        if (!supplier) return res.status(404).json({ error: 'Tedarikçi bulunamadı.' });
        const hasOrders = await db('purchase_requests').where('supplier_id', req.params.id).whereNotIn('status', ['completed', 'cancelled']).count('id as c').first();
        if (parseInt(hasOrders?.c || 0) > 0) return res.status(400).json({ error: 'Aktif satın alma talebi olan tedarikçi silinemez.' });
        await db('suppliers').where('id', req.params.id).del();
        res.json({ message: 'Tedarikçi silindi.' });
    } catch (error) {
        res.status(500).json({ error: 'Tedarikçi silinemedi.' });
    }
});

// ════════════════════════════
// SATIN ALMA TALEPLERİ
// ════════════════════════════

router.get('/', authenticate, async (req, res) => {
    try {
        const { status, supplier_id, search, limit = 100, offset = 0 } = req.query;
        let query = db('purchase_requests as pr')
            .select(
                'pr.*',
                'parts.name as part_name', 'parts.code as part_code', 'parts.unit',
                'suppliers.name as supplier_name',
                'u1.full_name as created_by_name', 'u2.full_name as approved_by_name'
            )
            .leftJoin('parts', 'pr.part_id', 'parts.id')
            .leftJoin('suppliers', 'pr.supplier_id', 'suppliers.id')
            .leftJoin('users as u1', 'pr.created_by', 'u1.id')
            .leftJoin('users as u2', 'pr.approved_by', 'u2.id')
            .orderBy('pr.created_at', 'desc')
            .limit(limit).offset(offset);
        if (status) query = query.where('pr.status', status);
        if (supplier_id) query = query.where('pr.supplier_id', supplier_id);
        if (search) {
            query = query.where(function () {
                this.where('pr.pr_number', 'ilike', `%${search}%`)
                    .orWhere('parts.name', 'ilike', `%${search}%`)
                    .orWhere('parts.code', 'ilike', `%${search}%`);
            });
        }
        const requests = await query;
        res.json(requests);
    } catch (error) {
        console.error('[PROCUREMENT] Liste hatası:', error);
        res.status(500).json({ error: 'Satın alma talepleri getirilemedi.' });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const { part_id, supplier_id, quantity, unit_price, currency, priority, needed_by_date, notes } = req.body;
        if (!part_id) return res.status(400).json({ error: 'Parça ID gereklidir.' });
        const pr_number = await generatePRNumber();
        const [pr] = await db('purchase_requests').insert({
            pr_number, part_id, supplier_id: supplier_id || null,
            quantity: quantity || 1, unit_price: unit_price || null,
            currency: currency || 'TRY', priority: priority || 'normal',
            needed_by_date: needed_by_date || null,
            notes: notes || null, created_by: req.user.id,
        }).returning('*');
        await req.audit('create', 'purchase_requests', pr.id, pr_number, null, pr);
        res.status(201).json(pr);
    } catch (error) {
        console.error('[PROCUREMENT] Oluşturma hatası:', error);
        res.status(500).json({ error: 'Satın alma talebi oluşturulamadı.' });
    }
});

router.put('/:id', authenticate, async (req, res) => {
    try {
        const {
            status, supplier_id, unit_price, currency, priority,
            needed_by_date, expected_delivery_date, received_date,
            received_quantity, po_number, notes, rejection_reason
        } = req.body;
        const existing = await db('purchase_requests').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Talep bulunamadı.' });

        const updateData = { updated_at: db.fn.now() };
        if (status) updateData.status = status;
        if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
        if (unit_price !== undefined) updateData.unit_price = unit_price;
        if (currency) updateData.currency = currency;
        if (priority) updateData.priority = priority;
        if (needed_by_date !== undefined) updateData.needed_by_date = needed_by_date;
        if (expected_delivery_date !== undefined) updateData.expected_delivery_date = expected_delivery_date;
        if (received_date !== undefined) updateData.received_date = received_date;
        if (received_quantity !== undefined) updateData.received_quantity = received_quantity;
        if (po_number !== undefined) updateData.po_number = po_number;
        if (notes !== undefined) updateData.notes = notes;
        if (rejection_reason !== undefined) updateData.rejection_reason = rejection_reason;

        // Onay kaydet
        if (status === 'approved' && existing.status !== 'approved') {
            updateData.approved_by = req.user.id;
            updateData.approved_at = db.fn.now();
        }
        // Teslim alındıysa, stok hareketi oluştur
        if (status === 'received' && existing.status !== 'received' && existing.part_id) {
            const qty = received_quantity || existing.quantity;
            const invEntry = await db('inventory')
                .where({ part_id: existing.part_id, warehouse_id: null })
                .first();
            if (invEntry) {
                await db('inventory').where('id', invEntry.id)
                    .update({ quantity: invEntry.quantity + qty, updated_at: db.fn.now() });
            } else {
                await db('inventory').insert({ part_id: existing.part_id, quantity: qty });
            }
            await db('inventory_movements').insert({
                part_id: existing.part_id, movement_type: 'in',
                quantity: qty, quantity_before: invEntry?.quantity || 0,
                quantity_after: (invEntry?.quantity || 0) + qty,
                reference_type: 'purchase', reference_id: existing.id,
                notes: `Satın alma teslim: ${existing.pr_number}`,
                created_by: req.user.id,
            });
        }

        const [updated] = await db('purchase_requests').where('id', req.params.id).update(updateData).returning('*');
        await req.audit('update', 'purchase_requests', existing.id, existing.pr_number, existing, updated);
        res.json(updated);
    } catch (error) {
        console.error('[PROCUREMENT] Güncelleme hatası:', error);
        res.status(500).json({ error: 'Satın alma talebi güncellenemedi.' });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const pr = await db('purchase_requests').where('id', req.params.id).first();
        if (!pr) return res.status(404).json({ error: 'Talep bulunamadı.' });
        if (['ordered', 'received'].includes(pr.status)) {
            return res.status(400).json({ error: 'Sipariş verilmiş veya teslim alınmış talep silinemez.' });
        }
        await db('purchase_requests').where('id', req.params.id).del();
        res.json({ message: 'Talep silindi.' });
    } catch (error) {
        res.status(500).json({ error: 'Talep silinemedi.' });
    }
});

// ─── Özet İstatistikler ───
router.get('/stats/summary', authenticate, async (req, res) => {
    try {
        const [total, pending, ordered, totalValue] = await Promise.all([
            db('purchase_requests').count('id as c').first(),
            db('purchase_requests').where('status', 'pending').count('id as c').first(),
            db('purchase_requests').where('status', 'ordered').count('id as c').first(),
            db('purchase_requests')
                .whereNotNull('unit_price')
                .sum(db.raw('quantity * unit_price as total'))
                .first(),
        ]);
        res.json({
            total: parseInt(total?.c || 0),
            pending: parseInt(pending?.c || 0),
            ordered: parseInt(ordered?.c || 0),
            total_value: parseFloat(totalValue?.total || 0),
        });
    } catch (error) {
        res.status(500).json({ error: 'İstatistikler getirilemedi.' });
    }
});

module.exports = router;
