// server/routes/auth.js
// Kimlik doğrulama route'ları - PostgreSQL/Knex
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/audit');

// ─── Giriş ───
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    const user = await db('users').where('username', username).first();

    if (!user) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Hesabınız devre dışı bırakılmış. Yöneticiyle iletişime geçin.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
    }

    const token = generateToken(user);

    // Son giriş zamanını güncelle
    await db('users').where('id', user.id).update({ last_login_at: db.fn.now() });

    // Audit log
    await createAuditLog({
      userId: user.id,
      username: user.username,
      action: 'login',
      entityType: 'users',
      entityId: user.id,
      entityName: user.full_name || user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        title: user.title,
      },
    });
  } catch (error) {
    console.error('[AUTH] Login hatası:', error);
    res.status(500).json({ error: 'Giriş sırasında bir hata oluştu.' });
  }
});

// ─── Kullanıcı bilgilerini getir ───
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db('users')
      .select('id', 'username', 'email', 'full_name', 'role', 'department', 'title', 'phone')
      .where('id', req.user.id)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    // Okunmamış bildirim sayısı
    const unreadCount = await db('notifications')
      .where({ user_id: user.id, is_read: false })
      .count('id as count')
      .first();

    res.json({
      ...user,
      unread_notifications: parseInt(unreadCount.count),
    });
  } catch (error) {
    console.error('[AUTH] Me hatası:', error);
    res.status(500).json({ error: 'Kullanıcı bilgileri getirilemedi.' });
  }
});

// ─── Şifre değiştir ───
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Mevcut ve yeni şifre gereklidir.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır.' });
    }

    const user = await db('users').where('id', req.user.id).first();
    const isValid = await bcrypt.compare(current_password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db('users').where('id', req.user.id).update({ password: hashedPassword });

    await req.audit('update', 'users', req.user.id, req.user.full_name, null, null, 'Şifre değiştirildi');

    res.json({ message: 'Şifre başarıyla değiştirildi.' });
  } catch (error) {
    console.error('[AUTH] Şifre değiştirme hatası:', error);
    res.status(500).json({ error: 'Şifre değiştirilemedi.' });
  }
});

module.exports = router;
