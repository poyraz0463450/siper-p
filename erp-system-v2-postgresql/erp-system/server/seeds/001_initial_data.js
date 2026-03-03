// server/seeds/001_initial_data.js
// Varsayılan veriler: admin, depolar, parça kategorileri, ayarlar
const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // ═══════════════════════════════════════
  // 1. VARSAYILAN ADMİN
  // ═══════════════════════════════════════
  const adminExists = await knex('users').where('username', 'admin').first();
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await knex('users').insert({
      username: 'admin',
      email: 'admin@erp.local',
      password: hashedPassword,
      full_name: 'Sistem Yöneticisi',
      role: 'admin',
      department: 'Bilgi Teknolojileri',
      title: 'Sistem Yöneticisi',
      is_active: true,
    });
    console.log('  → Varsayılan admin oluşturuldu (admin / admin123)');
  }

  // ═══════════════════════════════════════
  // 2. VARSAYILAN DEPOLAR
  // ═══════════════════════════════════════
  const warehouseCount = await knex('warehouses').count('id as count').first();
  if (parseInt(warehouseCount.count) === 0) {
    await knex('warehouses').insert([
      { name: 'Hammadde Deposu', code: 'HAM', type: 'raw_material', description: 'Hammadde ve yarı mamul stok alanı' },
      { name: 'Üretim Hattı', code: 'URE', type: 'production', description: 'Üretim hattı ara stok alanı' },
      { name: 'Karantina', code: 'KAR', type: 'quarantine', description: 'Kalite kontrol bekleyen malzeme' },
      { name: 'Bitmiş Ürün Deposu', code: 'BIT', type: 'finished_goods', description: 'Sevkiyata hazır ürünler' },
      { name: 'Sevkiyat Alanı', code: 'SEV', type: 'shipment', description: 'Sevkiyat bekleme alanı' },
    ]);
    console.log('  → Varsayılan depolar oluşturuldu');
  }

  // ═══════════════════════════════════════
  // 3. PARÇA KATEGORİLERİ
  // ═══════════════════════════════════════
  const catCount = await knex('part_categories').count('id as count').first();
  if (parseInt(catCount.count) === 0) {
    // Ana kategoriler
    const [namluGrubuId] = await knex('part_categories').insert(
      { name: 'Namlu Grubu', code: 'NAM', description: 'Namlu ve namlu aksamı', sort_order: 1 }
    ).returning('id');

    const [mekanizmaId] = await knex('part_categories').insert(
      { name: 'Mekanizma Grubu', code: 'MEK', description: 'Tetik, horoz, emniyet mekanizması', sort_order: 2 }
    ).returning('id');

    const [govdeId] = await knex('part_categories').insert(
      { name: 'Gövde Grubu', code: 'GOV', description: 'Üst ve alt gövde, kapak', sort_order: 3 }
    ).returning('id');

    const [surguId] = await knex('part_categories').insert(
      { name: 'Sürgü Grubu', code: 'SRG', description: 'Sürgü, kilit bloğu, sürgü taşıyıcı', sort_order: 4 }
    ).returning('id');

    const [kundakId] = await knex('part_categories').insert(
      { name: 'Kundak / Kabza', code: 'KUN', description: 'Kundak, kabza, el koruyucu', sort_order: 5 }
    ).returning('id');

    await knex('part_categories').insert([
      { name: 'Yay ve Pimler', code: 'YAP', description: 'Yaylar, pimler, segmanlar', sort_order: 6 },
      { name: 'Nişan Alma', code: 'NIS', description: 'Gez, arpacık, ray sistemi', sort_order: 7 },
      { name: 'Şarjör / Besleme', code: 'SAR', description: 'Şarjör, şarjör yuvası, besleme sistemi', sort_order: 8 },
      { name: 'Aksesuar', code: 'AKS', description: 'Dürbün, el feneri, susturucu', sort_order: 9 },
      { name: 'Hammadde', code: 'HMD', description: 'Çelik, alüminyum, polimer hammaddeler', sort_order: 10 },
    ]);

    // Alt kategoriler (örnekler)
    const namluId = typeof namluGrubuId === 'object' ? namluGrubuId.id : namluGrubuId;
    const mekId = typeof mekanizmaId === 'object' ? mekanizmaId.id : mekanizmaId;

    await knex('part_categories').insert([
      { name: 'Namlu', code: 'NAM-01', parent_id: namluId, sort_order: 1 },
      { name: 'Namlu Somunu', code: 'NAM-02', parent_id: namluId, sort_order: 2 },
      { name: 'Gaz Bloğu', code: 'NAM-03', parent_id: namluId, sort_order: 3 },
      { name: 'Tetik Mekanizması', code: 'MEK-01', parent_id: mekId, sort_order: 1 },
      { name: 'Horoz / Striker', code: 'MEK-02', parent_id: mekId, sort_order: 2 },
      { name: 'Emniyet Mekanizması', code: 'MEK-03', parent_id: mekId, sort_order: 3 },
    ]);
    console.log('  → Parça kategorileri oluşturuldu');
  }

  // ═══════════════════════════════════════
  // 4. SİSTEM AYARLARI
  // ═══════════════════════════════════════
  const settingsCount = await knex('settings').count('id as count').first();
  if (parseInt(settingsCount.count) === 0) {
    await knex('settings').insert([
      // Genel
      { key: 'company_name', value: 'Savunma Sanayi A.Ş.', type: 'string', group: 'general', description: 'Şirket adı' },
      { key: 'serial_number_format', value: '{MODEL}-{YEAR}-{SEQ:5}', type: 'string', group: 'production', description: 'Seri numarası formatı' },
      { key: 'order_number_prefix', value: 'UE', type: 'string', group: 'production', description: 'Üretim emri numara ön eki' },
      { key: 'auto_order_number', value: 'true', type: 'boolean', group: 'production', description: 'Otomatik sipariş numarası' },
      // Stok
      { key: 'low_stock_threshold_percent', value: '20', type: 'number', group: 'inventory', description: 'Düşük stok uyarı yüzdesi' },
      { key: 'enable_lot_tracking', value: 'true', type: 'boolean', group: 'inventory', description: 'Lot numarası takibi' },
      // Bildirim
      { key: 'enable_email_notifications', value: 'false', type: 'boolean', group: 'notification', description: 'E-posta bildirimleri' },
      { key: 'enable_low_stock_alerts', value: 'true', type: 'boolean', group: 'notification', description: 'Düşük stok uyarıları' },
    ]);
    console.log('  → Sistem ayarları oluşturuldu');
  }
};
