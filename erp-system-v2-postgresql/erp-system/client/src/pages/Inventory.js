import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FiSearch, FiFilter, FiRefreshCw, FiX, FiAlertTriangle, FiPackage,
  FiArrowDown, FiArrowUp, FiEdit2, FiEye, FiClock, FiCheckCircle,
  FiShield, FiTrendingDown, FiTrendingUp, FiDollarSign, FiActivity,
  FiMapPin, FiRotateCcw, FiTrash2, FiSliders, FiChevronDown
} from 'react-icons/fi';
import './Inventory.css';

const Inventory = () => {
  // ─── State ───
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtre
  const [filters, setFilters] = useState({ search: '', warehouse_id: '', low_stock: '', is_critical: '' });
  const [showFilters, setShowFilters] = useState(false);

  // Modallar
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Seçili parça
  const [selectedItem, setSelectedItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);

  // Stok hareket formu
  const [adjustForm, setAdjustForm] = useState({
    movement_type: 'in', quantity: '', warehouse_id: '', reference_number: '', notes: ''
  });

  // Stok düzenleme formu
  const [editForm, setEditForm] = useState({
    min_quantity: 0, max_quantity: 0, reorder_point: 0, reorder_quantity: 0
  });

  const [submitting, setSubmitting] = useState(false);

  // ─── Data Fetching ───
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = () => {
    fetchInventory();
    fetchWarehouses();
  };

  const fetchInventory = useCallback(async () => {
    try {
      setRefreshing(true);
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id;
      if (filters.low_stock) params.low_stock = filters.low_stock;
      const res = await axios.get('/api/inventory', { params });
      setInventory(res.data);
    } catch (error) {
      console.error('Stok yüklenemedi:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(() => fetchInventory(), 300);
    return () => clearTimeout(t);
  }, [filters, fetchInventory]);

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get('/api/inventory/meta/warehouses');
      setWarehouses(res.data);
    } catch (e) { console.warn('Depolar yüklenemedi'); }
  };

  const fetchMovements = async (partId) => {
    try {
      setMovementLoading(true);
      const res = await axios.get(`/api/inventory/${partId}/movements`);
      setMovements(res.data.movements || res.data);
    } catch (e) { console.error('Hareketler yüklenemedi:', e); setMovements([]); }
    finally { setMovementLoading(false); }
  };

  // ─── İşlemler ───
  const openAdjustModal = (item) => {
    setSelectedItem(item);
    setAdjustForm({ movement_type: 'in', quantity: '', warehouse_id: item.warehouse_id || '', reference_number: '', notes: '' });
    setShowAdjustModal(true);
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setEditForm({
      min_quantity: item.min_quantity || 0,
      max_quantity: item.max_quantity || 0,
      reorder_point: item.reorder_point || 0,
      reorder_quantity: item.reorder_quantity || 0,
    });
    setShowEditModal(true);
  };

  const openHistory = (item) => {
    setSelectedItem(item);
    setShowHistoryPanel(true);
    fetchMovements(item.part_id);
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!adjustForm.quantity || adjustForm.quantity <= 0) {
      alert('Geçerli bir miktar giriniz'); return;
    }
    setSubmitting(true);
    try {
      await axios.post(`/api/inventory/${selectedItem.part_id}/adjust`, {
        movement_type: adjustForm.movement_type,
        quantity: parseInt(adjustForm.quantity),
        warehouse_id: adjustForm.warehouse_id || undefined,
        reference_number: adjustForm.reference_number || undefined,
        notes: adjustForm.notes || undefined,
      });
      setShowAdjustModal(false);
      fetchInventory();
    } catch (error) {
      alert('Hata: ' + (error.response?.data?.error || error.message));
    } finally { setSubmitting(false); }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.put(`/api/inventory/${selectedItem.part_id}`, editForm);
      setShowEditModal(false);
      fetchInventory();
    } catch (error) {
      alert('Hata: ' + (error.response?.data?.error || error.message));
    } finally { setSubmitting(false); }
  };

  // ─── KPI Hesaplama ───
  const kpis = React.useMemo(() => {
    const total = inventory.length;
    const lowStock = inventory.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity).length;
    const criticalLow = inventory.filter(i => i.is_critical && i.min_quantity > 0 && i.quantity <= i.min_quantity).length;
    const totalQty = inventory.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalValue = inventory.reduce((s, i) => s + (i.quantity || 0) * (parseFloat(i.unit_cost) || 0), 0);
    return { total, lowStock, criticalLow, totalQty, totalValue };
  }, [inventory]);

  const activeFilterCount = Object.values(filters).filter(v => v).length - (filters.search ? 1 : 0);

  const getWarehouseName = (wId) => {
    const w = warehouses.find(w => w.id === wId);
    return w ? w.name : '';
  };

  if (loading) {
    return <div className="inv-loading"><div className="loading-spinner" /><p>Stok yükleniyor...</p></div>;
  }

  return (
    <div className="inventory-page">
      {/* ═══ HEADER ═══ */}
      <div className="inv-header">
        <div>
          <h1>Stok Yönetimi</h1>
          <p className="inv-subtitle">Çoklu Depo · Hareket Takibi · Reorder Noktaları</p>
        </div>
        <button className={`btn-refresh ${refreshing ? 'spinning' : ''}`} onClick={fetchAll} disabled={refreshing} title="Yenile">
          <FiRefreshCw />
        </button>
      </div>

      {/* ═══ KPI KARTLARI ═══ */}
      <div className="inv-kpi-grid">
        <div className="inv-kpi"><div className="inv-kpi-icon kpi-blue"><FiPackage /></div><div><div className="inv-kpi-value">{kpis.total}</div><div className="inv-kpi-label">Stok Kalemi</div></div></div>
        <div className="inv-kpi"><div className="inv-kpi-icon kpi-green"><FiTrendingUp /></div><div><div className="inv-kpi-value">{formatNumber(kpis.totalQty)}</div><div className="inv-kpi-label">Toplam Adet</div></div></div>
        <div className={`inv-kpi ${kpis.lowStock > 0 ? 'kpi-alert' : ''}`}><div className="inv-kpi-icon kpi-red"><FiAlertTriangle /></div><div><div className="inv-kpi-value">{kpis.lowStock}</div><div className="inv-kpi-label">Düşük Stok</div></div></div>
        <div className={`inv-kpi ${kpis.criticalLow > 0 ? 'kpi-alert' : ''}`}><div className="inv-kpi-icon kpi-orange"><FiShield /></div><div><div className="inv-kpi-value">{kpis.criticalLow}</div><div className="inv-kpi-label">Kritik Düşük</div></div></div>
        <div className="inv-kpi"><div className="inv-kpi-icon kpi-gold"><FiDollarSign /></div><div><div className="inv-kpi-value">{formatCurrency(kpis.totalValue)}</div><div className="inv-kpi-label">Stok Değeri</div></div></div>
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div className="inv-toolbar">
        <div className="search-box">
          <FiSearch />
          <input placeholder="Parça adı veya kodu ile ara..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
          {filters.search && <button className="search-clear" onClick={() => setFilters({ ...filters, search: '' })}><FiX /></button>}
        </div>
        <div className="toolbar-right">
          <button className={`btn-filter ${showFilters ? 'active' : ''} ${activeFilterCount > 0 ? 'has-filters' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <FiFilter /> Filtre {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {/* ═══ FİLTRELER ═══ */}
      {showFilters && (
        <div className="inv-filters">
          <div className="filter-group">
            <label>Depo</label>
            <select value={filters.warehouse_id} onChange={e => setFilters({ ...filters, warehouse_id: e.target.value })}>
              <option value="">Tüm Depolar</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Stok Durumu</label>
            <select value={filters.low_stock} onChange={e => setFilters({ ...filters, low_stock: e.target.value })}>
              <option value="">Tümü</option>
              <option value="true">Düşük Stok</option>
            </select>
          </div>
          <button className="btn-clear-filters" onClick={() => setFilters({ search: filters.search, warehouse_id: '', low_stock: '', is_critical: '' })}>
            <FiRefreshCw /> Temizle
          </button>
        </div>
      )}

      {/* ═══ STOK TABLOSU ═══ */}
      <div className="inv-table-container">
        {inventory.length === 0 ? (
          <div className="inv-empty"><FiPackage size={48} /><p>Stok kaydı bulunamadı</p></div>
        ) : (
          <table className="inv-table">
            <thead>
              <tr>
                <th className="th-flags"></th>
                <th>Parça</th>
                <th>Depo</th>
                <th>Mevcut</th>
                <th>Stok Durumu</th>
                <th>Min</th>
                <th>Max</th>
                <th>Reorder</th>
                <th>Birim Maliyet</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => {
                const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;
                const pct = item.max_quantity > 0 ? Math.min(100, Math.round((item.quantity / item.max_quantity) * 100)) : null;
                const atReorder = item.reorder_point > 0 && item.quantity <= item.reorder_point;

                return (
                  <tr key={item.id} className={`${isLow ? 'row-low' : ''} ${item.is_critical && isLow ? 'row-critical-low' : ''}`}>
                    <td className="td-flags">
                      {item.is_critical && <FiShield className="icon-critical" title="Emniyet Kritik" />}
                    </td>
                    <td>
                      <div className="td-part">
                        <strong>{item.part_name}</strong>
                        <span className="part-code">{item.part_code}</span>
                      </div>
                    </td>
                    <td>
                      <span className="warehouse-tag">{item.warehouse_name || 'Genel'}</span>
                    </td>
                    <td className="td-qty">
                      <span className={`qty-value ${isLow ? 'qty-low' : ''}`}>{item.quantity}</span>
                      <span className="qty-unit">{item.unit || 'adet'}</span>
                    </td>
                    <td className="td-bar">
                      {pct !== null ? (
                        <div className="stock-bar-wrapper">
                          <div className="stock-bar">
                            <div className={`stock-bar-fill ${pct <= 20 ? 'bar-danger' : pct <= 50 ? 'bar-warning' : 'bar-ok'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="stock-pct">{pct}%</span>
                        </div>
                      ) : <span className="text-muted">-</span>}
                    </td>
                    <td className="td-num">{item.min_quantity || '-'}</td>
                    <td className="td-num">{item.max_quantity || '-'}</td>
                    <td className="td-num">
                      {item.reorder_point > 0 ? (
                        <span className={atReorder ? 'reorder-alert' : ''}>{item.reorder_point}</span>
                      ) : '-'}
                    </td>
                    <td className="td-num">{item.unit_cost > 0 ? `₺${parseFloat(item.unit_cost).toLocaleString('tr-TR')}` : '-'}</td>
                    <td>
                      {isLow ? (
                        <span className="badge-low"><FiAlertTriangle /> Düşük</span>
                      ) : atReorder ? (
                        <span className="badge-reorder"><FiTrendingDown /> Sipariş</span>
                      ) : (
                        <span className="badge-ok"><FiCheckCircle /> Normal</span>
                      )}
                    </td>
                    <td className="td-actions">
                      <button className="btn-action btn-in" onClick={() => openAdjustModal(item)} title="Stok Hareketi">
                        <FiActivity />
                      </button>
                      <button className="btn-action" onClick={() => openEditModal(item)} title="Seviye Düzenle">
                        <FiSliders />
                      </button>
                      <button className="btn-action" onClick={() => openHistory(item)} title="Hareket Geçmişi">
                        <FiClock />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══ STOK HAREKET MODALI ═══ */}
      {showAdjustModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal inv-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Stok Hareketi</h2>
              <button className="btn-close" onClick={() => setShowAdjustModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleAdjust} className="modal-body">
              <div className="adjust-part-info">
                <strong>{selectedItem.part_name}</strong>
                <span>{selectedItem.part_code}</span>
                <span className="current-stock">Mevcut: <b>{selectedItem.quantity}</b> {selectedItem.unit || 'adet'}</span>
              </div>

              {/* Hareket Tipi Seçimi */}
              <div className="movement-type-grid">
                {MOVEMENT_TYPES.map(mt => (
                  <button key={mt.value} type="button"
                    className={`movement-type-btn ${adjustForm.movement_type === mt.value ? 'active' : ''} mt-${mt.direction}`}
                    onClick={() => setAdjustForm({ ...adjustForm, movement_type: mt.value })}
                  >
                    {mt.icon}
                    <span>{mt.label}</span>
                  </button>
                ))}
              </div>

              <div className="form-row">
                <div className="form-group required">
                  <label>Miktar *</label>
                  <input type="number" min="1" value={adjustForm.quantity} onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })} required placeholder="Adet" />
                </div>
                <div className="form-group">
                  <label>Depo</label>
                  <select value={adjustForm.warehouse_id} onChange={e => setAdjustForm({ ...adjustForm, warehouse_id: e.target.value })}>
                    <option value="">Mevcut Depo</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Referans No (İrsaliye / Sipariş No)</label>
                <input type="text" value={adjustForm.reference_number} onChange={e => setAdjustForm({ ...adjustForm, reference_number: e.target.value })} placeholder="ör: IRS-2026-001" />
              </div>

              <div className="form-group">
                <label>Açıklama</label>
                <textarea rows={2} value={adjustForm.notes} onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })} placeholder="Hareket açıklaması..." />
              </div>

              {/* Önizleme */}
              <div className="adjust-preview">
                <span>Mevcut: {selectedItem.quantity}</span>
                <span className="preview-arrow">→</span>
                <span className={`preview-result ${getDirection(adjustForm.movement_type) === 'in' ? 'preview-up' : 'preview-down'}`}>
                  {calcNewQty(selectedItem.quantity, adjustForm.quantity, adjustForm.movement_type)}
                </span>
                <span className="preview-unit">{selectedItem.unit || 'adet'}</span>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowAdjustModal(false)}>İptal</button>
                <button type="submit" className={`btn-primary btn-${getDirection(adjustForm.movement_type)}`} disabled={submitting}>
                  {submitting ? 'İşleniyor...' : 'Hareket Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ SEVİYE DÜZENLEME MODALI ═══ */}
      {showEditModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal inv-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Stok Seviyeleri</h2>
              <button className="btn-close" onClick={() => setShowEditModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleEditSave} className="modal-body">
              <div className="adjust-part-info">
                <strong>{selectedItem.part_name}</strong>
                <span>{selectedItem.part_code}</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Min. Stok</label>
                  <input type="number" min="0" value={editForm.min_quantity} onChange={e => setEditForm({ ...editForm, min_quantity: parseInt(e.target.value) || 0 })} />
                  <small>Bu seviyenin altında uyarı verilir</small>
                </div>
                <div className="form-group">
                  <label>Max. Stok</label>
                  <input type="number" min="0" value={editForm.max_quantity} onChange={e => setEditForm({ ...editForm, max_quantity: parseInt(e.target.value) || 0 })} />
                  <small>Depo kapasitesi / yüzde göstergesi</small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Reorder Noktası</label>
                  <input type="number" min="0" value={editForm.reorder_point} onChange={e => setEditForm({ ...editForm, reorder_point: parseInt(e.target.value) || 0 })} />
                  <small>Bu seviyeye düşünce sipariş önerisi</small>
                </div>
                <div className="form-group">
                  <label>Sipariş Miktarı</label>
                  <input type="number" min="0" value={editForm.reorder_quantity} onChange={e => setEditForm({ ...editForm, reorder_quantity: parseInt(e.target.value) || 0 })} />
                  <small>Otomatik sipariş önerisi miktarı</small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowEditModal(false)}>İptal</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ HAREKET GEÇMİŞİ PANELİ ═══ */}
      {showHistoryPanel && selectedItem && (
        <div className="detail-overlay" onClick={() => setShowHistoryPanel(false)}>
          <div className="history-panel" onClick={e => e.stopPropagation()}>
            <div className="history-header">
              <div>
                <h2>Hareket Geçmişi</h2>
                <span className="history-part">{selectedItem.part_name} — {selectedItem.part_code}</span>
              </div>
              <button className="btn-close" onClick={() => setShowHistoryPanel(false)}><FiX /></button>
            </div>
            <div className="history-body">
              {movementLoading ? (
                <div className="history-loading"><div className="loading-spinner" /><p>Yükleniyor...</p></div>
              ) : movements.length === 0 ? (
                <div className="history-empty"><FiClock size={36} /><p>Henüz hareket kaydı yok</p></div>
              ) : (
                <div className="movement-timeline">
                  {movements.map((m, i) => (
                    <div key={m.id || i} className={`timeline-item tl-${getDirection(m.movement_type)}`}>
                      <div className="tl-dot">{getMovementIcon(m.movement_type)}</div>
                      <div className="tl-content">
                        <div className="tl-header">
                          <span className={`tl-type tl-type-${getDirection(m.movement_type)}`}>
                            {getMovementLabel(m.movement_type)}
                          </span>
                          <span className="tl-qty">
                            {getDirection(m.movement_type) === 'in' ? '+' : '-'}{m.quantity}
                          </span>
                        </div>
                        <div className="tl-stock">
                          {m.quantity_before} → <strong>{m.quantity_after}</strong>
                        </div>
                        {m.warehouse_name && <div className="tl-meta"><FiMapPin /> {m.warehouse_name}</div>}
                        {m.reference_number && <div className="tl-meta">Ref: {m.reference_number}</div>}
                        {m.notes && <div className="tl-notes">{m.notes}</div>}
                        <div className="tl-footer">
                          <span>{m.created_by_name || '-'}</span>
                          <span>{formatDateTime(m.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══ Hareket Tipleri ═══
const MOVEMENT_TYPES = [
  { value: 'in', label: 'Giriş', icon: <FiArrowDown />, direction: 'in' },
  { value: 'out', label: 'Çıkış', icon: <FiArrowUp />, direction: 'out' },
  { value: 'increase', label: 'Artış', icon: <FiTrendingUp />, direction: 'in' },
  { value: 'decrease', label: 'Azalış', icon: <FiTrendingDown />, direction: 'out' },
  { value: 'return', label: 'İade', icon: <FiRotateCcw />, direction: 'in' },
  { value: 'scrap', label: 'Hurda', icon: <FiTrash2 />, direction: 'out' },
  { value: 'adjustment', label: 'Düzeltme', icon: <FiSliders />, direction: 'in' },
];

function getDirection(type) {
  const map = { in: 'in', increase: 'in', return: 'in', adjustment: 'in', out: 'out', decrease: 'out', scrap: 'out' };
  return map[type] || 'in';
}

function getMovementLabel(type) {
  const map = { in: 'Giriş', out: 'Çıkış', increase: 'Artış', decrease: 'Azalış', return: 'İade', scrap: 'Hurda', adjustment: 'Düzeltme' };
  return map[type] || type;
}

function getMovementIcon(type) {
  const map = { in: <FiArrowDown />, out: <FiArrowUp />, increase: <FiTrendingUp />, decrease: <FiTrendingDown />, return: <FiRotateCcw />, scrap: <FiTrash2 />, adjustment: <FiSliders /> };
  return map[type] || <FiActivity />;
}

function calcNewQty(current, amount, type) {
  const q = parseInt(amount) || 0;
  const dir = getDirection(type);
  return dir === 'in' ? current + q : Math.max(0, current - q);
}

function formatNumber(n) { if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return n?.toString() || '0'; }
function formatCurrency(a) { if (!a) return '₺0'; return '₺' + Math.round(a).toLocaleString('tr-TR'); }
function formatDateTime(d) { if (!d) return '-'; return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default Inventory;
