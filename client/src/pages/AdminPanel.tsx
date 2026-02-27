import { useEffect, useState } from 'react';
import { Users, Plus, X, Shield, Mail, Check, Ban, Edit2 } from 'lucide-react';
import { getAllUsers, createPendingUser, updateUserProfile } from '../lib/firestoreService';
import type { AppUser, UserRole } from '../lib/types';
import { useAuth } from '../context/AuthContext';

const MODULES = [
    { key: 'production', label: 'Üretim Emirleri' },
    { key: 'serial', label: 'Seri Takip' },
    { key: 'quality', label: 'Kalite Kontrol' },
    { key: 'inventory', label: 'Stok Yönetimi' },
    { key: 'procurement', label: 'Satın Alma' },
    { key: 'models', label: 'Modeller' },
    { key: 'documents', label: 'Dökümanlar' },
];

const ROLES: UserRole[] = ['Admin', 'Engineer', 'Technician'];

export default function AdminPanel() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [showNewUser, setShowNewUser] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    // Form
    const [formEmail, setFormEmail] = useState('');
    const [formName, setFormName] = useState('');
    const [formRole, setFormRole] = useState<UserRole>('Technician');
    const [formModules, setFormModules] = useState<string[]>([]);

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        const u = await getAllUsers();
        setUsers(u);
        setLoading(false);
    };

    const handleCreateUser = async () => {
        if (!formEmail || !formName) return;
        await createPendingUser(formEmail, formName, formRole, formModules);
        resetForm();
        loadUsers();
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;
        await updateUserProfile(editingUser.uid, {
            role: formRole,
            allowedModules: formModules,
        });
        setEditingUser(null);
        resetForm();
        loadUsers();
    };

    const toggleApproval = async (u: AppUser) => {
        await updateUserProfile(u.uid, { isApproved: !u.isApproved });
        loadUsers();
    };

    const startEdit = (u: AppUser) => {
        setEditingUser(u);
        setFormEmail(u.email);
        setFormName(u.displayName);
        setFormRole(u.role);
        setFormModules(u.allowedModules || []);
    };

    const toggleModule = (mod: string) => {
        setFormModules(prev =>
            prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
        );
    };

    const resetForm = () => {
        setShowNewUser(false);
        setEditingUser(null);
        setFormEmail(''); setFormName(''); setFormRole('Technician'); setFormModules([]);
    };

    if (currentUser?.role !== 'Admin') {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Shield className="w-12 h-12 mx-auto mb-3 text-red-400 opacity-50" />
                    <p className="text-lg font-semibold text-foreground">Yetkisiz Erişim</p>
                    <p className="text-sm text-muted-foreground mt-1">Bu sayfaya sadece yöneticiler erişebilir.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Users className="w-6 h-6 text-amber-400" />
                        Kullanıcı Yönetimi
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Kullanıcı hesaplarını ve yetkilerini yönetin</p>
                </div>
                <button
                    onClick={() => setShowNewUser(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Yeni Kullanıcı
                </button>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto space-y-3">
                {loading ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Yükleniyor...</p>
                ) : users.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Henüz kullanıcı yok</p>
                ) : (
                    users.map(u => (
                        <div key={u.uid} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex items-center gap-4">
                            {/* Avatar */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${u.role === 'Admin' ? 'bg-amber-500/10 text-amber-400' :
                                    u.role === 'Engineer' ? 'bg-blue-500/10 text-blue-400' :
                                        'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                <span className="text-lg font-bold">{u.displayName?.charAt(0).toUpperCase() || '?'}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-foreground">{u.displayName}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${u.role === 'Admin' ? 'bg-amber-500/10 text-amber-400' :
                                            u.role === 'Engineer' ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-emerald-500/10 text-emerald-400'
                                        }`}>
                                        {u.role}
                                    </span>
                                    {!u.isApproved && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">Onaysız</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Mail className="w-3 h-3" />
                                    {u.email}
                                </div>
                                {u.allowedModules && u.allowedModules.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {u.allowedModules.map(m => (
                                            <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{m}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={() => toggleApproval(u)}
                                    className={`p-2 rounded-lg transition-colors ${u.isApproved ? 'hover:bg-red-500/10 text-emerald-400 hover:text-red-400' : 'hover:bg-emerald-500/10 text-red-400 hover:text-emerald-400'}`}
                                    title={u.isApproved ? 'Devre Dışı Bırak' : 'Onayla'}
                                >
                                    {u.isApproved ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => startEdit(u)}
                                    className="p-2 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                                    title="Düzenle"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New / Edit User Modal */}
            {(showNewUser || editingUser) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass-modal rounded-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h3>
                            <button onClick={resetForm} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            {!editingUser && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">E-Posta</label>
                                        <input value={formEmail} onChange={e => setFormEmail(e.target.value)}
                                            placeholder="kullanici@brgdefence.com"
                                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ad Soyad</label>
                                        <input value={formName} onChange={e => setFormName(e.target.value)}
                                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Rol</label>
                                <select value={formRole} onChange={e => setFormRole(e.target.value as UserRole)}
                                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50">
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Yetkili Modüller</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {MODULES.map(mod => (
                                        <button
                                            key={mod.key}
                                            type="button"
                                            onClick={() => toggleModule(mod.key)}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${formModules.includes(mod.key)
                                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    : 'bg-white/5 text-muted-foreground border border-white/5 hover:bg-white/10'
                                                }`}
                                        >
                                            {formModules.includes(mod.key) ? '✓ ' : ''}{mod.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={editingUser ? handleUpdateUser : handleCreateUser}
                            disabled={!editingUser && (!formEmail || !formName)}
                            className="w-full mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:from-amber-600 hover:to-orange-700 transition-all"
                        >
                            {editingUser ? 'Güncelle' : 'Kullanıcı Oluştur'}
                        </button>
                        {!editingUser && (
                            <p className="text-[10px] text-muted-foreground text-center mt-3">
                                Not: Kullanıcı oluşturulduktan sonra Firebase Console üzerinden şifre atamanız gerekir.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
