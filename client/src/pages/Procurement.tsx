import { useEffect, useState } from 'react';
import {
    ShoppingBag, Plus, X, Search, RefreshCw, Building2,
    Clock, CheckCircle2, Truck, XCircle, Package, Trash2,
    ChevronRight, Star, Edit2, AlertTriangle
} from 'lucide-react';
import { apiRequest } from '../services/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    pending: { label: 'Beklemede', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
    approved: { label: 'Onaylandı', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: CheckCircle2 },
    ordered: { label: 'Sipariş Verildi', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Truck },
    received: { label: 'Teslim Alındı', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
    cancelled: { label: 'İptal', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    low: { label: 'Düşük', color: 'text-muted-foreground' },
    normal: { label: 'Normal', color: 'text-blue-400' },
    high: { label: 'Yüksek', color: 'text-amber-400' },
    urgent: { label: '🚨 Acil', color: 'text-red-400' },
};

interface PR {
    id: number; pr_number: string; part_id: number; part_name: string; part_code: string; unit: string;
    supplier_id: number; supplier_name: string; quantity: number; received_quantity: number;
    unit_price: number; currency: string; status: string; priority: string;
    needed_by_date: string; expected_delivery_date: string; po_number: string;
    notes: string; created_by_name: string; approved_by_name: string; rejection_reason: string;
    created_at: string;
}

interface Supplier { id: number; name: string; code: string; status: string; rating: number; city: string; category: string; }

export default function Procurement() {
    const [tab, setTab] = useState<'requests' | 'suppliers'>('requests');
    const [requests, setRequests] = useState<PR[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedPR, setSelectedPR] = useState<PR | null>(null);

    // PR Form
    const [showPRForm, setShowPRForm] = useState(false);
    const [prForm, setPrForm] = useState({ part_id: '', supplier_id: '', quantity: 1, unit_price: '', priority: 'normal', needed_by_date: '', notes: '' });

    // Supplier Form
    const [showSupplierForm, setShowSupplierForm] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [supplierForm, setSupplierForm] = useState({ name: '', code: '', contact_person: '', phone: '', email: '', city: '', category: '', notes: '' });

    // Update PR Modal (PO number, delivery dates, received qty)
    const [showUpdatePR, setShowUpdatePR] = useState(false);
    const [updateForm, setUpdateForm] = useState({ status: '', po_number: '', expected_delivery_date: '', received_quantity: '', notes: '', rejection_reason: '' });

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [r, s, p, st] = await Promise.all([
                apiRequest('/procurement'),
                apiRequest('/procurement/suppliers'),
                apiRequest('/parts'),
                apiRequest('/procurement/stats/summary'),
            ]);
            setRequests(Array.isArray(r) ? r : []);
            setSuppliers(Array.isArray(s) ? s : []);
            setParts(Array.isArray(p) ? p : []);
            setStats(st);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleCreatePR = async () => {
        if (!prForm.part_id) return;
        await apiRequest('/procurement', 'POST', {
            part_id: parseInt(prForm.part_id),
            supplier_id: prForm.supplier_id ? parseInt(prForm.supplier_id) : undefined,
            quantity: prForm.quantity,
            unit_price: prForm.unit_price ? parseFloat(prForm.unit_price) : undefined,
            priority: prForm.priority,
            needed_by_date: prForm.needed_by_date || undefined,
            notes: prForm.notes || undefined,
        });
        setShowPRForm(false);
        setPrForm({ part_id: '', supplier_id: '', quantity: 1, unit_price: '', priority: 'normal', needed_by_date: '', notes: '' });
        loadAll();
    };

    const handleUpdatePR = async () => {
        if (!selectedPR) return;
        await apiRequest(`/procurement/${selectedPR.id}`, 'PUT', {
            status: updateForm.status || undefined,
            po_number: updateForm.po_number || undefined,
            expected_delivery_date: updateForm.expected_delivery_date || undefined,
            received_quantity: updateForm.received_quantity ? parseInt(updateForm.received_quantity) : undefined,
            notes: updateForm.notes || undefined,
            rejection_reason: updateForm.rejection_reason || undefined,
        });
        setShowUpdatePR(false);
        loadAll();
    };

    const handleDeletePR = async (id: number) => {
        if (confirm('Bu talebi silmek istediğinize emin misiniz?')) {
            await apiRequest(`/procurement/${id}`, 'DELETE');
            loadAll();
        }
    };

    const openUpdateModal = (pr: PR) => {
        setSelectedPR(pr);
        setUpdateForm({ status: pr.status, po_number: pr.po_number || '', expected_delivery_date: pr.expected_delivery_date || '', received_quantity: String(pr.quantity), notes: pr.notes || '', rejection_reason: pr.rejection_reason || '' });
        setShowUpdatePR(true);
    };

    const handleCreateSupplier = async () => {
        if (!supplierForm.name) return;
        if (editingSupplier) {
            await apiRequest(`/procurement/suppliers/${editingSupplier.id}`, 'PUT', supplierForm);
        } else {
            await apiRequest('/procurement/suppliers', 'POST', supplierForm);
        }
        setShowSupplierForm(false);
        setEditingSupplier(null);
        setSupplierForm({ name: '', code: '', contact_person: '', phone: '', email: '', city: '', category: '', notes: '' });
        loadAll();
    };

    const startEditSupplier = (s: Supplier) => {
        setEditingSupplier(s);
        setSupplierForm({ name: s.name, code: s.code || '', contact_person: (s as any).contact_person || '', phone: (s as any).phone || '', email: (s as any).email || '', city: s.city || '', category: s.category || '', notes: (s as any).notes || '' });
        setShowSupplierForm(true);
    };

    const handleDeleteSupplier = async (id: number) => {
        if (confirm('Tedarikçiyi silmek istediğinize emin misiniz?')) {
            await apiRequest(`/procurement/suppliers/${id}`, 'DELETE');
            loadAll();
        }
    };

    const filteredRequests = requests.filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return r.pr_number?.toLowerCase().includes(q) || r.part_name?.toLowerCase().includes(q) || (r.supplier_name || '').toLowerCase().includes(q);
        }
        return true;
    });

    const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50";
    const lbl = "block text-xs font-semibold text-muted-foreground uppercase mb-1";

    return (
        <div className="p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <ShoppingBag className="w-6 h-6 text-orange-400" /> Satın Alma & Tedarik
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{requests.length} talep • {suppliers.length} tedarikçi</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadAll} className={`p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground ${loading ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
                    {tab === 'requests' ? (
                        <button onClick={() => setShowPRForm(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-medium hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/20">
                            <Plus className="w-4 h-4" /> Yeni Talep
                        </button>
                    ) : (
                        <button onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', code: '', contact_person: '', phone: '', email: '', city: '', category: '', notes: '' }); setShowSupplierForm(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-sm font-medium hover:from-blue-600 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/20">
                            <Plus className="w-4 h-4" /> Yeni Tedarikçi
                        </button>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            {stats && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                        { label: 'Toplam Talep', value: stats.total, color: 'text-foreground', icon: Package },
                        { label: 'Bekleyen', value: stats.pending, color: 'text-amber-400', icon: Clock },
                        { label: 'Siparişte', value: stats.ordered, color: 'text-purple-400', icon: Truck },
                        { label: 'Toplam Tutar', value: stats.total_value > 0 ? `₺${stats.total_value.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}` : '—', color: 'text-emerald-400', icon: ShoppingBag },
                    ].map(({ label, value, color, icon: Icon }) => (
                        <div key={label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex items-center gap-3">
                            <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                            <div>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className={`text-lg font-bold ${color}`}>{value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/5">
                {[{ id: 'requests', label: 'Satın Alma Talepleri' }, { id: 'suppliers', label: 'Tedarikçiler' }].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id as any)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* REQUESTS TAB */}
            {tab === 'requests' && (
                <>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Talep no, parça, tedarikçi..."
                                className="w-full h-9 rounded-xl bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
                        </div>
                        <div className="flex items-center gap-1">
                            {['all', 'pending', 'approved', 'ordered', 'received', 'cancelled'].map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-orange-500/20 text-orange-400' : 'text-muted-foreground hover:bg-white/5'}`}>
                                    {s === 'all' ? 'Tümü' : STATUS_CONFIG[s]?.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-white/[0.02]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase">
                                    <th className="text-left px-4 py-3">Talep No</th>
                                    <th className="text-left px-4 py-3">Parça</th>
                                    <th className="text-left px-4 py-3">Tedarikçi</th>
                                    <th className="text-right px-4 py-3">Miktar</th>
                                    <th className="text-right px-4 py-3">Birim Fiyat</th>
                                    <th className="text-center px-4 py-3">Öncelik</th>
                                    <th className="text-center px-4 py-3">Durum</th>
                                    <th className="text-left px-4 py-3">Gerekli T.</th>
                                    <th className="text-right px-4 py-3">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRequests.map(r => {
                                    const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                                    const pc = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG.normal;
                                    const StatusIcon = sc.icon;
                                    return (
                                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{r.pr_number}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">{r.part_name}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono">{r.part_code}</div>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">{r.supplier_name || '—'}</td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {r.status === 'received' && r.received_quantity ? (
                                                    <span>{r.received_quantity} <span className="text-muted-foreground text-[10px]">/ {r.quantity}</span></span>
                                                ) : r.quantity} <span className="text-[10px] text-muted-foreground">{r.unit}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                                {r.unit_price ? `${parseFloat(String(r.unit_price)).toFixed(2)} ${r.currency}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-xs font-medium ${pc.color}`}>{pc.label}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${sc.color} ${sc.bg}`}>
                                                    <StatusIcon className="w-3 h-3" /> {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {r.needed_by_date ? new Date(r.needed_by_date).toLocaleDateString('tr-TR') : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openUpdateModal(r)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-400 transition-colors">
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </button>
                                                    {!['ordered', 'received'].includes(r.status) && (
                                                        <button onClick={() => handleDeletePR(r.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredRequests.length === 0 && (
                                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">Talep bulunamadı</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* SUPPLIERS TAB */}
            {tab === 'suppliers' && (
                <div className="flex-1 overflow-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suppliers.map(s => (
                            <div key={s.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:border-white/10 transition-colors group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditSupplier(s)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteSupplier(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="font-semibold text-foreground">{s.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {s.code && <span className="text-[10px] font-mono text-muted-foreground">{s.code}</span>}
                                    {s.city && <span className="text-[10px] text-muted-foreground">📍 {s.city}</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    {s.category && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">{s.category}</span>}
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-400'
                                            : s.status === 'blacklisted' ? 'bg-red-500/10 text-red-400'
                                                : 'bg-white/5 text-muted-foreground'
                                        }`}>{s.status === 'active' ? 'Aktif' : s.status === 'blacklisted' ? 'Kara Liste' : 'Pasif'}</span>
                                </div>
                                {s.rating > 0 && (
                                    <div className="flex items-center gap-1 mt-2">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <Star key={i} className={`w-3 h-3 ${i <= s.rating ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {suppliers.length === 0 && (
                            <div className="col-span-3 text-center py-16 text-muted-foreground">
                                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Henüz tedarikçi eklenmedi</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* New PR Modal */}
            {showPRForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Yeni Satın Alma Talebi</h3>
                            <button onClick={() => setShowPRForm(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className={lbl}>Parça *</label>
                                <select value={prForm.part_id} onChange={e => setPrForm({ ...prForm, part_id: e.target.value })} className={inp}>
                                    <option value="">Parça Seçin</option>
                                    {parts.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Miktar</label>
                                    <input type="number" min={1} value={prForm.quantity} onChange={e => setPrForm({ ...prForm, quantity: parseInt(e.target.value) || 1 })} className={inp} />
                                </div>
                                <div>
                                    <label className={lbl}>Birim Fiyat (₺)</label>
                                    <input type="number" step="0.01" value={prForm.unit_price} onChange={e => setPrForm({ ...prForm, unit_price: e.target.value })} className={inp} placeholder="0.00" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Tedarikçi</label>
                                    <select value={prForm.supplier_id} onChange={e => setPrForm({ ...prForm, supplier_id: e.target.value })} className={inp}>
                                        <option value="">Opsiyonel</option>
                                        {suppliers.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>Öncelik</label>
                                    <select value={prForm.priority} onChange={e => setPrForm({ ...prForm, priority: e.target.value })} className={inp}>
                                        <option value="low">Düşük</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">Yüksek</option>
                                        <option value="urgent">Acil</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>Gerekli Tarih</label>
                                <input type="date" value={prForm.needed_by_date} onChange={e => setPrForm({ ...prForm, needed_by_date: e.target.value })} className={inp} />
                            </div>
                            <div>
                                <label className={lbl}>Notlar</label>
                                <textarea value={prForm.notes} onChange={e => setPrForm({ ...prForm, notes: e.target.value })} className={`${inp} resize-none h-16`} />
                            </div>
                        </div>
                        <button onClick={handleCreatePR} disabled={!prForm.part_id}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                            Talep Oluştur
                        </button>
                    </div>
                </div>
            )}

            {/* Update PR Modal */}
            {showUpdatePR && selectedPR && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-semibold">Talep Güncelle</h3>
                            <button onClick={() => setShowUpdatePR(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4 font-mono">{selectedPR.pr_number} — {selectedPR.part_name}</p>
                        <div className="space-y-3">
                            <div>
                                <label className={lbl}>Durum</label>
                                <select value={updateForm.status} onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })} className={`${inp} focus:ring-blue-500/50`}>
                                    <option value="pending">Beklemede</option>
                                    <option value="approved">Onaylandı</option>
                                    <option value="ordered">Sipariş Verildi</option>
                                    <option value="received">Teslim Alındı</option>
                                    <option value="cancelled">İptal</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>PO Numarası</label>
                                <input value={updateForm.po_number} onChange={e => setUpdateForm({ ...updateForm, po_number: e.target.value })} className={`${inp} focus:ring-blue-500/50`} placeholder="PO-2026-001" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Beklenen Teslim</label>
                                    <input type="date" value={updateForm.expected_delivery_date} onChange={e => setUpdateForm({ ...updateForm, expected_delivery_date: e.target.value })} className={`${inp} focus:ring-blue-500/50`} />
                                </div>
                                <div>
                                    <label className={lbl}>Alınan Miktar</label>
                                    <input type="number" value={updateForm.received_quantity} onChange={e => setUpdateForm({ ...updateForm, received_quantity: e.target.value })} className={`${inp} focus:ring-blue-500/50`} />
                                </div>
                            </div>
                            {updateForm.status === 'cancelled' && (
                                <div>
                                    <label className={lbl}>İptal Nedeni</label>
                                    <input value={updateForm.rejection_reason} onChange={e => setUpdateForm({ ...updateForm, rejection_reason: e.target.value })} className={`${inp} focus:ring-blue-500/50`} />
                                </div>
                            )}
                            {updateForm.status === 'received' && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>Teslim alındı olarak kaydedildiğinde stok otomatik olarak artırılacaktır.</span>
                                </div>
                            )}
                            <div>
                                <label className={lbl}>Not</label>
                                <textarea value={updateForm.notes} onChange={e => setUpdateForm({ ...updateForm, notes: e.target.value })} className={`${inp} resize-none h-14 focus:ring-blue-500/50`} />
                            </div>
                        </div>
                        <button onClick={handleUpdatePR}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-2.5 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 transition-all">
                            Güncelle
                        </button>
                    </div>
                </div>
            )}

            {/* Supplier Modal */}
            {showSupplierForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingSupplier ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}</h3>
                            <button onClick={() => setShowSupplierForm(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Firma Adı *</label>
                                    <input value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className={`${inp} focus:ring-blue-500/50`} /></div>
                                <div><label className={lbl}>Kod</label>
                                    <input value={supplierForm.code} onChange={e => setSupplierForm({ ...supplierForm, code: e.target.value })} className={`${inp} focus:ring-blue-500/50`} placeholder="TED-001" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>İletişim Kişisi</label>
                                    <input value={supplierForm.contact_person} onChange={e => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} className={`${inp} focus:ring-blue-500/50`} /></div>
                                <div><label className={lbl}>Telefon</label>
                                    <input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} className={`${inp} focus:ring-blue-500/50`} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>E-posta</label>
                                    <input type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} className={`${inp} focus:ring-blue-500/50`} /></div>
                                <div><label className={lbl}>Şehir</label>
                                    <input value={supplierForm.city} onChange={e => setSupplierForm({ ...supplierForm, city: e.target.value })} className={`${inp} focus:ring-blue-500/50`} placeholder="Ankara" /></div>
                            </div>
                            <div><label className={lbl}>Kategori</label>
                                <select value={supplierForm.category} onChange={e => setSupplierForm({ ...supplierForm, category: e.target.value })} className={`${inp} focus:ring-blue-500/50`}>
                                    <option value="">Seçiniz</option>
                                    <option>Hammadde</option><option>Makine Parçası</option>
                                    <option>Kimyasal</option><option>Yaylar & Plastik</option>
                                    <option>Elektronik</option><option>Ambalaj</option><option>Diğer</option>
                                </select></div>
                            <div><label className={lbl}>Notlar</label>
                                <textarea value={supplierForm.notes} onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })} className={`${inp} resize-none h-14 focus:ring-blue-500/50`} /></div>
                        </div>
                        <button onClick={handleCreateSupplier} disabled={!supplierForm.name}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                            {editingSupplier ? 'Güncelle' : 'Kaydet'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
