import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    QrCode, Search, Plus, Clock, Wrench, Settings, Flame,
    Target, CheckCircle, ChevronDown, ChevronRight, X, User, Layers
} from 'lucide-react';
import {
    getAllSerials, getSerialByNumber, getOperationLogs, getQCRecords,
    createSerial, addOperationLog, generateSerialNumber, getAllModels, updateSerial
} from '../lib/firestoreService';
import type {
    SerialRecord, OperationLog, QualityControlRecord, Model,
    OperationType, PartType
} from '../lib/types';
import { useAuth } from '../context/AuthContext';

const OP_ICONS: Record<string, any> = {
    'CNC': Settings, 'Isıl İşlem': Flame, 'Kaplama': Layers,
    'Montaj': Wrench, 'Atış Testi': Target, 'Rodaj': Settings, 'Kalite Kontrol': CheckCircle,
};

const OP_COLORS: Record<string, string> = {
    'CNC': 'text-blue-400 bg-blue-500/10', 'Isıl İşlem': 'text-orange-400 bg-orange-500/10',
    'Kaplama': 'text-purple-400 bg-purple-500/10', 'Montaj': 'text-emerald-400 bg-emerald-500/10',
    'Atış Testi': 'text-red-400 bg-red-500/10', 'Rodaj': 'text-amber-400 bg-amber-500/10',
    'Kalite Kontrol': 'text-teal-400 bg-teal-500/10',
};

const OPERATIONS: OperationType[] = ['CNC', 'Isıl İşlem', 'Kaplama', 'Montaj', 'Atış Testi', 'Rodaj', 'Kalite Kontrol'];
const PART_TYPES: PartType[] = ['Namlu', 'Sürgü', 'Gövde', 'Şarjör', 'Ana Montaj'];

