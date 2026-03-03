# FAZ 1A: PostgreSQL Geçiş Kılavuzu

## 1. PostgreSQL Kurulumu

### Windows
1. [PostgreSQL İndir](https://www.postgresql.org/download/windows/) (v16 önerilir)
2. Kurulum sırasında şifre belirle (varsayılan kullanıcı: `postgres`)
3. pgAdmin otomatik kurulur

### Mac
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Linux (Ubuntu)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## 2. Veritabanı Oluşturma

### pgAdmin ile:
1. pgAdmin'i aç
2. Servers > PostgreSQL > sağ tık > Create > Database
3. İsim: `erp_savunma` > Save

### Terminal ile:
```bash
# PostgreSQL'e bağlan
psql -U postgres

# Veritabanı oluştur
CREATE DATABASE erp_savunma;

# Çıkış
\q
```

## 3. Proje Kurulumu

```bash
# Proje klasörüne git
cd erp-system

# Backend bağımlılıkları (yeni olanlar: knex, pg, helmet, compression, morgan, express-rate-limit)
npm install

# .env dosyasını düzenle (PostgreSQL bilgilerinize göre)
# DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# Migration'ları çalıştır (tabloları oluşturur)
npm run db:migrate

# Seed verilerini yükle (admin, depolar, kategoriler, ayarlar)
npm run db:seed

# Sunucuyu başlat
npm start
```

## 4. Mevcut SQLite Verilerini Taşıma (Opsiyonel)

Eğer mevcut SQLite veritabanında veri varsa:

```bash
# SQLite'tan verileri export et
sqlite3 data/erp.db ".mode csv" ".headers on" ".output users.csv" "SELECT * FROM users;"
sqlite3 data/erp.db ".mode csv" ".headers on" ".output models.csv" "SELECT * FROM models;"
sqlite3 data/erp.db ".mode csv" ".headers on" ".output parts.csv" "SELECT * FROM parts;"
# ... diğer tablolar

# PostgreSQL'e import et (pgAdmin veya psql ile)
# Ya da migration sonrası seed dosyasını düzenleyerek
```

## 5. Faydalı Komutlar

```bash
# Migration durumu
npm run db:migrate:status

# Son migration'ı geri al
npm run db:migrate:rollback

# Tüm migration'ları geri al ve yeniden çalıştır
npm run db:reset

# Yeni migration dosyası oluştur
npm run db:make:migration -- add_new_table

# Yeni seed dosyası oluştur
npm run db:make:seed -- sample_data

# Sağlık kontrolü
curl http://localhost:5000/api/health
```

## 6. Yapılan Değişiklikler (SQLite → PostgreSQL)

### Altyapı
- ❌ `sqlite3` paketi → ✅ `pg` + `knex` query builder
- ❌ Callback tabanlı sorgular → ✅ Async/await Promise tabanlı
- ❌ `data/erp.db` dosya tabanlı DB → ✅ PostgreSQL sunucu
- ❌ Manuel tablo oluşturma → ✅ Knex migration sistemi

### Güvenlik
- ✅ `helmet` - HTTP güvenlik başlıkları
- ✅ `express-rate-limit` - API rate limiting
- ✅ `compression` - Response sıkıştırma
- ✅ `morgan` - HTTP istek loglama
- ✅ Login rate limiting (15dk'da max 10 deneme)
- ✅ Graceful shutdown desteği

### Yeni Tablolar
- `part_categories` - Parça kategorileri (hiyerarşik)
- `warehouses` - Depo tanımları
- `inventory_movements` - Stok hareket geçmişi
- `audit_logs` - İşlem logları (JSONB)
- `settings` - Sistem ayarları
- `notifications` - Bildirimler

### Genişletilen Tablolar
- `users` → +phone, department, title, is_active, last_login_at
- `models` → +category, caliber, status, base_price, image_path, created_by
- `parts` → +category_id, unit, drawing_number, revision, weight, dimensions, tolerance, hardness, surface_finish, is_critical, is_serialized, unit_cost, lead_time_days
- `inventory` → +warehouse_id, max_quantity, reorder_point, reorder_quantity
- `production_orders` → +planned/actual dates, completed/rejected quantity, customer info, approved_by

### Yeni API Endpoint'ler
- `POST /api/auth/change-password` - Şifre değiştirme
- `GET /api/parts/meta/categories` - Parça kategorileri
- `GET /api/inventory/:partId/movements` - Stok hareket geçmişi
- `GET /api/inventory/meta/warehouses` - Depo listesi
- `GET /api/production-orders/stats/summary` - Üretim istatistikleri
- `GET /api/users/meta/roles` - Rol listesi
- `GET /api/audit-logs` - İşlem logları
- `GET /api/notifications` - Bildirimler
- `PUT /api/notifications/:id/read` - Bildirim okundu
- `GET /api/settings` - Sistem ayarları
- `PUT /api/settings/:key` - Ayar güncelle
- `GET /api/health` - Sağlık kontrolü

## 7. Frontend Uyumluluk

Frontend (React) değişikliğe gerek kalmadan çalışmaya devam edecektir çünkü:
- API endpoint URL'leri aynı kalıyor
- Response formatları aynı (ek alanlar geriye uyumlu)
- Auth mekanizması aynı (JWT)

Yeni alanları kullanmak için frontend güncellemeleri ileriki fazlarda yapılacak.
