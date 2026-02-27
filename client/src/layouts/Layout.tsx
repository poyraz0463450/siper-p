import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, Package, Layers, ClipboardList, LogOut, Menu, X,
    History as HistoryIcon, ShoppingBag, FileText, QrCode, ShieldCheck,
    Users, Bell, ChevronDown, ChevronRight, Search, Settings
} from 'lucide-react';
import { Toaster } from 'sonner';
import { cn } from '../lib/utils';
import { onAlertsSnapshot } from '../lib/firestoreService';
import type { StockAlert } from '../lib/types';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono';

interface NavSection {
    title: string;
    items: NavItem[];
}

interface NavItem {
    href: string;
    label: string;
    icon: any;
    module?: string;
    adminOnly?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
    {
        title: 'Genel',
        items: [
            { href: '/', label: 'Genel Bakış', icon: LayoutDashboard },
        ],
    },
    {
        title: 'Üretim',
        items: [
            { href: '/production', label: 'Üretim Emirleri', icon: ClipboardList, module: 'production' },
            { href: '/serial-tracking', label: 'Seri Takip / Kardeks', icon: QrCode, module: 'serial' },
            { href: '/quality-control', label: 'Kalite Kontrol', icon: ShieldCheck, module: 'quality' },
        ],
    },
    {
        title: 'Stok & Tedarik',
        items: [
            { href: '/inventory', label: 'Stok Yönetimi', icon: Package, module: 'inventory' },
            { href: '/procurement', label: 'Satın Alma', icon: ShoppingBag, module: 'procurement' },
            { href: '/models', label: 'Modeller & BOM', icon: Layers, module: 'models' },
        ],
    },
    {
        title: 'Dökümanlar',
        items: [
            { href: '/documents', label: 'Döküman Merkezi', icon: FileText, module: 'documents' },
        ],
    },
    {
        title: 'Yönetim',
        items: [
            { href: '/admin', label: 'Kullanıcı Yönetimi', icon: Users, adminOnly: true },
            { href: '/audit-logs', label: 'İşlem Geçmişi', icon: HistoryIcon },
        ],
    },
];

const ROLE_COLORS: Record<string, string> = {
    Admin: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    Engineer: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    Technician: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white',
};

export default function Layout() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [showAlerts, setShowAlerts] = useState(false);
    const [serialSearch, setSerialSearch] = useState('');

    useEffect(() => {
        const unsub = onAlertsSnapshot(setAlerts);
        return () => unsub();
    }, []);

    const toggleSection = (title: string) => {
        setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    const handleSerialSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (serialSearch.trim()) {
            navigate(`/serial-tracking?search=${encodeURIComponent(serialSearch.trim())}`);
            setSerialSearch('');
        }
    };

    const canAccess = (item: NavItem) => {
        if (item.adminOnly && user?.role !== 'Admin') return false;
        if (!item.module) return true;
        if (user?.role === 'Admin') return true;
        return user?.allowedModules?.includes(item.module) ?? false;
    };

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
            {/* ==================== TOP BAR ==================== */}
            <div className="fixed top-0 left-0 right-0 h-12 z-50 flex items-center bg-[#1a1f2e] border-b border-white/5">
                {/* Window-like title bar */}
                <div className="flex items-center gap-2 px-4 w-64 border-r border-white/5 h-full flex-shrink-0">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-foreground truncate">BRG Defence ERP</span>
                    {/* Mobile menu toggle */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="ml-auto md:hidden p-1 text-muted-foreground hover:text-foreground"
                    >
                        {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                </div>

                {/* Center — Serial number quick search */}
                <div className="flex-1 flex items-center justify-center px-4">
                    <form onSubmit={handleSerialSearch} className="hidden md:flex items-center w-full max-w-md">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={serialSearch}
                                onChange={(e) => setSerialSearch(e.target.value)}
                                placeholder="Seri numarası ara... (BRG9-...)"
                                className="w-full h-8 rounded-lg bg-white/5 border border-white/5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                    </form>
                </div>

                {/* Right — Alerts + User */}
                <div className="flex items-center gap-2 px-4 flex-shrink-0">
                    {/* Alerts */}
                    <div className="relative">
                        <button
                            onClick={() => setShowAlerts(!showAlerts)}
                            className="relative p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Bell className="w-4 h-4" />
                            {alerts.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                                    {alerts.length > 9 ? '9+' : alerts.length}
                                </span>
                            )}
                        </button>

                        {/* Alert dropdown */}
                        {showAlerts && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowAlerts(false)} />
                                <div className="absolute right-0 top-10 w-80 bg-[#1e2536] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                                        <span className="text-sm font-semibold">Uyarılar</span>
                                        <span className="text-xs text-muted-foreground">{alerts.length} aktif</span>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {alerts.length === 0 ? (
                                            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                Aktif uyarı yok
                                            </div>
                                        ) : (
                                            alerts.slice(0, 10).map(alert => (
                                                <div
                                                    key={alert.id}
                                                    className="px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                                                    onClick={() => { navigate('/inventory?filter=critical'); setShowAlerts(false); }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.alertType === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                        <span className="text-sm font-medium truncate">{alert.partName}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Stok: {alert.currentStock} / Min: {alert.minLevel}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* User info */}
                    <div className="hidden md:flex items-center gap-2 pl-2 border-l border-white/5">
                        <div className="text-right">
                            <div className="text-xs font-medium text-foreground">{user?.displayName || user?.email}</div>
                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${ROLE_COLORS[user?.role || ''] || 'bg-muted text-muted-foreground'}`}>
                                {user?.role}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ==================== SIDEBAR ==================== */}
            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <div className={cn(
                "fixed top-12 bottom-0 left-0 z-40 w-64 bg-[#141821] border-r border-white/5 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:top-0 md:pt-12 flex flex-col",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Nav sections */}
                <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                    {NAV_SECTIONS.map((section) => {
                        const visibleItems = section.items.filter(canAccess);
                        if (visibleItems.length === 0) return null;
                        const isCollapsed = collapsedSections[section.title];
                        return (
                            <div key={section.title}>
                                <button
                                    onClick={() => toggleSection(section.title)}
                                    className="flex items-center gap-1 w-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                >
                                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    {section.title}
                                </button>
                                {!isCollapsed && (
                                    <div className="space-y-0.5 mb-2">
                                        {visibleItems.map((item) => {
                                            const isActive = item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href);
                                            return (
                                                <Link
                                                    key={item.href}
                                                    to={item.href}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                                                        isActive
                                                            ? "bg-blue-500/10 text-blue-400"
                                                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                                    )}
                                                >
                                                    {isActive && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />
                                                    )}
                                                    <item.icon className={cn("h-4 w-4 transition-colors flex-shrink-0", isActive ? "text-blue-400" : "text-muted-foreground group-hover:text-foreground")} />
                                                    <span className="truncate">{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Sidebar footer */}
                <div className="p-3 border-t border-white/5">
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all"
                    >
                        <LogOut className="h-4 w-4" />
                        Çıkış Yap
                    </button>
                </div>
            </div>

            {/* ==================== MAIN CONTENT ==================== */}
            <main className="flex-1 overflow-hidden relative flex flex-col pt-12">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/3 via-background to-slate-900/3 pointer-events-none" />
                <div className="flex-1 overflow-auto relative z-10">
                    <Outlet />
                </div>
            </main>

            <Toaster position="top-right" theme="dark" richColors closeButton />
        </div>
    );
}
