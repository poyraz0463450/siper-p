import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Shield, Wifi, Server, CheckCircle } from 'lucide-react';

const SECURITY_STEPS = [
    { label: 'Ağ güvenliği kontrol ediliyor...', icon: Wifi, duration: 800 },
    { label: 'Sunucu bağlantısı doğrulanıyor...', icon: Server, duration: 600 },
    { label: 'Güvenlik sertifikaları yükleniyor...', icon: Shield, duration: 500 },
    { label: 'Sistem hazır', icon: CheckCircle, duration: 400 },
];

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const [showLogin, setShowLogin] = useState(false);
    const [securityStep, setSecurityStep] = useState(0);
    const [securityDone, setSecurityDone] = useState(false);
    const { login, error: authError, user, isLoading } = useAuth();
    const navigate = useNavigate();

    // Redirect if already logged in
    useEffect(() => {
        if (user) navigate('/', { replace: true });
    }, [user, navigate]);

    // Security check animation on startup
    useEffect(() => {
        if (securityDone) return;

        if (securityStep < SECURITY_STEPS.length) {
            const timer = setTimeout(() => {
                setSecurityStep(prev => prev + 1);
            }, SECURITY_STEPS[securityStep].duration);
            return () => clearTimeout(timer);
        } else {
            setTimeout(() => {
                setSecurityDone(true);
                setShowLogin(true);
            }, 300);
        }
    }, [securityStep, securityDone]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        if (!email || !password) {
            setLocalError('E-posta ve şifre gereklidir.');
            return;
        }
        await login(email, password);
    };

    const displayError = localError || authError;

    // Security Check Splash Screen
    if (!securityDone) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
                <div className="w-full max-w-lg p-12 text-center">
                    {/* Logo */}
                    <div className="mb-10">
                        <img src="/siper-p-logo.png" alt="SİPER-P" className="mx-auto h-24 mb-4 drop-shadow-lg" />
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
                            SİPER-P
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Üretim Yönetim Sistemi</p>
                    </div>

                    {/* Security Steps */}
                    <div className="space-y-3 text-left">
                        {SECURITY_STEPS.map((step, i) => {
                            const StepIcon = step.icon;
                            const isCompleted = i < securityStep;
                            const isCurrent = i === securityStep;

                            return (
                                <div
                                    key={i}
                                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-500 ${isCompleted
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : isCurrent
                                            ? 'bg-blue-500/10 text-blue-400 animate-pulse'
                                            : 'bg-muted/30 text-muted-foreground/50'
                                        }`}
                                >
                                    <StepIcon className={`w-5 h-5 flex-shrink-0 ${isCompleted ? 'text-emerald-400' : ''}`} />
                                    <span className="text-sm font-medium">{step.label}</span>
                                    {isCompleted && <CheckCircle className="w-4 h-4 ml-auto text-emerald-400" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Loading bar */}
                    <div className="mt-8 w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(securityStep / SECURITY_STEPS.length) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Login Form
    return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/3 rounded-full blur-3xl" />
            </div>

            <div
                className={`w-full max-w-md transition-all duration-700 ease-out ${showLogin ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                    }`}
            >
                {/* Card */}
                <div className="glass-modal rounded-2xl p-8 relative">
                    {/* Top accent line */}
                    <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

                    {/* Logo */}
                    <div className="text-center mb-8">
                        <img src="/siper-p-logo.png" alt="SİPER-P" className="mx-auto h-20 mb-4 drop-shadow-lg" />
                        <h2 className="text-2xl font-bold text-foreground">
                            SİPER-P
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Güvenli Giriş
                        </p>
                    </div>

                    {/* Error */}
                    {displayError && (
                        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-start gap-2">
                            <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{displayError}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                E-Posta
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-xl border border-white/5 bg-white/5 py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="ornek@sirket.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Şifre
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
                                <input
                                    id="login-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-xl border border-white/5 bg-white/5 py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3 text-sm font-semibold text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Giriş Yapılıyor...
                                </span>
                            ) : (
                                'Giriş Yap'
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-xs text-muted-foreground/60">
                            Sadece yetkili personel erişebilir.<br />
                            Erişim talebi için yöneticinize başvurun.
                        </p>
                    </div>
                </div>

                {/* Version badge */}
                <div className="mt-4 text-center">
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                        SİPER-P v1.0 — Güvenli Bağlantı
                    </span>
                </div>
            </div>
        </div>
    );
}
