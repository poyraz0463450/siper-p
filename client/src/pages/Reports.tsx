import { useEffect, useState } from 'react';
import {
    BarChart2, TrendingUp, Package, QrCode, CheckCircle,
    AlertTriangle, DollarSign, Settings, RefreshCw
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { apiRequest } from '../services/api';

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

const KPICard = ({ icon: Icon, label, value, sub, color }: any) => (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    </div>
);

export default function Reports() {
    const [kpi, setKpi] = useState<any>(null);
    const [trend, setTrend] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [lowStock, setLowStock] = useState<any[]>([]);
    const [serialStatus, setSerialStatus] = useState<any>(null);
    const [qcSummary, setQcSummary] = useState<any>(null);
    const [opAnalysis, setOpAnalysis] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'production' | 'inventory' | 'quality'>('overview');

    const loadAll = async () => {
        setLoading(true);
        try {
            const [k, t, inv, ls, ser, qc, op] = await Promise.all([
                apiRequest('/reports/kpi'),
                apiRequest('/reports/production-trend'),
                apiRequest('/reports/inventory-summary'),
                apiRequest('/reports/low-stock'),
                apiRequest('/reports/serial-status'),
                apiRequest('/reports/qc-summary'),
                apiRequest('/reports/operation-analysis'),
            ]);
            setKpi(k); setTrend(Array.isArray(t) ? t : []);
            setInventory(Array.isArray(inv) ? inv : []);
            setLowStock(Array.isArray(ls) ? ls : []);
            setSerialStatus(ser); setQcSummary(qc); setOpAnalysis(op);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadAll(); }, []);

    const TABS = [
        { id: 'overview', label: 'Genel Bakış' },
        { id: 'production', label: 'Üretim' },
        { id: 'inventory', label: 'Stok' },
        { id: 'quality', label: 'Kalite' },
    ] as const;

    const serialPieData = serialStatus?.by_status?.map((r: any) => ({
        name: r.status === 'in_production' ? 'Üretimde'
            : r.status === 'completed' ? 'Tamamlandı'
                : r.status === 'shipped' ? 'Sevk Edildi'
                    : r.status === 'returned' ? 'İade'
                        : r.status === 'scrapped' ? 'Hurda' : r.status,
        value: parseInt(r.count),
    })) || [];

    const qcPieData = qcSummary?.overall
        ? [
            { name: 'Geçti', value: parseInt(qcSummary.overall.passed) },
            { name: 'Kaldı', value: parseInt(qcSummary.overall.failed) },
        ]
        : [];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="rounded-xl bg-background border border-white/10 p-3 text-xs shadow-xl">
                <p className="text-muted-foreground mb-1">{label}</p>
                {payload.map((p: any) => (
                    <p key={p.dataKey} style={{ color: p.color }}>
                        {p.name}: <strong>{p.value?.toLocaleString('tr-TR')}</strong>
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="p-6 h-full flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <BarChart2 className="w-6 h-6 text-violet-400" /> Raporlar & Analizler
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerçek zamanlı üretim, stok ve kalite metrikleri</p>
                </div>
                <button onClick={loadAll} className={`p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors ${loading ? 'animate-spin' : ''}`}>
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/5">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm">Raporlar yükleniyor...</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <>
                            {/* KPI Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <KPICard icon={TrendingUp} label="Toplam Üretim Emri" value={kpi?.total_orders || 0}
                                    sub={`${kpi?.completed_orders || 0} tamamlandı`} color="bg-indigo-500/10 text-indigo-400" />
                                <KPICard icon={Package} label="Toplam Parça" value={kpi?.total_parts || 0}
                                    sub={kpi?.low_stock_count > 0 ? `⚠️ ${kpi.low_stock_count} düşük stok` : 'Stok normal'}
                                    color="bg-emerald-500/10 text-emerald-400" />
                                <KPICard icon={QrCode} label="Seri Numarası" value={kpi?.total_serials || 0}
                                    color="bg-blue-500/10 text-blue-400" />
                                <KPICard icon={CheckCircle} label="QC Başarı Oranı" value={`%${kpi?.qc_pass_rate || 0}`}
                                    color="bg-teal-500/10 text-teal-400" />
                            </div>

                            {/* Inventory Value */}
                            {kpi?.inventory_value > 0 && (
                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 flex-shrink-0">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Toplam Stok Değeri</p>
                                        <p className="text-2xl font-bold text-foreground">
                                            ₺{kpi.inventory_value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Seri Status Pie + QC Pie */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                        <QrCode className="w-4 h-4 text-blue-400" /> Seri No Durum Dağılımı
                                    </h3>
                                    {serialPieData.length === 0 ? (
                                        <p className="text-center text-sm text-muted-foreground py-8">Henüz seri numarası yok</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <PieChart>
                                                <Pie data={serialPieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                                                    {serialPieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-teal-400" /> Kalite Kontrol Sonuçları
                                    </h3>
                                    {!qcSummary?.overall?.total || qcSummary.overall.total === '0' ? (
                                        <p className="text-center text-sm text-muted-foreground py-8">Henüz QC kaydı yok</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={140}>
                                                <PieChart>
                                                    <Pie data={qcPieData} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                                                        <Cell fill="#10b981" /><Cell fill="#ef4444" />
                                                    </Pie>
                                                    <Tooltip content={<CustomTooltip />} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="mt-3 space-y-2">
                                                {qcSummary.by_type?.slice(0, 5).map((t: any) => {
                                                    const rate = t.total > 0 ? Math.round((t.passed / t.total) * 100) : 0;
                                                    return (
                                                        <div key={t.test_type} className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">{t.test_type}</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                                    <div style={{ width: `${rate}%` }} className="h-full bg-emerald-500 rounded-full" />
                                                                </div>
                                                                <span className="text-foreground font-mono w-10 text-right">%{rate}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Low Stock Alert */}
                            {lowStock.length > 0 && (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-5">
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-400">
                                        <AlertTriangle className="w-4 h-4" /> Düşük Stok Uyarısı ({lowStock.length} parça)
                                    </h3>
                                    <div className="space-y-2">
                                        {lowStock.slice(0, 8).map((p: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                                                <div className="flex items-center gap-2">
                                                    {p.is_critical && <span className="text-red-400">🛡</span>}
                                                    <span className="font-mono text-muted-foreground">{p.code}</span>
                                                    <span className="text-foreground">{p.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-red-400 font-mono font-bold">{p.total_qty} {p.unit}</span>
                                                    <span className="text-muted-foreground ml-1">/ min {p.min_qty}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* PRODUCTION TAB */}
                    {activeTab === 'production' && (
                        <>
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-indigo-400" /> Aylık Üretim Trendi
                                </h3>
                                {trend.length === 0 ? (
                                    <p className="text-center text-sm text-muted-foreground py-12">Henüz üretim emri yok</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={trend}>
                                            <defs>
                                                <linearGradient id="colTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colComp" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Area type="monotone" dataKey="total" name="Toplam Emir" stroke="#6366f1" fill="url(#colTotal)" />
                                            <Area type="monotone" dataKey="completed" name="Tamamlanan" stroke="#10b981" fill="url(#colComp)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Seri by Model */}
                            {serialStatus?.by_model?.length > 0 && (
                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                        <QrCode className="w-4 h-4 text-blue-400" /> Model Bazlı Seri Dağılımı
                                    </h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={serialStatus.by_model}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="model_name" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="in_production" name="Üretimde" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="completed" name="Tamamlandı" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Operation Analysis */}
                            {opAnalysis?.by_operation?.length > 0 && (
                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                        <Settings className="w-4 h-4 text-amber-400" /> Operasyon Dağılımı
                                    </h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={opAnalysis.by_operation} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <YAxis type="category" dataKey="operation" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} width={100} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="count" name="Adet" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </>
                    )}

                    {/* INVENTORY TAB */}
                    {activeTab === 'inventory' && (
                        <>
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-emerald-400" /> Kategori Bazlı Stok Değeri
                                </h3>
                                {inventory.length === 0 ? (
                                    <p className="text-center text-sm text-muted-foreground py-12">Stok verisi bulunamadı</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={inventory}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="category_name" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="part_count" name="Parça Sayısı" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="low_stock_count" name="Düşük Stok" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Low Stock Table */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                <h3 className="text-sm font-semibold mb-4 text-red-400 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Düşük Stok Detayı
                                </h3>
                                {lowStock.length === 0 ? (
                                    <p className="text-center text-sm text-emerald-400 py-6">✅ Tüm stok seviyeleri normal</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs text-muted-foreground uppercase border-b border-white/5">
                                                <th className="text-left py-2 px-2">Parça Kodu</th>
                                                <th className="text-left py-2 px-2">Ad</th>
                                                <th className="text-right py-2 px-2">Mevcut</th>
                                                <th className="text-right py-2 px-2">Min</th>
                                                <th className="text-right py-2 px-2">Eksik</th>
                                                <th className="text-center py-2 px-2">Kritik</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lowStock.map((p: any, i: number) => (
                                                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                                                    <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{p.code}</td>
                                                    <td className="py-2 px-2 text-foreground">{p.name}</td>
                                                    <td className="py-2 px-2 text-right text-red-400 font-bold">{p.total_qty} {p.unit}</td>
                                                    <td className="py-2 px-2 text-right text-muted-foreground">{p.min_qty}</td>
                                                    <td className="py-2 px-2 text-right text-amber-400">{Math.max(0, p.min_qty - p.total_qty)}</td>
                                                    <td className="py-2 px-2 text-center">{p.is_critical ? '🛡' : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}

                    {/* QUALITY TAB */}
                    {activeTab === 'quality' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <KPICard icon={CheckCircle} label="Toplam QC Kaydı" value={qcSummary?.overall?.total || 0} color="bg-teal-500/10 text-teal-400" />
                                <KPICard icon={CheckCircle} label="Geçti" value={qcSummary?.overall?.passed || 0} color="bg-emerald-500/10 text-emerald-400" />
                                <KPICard icon={AlertTriangle} label="Kaldı" value={qcSummary?.overall?.failed || 0} color="bg-red-500/10 text-red-400" />
                            </div>

                            {qcSummary?.by_type?.length > 0 && (
                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-teal-400" /> Test Tipi Bazlı Sonuçlar
                                    </h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={qcSummary.by_type}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="test_type" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="passed" name="Geçti" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="total" name="Toplam" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {opAnalysis?.by_personnel?.length > 0 && (
                                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                                    <h3 className="text-sm font-semibold mb-4">En Aktif Personel</h3>
                                    <div className="space-y-3">
                                        {opAnalysis.by_personnel.map((p: any, i: number) => {
                                            const max = opAnalysis.by_personnel[0]?.count || 1;
                                            const pct = Math.round((p.count / max) * 100);
                                            return (
                                                <div key={i} className="flex items-center gap-3 text-sm">
                                                    <span className="w-6 text-xs text-muted-foreground text-right">{i + 1}</span>
                                                    <span className="flex-1 text-foreground">{p.personnel_name}</span>
                                                    <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                        <div style={{ width: `${pct}%` }} className="h-full bg-indigo-500 rounded-full" />
                                                    </div>
                                                    <span className="text-xs font-mono text-muted-foreground w-10 text-right">{p.count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
