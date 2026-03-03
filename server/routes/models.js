// server/routes/models.js
// Silah Modeli Yönetimi - PostgreSQL/Knex
const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

// ─── Tüm modelleri getir ───
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, category, search } = req.query;

    let query = db('models')
      .select('models.*', 'users.full_name as created_by_name')
      .leftJoin('users', 'models.created_by', 'users.id')
      .orderBy('models.name');

    if (status) query = query.where('models.status', status);
    if (category) query = query.where('models.category', category);
    if (search) {
      query = query.where(function () {
        this.where('models.name', 'ilike', `%${search}%`)
          .orWhere('models.code', 'ilike', `%${search}%`)
          .orWhere('models.caliber', 'ilike', `%${search}%`);
      });
    }

    const models = await query;

    // Her model için parça sayısını ekle
    const modelIds = models.map(m => m.id);
    const partCounts = await db('model_parts')
      .select('model_id')
      .count('part_id as part_count')
      .whereIn('model_id', modelIds)
      .groupBy('model_id');

    const countMap = {};
    partCounts.forEach(pc => { countMap[pc.model_id] = parseInt(pc.part_count); });

    const result = models.map(m => ({
      ...m,
      part_count: countMap[m.id] || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('[MODELS] Liste hatası:', error);
    res.status(500).json({ error: 'Modeller getirilemedi.' });
  }
});

// ─── Model detayı (parçalarıyla) ───
router.get('/:id', authenticate, async (req, res) => {
  try {
    const model = await db('models')
      .select('models.*', 'users.full_name as created_by_name')
      .leftJoin('users', 'models.created_by', 'users.id')
      .where('models.id', req.params.id)
      .first();

    if (!model) {
      return res.status(404).json({ error: 'Model bulunamadı.' });
    }

    const parts = await db('parts')
      .select('parts.*', 'model_parts.quantity', 'model_parts.sort_order', 'model_parts.notes as assembly_notes', 'model_parts.is_optional')
      .innerJoin('model_parts', 'parts.id', 'model_parts.part_id')
      .where('model_parts.model_id', model.id)
      .orderBy('model_parts.sort_order');

    res.json({ ...model, parts });
  } catch (error) {
    console.error('[MODELS] Detay hatası:', error);
    res.status(500).json({ error: 'Model getirilemedi.' });
  }
});

const multer = require('multer');
const xlsx = require('xlsx');

// Geçici hafıza storage (dosyayı diske kaydetmeden işlemek için)
const upload = multer({ storage: multer.memoryStorage() });

// ─── Yeni model oluştur ───
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, code, description, category, caliber, status, base_price } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Model adı ve kodu gereklidir.' });
    }

    const [newModel] = await db('models')
      .insert({
        name,
        code,
        description: description || null,
        category: category || null,
        caliber: caliber || null,
        status: status || 'active',
        base_price: base_price || 0,
        created_by: req.user.id,
      })
      .returning('*');

    await req.audit('create', 'models', newModel.id, name, null, { name, code, category, caliber });

    res.status(201).json(newModel);
  } catch (error) {
    if (error.constraint && error.constraint.includes('unique')) {
      return res.status(400).json({ error: 'Bu model kodu zaten kullanılıyor.' });
    }
    console.error('[MODELS] Oluşturma hatası:', error);
    res.status(500).json({ error: 'Model oluşturulamadı.' });
  }
});

// ─── Excel'den Toplu Model İçe Aktar ───
router.post('/import', authenticate, requireRole('admin', 'production_manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Lütfen bir Excel dosyası yükleyin.' });
    }

    // Excel dosyasını oku
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel dosyası boş veya formatı hatalı.' });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Her satırı veritabanına ekle veya güncelle
    for (const [index, row] of data.entries()) {
      // Excel sütun başlıklarını Türkçe varsayalım (Kod*, İsim*, Kategori, Kalibre, Fiyat vb.)
      // Başlıkların büyük/küçük harflerini normalize edelim
      const getVal = (possibleKeys) => {
        const key = Object.keys(row).find(k => possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase())));
        return key ? row[key] : null;
      };

      const code = getVal(['kod', 'code']);
      const name = getVal(['ad', 'isim', 'name']);
      let category = getVal(['kategori', 'category', 'tür']);
      let caliber = getVal(['kalibre', 'caliber', 'çap']);
      let basePrice = parseFloat(getVal(['fiyat', 'price', 'maliyet'])) || 0;

      if (!code || !name) {
        errorCount++;
        errors.push(`Satır ${index + 2}: Kod ve İsim zorunludur.`);
        continue;
      }

      try {
        // Mevcut modeli kod ile ara
        const existing = await db('models').where('code', code).first();

        // category ve caliber veritabanındaki enum kısıtlamalarına uymalı
        // Örnek: 'BRG', 'SİPER', 'AR-15' vs. Kalibre: '9x19mm', '5.56x45mm' vb.
        if (category && !['BRG', 'SİPER', 'AR-15', 'Yedek Parça'].includes(category.toUpperCase())) {
          // Varsayılanategori
          category = 'BRG';
        }

        if (existing) {
          // Güncelle
          await db('models')
            .where('id', existing.id)
            .update({
              name,
              category: category ? category.toUpperCase() : existing.category,
              caliber: caliber || existing.caliber,
              base_price: basePrice || existing.base_price,
              updated_at: db.fn.now()
            });
          successCount++;
        } else {
          // Yeni ekle
          await db('models').insert({
            name,
            code,
            category: category ? category.toUpperCase() : 'BRG',
            caliber: caliber || '9x19mm',
            status: 'active',
            base_price: basePrice || 0,
            created_by: req.user.id
          });
          successCount++;
        }
      } catch (err) {
        errorCount++;
        errors.push(`Satır ${index + 2} (${code}): Veritabanı hatası.`);
        console.error(`[MODELS IMPORT] Satır ${index + 2} hatası:`, err);
      }
    }

    await req.audit('import', 'models', null, 'Yükleme', null, {
      filename: req.file.originalname,
      success: successCount,
      errors: errorCount
    });

    res.json({
      message: `İçe aktarma tamamlandı. ${successCount} başarılı, ${errorCount} hatalı.`,
      successCount,
      errorCount,
      errors
    });

  } catch (error) {
    console.error('[MODELS IMPORT] Beklenmeyen hata:', error);
    res.status(500).json({ error: 'Excel dosyası işlenirken bir hata oluştu.' });
  }
});

