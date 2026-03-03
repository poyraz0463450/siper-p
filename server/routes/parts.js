// server/routes/parts.js
// Parça Yönetimi - PostgreSQL/Knex
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Upload yapılandırması
const uploadDir = path.join(__dirname, '../../uploads/parts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'part-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    cb(extOk && mimeOk ? null : new Error('Sadece resim dosyaları yüklenebilir.'), extOk && mimeOk);
  },
});

// ─── Tüm parçaları getir ───
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, category_id, material, search, is_critical } = req.query;

    let query = db('parts')
      .select('parts.*', 'part_categories.name as category_name')
      .leftJoin('part_categories', 'parts.category_id', 'part_categories.id')
      .orderBy('parts.name');

    if (status) query = query.where('parts.status', status);
    if (category_id) query = query.where('parts.category_id', category_id);
    if (material) query = query.where('parts.material', 'ilike', `%${material}%`);
    if (is_critical === 'true') query = query.where('parts.is_critical', true);
    if (search) {
      query = query.where(function () {
        this.where('parts.name', 'ilike', `%${search}%`)
          .orWhere('parts.code', 'ilike', `%${search}%`)
          .orWhere('parts.drawing_number', 'ilike', `%${search}%`);
      });
    }

    const parts = await query;
    res.json(parts);
  } catch (error) {
    console.error('[PARTS] Liste hatası:', error);
    res.status(500).json({ error: 'Parçalar getirilemedi.' });
  }
});

// ─── Parça detayı ───
router.get('/:id', authenticate, async (req, res) => {
  try {
    const part = await db('parts')
      .select('parts.*', 'part_categories.name as category_name', 'users.full_name as created_by_name')
      .leftJoin('part_categories', 'parts.category_id', 'part_categories.id')
      .leftJoin('users', 'parts.created_by', 'users.id')
      .where('parts.id', req.params.id)
      .first();

    if (!part) {
      return res.status(404).json({ error: 'Parça bulunamadı.' });
    }

    // Bu parçanın kullanıldığı modeller (where-used)
    const usedInModels = await db('models')
      .select('models.id', 'models.name', 'models.code', 'model_parts.quantity')
      .innerJoin('model_parts', 'models.id', 'model_parts.model_id')
      .where('model_parts.part_id', part.id);

    // Stok durumu
    const inventory = await db('inventory')
      .select('inventory.*', 'warehouses.name as warehouse_name', 'warehouses.code as warehouse_code')
      .leftJoin('warehouses', 'inventory.warehouse_id', 'warehouses.id')
      .where('inventory.part_id', part.id);

    res.json({ ...part, used_in_models: usedInModels, inventory });
  } catch (error) {
    console.error('[PARTS] Detay hatası:', error);
    res.status(500).json({ error: 'Parça getirilemedi.' });
  }
});

// ─── Yeni parça oluştur ───
router.post('/', authenticate, upload.single('image'), async (req, res) => {
  try {
    const {
      name, code, material, heat_treatment, coating, operation_code, description,
      category_id, unit, drawing_number, weight_grams, dimensions,
      tolerance, hardness, surface_finish, is_critical, is_serialized,
      unit_cost, lead_time_days,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Parça adı ve kodu gereklidir.' });
    }

    const imagePath = req.file ? `/uploads/parts/${req.file.filename}` : null;

    const [newPart] = await db('parts')
      .insert({
        name, code,
        material: material || null,
        heat_treatment: heat_treatment || null,
        coating: coating || null,
        operation_code: operation_code || null,
        image_path: imagePath,
        description: description || null,
        category_id: category_id || null,
        unit: unit || 'adet',
        drawing_number: drawing_number || null,
        weight_grams: weight_grams || null,
        dimensions: dimensions || null,
        tolerance: tolerance || null,
        hardness: hardness || null,
        surface_finish: surface_finish || null,
        is_critical: is_critical === 'true' || is_critical === true,
        is_serialized: is_serialized === 'true' || is_serialized === true,
        unit_cost: unit_cost || 0,
        lead_time_days: lead_time_days || 0,
        created_by: req.user.id,
      })
      .returning('*');

    // Varsayılan stok kaydı oluştur (ana depo için)
    const mainWarehouse = await db('warehouses').where('code', 'HAM').first();
    if (mainWarehouse) {
      await db('inventory').insert({
        part_id: newPart.id,
        warehouse_id: mainWarehouse.id,
        quantity: 0,
      });
    }

    await req.audit('create', 'parts', newPart.id, name, null, { name, code, material });

    res.status(201).json(newPart);
  } catch (error) {
    if (error.constraint && error.constraint.includes('unique')) {
      return res.status(400).json({ error: 'Bu parça kodu zaten kullanılıyor.' });
    }
    console.error('[PARTS] Oluşturma hatası:', error);
    res.status(500).json({ error: 'Parça oluşturulamadı.' });
  }
});

