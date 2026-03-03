// 20260302_001_initial_schema.js
// Temel tablo yapısı - Mevcut SQLite şemasının PostgreSQL versiyonu
// Genişletilmiş alanlar ve indeksler ile

exports.up = async function (knex) {
  // ═══════════════════════════════════════
  // 1. KULLANICILAR
  // ═══════════════════════════════════════
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username', 50).notNullable().unique();
    table.string('email', 255).notNullable().unique();
    table.string('password', 255).notNullable();
    table.string('full_name', 100);
    table.string('role', 30).notNullable().defaultTo('user');
    // Yeni alanlar
    table.string('phone', 20);
    table.string('department', 100);
    table.string('title', 100); // Ünvan
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_login_at');
    table.timestamps(true, true); // created_at, updated_at
  });

  // ═══════════════════════════════════════
  // 2. MODELLER (Silah Modelleri)
  // ═══════════════════════════════════════
  await knex.schema.createTable('models', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.string('code', 50).notNullable().unique();
    table.text('description');
    // Yeni alanlar
    table.string('category', 50); // Tabanca, Tüfek, Yedek Parça vb.
    table.string('caliber', 30); // 9mm, 5.56x45, 7.62x51 vb.
    table.string('status', 20).notNullable().defaultTo('active'); // active, discontinued, prototype
    table.string('image_path', 500);
    table.decimal('base_price', 12, 2).defaultTo(0);
    table.string('origin_country', 50).defaultTo('TR');
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  // ═══════════════════════════════════════
  // 3. PARÇA KATEGORİLERİ (Yeni)
  // ═══════════════════════════════════════
  await knex.schema.createTable('part_categories', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('code', 30).notNullable().unique();
    table.text('description');
    table.integer('parent_id').unsigned().references('id').inTable('part_categories').onDelete('SET NULL');
    table.integer('sort_order').defaultTo(0);
    table.timestamps(true, true);
  });

  // ═══════════════════════════════════════
  // 4. PARÇALAR
  // ═══════════════════════════════════════
  await knex.schema.createTable('parts', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable();
    table.string('code', 50).notNullable().unique();
    table.string('material', 100); // 4140 Çelik, 7075 Al, Polimer vb.
    table.string('heat_treatment', 100);
    table.string('coating', 100);
    table.string('operation_code', 50);
    table.string('image_path', 500);
    table.text('description');
    // Yeni alanlar
    table.integer('category_id').unsigned().references('id').inTable('part_categories').onDelete('SET NULL');
    table.string('unit', 20).notNullable().defaultTo('adet'); // adet, kg, metre, litre
    table.string('drawing_number', 50); // Teknik çizim numarası
    table.integer('revision').notNullable().defaultTo(1);
    table.string('revision_note', 255);
    table.decimal('weight_grams', 10, 2); // Ağırlık (gram)
    table.string('dimensions', 100); // Boyut bilgisi (ör: 150x30x20mm)
    table.string('tolerance', 100); // Tolerans bilgisi
    table.string('hardness', 50); // Sertlik değeri (ör: 28-32 HRC)
    table.string('surface_finish', 50); // Yüzey kalitesi (ör: Ra 0.8)
    table.boolean('is_critical').notNullable().defaultTo(false); // Emniyet kritik parça
    table.boolean('is_serialized').notNullable().defaultTo(false); // Seri no takibi gerekli mi
    table.string('status', 20).notNullable().defaultTo('active'); // active, obsolete, draft
    table.decimal('unit_cost', 12, 2).defaultTo(0); // Birim maliyet
    table.integer('lead_time_days').defaultTo(0); // Tedarik süresi (gün)
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  // ═══════════════════════════════════════
  // 5. MODEL-PARÇA İLİŞKİSİ (BOM Temel)
  // ═══════════════════════════════════════
  await knex.schema.createTable('model_parts', (table) => {
    table.increments('id').primary();
    table.integer('model_id').unsigned().notNullable().references('id').inTable('models').onDelete('CASCADE');
    table.integer('part_id').unsigned().notNullable().references('id').inTable('parts').onDelete('CASCADE');
    table.integer('quantity').notNullable().defaultTo(1);
    // Yeni alanlar
    table.integer('sort_order').defaultTo(0); // Montaj sırası
    table.text('notes'); // Montaj notları
    table.boolean('is_optional').defaultTo(false); // Opsiyonel parça mı
    table.unique(['model_id', 'part_id']);
    table.timestamps(true, true);
  });

  // ═══════════════════════════════════════
  // 6. DEPOLAR (Yeni)
  // ═══════════════════════════════════════
  await knex.schema.createTable('warehouses', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('code', 20).notNullable().unique();
    table.text('description');
    table.string('type', 30).notNullable().defaultTo('general');
    // general, raw_material, production, quarantine, finished_goods, shipment
    table.string('address', 255);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // ═══════════════════════════════════════
  // 7. STOK
  // ═══════════════════════════════════════
  await knex.schema.createTable('inventory', (table) => {
    table.increments('id').primary();
    table.integer('part_id').unsigned().notNullable().references('id').inTable('parts').onDelete('CASCADE');
    table.integer('warehouse_id').unsigned().references('id').inTable('warehouses').onDelete('SET NULL');
    table.integer('quantity').notNullable().defaultTo(0);
    table.integer('min_quantity').notNullable().defaultTo(0);
    table.integer('max_quantity').defaultTo(0);
    table.integer('reorder_point').defaultTo(0); // Yeniden sipariş noktası
    table.integer('reorder_quantity').defaultTo(0); // Yeniden sipariş miktarı
    table.string('location', 100); // Raf/bölge bilgisi
    table.text('notes');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['part_id', 'warehouse_id']);
  });

  // ═══════════════════════════════════════
  // 8. STOK HAREKETLERİ (Yeni)
  // ═══════════════════════════════════════
  await knex.schema.createTable('inventory_movements', (table) => {
    table.increments('id').primary();
    table.integer('part_id').unsigned().notNullable().references('id').inTable('parts').onDelete('CASCADE');
    table.integer('warehouse_id').unsigned().references('id').inTable('warehouses').onDelete('SET NULL');
    table.string('movement_type', 30).notNullable();
    // in, out, transfer_in, transfer_out, adjustment, scrap, return
    table.integer('quantity').notNullable();
    table.integer('quantity_before').notNullable().defaultTo(0);
    table.integer('quantity_after').notNullable().defaultTo(0);
    table.string('reference_type', 30); // production_order, purchase_order, manual, transfer
    table.integer('reference_id'); // İlişkili kayıt ID
    table.string('lot_number', 50); // Lot numarası
    table.text('notes');
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ═══════════════════════════════════════
  // 9. ÜRETİM EMİRLERİ
  // ═══════════════════════════════════════
  await knex.schema.createTable('production_orders', (table) => {
    table.increments('id').primary();
    table.string('order_number', 30).notNullable().unique();
    table.integer('model_id').unsigned().notNullable().references('id').inTable('models').onDelete('RESTRICT');
    table.integer('quantity').notNullable();
    table.string('status', 30).notNullable().defaultTo('draft');
    // draft, pending_approval, approved, in_production, quality_check, completed, cancelled
    table.string('priority', 20).notNullable().defaultTo('normal');
    // low, normal, high, urgent
    table.text('notes');
    // Yeni alanlar
    table.date('planned_start_date');
    table.date('planned_end_date');
    table.date('actual_start_date');
    table.date('actual_end_date');
    table.integer('completed_quantity').notNullable().defaultTo(0);
    table.integer('rejected_quantity').notNullable().defaultTo(0);
    table.string('customer_name', 200);
    table.string('customer_order_ref', 100); // Müşteri sipariş referansı
    table.integer('approved_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approved_at');
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    table.timestamp('completed_at');
  });

  // ═══════════════════════════════════════
  // 10. ÜRETİM EMRİ PARÇALARI
  // ═══════════════════════════════════════
  await knex.schema.createTable('production_order_parts', (table) => {
    table.increments('id').primary();
    table.integer('order_id').unsigned().notNullable().references('id').inTable('production_orders').onDelete('CASCADE');
    table.integer('part_id').unsigned().notNullable().references('id').inTable('parts').onDelete('RESTRICT');
    table.integer('required_quantity').notNullable();
    table.integer('allocated_quantity').notNullable().defaultTo(0);
    table.integer('consumed_quantity').notNullable().defaultTo(0);
    table.string('status', 20).notNullable().defaultTo('pending');
    // pending, partially_allocated, allocated, consumed
    table.timestamps(true, true);
  });

  // ═══════════════════════════════════════
  // 11. AUDIT LOG (Yeni)
  // ═══════════════════════════════════════
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('username', 50); // Kullanıcı silinse bile log kalacak
    table.string('action', 30).notNullable(); // create, update, delete, login, logout, export
    table.string('entity_type', 50).notNullable(); // users, models, parts, inventory, production_orders...
    table.integer('entity_id');
    table.string('entity_name', 200); // Okunabilir isim
    table.jsonb('old_values'); // Değişiklik öncesi değerler
    table.jsonb('new_values'); // Değişiklik sonrası değerler
    table.string('ip_address', 45);
    table.text('user_agent');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ═══════════════════════════════════════
  // 12. SİSTEM AYARLARI (Yeni)
  // ═══════════════════════════════════════
  await knex.schema.createTable('settings', (table) => {
    table.increments('id').primary();
    table.string('key', 100).notNullable().unique();
    table.text('value');
    table.string('type', 20).defaultTo('string'); // string, number, boolean, json
    table.string('group', 50); // general, production, inventory, notification
    table.text('description');
    table.timestamps(true, true);
  });

  // ═══════════════════════════════════════
  // 13. BİLDİRİMLER (Yeni)
  // ═══════════════════════════════════════
  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 30).notNullable(); // low_stock, order_status, qc_alert, system
    table.string('title', 200).notNullable();
    table.text('message');
    table.string('link', 500); // Yönlendirme linki
    table.string('severity', 20).defaultTo('info'); // info, warning, error, success
    table.boolean('is_read').notNullable().defaultTo(false);
    table.timestamp('read_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ═══════════════════════════════════════
  // İNDEKSLER
  // ═══════════════════════════════════════
  
  // Parçalar
  await knex.schema.raw('CREATE INDEX idx_parts_category ON parts(category_id)');
  await knex.schema.raw('CREATE INDEX idx_parts_status ON parts(status)');
  await knex.schema.raw('CREATE INDEX idx_parts_material ON parts(material)');
  
  // Stok
  await knex.schema.raw('CREATE INDEX idx_inventory_part ON inventory(part_id)');
  await knex.schema.raw('CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id)');
  
  // Stok Hareketleri
  await knex.schema.raw('CREATE INDEX idx_inv_movements_part ON inventory_movements(part_id)');
  await knex.schema.raw('CREATE INDEX idx_inv_movements_type ON inventory_movements(movement_type)');
  await knex.schema.raw('CREATE INDEX idx_inv_movements_date ON inventory_movements(created_at)');
  await knex.schema.raw('CREATE INDEX idx_inv_movements_ref ON inventory_movements(reference_type, reference_id)');
  
  // Üretim Emirleri
  await knex.schema.raw('CREATE INDEX idx_prod_orders_status ON production_orders(status)');
  await knex.schema.raw('CREATE INDEX idx_prod_orders_model ON production_orders(model_id)');
  await knex.schema.raw('CREATE INDEX idx_prod_orders_date ON production_orders(created_at)');
  
  // Audit Log
  await knex.schema.raw('CREATE INDEX idx_audit_user ON audit_logs(user_id)');
  await knex.schema.raw('CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id)');
  await knex.schema.raw('CREATE INDEX idx_audit_date ON audit_logs(created_at)');
  await knex.schema.raw('CREATE INDEX idx_audit_action ON audit_logs(action)');
  
  // Bildirimler
  await knex.schema.raw('CREATE INDEX idx_notifications_user ON notifications(user_id, is_read)');
};

exports.down = async function (knex) {
  // Ters sırada sil (foreign key bağımlılıkları)
  const tables = [
    'notifications',
    'settings',
    'audit_logs',
    'production_order_parts',
    'production_orders',
    'inventory_movements',
    'inventory',
    'warehouses',
    'model_parts',
    'parts',
    'part_categories',
    'models',
    'users',
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
