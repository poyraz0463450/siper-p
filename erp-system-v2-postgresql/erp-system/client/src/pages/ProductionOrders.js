import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  FiPlus, FiSearch, FiFilter, FiRefreshCw, FiX, FiEye, FiTrash2,
  FiCheckCircle, FiAlertTriangle, FiClock, FiFileText, FiChevronRight,
  FiArrowRight, FiPackage, FiUser, FiCalendar, FiShield, FiPlay,
  FiPause, FiCheck, FiXCircle, FiActivity, FiTruck, FiEdit2
} from 'react-icons/fi';
import './ProductionOrders.css';

// ═══ DURUM MAKİNESİ ═══
const STATUS_CONFIG = {
  draft:            { label: 'Taslak',        color: '#95a5a6', bg: '#f7fafc', icon: <FiEdit2 />,        step: 0 },
  pending_approval: { label: 'Onay Bekliyor', color: '#f39c12', bg: '#fffaf0', icon: <FiClock />,         step: 1 },
  approved:         { label: 'Onaylandı',     color: '#3498db', bg: '#ebf4ff', icon: <FiCheckCircle />,   step: 2 },
  in_production:    { label: 'Üretimde',      color: '#e67e22', bg: '#fff8f0', icon: <FiPlay />,          step: 3 },
  quality_check:    { label: 'Kalite Kontrol', color: '#9b59b6', bg: '#f5f0ff', icon: <FiShield />,       step: 4 },
  completed:        { label: 'Tamamlandı',    color: '#27ae60', bg: '#f0fff4', icon: <FiCheck />,         step: 5 },
  cancelled:        { label: 'İptal',         color: '#e74c3c', bg: '#fff5f5', icon: <FiXCircle />,       step: -1 },
};

const TRANSITIONS = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'draft', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['quality_check', 'completed', 'cancelled'],
  quality_check: ['completed', 'in_production'],
  completed: [],
  cancelled: ['draft'],
};

const PRIORITY_CONFIG = {
  low:    { label: 'Düşük',  color: '#3498db', bg: '#ebf4ff' },
  normal: { label: 'Normal', color: '#27ae60', bg: '#f0fff4' },
  high:   { label: 'Yüksek', color: '#f39c12', bg: '#fffaf0' },
  urgent: { label: 'ACİL',   color: '#e74c3c', bg: '#fff5f5' },
};