export default function SerialTracking() {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [serials, setSerials] = useState<SerialRecord[]>([]);
    const [selectedSerial, setSelectedSerial] = useState<SerialRecord | null>(null);
    const [opLogs, setOpLogs] = useState<OperationLog[]>([]);
    const [qcRecords, setQCRecords] = useState<QualityControlRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showNewSerial, setShowNewSerial] = useState(false);
    const [showNewOp, setShowNewOp] = useState(false);
    const [newSerialModel, setNewSerialModel] = useState('');
    const [newOp, setNewOp] = useState<Partial<OperationLog>>({
        operation: 'CNC', partType: 'Gövde', personnelName: '', machine: '', notes: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const q = searchParams.get('search');
        if (q) {
            setSearchQuery(q);
            handleSearch(q);
        }
    }, [searchParams]);

    const loadData = async () => {
        setLoading(true);
        const [s, m] = await Promise.all([getAllSerials(), getAllModels()]);
        setSerials(s);
        setModels(m);
        setLoading(false);
    };

    const handleSearch = async (q?: string) => {
        const query = q || searchQuery;
        if (!query.trim()) return;
        const found = await getSerialByNumber(query.trim());
        if (found) {
            selectSerial(found);
        }
    };

    const selectSerial = async (serial: SerialRecord) => {
        setSelectedSerial(serial);
        const [logs, qc] = await Promise.all([
            getOperationLogs(serial.id),
            getQCRecords(serial.id),
        ]);
        setOpLogs(logs);
        setQCRecords(qc);
    };

    const handleCreateSerial = async () => {
        if (!newSerialModel) return;
        const model = models.find(m => m.id === newSerialModel);
        if (!model) return;
        const serialNumber = await generateSerialNumber(model.name);
        await createSerial({
            serialNumber,
            modelId: model.id,
            modelName: model.name,
            status: 'in_production',
            subParts: {},
        });
        setShowNewSerial(false);
        setNewSerialModel('');
        loadData();
    };

    const handleAddOp = async () => {
        if (!selectedSerial || !newOp.personnelName) return;
        await addOperationLog(selectedSerial.id, {
            partType: newOp.partType as PartType,
            operation: newOp.operation as OperationType,
            machine: newOp.machine || undefined,
            personnelName: newOp.personnelName,
            startTime: new Date(),
            notes: newOp.notes || undefined,
        });
        setShowNewOp(false);
        setNewOp({ operation: 'CNC', partType: 'Gövde', personnelName: '', machine: '', notes: '' });
        selectSerial(selectedSerial);
    };

    const filtered = searchQuery
        ? serials.filter(s => s.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) || s.modelName.toLowerCase().includes(searchQuery.toLowerCase()))
        : serials;

    return (
        <div className="p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <QrCode className="w-6 h-6 text-blue-400" />
                        Seri Takip / Kardeks
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Parça izlenebilirliği ve operasyon geçmişi</p>
                </div>
                <button
                    onClick={() => setShowNewSerial(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Yeni Seri No
                </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Left panel — Serial list */}
                <div className="w-80 flex-shrink-0 flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Seri no veya model ara..."
                                className="w-full h-9 rounded-lg bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                        </div>
                    </div>

                    {/* Serial list */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">Yükleniyor...</div>
                        ) : filtered.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">Kayıt bulunamadı</div>
                        ) : (
                            filtered.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => selectSerial(s)}
                                    className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${selectedSerial?.id === s.id ? 'bg-blue-500/10' : 'hover:bg-white/5'
                                        }`}
                                >
                                    <div className="text-sm font-mono font-medium text-foreground">{s.serialNumber}</div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-muted-foreground">{s.modelName}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                                                s.status === 'in_production' ? 'bg-blue-500/10 text-blue-400' :
                                                    s.status === 'shipped' ? 'bg-purple-500/10 text-purple-400' :
                                                        'bg-muted text-muted-foreground'
                                            }`}>
                                            {s.status === 'completed' ? 'Tamamlandı' : s.status === 'in_production' ? 'Üretimde' : s.status === 'shipped' ? 'Sevk Edildi' : s.status}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Right panel — Kardeks / Detail */}
                <div className="flex-1 overflow-y-auto">
                    {!selectedSerial ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <QrCode className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">Bir seri numarası seçin veya arayın</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Serial Header */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold font-mono text-foreground">{selectedSerial.serialNumber}</h2>
                                        <p className="text-sm text-muted-foreground">{selectedSerial.modelName}</p>
                                    </div>
                                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${selectedSerial.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                            selectedSerial.status === 'in_production' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                'bg-muted text-muted-foreground border border-white/10'
                                        }`}>
                                        {selectedSerial.status === 'completed' ? 'Tamamlandı' : selectedSerial.status === 'in_production' ? 'Üretimde' : selectedSerial.status}
                                    </span>
                                </div>

                                {/* Sub-parts */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {(['namlu', 'surgu', 'govde', 'sarjor'] as const).map(key => (
                                        <div key={key} className="rounded-xl bg-white/[0.03] px-3 py-2.5 border border-white/5">
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                                {key === 'namlu' ? 'Namlu' : key === 'surgu' ? 'Sürgü' : key === 'govde' ? 'Gövde' : 'Şarjör'}
                                            </div>
                                            <div className="text-xs font-mono text-foreground">
                                                {selectedSerial.subParts[key] || '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Operation Timeline */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        Operasyon Geçmişi
                                    </h3>
                                    <button
                                        onClick={() => setShowNewOp(true)}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                    >
                                        + İşlem Ekle
                                    </button>
                                </div>

                                {opLogs.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Henüz operasyon kaydı yok</p>
                                ) : (
                                    <div className="space-y-3">
                                        {opLogs.map((log, i) => {
                                            const Icon = OP_ICONS[log.operation] || Settings;
                                            const color = OP_COLORS[log.operation] || 'text-muted-foreground bg-muted';
                                            return (
                                                <div key={log.id} className="flex gap-3 relative">
                                                    {i < opLogs.length - 1 && (
                                                        <div className="absolute left-[18px] top-10 bottom-0 w-px bg-white/5" />
                                                    )}
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 rounded-xl bg-white/[0.03] px-4 py-3 border border-white/5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium text-foreground">{log.operation}</span>
                                                            <span className="text-[10px] text-muted-foreground">{log.partType}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.personnelName}</span>
                                                            {log.machine && <span>Tezgah: {log.machine}</span>}
                                                        </div>
                                                        {log.notes && <p className="text-xs text-muted-foreground/70 mt-1">{log.notes}</p>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* QC Records */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                    Kalite Kontrol Kayıtları
                                </h3>
                                {qcRecords.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Henüz QC kaydı yok</p>
                                ) : (
                                    <div className="space-y-2">
                                        {qcRecords.map(qc => (
                                            <div key={qc.id} className="rounded-xl bg-white/[0.03] px-4 py-3 border border-white/5 flex items-center justify-between">
                                                <div>
                                                    <span className="text-sm font-medium text-foreground">{qc.testType}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">{qc.inspector}</span>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded-full ${qc.pass ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {qc.pass ? 'GEÇER' : 'RED'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* New Serial Modal */}
            {showNewSerial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Yeni Seri Numarası</h3>
                            <button onClick={() => setShowNewSerial(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Model</label>
                        <select
                            value={newSerialModel}
                            onChange={(e) => setNewSerialModel(e.target.value)}
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50 mb-4"
                        >
                            <option value="">Model Seçin</option>
                            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button
                            onClick={handleCreateSerial}
                            disabled={!newSerialModel}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-blue-600 hover:to-indigo-700 transition-all"
                        >
                            Oluştur
                        </button>
                    </div>
                </div>
            )}

            {/* New Operation Modal */}
            {showNewOp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Operasyon Ekle</h3>
                            <button onClick={() => setShowNewOp(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Operasyon</label>
                                <select value={newOp.operation} onChange={e => setNewOp({ ...newOp, operation: e.target.value as OperationType })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50">
                                    {OPERATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Parça Tipi</label>
                                <select value={newOp.partType} onChange={e => setNewOp({ ...newOp, partType: e.target.value as PartType })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50">
                                    {PART_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Personel Adı</label>
                                <input value={newOp.personnelName} onChange={e => setNewOp({ ...newOp, personnelName: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    placeholder="Ad Soyad" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tezgah / Makine</label>
                                <input value={newOp.machine} onChange={e => setNewOp({ ...newOp, machine: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    placeholder="CNC-1, Rodaj-A vb." />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Notlar</label>
                                <textarea value={newOp.notes} onChange={e => setNewOp({ ...newOp, notes: e.target.value })}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none h-20"
                                    placeholder="Opsiyonel notlar..." />
                            </div>
                        </div>
                        <button
                            onClick={handleAddOp}
                            disabled={!newOp.personnelName}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-blue-600 hover:to-indigo-700 transition-all"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
