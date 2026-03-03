// server/migrations/20260303_005_technical_documents.js
exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('technical_documents');
    if (!exists) {
        await knex.schema.createTable('technical_documents', table => {
            table.increments('id').primary();
            table.string('partCode').notNullable();
            table.string('title').notNullable();
            table.integer('revisionNumber').defaultTo(1);
            table.string('fileUrl').notNullable();
            table.string('fileType').defaultTo('application/pdf');
            table.string('uploadedBy').notNullable();
            table.timestamp('uploadedAt').defaultTo(knex.fn.now());
            table.boolean('isLatest').defaultTo(true);
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('technical_documents');
};
