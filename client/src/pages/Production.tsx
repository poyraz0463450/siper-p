import { useEffect, useState } from 'react';
import {
    ClipboardList, Plus, X, RefreshCw, Search, Clock, CheckCircle,
    AlertTriangle, RotateCcw, ArrowRight, Trash2, Edit2
} from 'lucide-react';
import {
    getAllOrders, createOrder, updateOrder, deleteOrder as deleteOrderFn,
    onOrdersSnapshot, getAllModels
} from '../lib/firestoreService';
import type { ProductionOrder, Model, OrderStatus, OrderPriority } from '../lib/types';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    planned: { label: 'Planlandı', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    pending_approval: { label: 'Onay Bekliyor', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    in_progress: { label: 'Üretimde', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
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

const KANBAN_STATUSES: OrderStatus[] = ['planned', 'pending_approval', 'in_progress', 'quality_check', 'completed'];

export default function Production() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<ProductionOrder[]>([]);
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [searchQuery, setSearchQuery] = useState('');

    // Form
    const [form, setForm] = useState({
        modelId: '', quantity: 1, priority: 'normal' as OrderPriority, notes: '',
    });

    useEffect(() => {
        const unsub = onOrdersSnapshot((o) => {
            setOrders(o);
            setLoading(false);
        });
        getAllModels().then(setModels);
        return () => unsub();
    }, []);

    const handleSave = async () => {
        if (!form.modelId) return;
        const model = models.find(m => m.id === form.modelId);
        if (editingOrder) {
            await updateOrder(editingOrder.id, {
                ...form, modelName: model?.name || '',
            });
        } else {
            await createOrder({
                ...form, modelName: model?.name || '', modelId: form.modelId,
                orderCode: '', status: 'planned',
            });
        }
        resetForm();
    };

    const handleStatusChange = async (id: string, status: OrderStatus) => {
        const updates: Partial<ProductionOrder> = { status };
        if (status === 'in_progress') updates.startedAt = new Date();
        if (status === 'completed') updates.completedAt = new Date();
        await updateOrder(id, updates);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bu emri silmek istediğinize emin misiniz?')) {
            await deleteOrderFn(id);
        }
    };

    const startEdit = (o: ProductionOrder) => {
        setEditingOrder(o);
        setForm({ modelId: o.modelId, quantity: o.quantity, priority: o.priority, notes: o.notes || '' });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false); setEditingOrder(null);
        setForm({ modelId: '', quantity: 1, priority: 'normal', notes: '' });
    };

    const filtered = searchQuery
        ? orders.filter(o => o.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) || o.modelName.toLowerCase().includes(searchQuery.toLowerCase()))
        : orders;

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-blue-400" />
                        Üretim Emirleri
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

            {/* Search */}
            <div className="mb-4">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Emir kodu veya model ara..."
                        className="w-full h-10 rounded-xl bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                </div>
            </div>

            {/* KANBAN VIEW */}
            {viewMode === 'kanban' ? (
                <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
                    {KANBAN_STATUSES.map(status => {
                        const config = STATUS_CONFIG[status];
                        const colOrders = filtered.filter(o => o.status === status);
                        return (
                            <div key={status} className="w-64 flex-shrink-0 flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                                    <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                                    <span className="text-[10px] text-muted-foreground">{colOrders.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {colOrders.map(o => (
                                        <div key={o.id} className="rounded-xl bg-white/[0.03] border border-white/5 p-3 hover:bg-white/[0.06] transition-colors cursor-pointer group">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono font-bold text-foreground">{o.orderCode}</span>
                                                <span className={`text-[10px] font-bold ${PRIORITY_CONFIG[o.priority]?.color || ''}`}>
                                                    {PRIORITY_CONFIG[o.priority]?.label}
                                                </span>
                                            </div>
                                            <div className="text-sm font-medium text-foreground mb-1">{o.modelName}</div>
                                            <div className="text-xs text-muted-foreground">Adet: {o.quantity}</div>
                                            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {status !== 'completed' && (
                                                    <button
                                                        onClick={() => handleStatusChange(o.id, KANBAN_STATUSES[KANBAN_STATUSES.indexOf(status) + 1])}
                                                        className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                                    >
                                                        İlerle →
                                                    </button>
                                                )}
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
                /* LIST VIEW */
                <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-white/[0.02]">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wider">
                                <th className="text-left px-4 py-3">Emir Kodu</th>
                                <th className="text-left px-4 py-3">Model</th>
                                <th className="text-right px-4 py-3">Adet</th>
                                <th className="text-center px-4 py-3">Öncelik</th>
                                <th className="text-center px-4 py-3">Durum</th>
                                <th className="text-right px-4 py-3">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(o => {
                                const sc = STATUS_CONFIG[o.status];
                                return (
                                    <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{o.orderCode}</td>
                                        <td className="px-4 py-3 font-medium text-foreground">{o.modelName}</td>
                                        <td className="px-4 py-3 text-right font-mono">{o.quantity}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs font-bold ${PRIORITY_CONFIG[o.priority]?.color}`}>{PRIORITY_CONFIG[o.priority]?.label}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs px-2 py-1 rounded-full ${sc.color} ${sc.bg}`}>{sc.label}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
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

            {/* Form */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingOrder ? 'Emir Düzenle' : 'Yeni Üretim Emri'}</h3>
                            <button onClick={resetForm} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Model</label>
                                <select value={form.modelId} onChange={e => setForm({ ...form, modelId: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50">
                                    <option value="">Model Seçin</option>
                                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Adet</label>
                                    <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Öncelik</label>
                                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as OrderPriority })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50">
                                        <option value="low">Düşük</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">Yüksek</option>
                                        <option value="urgent">Acil</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Notlar</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                            </div>
                        </div>
                        <button onClick={handleSave} disabled={!form.modelId}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-blue-600 hover:to-indigo-700 transition-all">
                            {editingOrder ? 'Güncelle' : 'Oluştur'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
