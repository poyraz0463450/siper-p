// server/middleware/auth.js
// JWT Authentication + Role-Based Access Control
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'DEGISTIR-guclu-bir-anahtar';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// ─── Rol Hiyerarşisi ───
const ROLES = {
  admin: 100,
  production_manager: 80,  // Üretim Müdürü
  quality_control: 70,      // Kalite Kontrol
  warehouse: 60,             // Depocu
  purchasing: 60,            // Satınalma
  operator: 40,              // Operatör
  viewer: 10,                // Sadece görüntüleme
  user: 20,                  // Genel kullanıcı
};

// ─── JWT Token doğrulama ───
const authenticate = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Yetkilendirme hatası. Token bulunamadı.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Kullanıcının hâlâ aktif olduğunu kontrol et
    const user = await db('users')
      .select('id', 'username', 'email', 'full_name', 'role', 'is_active', 'department')
      .where('id', decoded.id)
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Hesabınız devre dışı bırakılmış.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
    }
    res.status(401).json({ error: 'Geçersiz token.' });
  }
};

// ─── Admin kontrolü ───
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gereklidir.' });
  }
  next();
};

// ─── Belirli rol seviyesi kontrolü ───
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Kimlik doğrulama gerekli.' });
    }

    // Admin her şeyi yapabilir
    if (req.user.role === 'admin') {
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: 'Bu işlem için yetkiniz yok.',
      required_roles: allowedRoles,
      your_role: req.user.role,
    });
  };
};

// ─── Minimum rol seviyesi kontrolü ───
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Kimlik doğrulama gerekli.' });
    }

    const userLevel = ROLES[req.user.role] || 0;
    const requiredLevel = ROLES[minRole] || 0;

    if (userLevel >= requiredLevel) {
      return next();
    }

    return res.status(403).json({
      error: 'Bu işlem için yeterli yetkiniz yok.',
      required: minRole,
    });
  };
};

// ─── Token oluşturma ───
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

module.exports = {
  authenticate,
  requireAdmin,
  requireRole,
  requireMinRole,
  generateToken,
  JWT_SECRET,
  ROLES,
};
