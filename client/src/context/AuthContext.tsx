import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile } from '../lib/firestoreService';
import type { AppUser } from '../lib/types';

interface AuthContextType {
    user: AppUser | null;
    firebaseUser: FirebaseUser | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        // Safety timeout: if Firebase never fires onAuthStateChanged (e.g. invalid config),
        // force isLoading=false after 3 seconds so the login page renders
        const timeout = setTimeout(() => {
            setIsLoading(prev => {
                if (prev) console.warn('Firebase auth timeout — showing login page');
                return false;
            });
        }, 3000);

        try {
            unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
                clearTimeout(timeout);
                if (fbUser) {
                    setFirebaseUser(fbUser);
                    try {
                        const profile = await getUserProfile(fbUser.uid);
                        if (profile && profile.isApproved) {
                            setUser(profile);
                        } else {
                            setUser(null);
                            setError('Hesabınız henüz onaylanmadı. Yönetici ile iletişime geçin.');
                            await signOut(auth);
                        }
                    } catch (err) {
                        console.error('Error fetching user profile:', err);
                        setUser(null);
                    }
                } else {
                    setFirebaseUser(null);
                    setUser(null);
                }
                setIsLoading(false);
            }, (err) => {
                // Handle auth errors (e.g. invalid config)
                console.error('Auth state error:', err);
                setIsLoading(false);
            });
        } catch (err) {
            // Handle initialization errors
            console.error('Firebase auth init error:', err);
            setIsLoading(false);
        }

        return () => {
            clearTimeout(timeout);
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        setError(null);
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            const profile = await getUserProfile(result.user.uid);
            if (!profile) {
                setError('Kullanıcı profili bulunamadı. Yönetici ile iletişime geçin.');
                await signOut(auth);
                return;
            }
            if (!profile.isApproved) {
                setError('Hesabınız henüz onaylanmadı. Yönetici ile iletişime geçin.');
                await signOut(auth);
                return;
            }
            setUser(profile);
        } catch (err: any) {
            console.error('Login error:', err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                setError('Geçersiz e-posta veya şifre.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Çok fazla başarısız deneme. Lütfen bir süre bekleyin.');
            } else if (err.code === 'auth/invalid-api-key' || err.code === 'auth/api-key-not-valid') {
                setError('Firebase yapılandırma hatası. Yönetici ile iletişime geçin.');
            } else {
                setError('Giriş başarısız: ' + (err.message || 'Bilinmeyen hata'));
            }
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.error('Logout error:', err);
        }
        setUser(null);
        setFirebaseUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, firebaseUser, isLoading, login, logout, error }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
