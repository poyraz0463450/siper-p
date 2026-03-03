// server/routes/users.js
// Kullanıcı Yönetimi - PostgreSQL/Knex
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { authenticate, requireAdmin, ROLES } = require('../middleware/auth');

// ─── Tüm kullanıcılar (admin) ───
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'username', 'email', 'full_name', 'role', 'department',
        'title', 'phone', 'is_active', 'last_login_at', 'created_at')
      .orderBy('created_at');

    res.json(users);
  } catch (error) {
    console.error('[USERS] Liste hatası:', error);
    res.status(500).json({ error: 'Kullanıcılar getirilemedi.' });
  }
});

// ─── Yeni kullanıcı oluştur (admin) ───
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, full_name, role, department, title, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı, email ve şifre gereklidir.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
    }

    // Rol geçerliliği kontrol et
    if (role && !ROLES[role]) {
      return res.status(400).json({ error: 'Geçersiz rol.', valid_roles: Object.keys(ROLES) });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db('users')
      .insert({
        username,
        email,
        password: hashedPassword,
        full_name: full_name || null,
        role: role || 'user',
        department: department || null,
        title: title || null,
        phone: phone || null,
        is_active: true,
      })
      .returning(['id', 'username', 'email', 'full_name', 'role', 'department', 'title', 'phone', 'is_active']);

    await req.audit('create', 'users', newUser.id, full_name || username,
      null, { username, email, role: role || 'user', department });

    res.status(201).json(newUser);
  } catch (error) {
    if (error.constraint && error.constraint.includes('unique')) {
      return res.status(400).json({ error: 'Bu kullanıcı adı veya email zaten kullanılıyor.' });
    }
    console.error('[USERS] Oluşturma hatası:', error);
    res.status(500).json({ error: 'Kullanıcı oluşturulamadı.' });
  }
});

// ─── Kullanıcı güncelle ───
router.put('/:id', authenticate, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Sadece admin başkasını güncelleyebilir
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }

    const existing = await db('users').where('id', userId).first();
    if (!existing) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const { full_name, password, role, department, title, phone, is_active, email } = req.body;

    const updateData = {};

    if (full_name !== undefined) updateData.full_name = full_name;
    if (email) updateData.email = email;
    if (department !== undefined) updateData.department = department;
    if (title !== undefined) updateData.title = title;
    if (phone !== undefined) updateData.phone = phone;

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Sadece admin rol ve aktiflik değiştirebilir
    if (req.user.role === 'admin') {
      if (role) {
        if (!ROLES[role]) {
          return res.status(400).json({ error: 'Geçersiz rol.' });
        }
        updateData.role = role;
      }
      if (is_active !== undefined) {
        // Admin kendini devre dışı bırakamaz
        if (req.user.id === userId && !is_active) {
          return res.status(400).json({ error: 'Kendi hesabınızı devre dışı bırakamazsınız.' });
        }
        updateData.is_active = is_active;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan belirtilmedi.' });
    }

    updateData.updated_at = db.fn.now();

    await db('users').where('id', userId).update(updateData);

    await req.audit('update', 'users', userId, existing.full_name || existing.username, null, null, 'Kullanıcı güncellendi');

    res.json({ message: 'Kullanıcı güncellendi.' });
  } catch (error) {
    if (error.constraint && error.constraint.includes('unique')) {
      return res.status(400).json({ error: 'Bu email zaten kullanılıyor.' });
    }
    console.error('[USERS] Güncelleme hatası:', error);
    res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
  }
});

// ─── Kullanıcı sil (admin) ───
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (req.user.id === userId) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
    }

    const user = await db('users').where('id', userId).first();
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    // Soft delete (devre dışı bırak)
    await db('users').where('id', userId).update({ is_active: false, updated_at: db.fn.now() });

    await req.audit('delete', 'users', userId, user.full_name || user.username, null, null, 'Kullanıcı devre dışı bırakıldı');

    res.json({ message: 'Kullanıcı devre dışı bırakıldı.' });
  } catch (error) {
    console.error('[USERS] Silme hatası:', error);
    res.status(500).json({ error: 'Kullanıcı silinemedi.' });
  }
});

// ─── Roller listesi ───
router.get('/meta/roles', authenticate, async (req, res) => {
  const roleDescriptions = {
    admin: 'Sistem Yöneticisi - Tam yetki',
    production_manager: 'Üretim Müdürü - Üretim ve planlama',
    quality_control: 'Kalite Kontrol - QC ve test işlemleri',
    warehouse: 'Depocu - Stok ve depo yönetimi',
    purchasing: 'Satınalma - Tedarik ve sipariş',
    operator: 'Operatör - Üretim hattı işlemleri',
    viewer: 'İzleyici - Sadece görüntüleme',
    user: 'Kullanıcı - Temel işlemler',
  };

  res.json(Object.entries(roleDescriptions).map(([key, desc]) => ({
    role: key,
    description: desc,
    level: ROLES[key],
  })));
});

module.exports = router;
