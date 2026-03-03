import { useEffect, useState } from 'react';
import {
    Layers, Plus, X, Trash2, Package, Edit2, Search
} from 'lucide-react';
import { apiRequest } from '../services/api';

interface Model {
    id: number; name: string; code: string; description: string;
    category: string; caliber: string; status: string; base_price: number;
    part_count: number; created_by_name: string;
}

interface BOMPart {
    id: number; name: string; code: string; material: string;
    quantity: number; sort_order: number; assembly_notes: string;
    is_optional: boolean; unit_cost: number;
}

export default function Models() {
    const [models, setModels] = useState<Model[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<any>(null);
    const [bomParts, setBomParts] = useState<BOMPart[]>([]);
    const [showNewModel, setShowNewModel] = useState(false);
    const [showEditModel, setShowEditModel] = useState(false);
    const [showAddBom, setShowAddBom] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [_loading, setLoading] = useState(true);

    // Model form
    const defaultModelForm = { name: '', code: '', description: '', category: '', caliber: '', base_price: 0 };
    const [modelForm, setModelForm] = useState<any>(defaultModelForm);

    // BOM form
    const [bomForm, setBomForm] = useState({ part_id: '', quantity: 1, sort_order: 0, notes: '', is_optional: false });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [m, p] = await Promise.all([apiRequest('/models'), apiRequest('/parts')]);
            setModels(Array.isArray(m) ? m : []);
            setParts(Array.isArray(p) ? p : []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const selectModel = async (m: Model) => {
        try {
            const detail = await apiRequest(`/models/${m.id}`);
            setSelectedModel(detail);
            setBomParts(detail.parts || []);
        } catch (err) { console.error(err); }
    };

    const handleCreateModel = async () => {
        if (!modelForm.name || !modelForm.code) return;
        await apiRequest('/models', 'POST', modelForm);
        setShowNewModel(false); setModelForm(defaultModelForm);
        loadData();
    };

    const handleEditModel = async () => {
        if (!selectedModel || !modelForm.name) return;
        await apiRequest(`/models/${selectedModel.id}`, 'PUT', modelForm);
        setShowEditModel(false); setModelForm(defaultModelForm);
        loadData();
        selectModel(selectedModel);
    };

    const startEditModel = () => {
        if (!selectedModel) return;
        setModelForm({
            name: selectedModel.name, code: selectedModel.code, description: selectedModel.description || '',
            category: selectedModel.category || '', caliber: selectedModel.caliber || '',
            base_price: selectedModel.base_price || 0,
        });
        setShowEditModel(true);
    };

    const handleAddBom = async () => {
        if (!selectedModel || !bomForm.part_id) return;
        await apiRequest(`/models/${selectedModel.id}/parts`, 'POST', {
            part_id: parseInt(bomForm.part_id),
            quantity: bomForm.quantity,
            sort_order: bomForm.sort_order,
            notes: bomForm.notes || null,
            is_optional: bomForm.is_optional,
        });
        setShowAddBom(false); setBomForm({ part_id: '', quantity: 1, sort_order: 0, notes: '', is_optional: false });
        selectModel(selectedModel);
    };

    const handleRemoveBom = async (partId: number) => {
        if (!selectedModel) return;
        if (!confirm('Bu parçayı BOM\'dan çıkarmak istiyor musunuz?')) return;
        await apiRequest(`/models/${selectedModel.id}/parts/${partId}`, 'DELETE');
        selectModel(selectedModel);
    };

    const handleDeleteModel = async (id: number) => {
        if (confirm('Bu modeli silmek istediğinize emin misiniz?')) {
            await apiRequest(`/models/${id}`, 'DELETE');
            if (selectedModel?.id === id) { setSelectedModel(null); setBomParts([]); }
            loadData();
        }
    };

    const filteredModels = searchQuery
        ? models.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || (m.code || '').toLowerCase().includes(searchQuery.toLowerCase()))
        : models;

    // BOM total cost
    const bomTotalCost = bomParts.reduce((sum, bp) => sum + (bp.unit_cost || 0) * bp.quantity, 0);

    const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50";
    const lbl = "block text-xs font-semibold text-muted-foreground uppercase mb-1";

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Layers className="w-6 h-6 text-indigo-400" /> Modeller & BOM
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Silah modelleri ve malzeme listeleri • {models.length} model</p>
                </div>
                <button onClick={() => { setModelForm(defaultModelForm); setShowNewModel(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20">
                    <Plus className="w-4 h-4" /> Yeni Model
                </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Model List */}
                <div className="w-80 flex-shrink-0 flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                    <div className="p-3 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Model ara..."
                                className="w-full h-9 rounded-lg bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filteredModels.map(m => (
                            <button key={m.id} onClick={() => selectModel(m)}
                                className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors flex items-center justify-between group ${selectedModel?.id === m.id ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-mono text-muted-foreground">{m.code}</span>
                                        {m.caliber && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{m.caliber}</span>}
                                        <span className="text-[10px] text-muted-foreground">{m.part_count} parça</span>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteModel(m.id); }}
                                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </button>
                        ))}
                    </div>
                </div>

                {/* BOM Detail */}
                <div className="flex-1 overflow-y-auto">
                    {!selectedModel ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Layers className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">Bir model seçin</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Model Info */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground">{selectedModel.name}</h2>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-mono text-muted-foreground">{selectedModel.code}</span>
                                            {selectedModel.category && <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">{selectedModel.category}</span>}
                                            {selectedModel.caliber && <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground">{selectedModel.caliber}</span>}
                                        </div>
                                        {selectedModel.description && <p className="text-sm text-muted-foreground mt-2">{selectedModel.description}</p>}
                                    </div>
                                    <button onClick={startEditModel} className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                                {selectedModel.base_price > 0 && (
                                    <div className="mt-3 flex items-center gap-4 text-xs">
                                        <span className="text-muted-foreground">Baz Fiyat: <strong className="text-foreground">₺{selectedModel.base_price.toLocaleString('tr-TR')}</strong></span>
                                        <span className="text-muted-foreground">BOM Maliyet: <strong className="text-foreground">₺{bomTotalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong></span>
                                    </div>
                                )}
                            </div>

                            {/* BOM Table */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <Package className="w-4 h-4 text-indigo-400" /> Malzeme Listesi (BOM) — {bomParts.length} parça
                                    </h3>
                                    <button onClick={() => { setBomForm({ ...bomForm, sort_order: bomParts.length + 1 }); setShowAddBom(true); }}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
                                        + Parça Ekle
                                    </button>
                                </div>

                                {bomParts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Henüz parça eklenmedi</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase">
                                                <th className="text-center py-2 px-2 w-12">#</th>
                                                <th className="text-left py-2 px-2">Kod</th>
                                                <th className="text-left py-2 px-2">Ad</th>
                                                <th className="text-left py-2 px-2">Malzeme</th>
                                                <th className="text-right py-2 px-2">Adet</th>
                                                <th className="text-right py-2 px-2">B.Maliyet</th>
                                                <th className="text-left py-2 px-2">Not</th>
                                                <th className="text-center py-2 px-2 w-16">İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bomParts.sort((a, b) => a.sort_order - b.sort_order).map((bp) => (
                                                <tr key={bp.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                                    <td className="py-2 px-2 text-center text-xs text-muted-foreground">{bp.sort_order}</td>
                                                    <td className="py-2 px-2 font-mono text-xs text-foreground">{bp.code}</td>
                                                    <td className="py-2 px-2 font-medium text-foreground">
                                                        <div className="flex items-center gap-1.5">
                                                            {bp.name}
                                                            {bp.is_optional && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">OPSİYONEL</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-xs text-muted-foreground">{bp.material || '—'}</td>
                                                    <td className="py-2 px-2 text-right font-mono font-bold">{bp.quantity}</td>
                                                    <td className="py-2 px-2 text-right text-xs text-muted-foreground">{bp.unit_cost ? `₺${bp.unit_cost}` : '—'}</td>
                                                    <td className="py-2 px-2 text-xs text-muted-foreground max-w-32 truncate">{bp.assembly_notes || '—'}</td>
                                                    <td className="py-2 px-2 text-center">
                                                        <button onClick={() => handleRemoveBom(bp.id)}
                                                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* New/Edit Model Modal */}
            {(showNewModel || showEditModel) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{showEditModel ? 'Model Düzenle' : 'Yeni Model'}</h3>
                            <button onClick={() => { setShowNewModel(false); setShowEditModel(false); }} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Model Adı *</label>
                                    <input value={modelForm.name} onChange={e => setModelForm({ ...modelForm, name: e.target.value })}
                                        className={inp} placeholder="BRG9 GEN 1" /></div>
                                <div><label className={lbl}>Kod *</label>
                                    <input value={modelForm.code} onChange={e => setModelForm({ ...modelForm, code: e.target.value })}
                                        className={inp} placeholder="BRG9-G1" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Kategori</label>
                                    <select value={modelForm.category} onChange={e => setModelForm({ ...modelForm, category: e.target.value })} className={inp}>
                                        <option value="">Seçiniz</option>
                                        <option value="Tabanca">Tabanca</option><option value="Tüfek">Tüfek</option>
                                        <option value="SMG">SMG</option><option value="Diğer">Diğer</option>
                                    </select></div>
                                <div><label className={lbl}>Kalibre</label>
                                    <input value={modelForm.caliber} onChange={e => setModelForm({ ...modelForm, caliber: e.target.value })}
                                        className={inp} placeholder="9x19mm" /></div>
                            </div>
                            <div><label className={lbl}>Baz Fiyat (₺)</label>
                                <input type="number" step="0.01" value={modelForm.base_price} onChange={e => setModelForm({ ...modelForm, base_price: parseFloat(e.target.value) || 0 })}
                                    className={inp} /></div>
                            <div><label className={lbl}>Açıklama</label>
                                <textarea value={modelForm.description} onChange={e => setModelForm({ ...modelForm, description: e.target.value })}
                                    className={`${inp} resize-none h-16`} /></div>
                        </div>
                        <button onClick={showEditModel ? handleEditModel : handleCreateModel}
                            disabled={!modelForm.name || !modelForm.code}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                            {showEditModel ? 'Güncelle' : 'Oluştur'}
                        </button>
                    </div>
                </div>
            )}

            {/* Add BOM Part Modal */}
            {showAddBom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">BOM'a Parça Ekle</h3>
                            <button onClick={() => setShowAddBom(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div><label className={lbl}>Parça *</label>
                                <select value={bomForm.part_id} onChange={e => setBomForm({ ...bomForm, part_id: e.target.value })} className={inp}>
                                    <option value="">Parça Seçin</option>
                                    {parts.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                                </select></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={lbl}>Adet</label>
                                    <input type="number" min={1} value={bomForm.quantity} onChange={e => setBomForm({ ...bomForm, quantity: parseInt(e.target.value) || 1 })} className={inp} /></div>
                                <div><label className={lbl}>Sıra No</label>
                                    <input type="number" value={bomForm.sort_order} onChange={e => setBomForm({ ...bomForm, sort_order: parseInt(e.target.value) || 0 })} className={inp} /></div>
                            </div>
                            <div><label className={lbl}>Montaj Notu</label>
                                <input value={bomForm.notes} onChange={e => setBomForm({ ...bomForm, notes: e.target.value })}
                                    className={inp} placeholder="Tork: 25Nm, Loctite gerekli..." /></div>
                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                <input type="checkbox" checked={bomForm.is_optional} onChange={e => setBomForm({ ...bomForm, is_optional: e.target.checked })}
                                    className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/30" />
                                Opsiyonel Parça
                            </label>
                        </div>
                        <button onClick={handleAddBom} disabled={!bomForm.part_id}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                            Ekle
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
