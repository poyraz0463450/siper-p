import { useEffect, useState } from 'react';
import { ShoppingBag, Plus, X, Search, RefreshCw } from 'lucide-react';
import {
    getAllPurchaseRequests, createPurchaseRequest, updatePurchaseRequest,
    getAllSuppliers, getAllParts
} from '../lib/firestoreService';
import type { PurchaseRequest, Supplier, Part, PRStatus } from '../lib/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Beklemede', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    approved: { label: 'Onaylandı', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    ordered: { label: 'Sipariş Verildi', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    received: { label: 'Teslim Alındı', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    cancelled: { label: 'İptal', color: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function Procurement() {
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [parts, setParts] = useState<Part[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [form, setForm] = useState({
        partId: '', quantity: 1, supplierId: '', unitPrice: 0, notes: '',
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [r, s, p] = await Promise.all([
            getAllPurchaseRequests(), getAllSuppliers(), getAllParts()
        ]);
        setRequests(r); setSuppliers(s); setParts(p);
        setLoading(false);
    };

    const handleCreate = async () => {
        const part = parts.find(p => p.id === form.partId);
        const supplier = suppliers.find(s => s.id === form.supplierId);
        await createPurchaseRequest({
            prCode: '',
            partId: form.partId,
            partName: part?.name || '',
            quantity: form.quantity,
            status: 'pending',
            supplierId: form.supplierId || undefined,
            supplierName: supplier?.name || undefined,
            unitPrice: form.unitPrice || undefined,
            notes: form.notes || undefined,
        });
        setShowForm(false);
        setForm({ partId: '', quantity: 1, supplierId: '', unitPrice: 0, notes: '' });
        loadData();
    };

    const handleStatusChange = async (id: string, status: PRStatus) => {
        await updatePurchaseRequest(id, { status });
        loadData();
    };

    const filtered = searchQuery
        ? requests.filter(r => r.prCode.toLowerCase().includes(searchQuery.toLowerCase()) || r.partName.toLowerCase().includes(searchQuery.toLowerCase()))
        : requests;

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <ShoppingBag className="w-6 h-6 text-orange-400" />
                        Satın Alma
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{requests.length} talep</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadData} className={`p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground ${loading ? 'animate-spin' : ''}`}><RefreshCw className="w-4 h-4" /></button>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-medium hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/20">
                        <Plus className="w-4 h-4" /> Yeni Talep
                    </button>
                </div>
            </div>

            <div className="relative max-w-sm mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Talep kodu veya parça ara..."
                    className="w-full h-10 rounded-xl bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
            </div>

            <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-white/[0.02]">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Talep Kodu</th>
                            <th className="text-left px-4 py-3">Parça</th>
                            <th className="text-right px-4 py-3">Miktar</th>
                            <th className="text-left px-4 py-3">Tedarikçi</th>
                            <th className="text-right px-4 py-3">Birim Fiyat</th>
                            <th className="text-center px-4 py-3">Durum</th>
                            <th className="text-right px-4 py-3">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(r => {
                            const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                            return (
                                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{r.prCode}</td>
                                    <td className="px-4 py-3 font-medium text-foreground">{r.partName}</td>
                                    <td className="px-4 py-3 text-right font-mono">{r.quantity}</td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.supplierName || '—'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs">{r.unitPrice ? `${r.unitPrice} TL` : '—'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <select
                                            value={r.status}
                                            onChange={e => handleStatusChange(r.id, e.target.value as PRStatus)}
                                            className={`text-xs px-2 py-1 rounded-full border-0 ${sc.color} ${sc.bg} bg-opacity-100 focus:outline-none cursor-pointer`}
                                        >
                                            <option value="pending">Beklemede</option>
                                            <option value="approved">Onaylandı</option>
                                            <option value="ordered">Sipariş Verildi</option>
                                            <option value="received">Teslim Alındı</option>
                                            <option value="cancelled">İptal</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {r.notes && <span className="text-[10px] text-muted-foreground mr-2" title={r.notes}>📝</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Yeni Satın Alma Talebi</h3>
                            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Parça</label>
                                <select value={form.partId} onChange={e => setForm({ ...form, partId: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                                    <option value="">Parça Seçin</option>
                                    {parts.map(p => <option key={p.id} value={p.id}>{p.partCode} — {p.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Miktar</label>
                                    <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Birim Fiyat</label>
                                    <input type="number" step="0.01" value={form.unitPrice || ''} onChange={e => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tedarikçi</label>
                                <select value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                                    <option value="">Tedarikçi Seçin (opsiyonel)</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Notlar</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
                            </div>
                        </div>
                        <button onClick={handleCreate} disabled={!form.partId}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-orange-600 hover:to-amber-700 transition-all">
                            Talep Oluştur
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
