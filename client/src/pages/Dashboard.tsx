import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
    RefreshCw, Package, ClipboardList, AlertTriangle, QrCode,
    ShieldCheck, ArrowUpRight, TrendingUp, Activity
} from 'lucide-react';
import { getDashboardStats, getAllSerials, getActiveAlerts } from '../lib/firestoreService';
import type { StockAlert, SerialRecord } from '../lib/types';
import { useAuth } from '../context/AuthContext';

interface DashboardStats {
    totalParts: number;
    criticalStock: number;
    activeOrders: number;
    pendingOrders: number;
    completedOrders: number;
    activeAlerts: number;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalParts: 0, criticalStock: 0, activeOrders: 0,
        pendingOrders: 0, completedOrders: 0, activeAlerts: 0
    });
    const [recentSerials, setRecentSerials] = useState<SerialRecord[]>([]);
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [s, serials, al] = await Promise.all([
                getDashboardStats(),
                getAllSerials(),
                getActiveAlerts(),
            ]);
            setStats(s);
            setRecentSerials(serials.slice(0, 5));
            setAlerts(al.slice(0, 5));
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            label: 'Aktif Üretim Emirleri', value: stats.activeOrders,
            icon: ClipboardList, color: 'from-blue-500 to-indigo-500',
            onClick: () => navigate('/production'),
        },
        {
            label: 'Bekleyen Emirler', value: stats.pendingOrders,
            icon: Activity, color: 'from-amber-500 to-orange-500',
            onClick: () => navigate('/production'),
        },
        {
            label: 'Kritik Stok', value: stats.criticalStock,
            icon: AlertTriangle, color: 'from-red-500 to-pink-500',
            onClick: () => navigate('/inventory?filter=critical'),
        },
        {
            label: 'Toplam Parça', value: stats.totalParts,
            icon: Package, color: 'from-emerald-500 to-teal-500',
            onClick: () => navigate('/inventory'),
        },
        {
            label: 'Tamamlanan Üretim', value: stats.completedOrders,
            icon: TrendingUp, color: 'from-violet-500 to-purple-500',
            onClick: () => navigate('/production'),
        },
        {
            label: 'Aktif Uyarılar', value: stats.activeAlerts,
            icon: AlertTriangle, color: 'from-red-400 to-amber-500',
            onClick: () => navigate('/inventory?filter=critical'),
        },
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Hoş Geldiniz, {user?.displayName || user?.email}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">BRG Defence Üretim Yönetim Sistemi</p>
                </div>
                <button
                    onClick={fetchAll}
                    className={`p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all ${loading ? 'animate-spin' : ''}`}
                    disabled={loading}
                >
                    <RefreshCw className="h-5 w-5" />
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                {statCards.map((card, i) => (
                    <button
                        key={i}
                        onClick={card.onClick}
                        className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-left transition-all duration-300 hover:bg-white/[0.05] hover:border-white/10 hover:shadow-lg"
                    >
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.color} opacity-5 rounded-full -translate-y-6 translate-x-6 group-hover:opacity-10 transition-opacity`} />
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 shadow-lg`}>
                            <card.icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="text-2xl font-bold text-foreground font-mono-numbers">
                            {loading ? '—' : card.value}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            {card.label}
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </button>
                ))}
            </div>

            {/* Two column grid */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Serial Tracking */}
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-blue-400" />
                            Son Seri Numaraları
                        </h3>
                        <button
                            onClick={() => navigate('/serial-tracking')}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Tümünü Gör →
                        </button>
                    </div>
                    <div className="space-y-2">
                        {recentSerials.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">Henüz kayıt yok</p>
                        ) : (
                            recentSerials.map(s => (
                                <div key={s.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition-colors cursor-pointer"
                                    onClick={() => navigate(`/serial-tracking?search=${s.serialNumber}`)}
                                >
                                    <div>
                                        <span className="text-sm font-mono font-medium text-foreground">{s.serialNumber}</span>
                                        <span className="text-xs text-muted-foreground ml-2">{s.modelName}</span>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                                            s.status === 'in_production' ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-muted text-muted-foreground'
                                        }`}>
                                        {s.status === 'completed' ? 'Tamamlandı' : s.status === 'in_production' ? 'Üretimde' : s.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Stock Alerts */}
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            Stok Uyarıları
                        </h3>
                        <button
                            onClick={() => navigate('/inventory?filter=critical')}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                        >
                            Tümünü Gör →
                        </button>
                    </div>
                    <div className="space-y-2">
                        {alerts.length === 0 ? (
                            <div className="flex flex-col items-center py-6">
                                <ShieldCheck className="w-8 h-8 text-emerald-400/50 mb-2" />
                                <p className="text-sm text-muted-foreground">Tüm stoklar yeterli seviyede</p>
                            </div>
                        ) : (
                            alerts.map(a => (
                                <div key={a.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
                                    <div>
                                        <span className="text-sm font-medium text-foreground">{a.partName}</span>
                                        <span className="text-xs text-muted-foreground ml-2">{a.partCode}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-sm font-mono font-bold ${a.alertType === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                                            {a.currentStock}
                                        </span>
                                        <span className="text-xs text-muted-foreground"> / {a.minLevel}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
