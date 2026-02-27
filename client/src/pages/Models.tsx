import { useEffect, useState } from 'react';
import {
    Layers, Plus, X, Search, RefreshCw, Edit2, Trash2, Package
} from 'lucide-react';
import { getAllModels, createModel, getModelBOM, addBOMPart, getAllParts } from '../lib/firestoreService';
import type { Model, BOMPart, Part } from '../lib/types';
import { updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Models() {
    const [models, setModels] = useState<Model[]>([]);
    const [parts, setParts] = useState<Part[]>([]);
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [bomParts, setBomParts] = useState<BOMPart[]>([]);
    const [showNewModel, setShowNewModel] = useState(false);
    const [showAddBom, setShowAddBom] = useState(false);
    const [loading, setLoading] = useState(true);

    const [newModelName, setNewModelName] = useState('');
    const [newModelDesc, setNewModelDesc] = useState('');
    const [bomPartId, setBomPartId] = useState('');
    const [bomQty, setBomQty] = useState(1);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [m, p] = await Promise.all([getAllModels(), getAllParts()]);
        setModels(m); setParts(p);
        setLoading(false);
    };

    const selectModel = async (m: Model) => {
        setSelectedModel(m);
        const bom = await getModelBOM(m.id);
        setBomParts(bom);
    };

    const handleCreateModel = async () => {
        if (!newModelName) return;
        await createModel({ name: newModelName, description: newModelDesc || undefined });
        setShowNewModel(false); setNewModelName(''); setNewModelDesc('');
        loadData();
    };

    const handleAddBom = async () => {
        if (!selectedModel || !bomPartId) return;
        const part = parts.find(p => p.id === bomPartId);
        await addBOMPart(selectedModel.id, {
            partId: bomPartId,
            partCode: part?.partCode || '',
            partName: part?.name || '',
            quantityRequired: bomQty,
        });
        setShowAddBom(false); setBomPartId(''); setBomQty(1);
        selectModel(selectedModel);
    };

    const handleDeleteModel = async (id: string) => {
        if (confirm('Bu modeli silmek istediğinize emin misiniz?')) {
            await deleteDoc(doc(db, 'models', id));
            if (selectedModel?.id === id) { setSelectedModel(null); setBomParts([]); }
            loadData();
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Layers className="w-6 h-6 text-indigo-400" />
                        Modeller & BOM
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Silah modelleri ve malzeme listeleri</p>
                </div>
                <button onClick={() => setShowNewModel(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20">
                    <Plus className="w-4 h-4" /> Yeni Model
                </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Model List */}
                <div className="w-72 flex-shrink-0 flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Modeller ({models.length})
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {models.map(m => (
                            <button key={m.id} onClick={() => selectModel(m)}
                                className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors flex items-center justify-between ${selectedModel?.id === m.id ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-white/5 text-foreground'
                                    }`}>
                                <span className="text-sm font-medium">{m.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteModel(m.id); }}
                                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
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
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                                <h2 className="text-xl font-bold text-foreground mb-1">{selectedModel.name}</h2>
                                <p className="text-sm text-muted-foreground">{selectedModel.description || 'Açıklama yok'}</p>
                            </div>

                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <Package className="w-4 h-4 text-indigo-400" />
                                        Malzeme Listesi (BOM) — {bomParts.length} parça
                                    </h3>
                                    <button onClick={() => setShowAddBom(true)}
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
                                                <th className="text-left py-2 px-2">Parça Kodu</th>
                                                <th className="text-left py-2 px-2">Ad</th>
                                                <th className="text-right py-2 px-2">Adet</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bomParts.map((bp, i) => (
                                                <tr key={i} className="border-b border-white/5">
                                                    <td className="py-2 px-2 font-mono text-xs text-foreground">{bp.partCode}</td>
                                                    <td className="py-2 px-2 font-medium text-foreground">{bp.partName}</td>
                                                    <td className="py-2 px-2 text-right font-mono">{bp.quantityRequired}</td>
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

            {/* New Model Modal */}
            {showNewModel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Yeni Model</h3>
                            <button onClick={() => setShowNewModel(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Model Adı</label>
                                <input value={newModelName} onChange={e => setNewModelName(e.target.value)}
                                    placeholder="BRG9 GEN 1"
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Açıklama</label>
                                <textarea value={newModelDesc} onChange={e => setNewModelDesc(e.target.value)}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
                            </div>
                        </div>
                        <button onClick={handleCreateModel} disabled={!newModelName}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                            Oluştur
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
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Parça</label>
                                <select value={bomPartId} onChange={e => setBomPartId(e.target.value)}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                                    <option value="">Parça Seçin</option>
                                    {parts.map(p => <option key={p.id} value={p.id}>{p.partCode} — {p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Adet</label>
                                <input type="number" min={1} value={bomQty} onChange={e => setBomQty(parseInt(e.target.value) || 1)}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
                            </div>
                        </div>
                        <button onClick={handleAddBom} disabled={!bomPartId}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                            Ekle
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
