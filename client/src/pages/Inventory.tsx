import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Package, Search, Plus, X, AlertTriangle, Upload,
    Edit2, Trash2, Info, Layers, Ruler, Shield, ArrowDownUp
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface PartCategory { id: number; name: string; code: string; }

interface Part {
    id: number; name: string; code: string; material: string;
    heat_treatment: string; coating: string; operation_code: string;
    description: string; category_id: number; category_name: string;
    unit: string; drawing_number: string; revision: number; revision_note: string;
    weight_grams: number; dimensions: string; tolerance: string;
    hardness: string; surface_finish: string; is_critical: boolean;
    is_serialized: boolean; status: string; unit_cost: number;
    lead_time_days: number; image_path: string;
}

export default function Inventory() {
    const [searchParams] = useSearchParams();
    const { user: _user } = useAuth();
    const [parts, setParts] = useState<Part[]>([]);
    const [categories, setCategories] = useState<PartCategory[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [showCriticalOnly, setShowCriticalOnly] = useState(searchParams.get('filter') === 'critical');
    const [showForm, setShowForm] = useState(false);
    const [editingPart, setEditingPart] = useState<Part | null>(null);
    const [selectedPart, setSelectedPart] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showBomImport, setShowBomImport] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [stockForm, setStockForm] = useState({ type: 'in', quantity: 1, notes: '', lot_number: '' });
    const [stockSaving, setStockSaving] = useState(false);

    const defaultForm = {
        name: '', code: '', material: '', heat_treatment: '', coating: '',
        operation_code: '', description: '', category_id: '', unit: 'adet',
        drawing_number: '', weight_grams: '', dimensions: '', tolerance: '',
        hardness: '', surface_finish: '', is_critical: false, is_serialized: false,
        unit_cost: 0, lead_time_days: 0,
    };
    const [form, setForm] = useState<any>(defaultForm);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [p, c] = await Promise.all([
                apiRequest('/parts'),
                apiRequest('/parts/meta/categories'),
            ]);
            setParts(Array.isArray(p) ? p : []);
            setCategories(Array.isArray(c) ? c : []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const filtered = parts.filter(p => {
        if (showCriticalOnly && !p.is_critical) return false;
        if (categoryFilter !== 'all' && String(p.category_id) !== categoryFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.drawing_number || '').toLowerCase().includes(q);
        }
        return true;
    });

    const handleSave = async () => {
        const payload = { ...form, category_id: form.category_id || null };
        if (editingPart) {
            await apiRequest(`/parts/${editingPart.id}`, 'PUT', payload);
        } else {
            await apiRequest('/parts', 'POST', payload);
        }
        resetForm();
        loadData();
    };

    const handleDelete = async (id: number) => {
        if (confirm('Bu parçayı silmek istediğinize emin misiniz?')) {
            await apiRequest(`/parts/${id}`, 'DELETE');
            loadData();
        }
    };

    const startEdit = (p: Part) => {
        setEditingPart(p);
        setForm({
            name: p.name, code: p.code, material: p.material || '',
            heat_treatment: p.heat_treatment || '', coating: p.coating || '',
            operation_code: p.operation_code || '', description: p.description || '',
            category_id: p.category_id || '', unit: p.unit || 'adet',
            drawing_number: p.drawing_number || '', weight_grams: p.weight_grams || '',
            dimensions: p.dimensions || '', tolerance: p.tolerance || '',
            hardness: p.hardness || '', surface_finish: p.surface_finish || '',
            is_critical: p.is_critical, is_serialized: p.is_serialized,
            unit_cost: p.unit_cost || 0, lead_time_days: p.lead_time_days || 0,
        });
        setShowForm(true);
    };

    const resetForm = () => { setShowForm(false); setEditingPart(null); setForm(defaultForm); };

    const loadPartDetail = async (p: Part) => {
        try {
            const detail = await apiRequest(`/parts/${p.id}`);
            setSelectedPart(detail);
        } catch (err) { console.error(err); }
    };

    const handleBomImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return;
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            const row: any = {};
            headers.forEach((h, idx) => { row[h] = cols[idx]; });
            await apiRequest('/parts', 'POST', {
                name: row['name'] || row['parça adı'] || `Part ${i}`,
                code: row['code'] || row['parça kodu'] || `BOM-${i}`,
                material: row['material'] || row['malzeme'] || '',
                unit_cost: parseFloat(row['cost'] || row['maliyet'] || '0') || 0,
            });
        }
        setShowBomImport(false);
        loadData();
    };

    const handleStockAdjust = async () => {
        if (!selectedPart || !stockForm.quantity) return;
        setStockSaving(true);
        try {
            await apiRequest(`/inventory/${selectedPart.id}/adjust`, 'POST', {
                type: stockForm.type,
                quantity: Number(stockForm.quantity),
                notes: stockForm.notes || undefined,
                lot_number: stockForm.lot_number || undefined,
            });
            setShowStockModal(false);
            setStockForm({ type: 'in', quantity: 1, notes: '', lot_number: '' });
            // Reload part detail
            const detail = await apiRequest(`/parts/${selectedPart.id}`);
            setSelectedPart(detail);
            loadData();
        } catch (err) { console.error(err); }
        finally { setStockSaving(false); }
    };

    const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50";
    const lbl = "block text-xs font-semibold text-muted-foreground uppercase mb-1";

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Package className="w-6 h-6 text-emerald-400" /> Parça & Stok Yönetimi
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{filtered.length} / {parts.length} parça</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowBomImport(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors border border-white/5">
                        <Upload className="w-4 h-4" /> BOM İçe Aktar
                    </button>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20">
                        <Plus className="w-4 h-4" /> Parça Ekle
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="İsim, parça kodu veya çizim no ara..."
                        className="w-full h-10 rounded-xl bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                    className="h-10 rounded-xl bg-white/5 border border-white/5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50">
                    <option value="all">Tüm Kategoriler</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border ${showCriticalOnly ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10'}`}>
                    <AlertTriangle className="w-4 h-4" /> Emniyet Kritik
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Table */}
                <div className={`flex-1 overflow-auto rounded-2xl border border-white/5 bg-white/[0.02] ${selectedPart ? 'max-w-[60%]' : ''}`}>
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">Yükleniyor...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wider sticky top-0 bg-[#141821]">
                                    <th className="text-left px-4 py-3">Kod</th>
                                    <th className="text-left px-4 py-3">Ad</th>
                                    <th className="text-left px-4 py-3">Kategori</th>
                                    <th className="text-left px-4 py-3">Malzeme</th>
                                    <th className="text-center px-4 py-3">Rev</th>
                                    <th className="text-left px-4 py-3">Çizim No</th>
                                    <th className="text-right px-4 py-3">Maliyet</th>
                                    <th className="text-right px-4 py-3">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p.id} onClick={() => loadPartDetail(p)}
                                        className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer ${selectedPart?.id === p.id ? 'bg-emerald-500/[0.06]' : ''} ${p.is_critical ? 'border-l-2 border-l-red-500' : ''}`}>
                                        <td className="px-4 py-3 font-mono text-xs text-foreground">{p.code}</td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            <div className="flex items-center gap-1.5">
                                                {p.name}
                                                {p.is_critical && <Shield className="w-3 h-3 text-red-400" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground">{p.category_name || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.material || '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">R{p.revision}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.drawing_number || '—'}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                            {p.unit_cost > 0 ? `₺${p.unit_cost}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
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
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Detail Panel */}
                {selectedPart && (
                    <div className="w-[40%] flex-shrink-0 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">{selectedPart.name}</h2>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setShowStockModal(true)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors">
                                    <ArrowDownUp className="w-3.5 h-3.5" /> Stok Hareketi
                                </button>
                                <button onClick={() => setSelectedPart(null)} className="p-1 hover:bg-white/10 rounded-lg ml-1"><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono px-2 py-1 rounded bg-white/5 text-muted-foreground">{selectedPart.code}</span>
                            <span className="text-xs px-2 py-1 rounded bg-indigo-500/10 text-indigo-400">Rev {selectedPart.revision}</span>
                            {selectedPart.is_critical && <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400">🛡 Emniyet Kritik</span>}
                            {selectedPart.is_serialized && <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400">Seri Takipli</span>}
                        </div>

                        {/* Technical Specs */}
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Teknik Özellikler</h3>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {[
                                    ['Malzeme', selectedPart.material],
                                    ['Isıl İşlem', selectedPart.heat_treatment],
                                    ['Kaplama', selectedPart.coating],
                                    ['Çizim No', selectedPart.drawing_number],
                                    ['Boyut', selectedPart.dimensions],
                                    ['Ağırlık', selectedPart.weight_grams ? `${selectedPart.weight_grams}g` : null],
                                    ['Tolerans', selectedPart.tolerance],
                                    ['Sertlik', selectedPart.hardness],
                                    ['Yüzey', selectedPart.surface_finish],
                                    ['Tedarik', selectedPart.lead_time_days ? `${selectedPart.lead_time_days} gün` : null],
                                ].filter(([, val]) => val).map(([label, val]) => (
                                    <div key={label as string}>
                                        <span className="text-muted-foreground">{label}:</span>
                                        <span className="ml-1 text-foreground font-medium">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Where Used */}
                        {selectedPart.used_in_models?.length > 0 && (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Kullanıldığı Modeller</h3>
                                {selectedPart.used_in_models.map((m: any) => (
                                    <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                                        <span className="text-sm text-foreground">{m.name}</span>
                                        <span className="text-xs font-mono text-muted-foreground">{m.quantity} adet</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Inventory by Warehouse */}
                        {selectedPart.inventory?.length > 0 && (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Depo Stok Durumu</h3>
                                {selectedPart.inventory.map((inv: any) => (
                                    <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                                        <span className="text-sm text-foreground">{inv.warehouse_name || 'Ana Depo'}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-bold font-mono ${inv.quantity <= inv.min_quantity ? 'text-red-400' : 'text-emerald-400'}`}>{inv.quantity}</span>
                                            <span className="text-xs text-muted-foreground">/ min {inv.min_quantity}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedPart.revision_note && (
                            <div className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                                <strong className="text-amber-400">Rev Notu:</strong> {selectedPart.revision_note}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Part Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingPart ? 'Parça Düzenle' : 'Yeni Parça'}</h3>
                            <button onClick={resetForm} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            {/* Row 1: Code + Name */}
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Parça Kodu *</label>
                                    <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className={inp} placeholder="BRG00-01-64-0001" /></div>
                                <div><label className={lbl}>Ad *</label>
                                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} /></div>
                            </div>
                            {/* Row 2: Category + Unit + Drawing */}
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={lbl}>Kategori</label>
                                    <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className={inp}>
                                        <option value="">Seçiniz</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select></div>
                                <div><label className={lbl}>Birim</label>
                                    <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inp}>
                                        <option value="adet">Adet</option><option value="kg">Kg</option><option value="metre">Metre</option><option value="litre">Litre</option>
                                    </select></div>
                                <div><label className={lbl}>Teknik Çizim No</label>
                                    <input value={form.drawing_number} onChange={e => setForm({ ...form, drawing_number: e.target.value })} className={inp} placeholder="DWG-001-R1" /></div>
                            </div>
                            {/* Row 3: Material + Heat + Coating */}
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={lbl}>Malzeme</label>
                                    <input value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} className={inp} placeholder="4140 Çelik" /></div>
                                <div><label className={lbl}>Isıl İşlem</label>
                                    <input value={form.heat_treatment} onChange={e => setForm({ ...form, heat_treatment: e.target.value })} className={inp} placeholder="Sementasyon" /></div>
                                <div><label className={lbl}>Kaplama</label>
                                    <input value={form.coating} onChange={e => setForm({ ...form, coating: e.target.value })} className={inp} placeholder="Parkerize" /></div>
                            </div>
                            {/* Row 4: Dimensions + Weight + Tolerance */}
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={lbl}>Boyut</label>
                                    <input value={form.dimensions} onChange={e => setForm({ ...form, dimensions: e.target.value })} className={inp} placeholder="150x30x20mm" /></div>
                                <div><label className={lbl}>Ağırlık (g)</label>
                                    <input type="number" value={form.weight_grams} onChange={e => setForm({ ...form, weight_grams: e.target.value })} className={inp} /></div>
                                <div><label className={lbl}>Tolerans</label>
                                    <input value={form.tolerance} onChange={e => setForm({ ...form, tolerance: e.target.value })} className={inp} placeholder="±0.05mm" /></div>
                            </div>
                            {/* Row 5: Hardness + Surface + Op Code */}
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={lbl}>Sertlik</label>
                                    <input value={form.hardness} onChange={e => setForm({ ...form, hardness: e.target.value })} className={inp} placeholder="28-32 HRC" /></div>
                                <div><label className={lbl}>Yüzey Kalitesi</label>
                                    <input value={form.surface_finish} onChange={e => setForm({ ...form, surface_finish: e.target.value })} className={inp} placeholder="Ra 0.8" /></div>
                                <div><label className={lbl}>Operasyon Kodu</label>
                                    <input value={form.operation_code} onChange={e => setForm({ ...form, operation_code: e.target.value })} className={inp} /></div>
                            </div>
                            {/* Row 6: Cost + Lead Time */}
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Birim Maliyet (₺)</label>
                                    <input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })} className={inp} /></div>
                                <div><label className={lbl}>Tedarik Süresi (gün)</label>
                                    <input type="number" value={form.lead_time_days} onChange={e => setForm({ ...form, lead_time_days: parseInt(e.target.value) || 0 })} className={inp} /></div>
                            </div>
                            {/* Row 7: Checkboxes */}
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                    <input type="checkbox" checked={form.is_critical} onChange={e => setForm({ ...form, is_critical: e.target.checked })}
                                        className="rounded border-white/20 bg-white/5 text-red-500 focus:ring-red-500/30" />
                                    <Shield className="w-3.5 h-3.5 text-red-400" /> Emniyet Kritik Parça
                                </label>
                                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                    <input type="checkbox" checked={form.is_serialized} onChange={e => setForm({ ...form, is_serialized: e.target.checked })}
                                        className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/30" />
                                    Seri Numarası Takibi
                                </label>
                            </div>
                            {/* Description */}
                            <div><label className={lbl}>Açıklama</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    className={`${inp} resize-none h-16`} /></div>
                        </div>
                        <button onClick={handleSave} disabled={!form.name || !form.code}
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
                            Beklenen sütunlar: name/parça adı, code/parça kodu, material/malzeme, cost/maliyet
                        </p>
                        <input type="file" accept=".csv,.txt" onChange={handleBomImport}
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground file:bg-emerald-500/10 file:text-emerald-400 file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs file:mr-3" />
                    </div>
                </div>
            )}
            {/* Stok Hareketi Modal */}
            {showStockModal && selectedPart && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <ArrowDownUp className="w-5 h-5 text-emerald-400" /> Stok Hareketi
                            </h3>
                            <button onClick={() => setShowStockModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            <span className="font-mono font-medium text-foreground">{selectedPart.code}</span> — {selectedPart.name}
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className={lbl}>Hareket Tipi</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[{ v: 'in', l: 'Giriş', c: 'emerald' }, { v: 'out', l: 'Çıkış', c: 'red' }, { v: 'adjustment', l: 'Düzeltme', c: 'blue' }, { v: 'scrap', l: 'Hurda', c: 'amber' }].map(({ v, l, c }) => (
                                        <button key={v} onClick={() => setStockForm({ ...stockForm, type: v })}
                                            className={`py-2 rounded-xl text-xs font-medium border transition-all ${stockForm.type === v
                                                ? `bg-${c}-500/20 border-${c}-500/40 text-${c}-400`
                                                : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
                                                }`}>{l}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>Miktar</label>
                                <input type="number" min={1} value={stockForm.quantity}
                                    onChange={e => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 1 })}
                                    className={inp} />
                            </div>
                            <div>
                                <label className={lbl}>Lot / Parti No (Opsiyonel)</label>
                                <input value={stockForm.lot_number} onChange={e => setStockForm({ ...stockForm, lot_number: e.target.value })}
                                    className={inp} placeholder="LOT-2026-001" />
                            </div>
                            <div>
                                <label className={lbl}>Not</label>
                                <textarea value={stockForm.notes} onChange={e => setStockForm({ ...stockForm, notes: e.target.value })}
                                    className={`${inp} resize-none h-16`} placeholder="Hareket açıklaması..." />
                            </div>
                        </div>
                        <button onClick={handleStockAdjust} disabled={stockSaving || !stockForm.quantity}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-emerald-600 hover:to-teal-700 transition-all">
                            {stockSaving ? 'Kaydediliyor...' : 'Hareketi Kaydet'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
