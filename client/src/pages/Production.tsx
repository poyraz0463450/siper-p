import { useEffect, useState } from 'react';
import {
    ClipboardList, Plus, X, Search, Trash2, Edit2,
    ChevronRight, Package, AlertTriangle, CheckCircle, Clock, BarChart3
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { fetchOrderDetail, changeOrderStatus, fetchProductionStats } from '../lib/firestoreService';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Taslak', color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
    pending_approval: { label: 'Onay Bekliyor', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    approved: { label: 'Onaylı', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    in_production: { label: 'Üretimde', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    quality_check: { label: 'Kalite Kontrol', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    completed: { label: 'Tamamlandı', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    cancelled: { label: 'İptal', color: 'text-red-400', bg: 'bg-red-500/10' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    low: { label: 'Düşük', color: 'text-gray-400' },
    normal: { label: 'Normal', color: 'text-blue-400' },
    high: { label: 'Yüksek', color: 'text-amber-400' },
    urgent: { label: 'Acil', color: 'text-red-400' },
};

const KANBAN_STATUSES = ['draft', 'pending_approval', 'approved', 'in_production', 'quality_check', 'completed'];

interface OrderItem {
    id: number; order_number: string; model_id: number; model_name: string;
    model_code: string; caliber: string; quantity: number; status: string;
    priority: string; notes: string; planned_start_date: string;
    planned_end_date: string; customer_name: string; customer_order_ref: string;
    created_by_name: string; approved_by_name: string; created_at: string;
    completed_quantity: number; rejected_quantity: number;
}

export default function Production() {
    const { user: _user } = useAuth();
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [_loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [_stats, setStats] = useState<any>(null);

    const defaultForm = {
        model_id: '', quantity: 1, priority: 'normal', notes: '',
        planned_start_date: '', planned_end_date: '',
        customer_name: '', customer_order_ref: '',
    };
    const [form, setForm] = useState<any>(defaultForm);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [o, m, s] = await Promise.all([
                apiRequest('/production-orders'),
                apiRequest('/models'),
                fetchProductionStats().catch(() => null),
            ]);
            setOrders(Array.isArray(o) ? o : []);
            setModels(Array.isArray(m) ? m : []);
            setStats(s);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        if (!form.model_id) return;
        const payload = { ...form, model_id: parseInt(form.model_id), quantity: parseInt(form.quantity) || 1 };
        if (editingOrder) {
            await apiRequest(`/production-orders/${editingOrder.id}`, 'PUT', payload);
        } else {
            await apiRequest('/production-orders', 'POST', payload);
        }
        resetForm(); loadAll();
    };

    const handleStatusChange = async (id: number, newStatus: string) => {
        await changeOrderStatus(id, newStatus);
        loadAll();
    };

    const handleDelete = async (id: number) => {
        if (confirm('Bu emri silmek istediğinize emin misiniz?')) {
            await apiRequest(`/production-orders/${id}`, 'DELETE');
            loadAll();
        }
    };

    const startEdit = (o: OrderItem) => {
        setEditingOrder(o);
        setForm({
            model_id: o.model_id, quantity: o.quantity, priority: o.priority, notes: o.notes || '',
            planned_start_date: o.planned_start_date || '', planned_end_date: o.planned_end_date || '',
            customer_name: o.customer_name || '', customer_order_ref: o.customer_order_ref || '',
        });
        setShowForm(true);
    };

    const loadOrderDetail = async (o: OrderItem) => {
        try {
            const detail = await fetchOrderDetail(o.id);
            setSelectedOrder(detail);
        } catch (err) { console.error(err); }
    };

    const resetForm = () => { setShowForm(false); setEditingOrder(null); setForm(defaultForm); };

    const filtered = searchQuery
        ? orders.filter(o => (o.order_number || '').toLowerCase().includes(searchQuery.toLowerCase()) || (o.model_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
        : orders;

    // KPI calculations
    const totalOrders = orders.length;
    const inProduction = orders.filter(o => o.status === 'in_production').length;
    const pendingOrders = orders.filter(o => ['draft', 'pending_approval', 'approved'].includes(o.status)).length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;

    const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50";
    const lbl = "block text-xs font-semibold text-muted-foreground uppercase mb-1";

    return (
        <div className="p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-blue-400" /> Üretim Emirleri
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{orders.length} emir</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-xl bg-white/5 border border-white/5 overflow-hidden">
                        <button onClick={() => setViewMode('kanban')} className={`px-3 py-2 text-xs font-medium ${viewMode === 'kanban' ? 'bg-blue-500/10 text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}>Kanban</button>
                        <button onClick={() => setViewMode('list')} className={`px-3 py-2 text-xs font-medium ${viewMode === 'list' ? 'bg-blue-500/10 text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}>Liste</button>
                    </div>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20">
                        <Plus className="w-4 h-4" /> Yeni Emir
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                    { icon: <BarChart3 className="w-4 h-4" />, label: 'Toplam Emir', value: totalOrders, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { icon: <Clock className="w-4 h-4" />, label: 'Bekleyen', value: pendingOrders, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { icon: <Package className="w-4 h-4" />, label: 'Üretimde', value: inProduction, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { icon: <CheckCircle className="w-4 h-4" />, label: 'Tamamlanan', value: completedOrders, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map((kpi, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className={`p-2 rounded-lg ${kpi.bg}`}><span className={kpi.color}>{kpi.icon}</span></div>
                        <div>
                            <div className="text-xl font-bold text-foreground">{kpi.value}</div>
                            <div className="text-xs text-muted-foreground">{kpi.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="mb-4">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Emir no, model adı veya müşteri ara..."
                        className="w-full h-10 rounded-xl bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Left: Kanban / List */}
                <div className={`flex-1 overflow-auto ${selectedOrder ? 'max-w-[60%]' : ''}`}>
                    {viewMode === 'kanban' ? (
                        <div className="flex gap-3 overflow-x-auto pb-2 h-full">
                            {KANBAN_STATUSES.map(status => {
                                const config = STATUS_CONFIG[status];
                                const colOrders = filtered.filter(o => o.status === status);
                                return (
                                    <div key={status} className="w-56 flex-shrink-0 flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                                        <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
                                            <span className={`text-xs font-semibold ${config?.color}`}>{config?.label}</span>
                                            <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{colOrders.length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            {colOrders.map(o => (
                                                <div key={o.id} onClick={() => loadOrderDetail(o)}
                                                    className={`rounded-xl bg-white/[0.03] border border-white/5 p-3 hover:bg-white/[0.06] transition-colors cursor-pointer group ${selectedOrder?.id === o.id ? 'ring-1 ring-blue-500/30' : ''}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-mono font-bold text-foreground">{o.order_number}</span>
                                                        <span className={`text-[10px] font-bold ${PRIORITY_CONFIG[o.priority]?.color || ''}`}>
                                                            {PRIORITY_CONFIG[o.priority]?.label}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs font-medium text-foreground mb-0.5">{o.model_name}</div>
                                                    <div className="text-[10px] text-muted-foreground">{o.quantity} adet</div>
                                                    {o.customer_name && <div className="text-[10px] text-muted-foreground mt-0.5">👤 {o.customer_name}</div>}
                                                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => startEdit(o)} className="p-1 rounded hover:bg-white/10 text-muted-foreground"><Edit2 className="w-3 h-3" /></button>
                                                        <button onClick={() => handleDelete(o.id)} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="overflow-auto rounded-2xl border border-white/5 bg-white/[0.02] h-full">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wider sticky top-0 bg-[#141821]">
                                        <th className="text-left px-4 py-3">Emir No</th>
                                        <th className="text-left px-4 py-3">Model</th>
                                        <th className="text-right px-4 py-3">Adet</th>
                                        <th className="text-left px-4 py-3">Müşteri</th>
                                        <th className="text-center px-4 py-3">Öncelik</th>
                                        <th className="text-center px-4 py-3">Durum</th>
                                        <th className="text-left px-4 py-3">Tarih</th>
                                        <th className="text-right px-4 py-3">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(o => {
                                        const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.draft;
                                        return (
                                            <tr key={o.id} onClick={() => loadOrderDetail(o)}
                                                className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer ${selectedOrder?.id === o.id ? 'bg-blue-500/[0.06]' : ''}`}>
                                                <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{o.order_number}</td>
                                                <td className="px-4 py-3 font-medium text-foreground">{o.model_name}</td>
                                                <td className="px-4 py-3 text-right font-mono">{o.quantity}</td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">{o.customer_name || '—'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-xs font-bold ${PRIORITY_CONFIG[o.priority]?.color}`}>{PRIORITY_CONFIG[o.priority]?.label}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-xs px-2 py-1 rounded-full ${sc.color} ${sc.bg}`}>{sc.label}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleDateString('tr-TR') : '—'}</td>
                                                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={() => startEdit(o)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleDelete(o.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right: Detail Panel */}
                {selectedOrder && (
                    <div className="w-[40%] flex-shrink-0 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">{selectedOrder.order_number}</h2>
                            <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_CONFIG[selectedOrder.status]?.color} ${STATUS_CONFIG[selectedOrder.status]?.bg}`}>
                                {STATUS_CONFIG[selectedOrder.status]?.label}
                            </span>
                            <span className={`text-xs font-bold ${PRIORITY_CONFIG[selectedOrder.priority]?.color}`}>
                                {PRIORITY_CONFIG[selectedOrder.priority]?.label}
                            </span>
                        </div>

                        {/* Quick Info */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Model:</span> <span className="text-foreground font-medium">{selectedOrder.model_name}</span></div>
                            <div><span className="text-muted-foreground">Adet:</span> <span className="text-foreground font-bold">{selectedOrder.quantity}</span></div>
                            {selectedOrder.customer_name && <div><span className="text-muted-foreground">Müşteri:</span> <span className="text-foreground">{selectedOrder.customer_name}</span></div>}
                            {selectedOrder.customer_order_ref && <div><span className="text-muted-foreground">Ref:</span> <span className="text-foreground font-mono">{selectedOrder.customer_order_ref}</span></div>}
                            {selectedOrder.created_by_name && <div><span className="text-muted-foreground">Oluşturan:</span> <span className="text-foreground">{selectedOrder.created_by_name}</span></div>}
                            {selectedOrder.approved_by_name && <div><span className="text-muted-foreground">Onaylayan:</span> <span className="text-foreground">{selectedOrder.approved_by_name}</span></div>}
                        </div>

                        {/* Status Transitions (State Machine) */}
                        {selectedOrder.allowed_status_transitions?.length > 0 && (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5" /> Durum Değiştir</h3>
                                <div className="flex flex-wrap gap-2">
                                    {selectedOrder.allowed_status_transitions.map((s: string) => {
                                        const sc = STATUS_CONFIG[s] || { label: s, color: 'text-foreground', bg: 'bg-white/5' };
                                        return (
                                            <button key={s} onClick={() => { handleStatusChange(selectedOrder.id, s); setSelectedOrder(null); }}
                                                className={`text-xs px-3 py-1.5 rounded-lg font-medium border border-white/10 ${sc.color} hover:bg-white/[0.05] transition-colors`}>
                                                {sc.label} →
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Material Check (Parts Analysis) */}
                        {selectedOrder.parts?.length > 0 && (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Malzeme Kontrolü</h3>
                                <div className="space-y-2">
                                    {selectedOrder.parts.map((p: any) => {
                                        const shortage = p.required_quantity - p.available_quantity;
                                        const isShort = shortage > 0;
                                        return (
                                            <div key={p.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs ${isShort ? 'bg-red-500/[0.05] border border-red-500/10' : 'bg-white/[0.02] border border-white/5'}`}>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-foreground truncate">{p.part_name}</div>
                                                    <div className="text-muted-foreground font-mono">{p.part_code}</div>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <div className="text-right">
                                                        <div className="text-muted-foreground">Gerekli</div>
                                                        <div className="font-bold text-foreground">{p.required_quantity}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-muted-foreground">Mevcut</div>
                                                        <div className={`font-bold ${isShort ? 'text-red-400' : 'text-emerald-400'}`}>{p.available_quantity}</div>
                                                    </div>
                                                    {isShort && (
                                                        <div className="flex items-center gap-1 text-red-400">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            <span className="font-bold">-{shortage}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* New/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingOrder ? 'Emir Düzenle' : 'Yeni Üretim Emri'}</h3>
                            <button onClick={resetForm} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className={lbl}>Model *</label>
                                <select value={form.model_id} onChange={e => setForm({ ...form, model_id: e.target.value })} className={inp}>
                                    <option value="">Model Seçin</option>
                                    {models.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Adet *</label>
                                    <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className={inp} /></div>
                                <div><label className={lbl}>Öncelik</label>
                                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={inp}>
                                        <option value="low">Düşük</option><option value="normal">Normal</option>
                                        <option value="high">Yüksek</option><option value="urgent">Acil</option>
                                    </select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Müşteri Adı</label>
                                    <input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className={inp} /></div>
                                <div><label className={lbl}>Müşteri Sipariş Ref</label>
                                    <input value={form.customer_order_ref} onChange={e => setForm({ ...form, customer_order_ref: e.target.value })} className={inp} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Planlanan Başlangıç</label>
                                    <input type="date" value={form.planned_start_date} onChange={e => setForm({ ...form, planned_start_date: e.target.value })} className={inp} /></div>
                                <div><label className={lbl}>Planlanan Bitiş</label>
                                    <input type="date" value={form.planned_end_date} onChange={e => setForm({ ...form, planned_end_date: e.target.value })} className={inp} /></div>
                            </div>
                            <div><label className={lbl}>Notlar</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                    className={`${inp} resize-none h-16`} /></div>
                        </div>
                        <button onClick={handleSave} disabled={!form.model_id}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-blue-600 hover:to-indigo-700 transition-all">
                            {editingOrder ? 'Güncelle' : 'Oluştur'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
