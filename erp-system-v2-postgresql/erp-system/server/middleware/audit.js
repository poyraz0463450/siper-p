// server/middleware/audit.js
// İşlem loglama servisi - Kim, ne zaman, ne yaptı
const { db } = require('../config/database');

/**
 * Audit log kaydı oluştur
 * @param {object} params
 * @param {number} params.userId - İşlemi yapan kullanıcı ID
 * @param {string} params.username - Kullanıcı adı
 * @param {string} params.action - İşlem tipi: create, update, delete, login, logout, export
 * @param {string} params.entityType - Tablo/modül adı: users, models, parts, vb.
 * @param {number} params.entityId - Kayıt ID
 * @param {string} params.entityName - Okunabilir isim
 * @param {object} params.oldValues - Değişiklik öncesi değerler
 * @param {object} params.newValues - Değişiklik sonrası değerler
 * @param {string} params.ipAddress - IP adresi
 * @param {string} params.userAgent - Tarayıcı bilgisi
 * @param {string} params.notes - Ek notlar
 */
const createAuditLog = async ({
  userId,
  username,
  action,
  entityType,
  entityId = null,
  entityName = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  notes = null,
}) => {
  try {
    await db('audit_logs').insert({
      user_id: userId,
      username: username,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      notes,
    });
  } catch (error) {
    // Audit log hatası ana işlemi engellemeMELİ
    console.error('[AUDIT] Log oluşturma hatası:', error.message);
  }
};

/**
 * Express middleware: req.audit fonksiyonunu ekler
 */
const auditMiddleware = (req, res, next) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  req.audit = async (action, entityType, entityId, entityName, oldValues, newValues, notes) => {
    await createAuditLog({
      userId: req.user?.id,
      username: req.user?.username,
      action,
      entityType,
      entityId,
      entityName,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      notes,
    });
  };

  next();
};

/**
 * Hassas alanları filtrele (şifre vb.)
 */
const sanitizeForAudit = (obj, sensitiveFields = ['password', 'token', 'secret']) => {
  if (!obj) return null;
  const sanitized = { ...obj };
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***';
    }
  });
  return sanitized;
};

module.exports = {
  createAuditLog,
  auditMiddleware,
  sanitizeForAudit,
};
