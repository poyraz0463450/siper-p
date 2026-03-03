// server/index.js
// Savunma Sanayi ERP - Ana Sunucu Dosyası
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { init, destroy } = require('./config/database');
const { auditMiddleware } = require('./middleware/audit');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ═══════════════════════════════════════
// GÜVENLİK & PERFORMANS MİDDLEWARE
// ═══════════════════════════════════════

// Güvenlik başlıkları
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Dosya upload için
}));

// Sıkıştırma
app.use(compression());

// CORS
app.use(cors({
  origin: NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN || 'http://localhost:3000'
    : '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: NODE_ENV === 'development' ? 1000 : 100,
  message: { error: 'Çok fazla istek gönderdiniz. Lütfen bekleyin.' },
});
app.use('/api/', limiter);

// Login rate limiting (daha sıkı)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
});
app.use('/api/auth/login', loginLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP loglama
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Audit middleware (tüm route'lara req.audit fonksiyonu ekler)
app.use(auditMiddleware);

// ═══════════════════════════════════════
// STATİK DOSYALAR
// ═══════════════════════════════════════
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ═══════════════════════════════════════
// API ROUTE'LARI
// ═══════════════════════════════════════
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/models', require('./routes/models'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/production-orders', require('./routes/productionOrders'));
app.use('/api/users', require('./routes/users'));

// ─── Sistem endpoint'leri ───
const { authenticate, requireAdmin } = require('./middleware/auth');
const { db } = require('./config/database');

// Audit log'ları
app.get('/api/audit-logs', authenticate, requireAdmin, async (req, res) => {
  try {
    const { entity_type, action, user_id, limit = 100, offset = 0 } = req.query;

    let query = db('audit_logs')
      .select('audit_logs.*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (entity_type) query = query.where('entity_type', entity_type);
    if (action) query = query.where('action', action);
    if (user_id) query = query.where('user_id', user_id);

    const logs = await query;
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Audit log\'lar getirilemedi.' });
  }
});

// Bildirimler
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const { is_read, limit = 50 } = req.query;

    let query = db('notifications')
      .where(function () {
        this.where('user_id', req.user.id).orWhereNull('user_id');
      })
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (is_read !== undefined) query = query.where('is_read', is_read === 'true');

    const notifications = await query;
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Bildirimler getirilemedi.' });
  }
});

app.put('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    await db('notifications')
      .where('id', req.params.id)
      .update({ is_read: true, read_at: db.fn.now() });
    res.json({ message: 'Bildirim okundu.' });
  } catch (error) {
    res.status(500).json({ error: 'Bildirim güncellenemedi.' });
  }
});

// Sistem ayarları
app.get('/api/settings', authenticate, async (req, res) => {
  try {
    const { group } = req.query;
    let query = db('settings').orderBy('group', 'key');
    if (group) query = query.where('group', group);
    const settings = await query;
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Ayarlar getirilemedi.' });
  }
});

app.put('/api/settings/:key', authenticate, requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    await db('settings')
      .where('key', req.params.key)
      .update({ value, updated_at: db.fn.now() });
    res.json({ message: 'Ayar güncellendi.' });
  } catch (error) {
    res.status(500).json({ error: 'Ayar güncellenemedi.' });
  }
});

// Sağlık kontrolü
app.get('/api/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({
      status: 'healthy',
      environment: NODE_ENV,
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: require('../package.json').version,
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// ═══════════════════════════════════════
// REACT FRONTEND (Production)
// ═══════════════════════════════════════
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// ═══════════════════════════════════════
// HATA YÖNETİMİ
// ═══════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Dosya boyutu çok büyük.' });
  }

  if (err.message && err.message.includes('Sadece resim')) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error: NODE_ENV === 'development' ? err.message : 'Sunucu hatası.',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı.' });
});

// ═══════════════════════════════════════
// SUNUCU BAŞLATMA
// ═══════════════════════════════════════
const startServer = async () => {
  try {
    await init();

    const server = app.listen(PORT, () => {
      console.log('═══════════════════════════════════════');
      console.log('  SAVUNMA SANAYİ ERP SİSTEMİ v2.0');
      console.log('═══════════════════════════════════════');
      console.log(`  Ortam: ${NODE_ENV}`);
      console.log(`  Sunucu: http://localhost:${PORT}`);
      console.log(`  API: http://localhost:${PORT}/api`);
      console.log(`  Sağlık: http://localhost:${PORT}/api/health`);
      console.log('═══════════════════════════════════════');
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[${signal}] Sunucu kapatılıyor...`);
      server.close(async () => {
        await destroy();
        console.log('Sunucu kapatıldı.');
        process.exit(0);
      });
      // 10 saniye sonra zorla kapat
      setTimeout(() => {
        console.error('Zorla kapatılıyor...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Sunucu başlatılamadı:', error);
    process.exit(1);
  }
};

startServer();
