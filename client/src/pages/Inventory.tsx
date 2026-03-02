import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Package, Search, Plus, X, AlertTriangle, Upload,
    Edit2, Trash2
} from 'lucide-react';
import {
    createPart, updatePart, deletePart, onPartsSnapshot
} from '../lib/firestoreService';
import type { Part, PartCategory } from '../lib/types';
import { useAuth } from '../context/AuthContext';

const CATEGORIES: PartCategory[] = ['Namlu', 'Sürgü', 'Gövde', 'Şarjör', 'Tetik Mekanizması', 'Diğer'];

export default function Inventory() {
    const [searchParams] = useSearchParams();
    const { user: _user } = useAuth();
    const [parts, setParts] = useState<Part[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showCriticalOnly, setShowCriticalOnly] = useState(searchParams.get('filter') === 'critical');
    const [showForm, setShowForm] = useState(false);
    const [editingPart, setEditingPart] = useState<Part | null>(null);
    const [_loading, setLoading] = useState(true);
    const [showBomImport, setShowBomImport] = useState(false);

    // Form
    const [form, setForm] = useState({
        name: '', partCode: '', category: 'Diğer' as PartCategory,
        material: '', heatTreatment: '', coating: '',
        stockQuantity: 0, minStockLevel: 10, averageCost: 0, currency: 'TL',
    });

    useEffect(() => {
        const unsub = onPartsSnapshot((p) => {
            setParts(p);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const filtered = parts.filter(p => {
        if (showCriticalOnly && p.stockQuantity >= p.minStockLevel) return false;
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.partCode.toLowerCase().includes(q);
        }
        return true;
    });

    const handleSave = async () => {
        if (editingPart) {
            await updatePart(editingPart.id, form);
        } else {
            await createPart(form);
        }
        resetForm();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bu parçayı silmek istediğinize emin misiniz?')) {
            await deletePart(id);
        }
    };

    const startEdit = (p: Part) => {
        setEditingPart(p);
        setForm({
            name: p.name, partCode: p.partCode, category: p.category,
            material: p.material || '', heatTreatment: p.heatTreatment || '',
            coating: p.coating || '', stockQuantity: p.stockQuantity,
            minStockLevel: p.minStockLevel, averageCost: p.averageCost, currency: p.currency,
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false); setEditingPart(null);
        setForm({ name: '', partCode: '', category: 'Diğer', material: '', heatTreatment: '', coating: '', stockQuantity: 0, minStockLevel: 10, averageCost: 0, currency: 'TL' });
    };

    const handleBomImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        // Parse CSV BOM
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return;
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            const row: any = {};
            headers.forEach((h, idx) => { row[h] = cols[idx]; });
            await createPart({
                name: row['name'] || row['parça adı'] || row['part name'] || `Part ${i}`,
                partCode: row['code'] || row['parça kodu'] || row['part number'] || `BOM-${i}`,
                category: 'Diğer' as PartCategory,
                material: row['material'] || row['malzeme'] || '',
                stockQuantity: parseInt(row['quantity'] || row['miktar'] || '0') || 0,
                minStockLevel: 10,
                averageCost: parseFloat(row['cost'] || row['maliyet'] || '0') || 0,
                currency: 'TL',
            });
        }
        setShowBomImport(false);
    };

    const stockPercent = (p: Part) => {
        if (p.minStockLevel === 0) return 100;
        return Math.min(100, Math.round((p.stockQuantity / p.minStockLevel) * 100));
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Package className="w-6 h-6 text-emerald-400" />
                        Stok Yönetimi
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{filtered.length} / {parts.length} parça</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowBomImport(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors border border-white/5"
                    >
                        <Upload className="w-4 h-4" />
                        BOM İçe Aktar
                    </button>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Parça Ekle
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="İsim veya parça kodu ara..."
                        className="w-full h-10 rounded-xl bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                    className="h-10 rounded-xl bg-white/5 border border-white/5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50">
                    <option value="all">Tüm Kategoriler</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                    onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border ${showCriticalOnly ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10'
                        }`}
                >
                    <AlertTriangle className="w-4 h-4" />
                    Kritik Stok
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-white/[0.02]">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Parça Kodu</th>
                            <th className="text-left px-4 py-3">Ad</th>
                            <th className="text-left px-4 py-3">Kategori</th>
                            <th className="text-left px-4 py-3">Malzeme</th>
                            <th className="text-right px-4 py-3">Stok</th>
                            <th className="text-right px-4 py-3">Min</th>
                            <th className="text-left px-4 py-3 w-28">Seviye</th>
                            <th className="text-right px-4 py-3">Maliyet</th>
                            <th className="text-right px-4 py-3">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(p => {
                            const pct = stockPercent(p);
                            const critical = p.stockQuantity < p.minStockLevel;
                            return (
                                <tr key={p.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${critical ? 'bg-red-500/[0.03]' : ''}`}>
                                    <td className="px-4 py-3 font-mono text-xs text-foreground">{p.partCode}</td>
                                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground">{p.category}</span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.material || '—'}</td>
                                    <td className={`px-4 py-3 text-right font-mono font-bold ${critical ? 'text-red-400' : 'text-foreground'}`}>{p.stockQuantity}</td>
                                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{p.minStockLevel}</td>
                                    <td className="px-4 py-3">
                                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                        {p.averageCost > 0 ? `${p.averageCost} ${p.currency}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Part Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingPart ? 'Parça Düzenle' : 'Yeni Parça'}</h3>
                            <button onClick={resetForm} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Parça Kodu</label>
                                    <input value={form.partCode} onChange={e => setForm({ ...form, partCode: e.target.value })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" placeholder="BRG00-01-64-0001" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Kategori</label>
                                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as PartCategory })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50">
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ad</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Malzeme</label>
                                    <input value={form.material} onChange={e => setForm({ ...form, material: e.target.value })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Isıl İşlem</label>
                                    <input value={form.heatTreatment} onChange={e => setForm({ ...form, heatTreatment: e.target.value })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Kaplama</label>
                                    <input value={form.coating} onChange={e => setForm({ ...form, coating: e.target.value })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Stok Miktarı</label>
                                    <input type="number" value={form.stockQuantity || ''} onChange={e => setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Min Stok</label>
                                    <input type="number" value={form.minStockLevel || ''} onChange={e => setForm({ ...form, minStockLevel: parseInt(e.target.value) || 0 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Birim Maliyet</label>
                                    <input type="number" step="0.01" value={form.averageCost || ''} onChange={e => setForm({ ...form, averageCost: parseFloat(e.target.value) || 0 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Para Birimi</label>
                                    <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50">
                                        <option value="TL">TL</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleSave} disabled={!form.name || !form.partCode}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-emerald-600 hover:to-teal-700 transition-all">
                            {editingPart ? 'Güncelle' : 'Ekle'}
                        </button>
                    </div>
                </div>
            )}

            {/* BOM Import Modal */}
            {showBomImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">BOM İçe Aktar (CSV)</h3>
                            <button onClick={() => setShowBomImport(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                            SolidWorks veya Fusion 360'tan dışa aktarılmış CSV dosyasını yükleyin.<br />
                            Beklenen sütunlar: name/parça adı, code/parça kodu, material/malzeme, quantity/miktar, cost/maliyet
                        </p>
                        <input type="file" accept=".csv,.txt" onChange={handleBomImport}
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground file:bg-emerald-500/10 file:text-emerald-400 file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs file:mr-3" />
                    </div>
                </div>
            )}
        </div>
    );
}