// ─── Model güncelle ───
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, code, description, category, caliber, status, base_price } = req.body;
    const modelId = req.params.id;

    const existing = await db('models').where('id', modelId).first();
    if (!existing) {
      return res.status(404).json({ error: 'Model bulunamadı.' });
    }

    const updated = await db('models')
      .where('id', modelId)
      .update({
        name, code, description,
        category: category || null,
        caliber: caliber || null,
        status: status || existing.status,
        base_price: base_price !== undefined ? base_price : existing.base_price,
        updated_at: db.fn.now(),
      })
      .returning('*');

    await req.audit('update', 'models', modelId, name, existing, updated[0]);

    res.json(updated[0]);
  } catch (error) {
    console.error('[MODELS] Güncelleme hatası:', error);
    res.status(500).json({ error: 'Model güncellenemedi.' });
  }
});

// ─── Model sil ───
router.delete('/:id', authenticate, requireRole('admin', 'production_manager'), async (req, res) => {
  try {
    const model = await db('models').where('id', req.params.id).first();
    if (!model) {
      return res.status(404).json({ error: 'Model bulunamadı.' });
    }

    // Aktif üretim emri var mı kontrol et
    const activeOrders = await db('production_orders')
      .where('model_id', req.params.id)
      .whereNotIn('status', ['completed', 'cancelled'])
      .count('id as count')
      .first();

    if (parseInt(activeOrders.count) > 0) {
      return res.status(400).json({ error: 'Bu modele ait aktif üretim emirleri var. Önce emirleri tamamlayın veya iptal edin.' });
    }

    await db('models').where('id', req.params.id).del();

    await req.audit('delete', 'models', model.id, model.name, model, null);

    res.json({ message: 'Model silindi.' });
  } catch (error) {
    console.error('[MODELS] Silme hatası:', error);
    res.status(500).json({ error: 'Model silinemedi.' });
  }
});

// ─── Döküman Merkezi ───
router.get('/documents', authenticate, async (req, res) => {
  try {
    const docs = await db('technical_documents').orderBy('uploadedAt', 'desc');
    res.json(docs);
  } catch (error) {
    console.error('[DOCS] Liste hatası:', error);
    res.status(500).json({ error: 'Dökümanlar getirilemedi.' });
  }
});

router.get('/documents/part/:code', authenticate, async (req, res) => {
  try {
    const docs = await db('technical_documents')
      .where('partCode', req.params.code)
      .orderBy('revisionNumber', 'desc');
    res.json(docs);
  } catch (error) {
    console.error('[DOCS] Parça dökümanları hatası:', error);
    res.status(500).json({ error: 'Parça dökümanları getirilemedi.' });
  }
});

router.post('/documents', authenticate, requireRole('admin', 'engineering'), async (req, res) => {
  try {
    const { partCode, title, revisionNumber, fileUrl, fileType } = req.body;

    // Eski dökümanların isLatest durumunu false yap (isteğe bağlı)
    if (partCode) {
      await db('technical_documents').where('partCode', partCode).update({ isLatest: false });
    }

    const doc = await db('technical_documents').insert({
      partCode,
      title,
      revisionNumber: revisionNumber || 1,
      fileUrl,
      fileType: fileType || 'application/pdf',
      uploadedBy: req.user.full_name || req.user.username,
      isLatest: true
    }).returning('*');

    res.status(201).json(doc[0]);
  } catch (error) {
    console.error('[DOCS] Ekleme hatası:', error);
    res.status(500).json({ error: 'Döküman eklenemedi.' });
  }
});

// ─── Modele parça ekle ───
router.post('/:id/parts', authenticate, async (req, res) => {
  try {
    const { part_id, quantity, sort_order, notes, is_optional } = req.body;
    const modelId = req.params.id;

    if (!part_id) {
      return res.status(400).json({ error: 'Parça ID gereklidir.' });
    }

    await db('model_parts')
      .insert({
        model_id: modelId,
        part_id,
        quantity: quantity || 1,
        sort_order: sort_order || 0,
        notes: notes || null,
        is_optional: is_optional || false,
      })
      .onConflict(['model_id', 'part_id'])
      .merge();

    res.json({ message: 'Parça eklendi.' });
  } catch (error) {
    console.error('[MODELS] Parça ekleme hatası:', error);
    res.status(500).json({ error: 'Parça eklenemedi.' });
  }
});

// ─── Modelden parça çıkar ───
router.delete('/:id/parts/:partId', authenticate, async (req, res) => {
  try {
    await db('model_parts')
      .where({ model_id: req.params.id, part_id: req.params.partId })
      .del();

    res.json({ message: 'Parça çıkarıldı.' });
  } catch (error) {
    console.error('[MODELS] Parça çıkarma hatası:', error);
    res.status(500).json({ error: 'Parça çıkarılamadı.' });
  }
});

module.exports = router;
