import { useEffect, useState } from 'react';
import { History, RefreshCw, Search } from 'lucide-react';
import { fetchAuditLogs } from '../services/api';

interface AuditLog {
    id: string;
    action: string;
    module: string;
    details: string;
    userId: string;
    userName: string;
    timestamp: any;
}

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [moduleFilter, setModuleFilter] = useState('all');

    useEffect(() => { loadLogs(); }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await fetchAuditLogs();
            setLogs(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = logs.filter(l => {
        if (moduleFilter !== 'all' && l.module !== moduleFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (l.action?.toLowerCase().includes(q) || l.details?.toLowerCase().includes(q) || l.userName?.toLowerCase().includes(q));
        }
        return true;
    });

    const modules = [...new Set(logs.map(l => l.module).filter(Boolean))];

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <History className="w-6 h-6 text-cyan-400" />
                        İşlem Geçmişi
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{filtered.length} kayıt</p>
                </div>
                <button onClick={loadLogs} className={`p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground ${loading ? 'animate-spin' : ''}`}>
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="flex gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="İşlem, detay veya kullanıcı ara..."
                        className="w-full h-10 rounded-xl bg-white/5 border border-white/5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
                </div>
                {modules.length > 0 && (
                    <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
                        className="h-10 rounded-xl bg-white/5 border border-white/5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50">
                        <option value="all">Tüm Modüller</option>
                        {modules.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                )}
            </div>

            <div className="flex-1 overflow-auto rounded-2xl border border-white/5 bg-white/[0.02]">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                        <History className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">{loading ? 'Yükleniyor...' : 'Henüz kayıt yok'}</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wider sticky top-0 bg-[#141821]">
                                <th className="text-left px-4 py-3">Zaman</th>
                                <th className="text-left px-4 py-3">Kullanıcı</th>
                                <th className="text-left px-4 py-3">Modül</th>
                                <th className="text-left px-4 py-3">İşlem</th>
                                <th className="text-left px-4 py-3">Detaylar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(log => (
                                <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                                        {log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : '—'}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-foreground text-xs">{log.userName || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground">{log.module || '—'}</span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-foreground">{log.action}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div >
    );
}
