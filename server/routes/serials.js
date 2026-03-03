// server/routes/serials.js
// Seri Numarası Takip Modülü - Backend API
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// ─── Otomatik seri numarası üret ───
async function generateSerialNumber(modelCode) {
    const prefix = (modelCode || 'BRG').substring(0, 6).toUpperCase();
    const year = new Date().getFullYear().toString().slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const last = await db('serial_numbers')
        .where('serial_number', 'like', `${prefix}-${year}${month}-%`)
        .orderBy('serial_number', 'desc')
        .first();

    let seq = 1;
    if (last) {
        const parts = last.serial_number.split('-');
        seq = parseInt(parts[parts.length - 1]) + 1;
    }

    return `${prefix}-${year}${month}-${String(seq).padStart(4, '0')}`;
}

// ─── Tüm seri numaralarını listele ───
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, model_id, search, limit = 100, offset = 0 } = req.query;

        let query = db('serial_numbers as s')
            .select(
                's.*',
                'models.name as model_name',
                'models.code as model_code',
                'users.full_name as created_by_name'
            )
            .leftJoin('models', 's.model_id', 'models.id')
            .leftJoin('users', 's.created_by', 'users.id')
            .orderBy('s.created_at', 'desc')
            .limit(limit)
            .offset(offset);

        if (status) query = query.where('s.status', status);
        if (model_id) query = query.where('s.model_id', model_id);
        if (search) {
            query = query.where(function () {
                this.where('s.serial_number', 'ilike', `%${search}%`)
                    .orWhere('models.name', 'ilike', `%${search}%`);
            });
        }

        const serials = await query;
        res.json(serials);
    } catch (error) {
        console.error('[SERIALS] Liste hatası:', error);
        res.status(500).json({ error: 'Seri numaraları getirilemedi.' });
    }
});

// ─── Seri numarasından arama ───
router.get('/by-number/:serialNumber', authenticate, async (req, res) => {
    try {
        const serial = await db('serial_numbers as s')
            .select('s.*', 'models.name as model_name', 'models.code as model_code')
            .leftJoin('models', 's.model_id', 'models.id')
            .where('s.serial_number', req.params.serialNumber)
            .first();

        if (!serial) {
            return res.status(404).json({ error: 'Seri numarası bulunamadı.' });
        }

        // Operasyon logları ve QC kayıtlarını da getir
        const [operations, qcRecords] = await Promise.all([
            db('operation_logs').where('serial_id', serial.id).orderBy('start_time', 'desc'),
            db('qc_records').where('serial_id', serial.id).orderBy('created_at', 'desc'),
        ]);

        res.json({ ...serial, operations, qc_records: qcRecords });
    } catch (error) {
        console.error('[SERIALS] Arama hatası:', error);
        res.status(500).json({ error: 'Arama yapılamadı.' });
    }
});

// ─── Seri detayı (operasyonlar + QC ile) ───
router.get('/:id', authenticate, async (req, res) => {
    try {
        const serial = await db('serial_numbers as s')
            .select('s.*', 'models.name as model_name', 'models.code as model_code')
            .leftJoin('models', 's.model_id', 'models.id')
            .where('s.id', req.params.id)
            .first();

        if (!serial) {
            return res.status(404).json({ error: 'Seri numarası bulunamadı.' });
        }

        const [operations, qcRecords] = await Promise.all([
            db('operation_logs').where('serial_id', serial.id).orderBy('start_time', 'desc'),
            db('qc_records').where('serial_id', serial.id).orderBy('created_at', 'desc'),
        ]);

        res.json({ ...serial, operations, qc_records: qcRecords });
    } catch (error) {
        console.error('[SERIALS] Detay hatası:', error);
        res.status(500).json({ error: 'Seri detayı getirilemedi.' });
    }
});