const ProductionOrders = () => {
  const [orders, setOrders] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtre
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' });
  const [showFilters, setShowFilters] = useState(false);

  // Modallar
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form
  const [formData, setFormData] = useState({ model_id: '', quantity: 1, priority: 'normal', customer_name: '', customer_order_number: '', planned_start_date: '', planned_end_date: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  // ─── Fetch ───
  useEffect(() => { fetchOrders(); fetchModels(); }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setRefreshing(true);
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      const res = await axios.get('/api/production-orders', { params });
      setOrders(res.data);
    } catch (e) { console.error('Emirler yüklenemedi:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(() => fetchOrders(), 300);
    return () => clearTimeout(t);
  }, [filters, fetchOrders]);

  const fetchModels = async () => {
    try { const r = await axios.get('/api/models'); setModels(r.data); }
    catch (e) { console.warn('Modeller yüklenemedi'); }
  };

  const fetchOrderDetail = async (id) => {
    try {
      setDetailLoading(true);
      const r = await axios.get(`/api/production-orders/${id}`);
      setSelectedOrder(r.data);
      setShowDetailPanel(true);
    } catch (e) { alert('Emir detayı yüklenemedi'); }
    finally { setDetailLoading(false); }
  };

  // ─── İşlemler ───
  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post('/api/production-orders', formData);
      setShowCreateModal(false);
      resetForm();
      fetchOrders();
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    } finally { setSubmitting(false); }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
    if (!window.confirm(`Bu emri "${statusLabel}" durumuna geçirmek istediğinizden emin misiniz?`)) return;
    try {
      await axios.put(`/api/production-orders/${orderId}/status`, { status: newStatus });
      fetchOrders();
      if (selectedOrder?.id === orderId) fetchOrderDetail(orderId);
    } catch (err) {
      alert('Hata: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu üretim emrini silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`/api/production-orders/${id}`);
      fetchOrders();
      if (selectedOrder?.id === id) setShowDetailPanel(false);
    } catch (err) { alert('Hata: ' + (err.response?.data?.error || err.message)); }
  };

  const resetForm = () => setFormData({ model_id: '', quantity: 1, priority: 'normal', customer_name: '', customer_order_number: '', planned_start_date: '', planned_end_date: '', notes: '' });

  // ─── KPI ───
  const kpis = useMemo(() => {
    const byStatus = {};
    orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
    const active = (byStatus['pending_approval'] || 0) + (byStatus['approved'] || 0) + (byStatus['in_production'] || 0) + (byStatus['quality_check'] || 0);
    const urgent = orders.filter(o => o.priority === 'urgent' && !['completed', 'cancelled'].includes(o.status)).length;
    return { total: orders.length, active, completed: byStatus['completed'] || 0, cancelled: byStatus['cancelled'] || 0, urgent, byStatus };
  }, [orders]);

  const activeFilterCount = Object.values(filters).filter(v => v).length - (filters.search ? 1 : 0);

  if (loading) return <div className="po-loading"><div className="loading-spinner" /><p>Üretim emirleri yükleniyor...</p></div>;

  return (
    <div className="po-page">
      {/* ═══ HEADER ═══ */}
      <div className="po-header">
        <div>
          <h1>Üretim Emirleri</h1>
          <p className="po-subtitle">İş Akışı · Durum Takibi · Malzeme Kontrol</p>
        </div>
        <div className="po-header-actions">
          <button className={`btn-refresh ${refreshing ? 'spinning' : ''}`} onClick={fetchOrders} disabled={refreshing}><FiRefreshCw /></button>
          <button className="btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}><FiPlus /> Yeni Emir</button>
        </div>
      </div>

      {/* ═══ DURUM SEKMELERI ═══ */}
      <div className="status-tabs">
        <button className={`status-tab ${!filters.status ? 'active' : ''}`} onClick={() => setFilters({...filters, status: ''})}>
          Tümü <span className="tab-count">{kpis.total}</span>
        </button>
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'cancelled').map(([key, cfg]) => (
          <button key={key} className={`status-tab ${filters.status === key ? 'active' : ''}`} onClick={() => setFilters({...filters, status: key})} style={filters.status === key ? { borderColor: cfg.color, color: cfg.color } : {}}>
            {cfg.icon} {cfg.label}
            {kpis.byStatus[key] > 0 && <span className="tab-count" style={filters.status === key ? { background: cfg.color } : {}}>{kpis.byStatus[key]}</span>}
          </button>
        ))}
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div className="po-toolbar">
        <div className="search-box">
          <FiSearch />
          <input placeholder="Emir no, model veya müşteri ara..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
          {filters.search && <button className="search-clear" onClick={() => setFilters({...filters, search: ''})}><FiX /></button>}
        </div>
        <div className="toolbar-right">
          <button className={`btn-filter ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <FiFilter /> Filtre {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="po-filters">
          <div className="filter-group">
            <label>Öncelik</label>
            <select value={filters.priority} onChange={e => setFilters({...filters, priority: e.target.value})}>
              <option value="">Tümü</option>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <button className="btn-clear-filters" onClick={() => setFilters({ search: filters.search, status: '', priority: '' })}><FiRefreshCw /> Temizle</button>
        </div>
      )}

      {/* ═══ TABLO ═══ */}
      <div className="po-table-container">
        {orders.length === 0 ? (
          <div className="po-empty"><FiFileText size={48} /><p>Üretim emri bulunamadı</p></div>
        ) : (
          <table className="po-table">
            <thead>
              <tr>
                <th>Emir No</th>
                <th>Model</th>
                <th>Müşteri</th>
                <th>Miktar</th>
                <th>Öncelik</th>
                <th>Durum</th>
                <th>İlerleme</th>
                <th>Planlanan Bitiş</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;
                const pc = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.normal;
                const progress = order.completed_quantity > 0 ? Math.min(100, Math.round((order.completed_quantity / order.quantity) * 100)) : (sc.step >= 0 ? Math.round((sc.step / 5) * 100) : 0);
                const isOverdue = order.planned_end_date && new Date(order.planned_end_date) < new Date() && !['completed', 'cancelled'].includes(order.status);

                return (
                  <tr key={order.id} className={`${isOverdue ? 'row-overdue' : ''} ${order.priority === 'urgent' ? 'row-urgent' : ''}`}>
                    <td className="td-ordernum" onClick={() => fetchOrderDetail(order.id)}>
                      <strong>{order.order_number}</strong>
                    </td>
                    <td>
                      <div className="td-model">
                        <span className="model-name">{order.model_name}</span>
                        <span className="model-code">{order.model_code}</span>
                      </div>
                    </td>
                    <td>{order.customer_name || <span className="text-muted">-</span>}</td>
                    <td className="td-qty">
                      {order.completed_quantity > 0 ? (
                        <><strong>{order.completed_quantity}</strong><span className="text-muted">/{order.quantity}</span></>
                      ) : <strong>{order.quantity}</strong>}
                    </td>
                    <td><span className="priority-badge" style={{ color: pc.color, background: pc.bg }}>{pc.label}</span></td>
                    <td>
                      <span className="status-badge" style={{ color: sc.color, background: sc.bg }}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="td-progress">
                      <div className="progress-bar-wrapper">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${progress}%`, background: sc.color }} />
                        </div>
                        <span className="progress-pct">{progress}%</span>
                      </div>
                    </td>
                    <td className={isOverdue ? 'td-overdue' : ''}>
                      {order.planned_end_date ? (
                        <span>{formatDate(order.planned_end_date)} {isOverdue && <FiAlertTriangle className="overdue-icon" />}</span>
                      ) : <span className="text-muted">-</span>}
                    </td>
                    <td className="td-actions">
                      <button className="btn-action" onClick={() => fetchOrderDetail(order.id)} title="Detay"><FiEye /></button>
                      {['draft', 'cancelled'].includes(order.status) && (
                        <button className="btn-action danger" onClick={() => handleDelete(order.id)} title="Sil"><FiTrash2 /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══ DETAY PANELİ ═══ */}
      {showDetailPanel && selectedOrder && (
        <div className="detail-overlay" onClick={() => setShowDetailPanel(false)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <div>
                <h2>{selectedOrder.order_number}</h2>
                <span className="detail-model">{selectedOrder.model_name} ({selectedOrder.model_code})</span>
              </div>
              <button className="btn-close" onClick={() => setShowDetailPanel(false)}><FiX /></button>
            </div>

            <div className="detail-body">
              {/* Workflow Progress */}
              <div className="workflow-section">
                <WorkflowStepper currentStatus={selectedOrder.status} />
              </div>

              {/* Durum Geçişleri */}
              {TRANSITIONS[selectedOrder.status]?.length > 0 && (
                <div className="transition-section">
                  <h3>Durum Değiştir</h3>
                  <div className="transition-buttons">
                    {(selectedOrder.allowed_status_transitions || TRANSITIONS[selectedOrder.status]).map(nextStatus => {
                      const nsc = STATUS_CONFIG[nextStatus];
                      if (!nsc) return null;
                      return (
                        <button key={nextStatus} className="btn-transition" style={{ borderColor: nsc.color, color: nsc.color }}
                          onClick={() => handleStatusChange(selectedOrder.id, nextStatus)}
                        >
                          {nsc.icon} {nsc.label} <FiArrowRight />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Emir Bilgileri */}
              <div className="detail-section">
                <h3>Emir Bilgileri</h3>
                <div className="detail-grid">
                  <DetailField label="Emir No" value={selectedOrder.order_number} />
                  <DetailField label="Durum" value={<span className="status-badge-sm" style={{ color: STATUS_CONFIG[selectedOrder.status]?.color }}>{STATUS_CONFIG[selectedOrder.status]?.icon} {STATUS_CONFIG[selectedOrder.status]?.label}</span>} />
                  <DetailField label="Öncelik" value={PRIORITY_CONFIG[selectedOrder.priority]?.label} />
                  <DetailField label="Miktar" value={`${selectedOrder.quantity} adet`} />
                  <DetailField label="Tamamlanan" value={`${selectedOrder.completed_quantity || 0} adet`} />
                  <DetailField label="Reddedilen" value={`${selectedOrder.rejected_quantity || 0} adet`} />
                </div>
              </div>

              {/* Müşteri & Tarih */}
              <div className="detail-section">
                <h3>Müşteri & Planlama</h3>
                <div className="detail-grid">
                  <DetailField label="Müşteri" value={selectedOrder.customer_name} icon={<FiUser />} />
                  <DetailField label="Müşteri Sipariş No" value={selectedOrder.customer_order_number} icon={<FiTruck />} />
                  <DetailField label="Plan. Başlangıç" value={formatDate(selectedOrder.planned_start_date)} icon={<FiCalendar />} />
                  <DetailField label="Plan. Bitiş" value={formatDate(selectedOrder.planned_end_date)} icon={<FiCalendar />} />
                  <DetailField label="Fiili Başlangıç" value={formatDate(selectedOrder.actual_start_date)} />
                  <DetailField label="Tamamlanma" value={formatDate(selectedOrder.completed_at)} />
                </div>
                {selectedOrder.notes && (
                  <div className="detail-notes"><label>Notlar</label><p>{selectedOrder.notes}</p></div>
                )}
              </div>

              {/* Malzeme Listesi */}
              {selectedOrder.parts && selectedOrder.parts.length > 0 && (
                <div className="detail-section">
                  <h3><FiPackage /> Malzeme İhtiyacı ({selectedOrder.parts.length} kalem)</h3>
                  <table className="parts-detail-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Parça</th>
                        <th>Gerekli</th>
                        <th>Tahsis</th>
                        <th>Mevcut</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.parts.map((p, i) => {
                        const isShort = (p.available_quantity || 0) < (p.required_quantity || 0);
                        const allocated = p.allocated_quantity || 0;
                        const required = p.required_quantity || 0;
                        const allocPct = required > 0 ? Math.round((allocated / required) * 100) : 0;
                        return (
                          <tr key={i} className={isShort ? 'row-shortage' : ''}>
                            <td className="td-flags">{p.is_critical && <FiShield className="icon-critical" title="Kritik" />}</td>
                            <td><strong>{p.part_name || p.name}</strong><br /><span className="text-muted">{p.part_code || p.code}</span></td>
                            <td className="td-center">{required}</td>
                            <td className="td-center">
                              <div className="alloc-bar-wrapper">
                                <div className="alloc-bar"><div className="alloc-fill" style={{ width: `${Math.min(100, allocPct)}%` }} /></div>
                                <span>{allocated}/{required}</span>
                              </div>
                            </td>
                            <td className={`td-center ${isShort ? 'qty-shortage' : ''}`}>{p.available_quantity ?? '-'}</td>
                            <td>
                              {isShort ? <span className="badge-shortage"><FiAlertTriangle /> Eksik</span>
                                : allocPct >= 100 ? <span className="badge-ready"><FiCheckCircle /> Hazır</span>
                                : <span className="badge-partial"><FiClock /> Bekliyor</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Meta */}
              <div className="detail-section detail-meta">
                <p>Oluşturan: {selectedOrder.created_by_name || '-'}</p>
                <p>Onaylayan: {selectedOrder.approved_by_name || '-'}</p>
                <p>Oluşturma: {formatDateTime(selectedOrder.created_at)}</p>
                <p>Son Güncelleme: {formatDateTime(selectedOrder.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ YENİ EMİR MODALI ═══ */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal po-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Yeni Üretim Emri</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreate} className="modal-body">
              <div className="form-row">
                <div className="form-group required">
                  <label>Model *</label>
                  <select value={formData.model_id} onChange={e => setFormData({...formData, model_id: e.target.value})} required>
                    <option value="">Model Seçiniz</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                  </select>
                </div>
                <div className="form-group required">
                  <label>Miktar *</label>
                  <input type="number" min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Öncelik</label>
                  <div className="priority-select">
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <button key={k} type="button" className={`priority-option ${formData.priority === k ? 'active' : ''}`}
                        style={formData.priority === k ? { borderColor: v.color, background: v.bg, color: v.color } : {}}
                        onClick={() => setFormData({...formData, priority: k})}>{v.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Müşteri Adı</label><input type="text" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} placeholder="ör: TSK / EGM / JGK" /></div>
                <div className="form-group"><label>Müşteri Sipariş No</label><input type="text" value={formData.customer_order_number} onChange={e => setFormData({...formData, customer_order_number: e.target.value})} placeholder="ör: TSK-2026-001" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Planlanan Başlangıç</label><input type="date" value={formData.planned_start_date} onChange={e => setFormData({...formData, planned_start_date: e.target.value})} /></div>
                <div className="form-group"><label>Planlanan Bitiş</label><input type="date" value={formData.planned_end_date} onChange={e => setFormData({...formData, planned_end_date: e.target.value})} /></div>
              </div>
              <div className="form-group"><label>Notlar</label><textarea rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Üretim ile ilgili notlar..." /></div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>İptal</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Oluşturuluyor...' : 'Emir Oluştur'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══ Workflow Stepper ═══
const WorkflowStepper = ({ currentStatus }) => {
  const steps = ['draft', 'pending_approval', 'approved', 'in_production', 'quality_check', 'completed'];
  const currentStep = STATUS_CONFIG[currentStatus]?.step ?? -1;
  const isCancelled = currentStatus === 'cancelled';

  return (
    <div className={`workflow-stepper ${isCancelled ? 'workflow-cancelled' : ''}`}>
      {isCancelled ? (
        <div className="workflow-cancelled-msg"><FiXCircle /> Bu emir iptal edilmiştir</div>
      ) : (
        steps.map((step, i) => {
          const cfg = STATUS_CONFIG[step];
          const isActive = step === currentStatus;
          const isDone = cfg.step < currentStep;
          return (
            <div key={step} className={`workflow-step ${isActive ? 'step-active' : ''} ${isDone ? 'step-done' : ''}`}>
              <div className="step-dot" style={isActive ? { background: cfg.color, borderColor: cfg.color } : isDone ? { background: cfg.color, borderColor: cfg.color } : {}}>
                {isDone ? <FiCheck /> : (i + 1)}
              </div>
              <span className="step-label" style={isActive ? { color: cfg.color, fontWeight: 700 } : {}}>{cfg.label}</span>
              {i < steps.length - 1 && <div className={`step-line ${isDone ? 'line-done' : ''}`} style={isDone ? { background: cfg.color } : {}} />}
            </div>
          );
        })
      )}
    </div>
  );
};

const DetailField = ({ label, value, icon }) => (
  <div className="detail-field"><span className="detail-field-label">{icon} {label}</span><span className="detail-field-value">{value || '-'}</span></div>
);

function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatDateTime(d) { if (!d) return '-'; return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default ProductionOrders;
