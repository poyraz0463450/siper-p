// server/config/database.js
// Knex.js tabanlı PostgreSQL bağlantı yöneticisi
const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

if (!config) {
  throw new Error(`Veritabanı konfigürasyonu bulunamadı: ${environment}`);
}

const db = knex(config);

// Bağlantı testi
const testConnection = async () => {
  try {
    await db.raw('SELECT 1+1 AS result');
    console.log(`[DB] PostgreSQL bağlantısı başarılı (${environment})`);
    return true;
  } catch (error) {
    console.error('[DB] PostgreSQL bağlantı hatası:', error.message);
    throw error;
  }
};

// Migration'ları çalıştır
const runMigrations = async () => {
  try {
    const [batchNo, migrations] = await db.migrate.latest();
    if (migrations.length > 0) {
      console.log(`[DB] Migration batch ${batchNo} çalıştırıldı:`);
      migrations.forEach(m => console.log(`  → ${m}`));
    } else {
      console.log('[DB] Tüm migration\'lar güncel');
    }
  } catch (error) {
    console.error('[DB] Migration hatası:', error.message);
    throw error;
  }
};

// Seed'leri çalıştır (ilk kurulumda)
const runSeeds = async () => {
  try {
    const userCount = await db('users').count('id as count').first();
    if (parseInt(userCount.count) === 0) {
      await db.seed.run();
      console.log('[DB] Seed verileri oluşturuldu');
    }
  } catch (error) {
    // Tablo yoksa sessizce geç (migration henüz çalışmamış olabilir)
    if (!error.message.includes('does not exist')) {
      console.error('[DB] Seed hatası:', error.message);
    }
  }
};

// Tam başlatma
const init = async () => {
  await testConnection();
  await runMigrations();
  await runSeeds();
  return db;
};

// Graceful shutdown
const destroy = async () => {
  await db.destroy();
  console.log('[DB] Bağlantı havuzu kapatıldı');
};

module.exports = {
  db,
  init,
  destroy,
  testConnection,
  runMigrations,
  runSeeds,
};