// ─── Yeni seri oluştur ───
router.post('/', authenticate, async (req, res) => {
    try {
        const { model_id, production_order_id, sub_parts, notes, serial_number } = req.body;

        if (!model_id) {
            return res.status(400).json({ error: 'Model ID gereklidir.' });
        }

        const model = await db('models').where('id', model_id).first();
        if (!model) {
            return res.status(404).json({ error: 'Model bulunamadı.' });
        }

        const sn = serial_number || await generateSerialNumber(model.code || model.name);

        const [newSerial] = await db('serial_numbers')
            .insert({
                serial_number: sn,
                model_id,
                production_order_id: production_order_id || null,
                status: 'in_production',
                sub_parts: JSON.stringify(sub_parts || {}),
                notes: notes || null,
                created_by: req.user.id,
            })
            .returning('*');

        await req.audit('create', 'serial_numbers', newSerial.id, sn, null, { model_id, serial_number: sn });

        res.status(201).json({ ...newSerial, model_name: model.name, model_code: model.code });
    } catch (error) {
        if (error.constraint && error.constraint.includes('unique')) {
            return res.status(400).json({ error: 'Bu seri numarası zaten mevcut.' });
        }
        console.error('[SERIALS] Oluşturma hatası:', error);
        res.status(500).json({ error: 'Seri numarası oluşturulamadı.' });
    }
});

// ─── Seri güncelle ───
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { status, sub_parts, notes } = req.body;
        const existing = await db('serial_numbers').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Seri bulunamadı.' });

        const updateData = { updated_at: db.fn.now() };
        if (status) updateData.status = status;
        if (sub_parts) updateData.sub_parts = JSON.stringify(sub_parts);
        if (notes !== undefined) updateData.notes = notes;

        const [updated] = await db('serial_numbers')
            .where('id', req.params.id)
            .update(updateData)
            .returning('*');

        await req.audit('update', 'serial_numbers', existing.id, existing.serial_number, existing, updated);

        res.json(updated);
    } catch (error) {
        console.error('[SERIALS] Güncelleme hatası:', error);
        res.status(500).json({ error: 'Seri güncellenemedi.' });
    }
});

// ─── Operasyon ekle ───
router.post('/:id/operations', authenticate, async (req, res) => {
    try {
        const { operation, part_type, personnel_name, machine, start_time, end_time, notes } = req.body;

        if (!operation) {
            return res.status(400).json({ error: 'Operasyon tipi gereklidir.' });
        }

        const serial = await db('serial_numbers').where('id', req.params.id).first();
        if (!serial) return res.status(404).json({ error: 'Seri bulunamadı.' });

        const [log] = await db('operation_logs')
            .insert({
                serial_id: parseInt(req.params.id),
                operation,
                part_type: part_type || null,
                personnel_name: personnel_name || null,
                machine: machine || null,
                start_time: start_time || db.fn.now(),
                end_time: end_time || null,
                notes: notes || null,
                created_by: req.user.id,
            })
            .returning('*');

        res.status(201).json(log);
    } catch (error) {
        console.error('[SERIALS] Operasyon ekleme hatası:', error);
        res.status(500).json({ error: 'Operasyon eklenemedi.' });
    }
});

// ─── QC kaydı ekle ───
router.post('/:id/qc', authenticate, async (req, res) => {
    try {
        const { test_type, inspector, pass, measurements, notes } = req.body;

        if (!test_type) {
            return res.status(400).json({ error: 'Test tipi gereklidir.' });
        }

        const serial = await db('serial_numbers').where('id', req.params.id).first();
        if (!serial) return res.status(404).json({ error: 'Seri bulunamadı.' });

        const [record] = await db('qc_records')
            .insert({
                serial_id: parseInt(req.params.id),
                test_type,
                inspector: inspector || null,
                pass: pass !== undefined ? pass : true,
                measurements: JSON.stringify(measurements || {}),
                notes: notes || null,
            })
            .returning('*');

        res.status(201).json(record);
    } catch (error) {
        console.error('[SERIALS] QC ekleme hatası:', error);
        res.status(500).json({ error: 'QC kaydı eklenemedi.' });
    }
});

// ─── Seri sil ───
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const serial = await db('serial_numbers').where('id', req.params.id).first();
        if (!serial) return res.status(404).json({ error: 'Seri bulunamadı.' });

        await db('serial_numbers').where('id', req.params.id).del();
        await req.audit('delete', 'serial_numbers', serial.id, serial.serial_number, serial, null);

        res.json({ message: 'Seri numarası silindi.' });
    } catch (error) {
        console.error('[SERIALS] Silme hatası:', error);
        res.status(500).json({ error: 'Seri silinemedi.' });
    }
});

module.exports = router;
