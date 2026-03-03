import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FiPlus, FiEdit2, FiTrash2, FiPackage, FiImage, FiSearch,
  FiGrid, FiList, FiFilter, FiX, FiChevronRight, FiAlertTriangle,
  FiShield, FiInfo, FiCopy, FiRefreshCw, FiLayers, FiEye,
  FiHash, FiFileText, FiCheckCircle, FiClock, FiDollarSign
} from 'react-icons/fi';
import './Parts.css';

const Parts = () => {
  // ─── State ───
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // grid | table
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filtreler
  const [filters, setFilters] = useState({
    search: '',
    category_id: '',
    material: '',
    status: '',
    is_critical: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Form
  const [formData, setFormData] = useState(getEmptyForm());
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Data Fetching ───
  useEffect(() => {
    fetchParts();
    fetchCategories();
  }, []);

  const fetchParts = useCallback(async () => {
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.material) params.material = filters.material;
      if (filters.status) params.status = filters.status;
      if (filters.is_critical) params.is_critical = filters.is_critical;

      const res = await axios.get('/api/parts', { params });
      setParts(res.data);
    } catch (error) {
      console.error('Parçalar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchParts();
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, fetchParts]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/parts/meta/categories');
      setCategories(res.data);
    } catch (error) {
      // Eski API uyumluluğu — kategori endpoint yoksa boş bırak
      console.warn('Kategoriler yüklenemedi (eski API olabilir)');
    }
  };

  const fetchPartDetail = async (partId) => {
    try {
      setDetailLoading(true);
      const res = await axios.get(`/api/parts/${partId}`);
      setSelectedPart(res.data);
      setShowDetail(true);
    } catch (error) {
      console.error('Parça detayı yüklenemedi:', error);
      alert('Parça detayı yüklenemedi');
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Form İşlemleri ───
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (key !== 'image' && formData[key] !== null && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });
      if (formData.image) {
        submitData.append('image', formData.image);
      }

      if (editingPart) {
        await axios.put(`/api/parts/${editingPart.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post('/api/parts', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      setShowModal(false);
      resetForm();
      fetchParts();
    } catch (error) {
      alert('Hata: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingPart(null);
    setFormData(getEmptyForm());
    setImagePreview(null);
  };

  const openEditModal = (part) => {
    setEditingPart(part);
    setFormData({
      name: part.name || '',
      code: part.code || '',
      material: part.material || '',
      heat_treatment: part.heat_treatment || '',
      coating: part.coating || '',
      operation_code: part.operation_code || '',
      description: part.description || '',
      category_id: part.category_id || '',
      unit: part.unit || 'adet',
      drawing_number: part.drawing_number || '',
      weight_grams: part.weight_grams || '',
      dimensions: part.dimensions || '',
      tolerance: part.tolerance || '',
      hardness: part.hardness || '',
      surface_finish: part.surface_finish || '',
      is_critical: part.is_critical || false,
      is_serialized: part.is_serialized || false,
      unit_cost: part.unit_cost || '',
      lead_time_days: part.lead_time_days || '',
      revision_note: '',
      image: null,
    });
    setImagePreview(part.image_path || null);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" parçasını silmek istediğinizden emin misiniz?`)) return;
    try {
      await axios.delete(`/api/parts/${id}`);
      fetchParts();
      if (selectedPart?.id === id) setShowDetail(false);
    } catch (error) {
      alert('Hata: ' + (error.response?.data?.error || error.message));
    }
  };

  // ─── Yardımcılar ───
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length - (filters.search ? 1 : 0);

  const uniqueMaterials = [...new Set(parts.map(p => p.material).filter(Boolean))];

  const getCategoryName = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : '';
  };

  // Hiyerarşik kategoriler
  const parentCategories = categories.filter(c => !c.parent_id);
  const getSubCategories = (parentId) => categories.filter(c => c.parent_id === parentId);

  if (loading) {
    return (
      <div className="parts-loading">
        <div className="loading-spinner" />
        <p>Parçalar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="parts-page">
      {/* ═══ HEADER ═══ */}
      <div className="parts-header">
        <div>
          <h1>Parça Yönetimi</h1>
          <p className="parts-subtitle">{parts.length} parça kayıtlı</p>
        </div>
        <div className="parts-header-actions">
          <button className="btn-primary" onClick={() => { setShowModal(true); resetForm(); }}>
            <FiPlus /> Yeni Parça
          </button>
        </div>
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div className="parts-toolbar">
        <div className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Parça adı, kodu veya çizim no ile ara..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <button className="search-clear" onClick={() => setFilters({ ...filters, search: '' })}>
              <FiX />
            </button>
          )}
        </div>
        <div className="toolbar-right">
          <button
            className={`btn-filter ${showFilters ? 'active' : ''} ${activeFilterCount > 0 ? 'has-filters' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter />
            Filtre
            {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
          <div className="view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Kart Görünümü">
              <FiGrid />
            </button>
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')} title="Tablo Görünümü">
              <FiList />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ FİLTRELER ═══ */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Kategori</label>
            <select value={filters.category_id} onChange={e => setFilters({ ...filters, category_id: e.target.value })}>
              <option value="">Tümü</option>
              {parentCategories.map(cat => (
                <optgroup key={cat.id} label={cat.name}>
                  <option value={cat.id}>{cat.name} (Tümü)</option>
                  {getSubCategories(cat.id).map(sub => (
                    <option key={sub.id} value={sub.id}>&nbsp;&nbsp;{sub.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Malzeme</label>
            <select value={filters.material} onChange={e => setFilters({ ...filters, material: e.target.value })}>
              <option value="">Tümü</option>
              {uniqueMaterials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Durum</label>
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Tümü</option>
              <option value="active">Aktif</option>
              <option value="draft">Taslak</option>
              <option value="obsolete">Kullanım Dışı</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Kritik</label>
            <select value={filters.is_critical} onChange={e => setFilters({ ...filters, is_critical: e.target.value })}>
              <option value="">Tümü</option>
              <option value="true">Sadece Kritik</option>
            </select>
          </div>
          <button className="btn-clear-filters" onClick={() => setFilters({ search: filters.search, category_id: '', material: '', status: '', is_critical: '' })}>
            <FiRefreshCw /> Temizle
          </button>
        </div>
      )}

      {/* ═══ İÇERİK — GRID GÖRÜNÜMÜ ═══ */}
      {viewMode === 'grid' && (
        <div className="parts-grid">
          {parts.length === 0 ? (
            <div className="empty-state"><FiPackage size={48} /><p>Parça bulunamadı</p></div>
          ) : (
            parts.map(part => (
              <div key={part.id} className={`part-card ${part.is_critical ? 'card-critical' : ''}`}>
                {/* Üst Bilgi Rozeti */}
                <div className="card-badges">
                  {part.is_critical && <span className="badge-critical"><FiShield /> Kritik</span>}
                  {part.revision > 1 && <span className="badge-revision">Rev.{part.revision}</span>}
                  <span className={`badge-status status-${part.status || 'active'}`}>{getStatusLabel(part.status)}</span>
                </div>

                {/* Görsel */}
                <div className="part-image" onClick={() => fetchPartDetail(part.id)}>
                  {part.image_path ? (
                    <img src={part.image_path} alt={part.name} />
                  ) : (
                    <div className="no-image"><FiImage size={32} /></div>
                  )}
                </div>

                {/* Bilgiler */}
                <div className="part-info" onClick={() => fetchPartDetail(part.id)}>
                  <h3 title={part.name}>{part.name}</h3>
                  <div className="part-code-row">
                    <span className="part-code">{part.code}</span>
                    {part.drawing_number && <span className="part-drawing" title="Teknik Çizim No"><FiFileText /> {part.drawing_number}</span>}
                  </div>

                  <div className="part-specs">
                    {part.material && <span className="spec-tag" title="Malzeme">{part.material}</span>}
                    {part.heat_treatment && <span className="spec-tag" title="Isıl İşlem">{part.heat_treatment}</span>}
                    {part.coating && <span className="spec-tag" title="Kaplama">{part.coating}</span>}
                    {part.hardness && <span className="spec-tag" title="Sertlik">{part.hardness}</span>}
                  </div>

                  {part.category_name && (
                    <div className="part-category">
                      <FiLayers /> {part.category_name}
                    </div>
                  )}
                </div>

                {/* Aksiyonlar */}
                <div className="part-actions">
                  <button className="btn-icon" onClick={() => fetchPartDetail(part.id)} title="Detay">
                    <FiEye />
                  </button>
                  <button className="btn-icon" onClick={() => openEditModal(part)} title="Düzenle">
                    <FiEdit2 />
                  </button>
                  <button className="btn-icon danger" onClick={() => handleDelete(part.id, part.name)} title="Sil">
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ İÇERİK — TABLO GÖRÜNÜMÜ ═══ */}
      {viewMode === 'table' && (
        <div className="parts-table-container">
          {parts.length === 0 ? (
            <div className="empty-state"><FiPackage size={48} /><p>Parça bulunamadı</p></div>
          ) : (
            <table className="parts-data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Kod</th>
                  <th>Ad</th>
                  <th>Kategori</th>
                  <th>Malzeme</th>
                  <th>Isıl İşlem</th>
                  <th>Kaplama</th>
                  <th>Çizim No</th>
                  <th>Rev.</th>
                  <th>Birim Maliyet</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {parts.map(part => (
                  <tr key={part.id} className={part.is_critical ? 'row-critical' : ''}>
                    <td className="td-flags">
                      {part.is_critical && <FiShield className="icon-critical" title="Emniyet Kritik" />}
                      {part.is_serialized && <FiHash className="icon-serial" title="Seri No Takipli" />}
                    </td>
                    <td className="td-code" onClick={() => fetchPartDetail(part.id)}>
                      <strong>{part.code}</strong>
                    </td>
                    <td onClick={() => fetchPartDetail(part.id)} className="clickable">
                      <div className="td-name-row">
                        {part.image_path && <img src={part.image_path} alt="" className="table-thumb" />}
                        <span>{part.name}</span>
                      </div>
                    </td>
                    <td>{part.category_name || '-'}</td>
                    <td>{part.material || '-'}</td>
                    <td>{part.heat_treatment || '-'}</td>
                    <td>{part.coating || '-'}</td>
                    <td>{part.drawing_number || '-'}</td>
                    <td className="td-center">{part.revision || 1}</td>
                    <td className="td-right">{part.unit_cost > 0 ? `₺${parseFloat(part.unit_cost).toLocaleString('tr-TR')}` : '-'}</td>
                    <td><span className={`badge-status-sm status-${part.status || 'active'}`}>{getStatusLabel(part.status)}</span></td>
                    <td className="td-actions">
                      <button className="btn-icon-sm" onClick={() => fetchPartDetail(part.id)} title="Detay"><FiEye /></button>
                      <button className="btn-icon-sm" onClick={() => openEditModal(part)} title="Düzenle"><FiEdit2 /></button>
                      <button className="btn-icon-sm danger" onClick={() => handleDelete(part.id, part.name)} title="Sil"><FiTrash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ DETAY PANELİ ═══ */}
      {showDetail && selectedPart && (
        <div className="detail-overlay" onClick={() => setShowDetail(false)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <div>
                <h2>{selectedPart.name}</h2>
                <span className="detail-code">{selectedPart.code}</span>
                {selectedPart.is_critical && <span className="badge-critical"><FiShield /> Emniyet Kritik</span>}
              </div>
              <button className="btn-close" onClick={() => setShowDetail(false)}><FiX /></button>
            </div>

            <div className="detail-body">
              {/* Görsel */}
              {selectedPart.image_path && (
                <div className="detail-image">
                  <img src={selectedPart.image_path} alt={selectedPart.name} />
                </div>
              )}

              {/* Genel Bilgiler */}
              <div className="detail-section">
                <h3>Genel Bilgiler</h3>
                <div className="detail-grid">
                  <DetailField label="Parça Kodu" value={selectedPart.code} />
                  <DetailField label="Kategori" value={selectedPart.category_name} />
                  <DetailField label="Birim" value={selectedPart.unit} />
                  <DetailField label="Durum" value={getStatusLabel(selectedPart.status)} />
                  <DetailField label="Revizyon" value={`Rev.${selectedPart.revision}`} />
                  <DetailField label="Çizim No" value={selectedPart.drawing_number} />
                </div>
                {selectedPart.description && (
                  <div className="detail-description">
                    <label>Açıklama</label>
                    <p>{selectedPart.description}</p>
                  </div>
                )}
              </div>

              {/* Teknik Özellikler */}
              <div className="detail-section">
                <h3>Teknik Özellikler</h3>
                <div className="detail-grid">
                  <DetailField label="Malzeme" value={selectedPart.material} />
                  <DetailField label="Isıl İşlem" value={selectedPart.heat_treatment} />
                  <DetailField label="Kaplama" value={selectedPart.coating} />
                  <DetailField label="Sertlik" value={selectedPart.hardness} />
                  <DetailField label="Yüzey Kalitesi" value={selectedPart.surface_finish} />
                  <DetailField label="Tolerans" value={selectedPart.tolerance} />
                  <DetailField label="Boyutlar" value={selectedPart.dimensions} />
                  <DetailField label="Ağırlık" value={selectedPart.weight_grams ? `${selectedPart.weight_grams} g` : null} />
                  <DetailField label="Operasyon Kodu" value={selectedPart.operation_code} />
                </div>
              </div>

              {/* Maliyet & Tedarik */}
              <div className="detail-section">
                <h3>Maliyet & Tedarik</h3>
                <div className="detail-grid">
                  <DetailField label="Birim Maliyet" value={selectedPart.unit_cost > 0 ? `₺${parseFloat(selectedPart.unit_cost).toLocaleString('tr-TR')}` : null} icon={<FiDollarSign />} />
                  <DetailField label="Tedarik Süresi" value={selectedPart.lead_time_days > 0 ? `${selectedPart.lead_time_days} gün` : null} icon={<FiClock />} />
                  <DetailField label="Seri No Takipli" value={selectedPart.is_serialized ? 'Evet' : 'Hayır'} />
                </div>
              </div>

              {/* Kullanıldığı Modeller */}
              {selectedPart.used_in_models && selectedPart.used_in_models.length > 0 && (
                <div className="detail-section">
                  <h3>Kullanıldığı Modeller ({selectedPart.used_in_models.length})</h3>
                  <div className="where-used-list">
                    {selectedPart.used_in_models.map(m => (
                      <div key={m.id} className="where-used-item">
                        <FiLayers />
                        <span className="where-used-name">{m.name}</span>
                        <span className="where-used-code">{m.code}</span>
                        <span className="where-used-qty">× {m.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stok Durumu */}
              {selectedPart.inventory && selectedPart.inventory.length > 0 && (
                <div className="detail-section">
                  <h3>Stok Durumu</h3>
                  <div className="inventory-mini-list">
                    {selectedPart.inventory.map((inv, i) => (
                      <div key={i} className="inv-row">
                        <span className="inv-warehouse">{inv.warehouse_name || 'Genel'}</span>
                        <span className={`inv-qty ${inv.quantity <= inv.min_quantity ? 'low' : ''}`}>
                          {inv.quantity} {selectedPart.unit}
                        </span>
                        <span className="inv-min">min: {inv.min_quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta Bilgiler */}
              <div className="detail-section detail-meta">
                <p>Oluşturan: {selectedPart.created_by_name || '-'}</p>
                <p>Oluşturma: {formatDate(selectedPart.created_at)}</p>
                <p>Son Güncelleme: {formatDate(selectedPart.updated_at)}</p>
                {selectedPart.revision_note && <p>Revizyon Notu: {selectedPart.revision_note}</p>}
              </div>
            </div>

            <div className="detail-footer">
              <button className="btn-secondary" onClick={() => { openEditModal(selectedPart); setShowDetail(false); }}>
                <FiEdit2 /> Düzenle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ OLUŞTUR / DÜZENLE MODALI ═══ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal parts-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPart ? 'Parça Düzenle' : 'Yeni Parça Oluştur'}</h2>
              <button className="btn-close" onClick={() => { setShowModal(false); resetForm(); }}><FiX /></button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              {/* Tab: Temel Bilgiler */}
              <fieldset className="form-section">
                <legend>Temel Bilgiler</legend>
                <div className="form-row">
                  <div className="form-group required">
                    <label>Parça Adı *</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="ör: Namlu, Sürgü, Tetik Grubu" />
                  </div>
                  <div className="form-group required">
                    <label>Parça Kodu *</label>
                    <input type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} required placeholder="ör: NAM-001" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Kategori</label>
                    <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })}>
                      <option value="">Seçiniz</option>
                      {parentCategories.map(cat => (
                        <optgroup key={cat.id} label={cat.name}>
                          <option value={cat.id}>{cat.name}</option>
                          {getSubCategories(cat.id).map(sub => (
                            <option key={sub.id} value={sub.id}>&nbsp;&nbsp;{sub.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Birim</label>
                    <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                      <option value="adet">Adet</option>
                      <option value="kg">Kilogram</option>
                      <option value="metre">Metre</option>
                      <option value="litre">Litre</option>
                      <option value="set">Set</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Açıklama</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Parça açıklaması..." />
                </div>
              </fieldset>

              {/* Tab: Teknik Özellikler */}
              <fieldset className="form-section">
                <legend>Teknik Özellikler</legend>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label>Malzeme</label>
                    <input type="text" value={formData.material} onChange={e => setFormData({ ...formData, material: e.target.value })} placeholder="ör: AISI 4140 Çelik" />
                  </div>
                  <div className="form-group">
                    <label>Isıl İşlem</label>
                    <input type="text" value={formData.heat_treatment} onChange={e => setFormData({ ...formData, heat_treatment: e.target.value })} placeholder="ör: Sertleştirme + Menevişleme" />
                  </div>
                  <div className="form-group">
                    <label>Kaplama</label>
                    <input type="text" value={formData.coating} onChange={e => setFormData({ ...formData, coating: e.target.value })} placeholder="ör: Fosfat, Nikel, PVD" />
                  </div>
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label>Sertlik</label>
                    <input type="text" value={formData.hardness} onChange={e => setFormData({ ...formData, hardness: e.target.value })} placeholder="ör: 28-32 HRC" />
                  </div>
                  <div className="form-group">
                    <label>Yüzey Kalitesi</label>
                    <input type="text" value={formData.surface_finish} onChange={e => setFormData({ ...formData, surface_finish: e.target.value })} placeholder="ör: Ra 0.8" />
                  </div>
                  <div className="form-group">
                    <label>Tolerans</label>
                    <input type="text" value={formData.tolerance} onChange={e => setFormData({ ...formData, tolerance: e.target.value })} placeholder="ör: ±0.02 mm" />
                  </div>
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label>Boyutlar</label>
                    <input type="text" value={formData.dimensions} onChange={e => setFormData({ ...formData, dimensions: e.target.value })} placeholder="ör: 150x30x20 mm" />
                  </div>
                  <div className="form-group">
                    <label>Ağırlık (g)</label>
                    <input type="number" step="0.01" value={formData.weight_grams} onChange={e => setFormData({ ...formData, weight_grams: e.target.value })} placeholder="Gram cinsinden" />
                  </div>
                  <div className="form-group">
                    <label>Operasyon Kodu</label>
                    <input type="text" value={formData.operation_code} onChange={e => setFormData({ ...formData, operation_code: e.target.value })} placeholder="ör: CNC-T-001" />
                  </div>
                </div>
              </fieldset>

              {/* Tab: Çizim & Revizyon */}
              <fieldset className="form-section">
                <legend>Teknik Çizim & Revizyon</legend>
                <div className="form-row">
                  <div className="form-group">
                    <label>Teknik Çizim Numarası</label>
                    <input type="text" value={formData.drawing_number} onChange={e => setFormData({ ...formData, drawing_number: e.target.value })} placeholder="ör: DRW-NAM-001-R3" />
                  </div>
                  <div className="form-group">
                    <label>Revizyon Notu {editingPart && '(değişiklik açıklaması)'}</label>
                    <input type="text" value={formData.revision_note} onChange={e => setFormData({ ...formData, revision_note: e.target.value })} placeholder="ör: Tolerans değişikliği" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Parça Görseli</label>
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                  {imagePreview && (
                    <div className="image-preview">
                      <img src={imagePreview} alt="Önizleme" />
                    </div>
                  )}
                </div>
              </fieldset>

              {/* Tab: Maliyet & Özellikler */}
              <fieldset className="form-section">
                <legend>Maliyet & Sınıflandırma</legend>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label>Birim Maliyet (₺)</label>
                    <input type="number" step="0.01" value={formData.unit_cost} onChange={e => setFormData({ ...formData, unit_cost: e.target.value })} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label>Tedarik Süresi (gün)</label>
                    <input type="number" value={formData.lead_time_days} onChange={e => setFormData({ ...formData, lead_time_days: e.target.value })} placeholder="0" />
                  </div>
                  <div className="form-group" />
                </div>
                <div className="form-row">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={formData.is_critical} onChange={e => setFormData({ ...formData, is_critical: e.target.checked })} />
                    <FiShield className="icon-critical" />
                    <span>Emniyet Kritik Parça</span>
                    <small>Bu parça silah emniyetini doğrudan etkiler</small>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={formData.is_serialized} onChange={e => setFormData({ ...formData, is_serialized: e.target.checked })} />
                    <FiHash className="icon-serial" />
                    <span>Seri Numarası Takibi</span>
                    <small>Her parça bireysel seri no ile izlenir</small>
                  </label>
                </div>
              </fieldset>

              {/* Submit */}
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => { setShowModal(false); resetForm(); }}>İptal</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Kaydediliyor...' : (editingPart ? 'Güncelle' : 'Oluştur')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══ Yardımcı Bileşenler ═══

const DetailField = ({ label, value, icon }) => (
  <div className="detail-field">
    <span className="detail-field-label">{icon} {label}</span>
    <span className="detail-field-value">{value || '-'}</span>
  </div>
);

// ═══ Yardımcı Fonksiyonlar ═══

function getEmptyForm() {
  return {
    name: '', code: '', material: '', heat_treatment: '', coating: '',
    operation_code: '', description: '', category_id: '', unit: 'adet',
    drawing_number: '', weight_grams: '', dimensions: '', tolerance: '',
    hardness: '', surface_finish: '', is_critical: false, is_serialized: false,
    unit_cost: '', lead_time_days: '', revision_note: '', image: null,
  };
}

function getStatusLabel(status) {
  const map = { active: 'Aktif', draft: 'Taslak', obsolete: 'Kullanım Dışı' };
  return map[status] || 'Aktif';
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default Parts;