// ─── Parça güncelle ───
router.put('/:id', authenticate, upload.single('image'), async (req, res) => {
  try {
    const partId = req.params.id;
    const existing = await db('parts').where('id', partId).first();

    if (!existing) {
      return res.status(404).json({ error: 'Parça bulunamadı.' });
    }

    let imagePath = existing.image_path;
    if (req.file) {
      // Eski resmi sil
      if (existing.image_path) {
        const oldPath = path.join(__dirname, '../..', existing.image_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      imagePath = `/uploads/parts/${req.file.filename}`;
    }

    const {
      name, code, material, heat_treatment, coating, operation_code, description,
      category_id, unit, drawing_number, weight_grams, dimensions,
      tolerance, hardness, surface_finish, is_critical, is_serialized,
      unit_cost, lead_time_days, revision_note,
    } = req.body;

    // Önemli alan değişikliğinde revizyon artır
    const criticalChange = (
      existing.material !== material ||
      existing.heat_treatment !== heat_treatment ||
      existing.tolerance !== tolerance ||
      existing.dimensions !== dimensions
    );

    const [updated] = await db('parts')
      .where('id', partId)
      .update({
        name: name || existing.name,
        code: code || existing.code,
        material: material || null,
        heat_treatment: heat_treatment || null,
        coating: coating || null,
        operation_code: operation_code || null,
        image_path: imagePath,
        description: description || null,
        category_id: category_id || existing.category_id,
        unit: unit || existing.unit,
        drawing_number: drawing_number || null,
        weight_grams: weight_grams || null,
        dimensions: dimensions || null,
        tolerance: tolerance || null,
        hardness: hardness || null,
        surface_finish: surface_finish || null,
        is_critical: is_critical !== undefined ? (is_critical === 'true' || is_critical === true) : existing.is_critical,
        is_serialized: is_serialized !== undefined ? (is_serialized === 'true' || is_serialized === true) : existing.is_serialized,
        unit_cost: unit_cost !== undefined ? unit_cost : existing.unit_cost,
        lead_time_days: lead_time_days !== undefined ? lead_time_days : existing.lead_time_days,
        revision: criticalChange ? existing.revision + 1 : existing.revision,
        revision_note: revision_note || (criticalChange ? 'Kritik alan değişikliği' : existing.revision_note),
        updated_at: db.fn.now(),
      })
      .returning('*');

    await req.audit('update', 'parts', partId, name || existing.name, existing, updated);

    res.json(updated);
  } catch (error) {
    console.error('[PARTS] Güncelleme hatası:', error);
    res.status(500).json({ error: 'Parça güncellenemedi.' });
  }
});

// ─── Parça sil ───
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const part = await db('parts').where('id', req.params.id).first();
    if (!part) {
      return res.status(404).json({ error: 'Parça bulunamadı.' });
    }

    // Parça bir modelde kullanılıyor mu kontrol et
    const usageCount = await db('model_parts')
      .where('part_id', req.params.id)
      .count('id as count')
      .first();

    if (parseInt(usageCount.count) > 0) {
      return res.status(400).json({ error: 'Bu parça modellerde kullanılıyor. Önce model ilişkilerini kaldırın.' });
    }

    // Resmi sil
    if (part.image_path) {
      const imgPath = path.join(__dirname, '../..', part.image_path);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await db('parts').where('id', req.params.id).del();
    await req.audit('delete', 'parts', part.id, part.name, part, null);

    res.json({ message: 'Parça silindi.' });
  } catch (error) {
    console.error('[PARTS] Silme hatası:', error);
    res.status(500).json({ error: 'Parça silinemedi.' });
  }
});

// ─── Parça kategorileri ───
router.get('/meta/categories', authenticate, async (req, res) => {
  try {
    const categories = await db('part_categories').orderBy('sort_order');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Kategoriler getirilemedi.' });
  }
});

module.exports = router;
