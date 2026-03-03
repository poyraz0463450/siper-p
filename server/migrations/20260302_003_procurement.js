// server/migrations/20260302_003_procurement.js
// Satın Alma / Tedarik Zinciri Modülü

exports.up = async function (knex) {
    // ─── Tedarikçiler ───
    await knex.schema.createTable('suppliers', (table) => {
        table.increments('id').primary();
        table.string('name', 150).notNullable();
        table.string('code', 20).unique();
        table.string('contact_person', 100);
        table.string('phone', 30);
        table.string('email', 100);
        table.string('address', 300);
        table.string('city', 60);
        table.string('country', 60).defaultTo('Türkiye');
        table.string('tax_number', 20);
        table.string('category', 60); // Hammadde, Makine Parçası, Kimyasal, vb.
        table.enu('status', ['active', 'passive', 'blacklisted']).defaultTo('active');
        table.decimal('rating', 3, 2); // 0-5
        table.text('notes');
        table.timestamps(true, true);
    });

    // ─── Satın Alma Talepleri ───
    await knex.schema.createTable('purchase_requests', (table) => {
        table.increments('id').primary();
        table.string('pr_number', 30).unique().notNullable();
        table.integer('part_id').unsigned().references('id').inTable('parts').onDelete('SET NULL');
        table.integer('supplier_id').unsigned().references('id').inTable('suppliers').onDelete('SET NULL');
        table.integer('quantity').unsigned().notNullable().defaultTo(1);
        table.decimal('unit_price', 12, 4);
        table.string('currency', 10).defaultTo('TRY');
        table.enu('status', ['pending', 'approved', 'ordered', 'received', 'cancelled']).defaultTo('pending');
        table.enu('priority', ['low', 'normal', 'high', 'urgent']).defaultTo('normal');
        table.date('needed_by_date');
        table.date('expected_delivery_date');
        table.date('received_date');
        table.integer('received_quantity').unsigned();
        table.string('po_number', 50); // Purchase Order numarası
        table.text('notes');
        table.text('rejection_reason');
        table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
        table.integer('approved_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
        table.timestamp('approved_at');
        table.timestamps(true, true);
    });

    // İndeksler
    await knex.schema.raw('CREATE INDEX idx_purchase_requests_status ON purchase_requests(status)');
    await knex.schema.raw('CREATE INDEX idx_purchase_requests_part ON purchase_requests(part_id)');
    await knex.schema.raw('CREATE INDEX idx_suppliers_status ON suppliers(status)');
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('purchase_requests');
    await knex.schema.dropTableIfExists('suppliers');
};
