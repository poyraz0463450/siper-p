// server/migrations/20260302_002_serial_tracking.js
// Seri Numarası Takip Modülü - PostgreSQL Tabloları

exports.up = async function (knex) {
    // ─── Seri Numaraları ───
    await knex.schema.createTable('serial_numbers', (table) => {
        table.increments('id').primary();
        table.string('serial_number', 50).unique().notNullable();
        table.integer('model_id').unsigned().references('id').inTable('models').onDelete('SET NULL');
        table.integer('production_order_id').unsigned().references('id').inTable('production_orders').onDelete('SET NULL');
        table.enu('status', ['in_production', 'completed', 'shipped', 'returned', 'scrapped']).defaultTo('in_production');
        table.jsonb('sub_parts').defaultTo('{}'); // { namlu: "SN-001", surgu: "SN-002", ... }
        table.text('notes');
        table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
        table.timestamps(true, true);
    });

    // ─── Operasyon Logları ───
    await knex.schema.createTable('operation_logs', (table) => {
        table.increments('id').primary();
        table.integer('serial_id').unsigned().references('id').inTable('serial_numbers').onDelete('CASCADE').notNullable();
        table.string('operation', 50).notNullable(); // CNC, Isıl İşlem, Kaplama, Montaj, Atış Testi, Rodaj, Kalite Kontrol
        table.string('part_type', 50); // Namlu, Sürgü, Gövde, Şarjör, Ana Montaj
        table.string('personnel_name', 100);
        table.string('machine', 100);
        table.timestamp('start_time').defaultTo(knex.fn.now());
        table.timestamp('end_time');
        table.text('notes');
        table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
        table.timestamps(true, true);
    });

    // ─── Kalite Kontrol Kayıtları ───
    await knex.schema.createTable('qc_records', (table) => {
        table.increments('id').primary();
        table.integer('serial_id').unsigned().references('id').inTable('serial_numbers').onDelete('CASCADE').notNullable();
        table.string('test_type', 100).notNullable(); // Boyut Kontrolü, Sertlik Testi, Atış Testi, Görsel Kontrol
        table.string('inspector', 100);
        table.boolean('pass').defaultTo(true);
        table.jsonb('measurements').defaultTo('{}');
        table.text('notes');
        table.timestamps(true, true);
    });

    // İndeksler
    await knex.schema.raw('CREATE INDEX idx_serial_numbers_model ON serial_numbers(model_id)');
    await knex.schema.raw('CREATE INDEX idx_serial_numbers_status ON serial_numbers(status)');
    await knex.schema.raw('CREATE INDEX idx_operation_logs_serial ON operation_logs(serial_id)');
    await knex.schema.raw('CREATE INDEX idx_qc_records_serial ON qc_records(serial_id)');
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('qc_records');
    await knex.schema.dropTableIfExists('operation_logs');
    await knex.schema.dropTableIfExists('serial_numbers');
};
