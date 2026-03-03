import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  FiLayers, FiPackage, FiAlertTriangle, FiFileText,
  FiCheckCircle, FiTrendingUp, FiDollarSign, FiShield,
  FiArrowRight, FiArrowUp, FiArrowDown, FiClock,
  FiBell, FiRefreshCw, FiActivity
} from 'react-icons/fi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area
} from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setRefreshing(true);
      const res = await axios.get('/api/dashboard');
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error('Dashboard yüklenemedi:', err);
      // Fallback: eski API'lerle dene
      try {
        const [modelsRes, partsRes, lowStockRes, ordersRes] = await Promise.all([
          axios.get('/api/models'),
          axios.get('/api/parts'),
          axios.get('/api/inventory/alerts/low-stock'),
          axios.get('/api/production-orders')
        ]);
        const pending = ordersRes.data.filter(o => !['completed', 'cancelled'].includes(o.status));
        setData({
          kpis: {
            total_models: modelsRes.data.length,
            total_parts: partsRes.data.length,
            low_stock_count: lowStockRes.data.length,
            active_orders: pending.length,
            completed_orders: ordersRes.data.filter(o => o.status === 'completed').length,
            critical_parts: 0, total_produced: 0, inventory_value: 0,
          },
          charts: { orders_by_status: [], orders_by_priority: [], monthly_production: [], warehouse_stats: [] },
          tables: { recent_orders: ordersRes.data.slice(0, 10), recent_movements: [], low_stock_alerts: lowStockRes.data },
          notifications: [],
        });
        setError(null);
      } catch (e2) {
        setError('Veriler yüklenemedi.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <p>Dashboard yükleniyor...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard-error">
        <FiAlertTriangle size={48} />
        <h2>Veri Yüklenemedi</h2>
        <p>{error}</p>
        <button onClick={fetchDashboard} className="btn-retry"><FiRefreshCw /> Tekrar Dene</button>
      </div>
    );
  }

  const { kpis, charts, tables, notifications } = data;

  return (
    <div className="dashboard">
      {/* ─── Header ─── */}
      <div className="dashboard-header">
        <div>
          <h1>Kontrol Paneli</h1>
          <p className="dashboard-subtitle">Savunma Sanayi ERP — Anlık Üretim Özeti</p>
        </div>
        <button className={`btn-refresh ${refreshing ? 'spinning' : ''}`} onClick={fetchDashboard} disabled={refreshing} title="Yenile">
          <FiRefreshCw />
        </button>
      </div>

      {/* ═══ KPI KARTLARI ═══ */}
      <div className="kpi-grid">
        <KpiCard icon={<FiLayers />} label="Toplam Model" value={kpis.total_models} color="blue" onClick={() => navigate('/models')} />
        <KpiCard icon={<FiPackage />} label="Toplam Parça" value={kpis.total_parts} subtext={kpis.critical_parts > 0 ? `${kpis.critical_parts} kritik` : null} color="green" onClick={() => navigate('/parts')} />
        <KpiCard icon={<FiAlertTriangle />} label="Düşük Stok" value={kpis.low_stock_count} color="red" alert={kpis.low_stock_count > 0} onClick={() => navigate('/inventory')} />
        <KpiCard icon={<FiFileText />} label="Aktif Emirler" value={kpis.active_orders} color="orange" onClick={() => navigate('/production-orders')} />
        <KpiCard icon={<FiCheckCircle />} label="Tamamlanan" value={kpis.completed_orders} color="teal" />
        <KpiCard icon={<FiTrendingUp />} label="Toplam Üretim" value={formatNumber(kpis.total_produced)} subtext="adet" color="purple" />
        <KpiCard icon={<FiShield />} label="Kritik Parçalar" value={kpis.critical_parts} color="navy" onClick={() => navigate('/parts')} />
        <KpiCard icon={<FiDollarSign />} label="Stok Değeri" value={formatCurrency(kpis.inventory_value)} color="gold" />
      </div>

      {/* ═══ GRAFİKLER SATIR 1 ═══ */}
      <div className="chart-row">
        <div className="chart-card chart-wide">
          <div className="chart-header"><h3><FiActivity /> Aylık Üretim Trendi</h3></div>
          <div className="chart-body">
            {charts.monthly_production.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={charts.monthly_production}>
                  <defs>
                    <linearGradient id="gradQty" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#667eea" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradComp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#27ae60" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#27ae60" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month_short" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="quantity" name="Planlanan" stroke="#667eea" fill="url(#gradQty)" strokeWidth={2} />
                  <Area type="monotone" dataKey="completed" name="Tamamlanan" stroke="#27ae60" fill="url(#gradComp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Henüz üretim verisi yok" />}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header"><h3><FiFileText /> Emir Durumu</h3></div>
          <div className="chart-body">
            {charts.orders_by_status.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={charts.orders_by_status} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ label, count }) => `${label}: ${count}`} labelLine={{ strokeWidth: 1 }}>
                    {charts.orders_by_status.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Henüz üretim emri yok" />}
          </div>
        </div>
      </div>

      {/* ═══ GRAFİKLER SATIR 2 ═══ */}
      <div className="chart-row">
        <div className="chart-card chart-wide">
          <div className="chart-header"><h3><FiPackage /> Depo Doluluk Durumu</h3></div>
          <div className="chart-body">
            {charts.warehouse_stats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={charts.warehouse_stats} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total_items" name="Toplam Adet" fill="#667eea" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="item_count" name="Parça Çeşidi" fill="#a0b4f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Depo verisi yok" />}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header"><h3><FiAlertTriangle /> Aktif Emir Öncelikleri</h3></div>
          <div className="chart-body">
            {charts.orders_by_priority.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={charts.orders_by_priority} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={3} label={({ label, count }) => `${label}: ${count}`}>
                    {charts.orders_by_priority.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Aktif emir yok" />}
          </div>
        </div>
      </div>

      {/* ═══ TABLOLAR ═══ */}
      <div className="tables-row">
        <div className="table-card table-wide">
          <div className="table-card-header">
            <h3>Son Üretim Emirleri</h3>
            <button className="btn-link" onClick={() => navigate('/production-orders')}>Tümünü Gör <FiArrowRight /></button>
          </div>
          <div className="table-card-body">
            {tables.recent_orders.length > 0 ? (
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Emir No</th>
                    <th>Model</th>
                    <th>Adet</th>
                    <th>Öncelik</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.recent_orders.map(o => (
                    <tr key={o.id} className="clickable-row" onClick={() => navigate('/production-orders')}>
                      <td><strong>{o.order_number}</strong></td>
                      <td>{o.model_name}</td>
                      <td>{o.quantity}</td>
                      <td><PriorityBadge priority={o.priority} /></td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-muted">{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty-table">Henüz üretim emri yok</div>}
          </div>
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <h3><FiAlertTriangle className="text-warning" /> Düşük Stok</h3>
            <button className="btn-link" onClick={() => navigate('/inventory')}>Tümü <FiArrowRight /></button>
          </div>
          <div className="table-card-body">
            {tables.low_stock_alerts.length > 0 ? (
              <div className="alert-list">
                {tables.low_stock_alerts.map(item => (
                  <div key={item.id} className={`alert-item ${item.is_critical ? 'critical' : ''}`}>
                    <div className="alert-item-info">
                      <span className="alert-item-name">{item.part_name}</span>
                      <span className="alert-item-code">{item.part_code}</span>
                    </div>
                    <div className="alert-item-stock">
                      <span className="stock-current">{item.quantity}</span>
                      <span className="stock-divider">/</span>
                      <span className="stock-min">{item.min_quantity}</span>
                    </div>
                    {item.is_critical && <span className="critical-badge">KRİTİK</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-table success"><FiCheckCircle /> Tüm stoklar yeterli</div>
            )}
          </div>

          {notifications && notifications.length > 0 && (
            <>
              <div className="table-card-header" style={{ marginTop: 16 }}>
                <h3><FiBell className="text-info" /> Bildirimler</h3>
              </div>
              <div className="table-card-body">
                <div className="notification-list">
                  {notifications.map(n => (
                    <div key={n.id} className={`notification-item severity-${n.severity}`}>
                      <div className="notification-title">{n.title}</div>
                      <div className="notification-message">{n.message}</div>
                      <div className="notification-time">{formatTimeAgo(n.created_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ SON STOK HAREKETLERİ ═══ */}
      {tables.recent_movements.length > 0 && (
        <div className="table-card full-width" style={{ marginTop: 20 }}>
          <div className="table-card-header">
            <h3><FiActivity /> Son Stok Hareketleri</h3>
          </div>
          <div className="table-card-body">
            <table className="mini-table">
              <thead>
                <tr><th>Parça</th><th>Hareket</th><th>Miktar</th><th>Önceki → Sonraki</th><th>Depo</th><th>Kullanıcı</th><th>Tarih</th></tr>
              </thead>
              <tbody>
                {tables.recent_movements.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.part_name}</strong> <span className="text-muted">{m.part_code}</span></td>
                    <td><MovementBadge type={m.movement_type} /></td>
                    <td>{m.quantity}</td>
                    <td><span className="text-muted">{m.quantity_before}</span> → <strong>{m.quantity_after}</strong></td>
                    <td>{m.warehouse_name || '-'}</td>
                    <td>{m.created_by_name || '-'}</td>
                    <td className="text-muted">{formatDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══ ALT BİLEŞENLER ═══ */
const KpiCard = ({ icon, label, value, subtext, color, alert, onClick }) => (
  <div className={`kpi-card kpi-${color} ${alert ? 'kpi-alert' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
    <div className="kpi-icon">{icon}</div>
    <div className="kpi-content">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {subtext && <div className="kpi-subtext">{subtext}</div>}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = { draft: { l: 'Taslak', c: 'gray' }, pending_approval: { l: 'Onay Bekliyor', c: 'yellow' }, approved: { l: 'Onaylandı', c: 'blue' }, in_production: { l: 'Üretimde', c: 'orange' }, quality_check: { l: 'KK', c: 'purple' }, completed: { l: 'Tamamlandı', c: 'green' }, cancelled: { l: 'İptal', c: 'red' } };
  const s = map[status] || { l: status, c: 'gray' };
  return <span className={`badge-pill badge-${s.c}`}>{s.l}</span>;
};

const PriorityBadge = ({ priority }) => {
  const map = { low: { l: 'Düşük', c: 'blue' }, normal: { l: 'Normal', c: 'green' }, high: { l: 'Yüksek', c: 'orange' }, urgent: { l: 'ACİL', c: 'red' } };
  const p = map[priority] || { l: priority, c: 'gray' };
  return <span className={`priority-pill priority-${p.c}`}>{p.l}</span>;
};

const MovementBadge = ({ type }) => {
  const map = { in: { l: 'Giriş', i: <FiArrowDown />, c: 'movement-in' }, increase: { l: 'Artış', i: <FiArrowUp />, c: 'movement-in' }, out: { l: 'Çıkış', i: <FiArrowUp />, c: 'movement-out' }, decrease: { l: 'Azalış', i: <FiArrowDown />, c: 'movement-out' }, adjustment: { l: 'Düzeltme', i: <FiRefreshCw />, c: 'movement-adj' }, scrap: { l: 'Hurda', i: <FiAlertTriangle />, c: 'movement-out' }, return: { l: 'İade', i: <FiArrowDown />, c: 'movement-in' } };
  const m = map[type] || { l: type, i: null, c: '' };
  return <span className={`movement-badge ${m.c}`}>{m.i} {m.l}</span>;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong> adet</p>)}
    </div>
  );
};

const EmptyChart = ({ message }) => (
  <div className="empty-chart"><FiActivity size={36} /><p>{message}</p></div>
);

/* ═══ YARDIMCI FONKSİYONLAR ═══ */
function formatNumber(n) { if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return n?.toString() || '0'; }
function formatCurrency(a) { if (!a) return '₺0'; return '₺' + a.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatTimeAgo(d) { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return `${m} dk önce`; const h = Math.floor(m/60); if (h < 24) return `${h} saat önce`; return `${Math.floor(h/24)} gün önce`; }

export default Dashboard;
