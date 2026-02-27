import { useEffect, useState } from 'react';
import {
    ShieldCheck, Plus, X, Search, ClipboardCheck,
    Ruler, Eye, Target, Settings, CheckCircle, XCircle
} from 'lucide-react';
import {
    getAllSerials, getSerialByNumber, getQCRecords, addQCRecord
} from '../lib/firestoreService';
import type { SerialRecord, QualityControlRecord, QCTestType, Measurement, FiringTestData, RodajData } from '../lib/types';
import { useAuth } from '../context/AuthContext';

const TEST_TABS: { type: QCTestType; label: string; icon: any }[] = [
    { type: 'Mikrometre', label: 'Mikrometre Ölçümü', icon: Ruler },
    { type: 'Yüzey Pürüzlülüğü', label: 'Yüzey Pürüzlülüğü', icon: Eye },
    { type: 'Atış Testi', label: 'Atış Testi', icon: Target },
    { type: 'Rodaj', label: 'Rodaj Makinesi', icon: Settings },
    { type: 'Görsel Kontrol', label: 'Görsel Kontrol', icon: ClipboardCheck },
];

export default function QualityControl() {
    const { user } = useAuth();
    const [serials, setSerials] = useState<SerialRecord[]>([]);
    const [selectedSerial, setSelectedSerial] = useState<SerialRecord | null>(null);
    const [qcRecords, setQCRecords] = useState<QualityControlRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<QCTestType>('Mikrometre');
    const [showNewTest, setShowNewTest] = useState(false);
    const [loading, setLoading] = useState(true);

    // Form states
    const [measurements, setMeasurements] = useState<Measurement[]>([
        { dimension: '', tolerance: '', actual: 0, pass: true }
    ]);
    const [firingData, setFiringData] = useState<FiringTestData>({ roundsFired: 0, malfunctions: 0, notes: '' });
    const [rodajData, setRodajData] = useState<RodajData>({ cycleCount: 0, resultNotes: '', pass: true });
    const [testNotes, setTestNotes] = useState('');

    useEffect(() => {
        loadSerials();
    }, []);

    const loadSerials = async () => {
        setLoading(true);
        const s = await getAllSerials();
        setSerials(s);
        setLoading(false);
    };

    const selectSerial = async (serial: SerialRecord) => {
        setSelectedSerial(serial);
        const records = await getQCRecords(serial.id);
        setQCRecords(records);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        const found = await getSerialByNumber(searchQuery.trim());
        if (found) selectSerial(found);
    };

    const addMeasurementRow = () => {
        setMeasurements([...measurements, { dimension: '', tolerance: '', actual: 0, pass: true }]);
    };

    const updateMeasurement = (idx: number, field: keyof Measurement, value: any) => {
        const updated = [...measurements];
        (updated[idx] as any)[field] = value;
        setMeasurements(updated);
    };

    const handleSubmitTest = async () => {
        if (!selectedSerial) return;
        const record: any = {
            testType: activeTab,
            inspector: user?.displayName || user?.email || 'Bilinmeyen',
            inspectorId: user?.uid,
            testDate: new Date(),
            pass: true,
        };

        if (activeTab === 'Mikrometre' || activeTab === 'Yüzey Pürüzlülüğü' || activeTab === 'Görsel Kontrol') {
            record.measurements = measurements;
            record.pass = measurements.every(m => m.pass);
        } else if (activeTab === 'Atış Testi') {
            record.firingTestData = firingData;
            record.pass = firingData.malfunctions === 0;
        } else if (activeTab === 'Rodaj') {
            record.rodajData = rodajData;
            record.pass = rodajData.pass;
        }

        await addQCRecord(selectedSerial.id, record);
        setShowNewTest(false);
        setMeasurements([{ dimension: '', tolerance: '', actual: 0, pass: true }]);
        setFiringData({ roundsFired: 0, malfunctions: 0, notes: '' });
        setRodajData({ cycleCount: 0, resultNotes: '', pass: true });
        selectSerial(selectedSerial);
    };

    const filteredRecords = qcRecords.filter(r => r.testType === activeTab);

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                        Kalite Kontrol
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Test verileri ve ölçüm kayıtları</p>
                </div>
            </div>

            {/* Serial selector */}
            <div className="flex gap-3 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Seri numarası girin..."
                        className="w-full h-10 rounded-xl bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                </div>
                <select
                    value={selectedSerial?.id || ''}
                    onChange={(e) => {
                        const s = serials.find(x => x.id === e.target.value);
                        if (s) selectSerial(s);
                    }}
                    className="h-10 rounded-xl bg-white/5 border border-white/5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                >
                    <option value="">Seri No Seçin</option>
                    {serials.map(s => (
                        <option key={s.id} value={s.id}>{s.serialNumber} — {s.modelName}</option>
                    ))}
                </select>
            </div>

            {!selectedSerial ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Test kaydı eklemek için bir seri numarası seçin</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Test type tabs */}
                    <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                        {TEST_TABS.map(tab => (
                            <button
                                key={tab.type}
                                onClick={() => setActiveTab(tab.type)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.type
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'text-muted-foreground hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Add test button */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-muted-foreground">
                            Seri: <span className="font-mono font-medium text-foreground">{selectedSerial.serialNumber}</span>
                            {' · '}{filteredRecords.length} kayıt
                        </span>
                        <button
                            onClick={() => setShowNewTest(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            Test Kaydı Ekle
                        </button>
                    </div>

                    {/* Records list */}
                    <div className="flex-1 overflow-y-auto space-y-3">
                        {filteredRecords.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">Bu test türünde henüz kayıt yok</p>
                            </div>
                        ) : (
                            filteredRecords.map(rec => (
                                <div key={rec.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            {rec.pass ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-400" />
                                            )}
                                            <span className="text-sm font-semibold text-foreground">{rec.testType}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${rec.pass ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {rec.pass ? 'GEÇER' : 'RED'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{rec.inspector}</span>
                                    </div>

                                    {/* Measurements */}
                                    {rec.measurements && rec.measurements.length > 0 && (
                                        <div className="mt-3 overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-muted-foreground border-b border-white/5">
                                                        <th className="text-left py-2 px-2">Ölçü</th>
                                                        <th className="text-left py-2 px-2">Tolerans</th>
                                                        <th className="text-left py-2 px-2">Gerçek</th>
                                                        <th className="text-left py-2 px-2">Sonuç</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rec.measurements.map((m, i) => (
                                                        <tr key={i} className="border-b border-white/5">
                                                            <td className="py-1.5 px-2 font-medium text-foreground">{m.dimension}</td>
                                                            <td className="py-1.5 px-2 font-mono">{m.tolerance}</td>
                                                            <td className="py-1.5 px-2 font-mono">{m.actual}</td>
                                                            <td className="py-1.5 px-2">
                                                                <span className={m.pass ? 'text-emerald-400' : 'text-red-400'}>{m.pass ? '✓' : '✗'}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Firing test */}
                                    {rec.firingTestData && (
                                        <div className="mt-3 grid grid-cols-3 gap-3">
                                            <div className="rounded-xl bg-white/[0.03] px-3 py-2 border border-white/5">
                                                <div className="text-[10px] text-muted-foreground uppercase">Atış Sayısı</div>
                                                <div className="text-sm font-mono font-bold text-foreground">{rec.firingTestData.roundsFired}</div>
                                            </div>
                                            <div className="rounded-xl bg-white/[0.03] px-3 py-2 border border-white/5">
                                                <div className="text-[10px] text-muted-foreground uppercase">Arıza</div>
                                                <div className={`text-sm font-mono font-bold ${rec.firingTestData.malfunctions > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {rec.firingTestData.malfunctions}
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-white/[0.03] px-3 py-2 border border-white/5">
                                                <div className="text-[10px] text-muted-foreground uppercase">Not</div>
                                                <div className="text-xs text-muted-foreground truncate">{rec.firingTestData.notes || '—'}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Rodaj */}
                                    {rec.rodajData && (
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="rounded-xl bg-white/[0.03] px-3 py-2 border border-white/5">
                                                <div className="text-[10px] text-muted-foreground uppercase">Çevrim Sayısı</div>
                                                <div className="text-sm font-mono font-bold text-foreground">{rec.rodajData.cycleCount}</div>
                                            </div>
                                            <div className="rounded-xl bg-white/[0.03] px-3 py-2 border border-white/5">
                                                <div className="text-[10px] text-muted-foreground uppercase">Sonuç</div>
                                                <div className="text-xs text-muted-foreground">{rec.rodajData.resultNotes}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* New Test Modal */}
            {showNewTest && selectedSerial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Test Kaydı Ekle — {activeTab}</h3>
                            <button onClick={() => setShowNewTest(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>

                        {(activeTab === 'Mikrometre' || activeTab === 'Yüzey Pürüzlülüğü' || activeTab === 'Görsel Kontrol') && (
                            <div className="space-y-3">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ölçümler</div>
                                {measurements.map((m, i) => (
                                    <div key={i} className="grid grid-cols-4 gap-2">
                                        <input placeholder="Ölçü adı" value={m.dimension} onChange={e => updateMeasurement(i, 'dimension', e.target.value)}
                                            className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                        <input placeholder="Tolerans" value={m.tolerance} onChange={e => updateMeasurement(i, 'tolerance', e.target.value)}
                                            className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                        <input type="number" step="0.001" placeholder="Gerçek" value={m.actual || ''} onChange={e => updateMeasurement(i, 'actual', parseFloat(e.target.value) || 0)}
                                            className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                        <select value={m.pass ? 'pass' : 'fail'} onChange={e => updateMeasurement(i, 'pass', e.target.value === 'pass')}
                                            className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50">
                                            <option value="pass">Geçer</option>
                                            <option value="fail">Red</option>
                                        </select>
                                    </div>
                                ))}
                                <button onClick={addMeasurementRow} className="text-xs text-emerald-400 hover:text-emerald-300">+ Ölçüm Satırı Ekle</button>
                            </div>
                        )}

                        {activeTab === 'Atış Testi' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Atış Sayısı</label>
                                    <input type="number" value={firingData.roundsFired || ''} onChange={e => setFiringData({ ...firingData, roundsFired: parseInt(e.target.value) || 0 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tutukluk / Arıza Sayısı</label>
                                    <input type="number" value={firingData.malfunctions || ''} onChange={e => setFiringData({ ...firingData, malfunctions: parseInt(e.target.value) || 0 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Arıza Detayı</label>
                                    <input value={firingData.malfunctionDetails || ''} onChange={e => setFiringData({ ...firingData, malfunctionDetails: e.target.value })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                        placeholder="Tutukluk tipi, atış numarası vs." />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Notlar</label>
                                    <textarea value={firingData.notes || ''} onChange={e => setFiringData({ ...firingData, notes: e.target.value })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                            </div>
                        )}

                        {activeTab === 'Rodaj' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Çevrim Sayısı</label>
                                    <input type="number" value={rodajData.cycleCount || ''} onChange={e => setRodajData({ ...rodajData, cycleCount: parseInt(e.target.value) || 0 })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Sonuç Notları</label>
                                    <textarea value={rodajData.resultNotes} onChange={e => setRodajData({ ...rodajData, resultNotes: e.target.value })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Sonuç</label>
                                    <select value={rodajData.pass ? 'pass' : 'fail'} onChange={e => setRodajData({ ...rodajData, pass: e.target.value === 'pass' })}
                                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50">
                                        <option value="pass">Geçer</option>
                                        <option value="fail">Red</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSubmitTest}
                            className="w-full mt-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-medium text-white hover:from-emerald-600 hover:to-teal-700 transition-all"
                        >
                            Kaydet
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
