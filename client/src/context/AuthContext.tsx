import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, meApi } from '../services/api';
import type { AppUser } from '../lib/types';

interface AuthContextType {
    user: AppUser | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const userData = await meApi();
                if (userData && userData.user) {
                    // API returns user details, we can map it to our frontend types
                    setUser({
                        id: userData.user.id.toString(),
                        uid: userData.user.id.toString(), // Keep uid for legacy compatibility if needed
                        email: userData.user.email,
                        displayName: userData.user.full_name || userData.user.username,
                        role: userData.user.role,
                        department: userData.user.department,
                        isApproved: userData.user.is_active,
                        createdAt: Date.now() // Mock for now or map from response
                    } as unknown as AppUser);
                } else {
                    localStorage.removeItem('token');
                    setUser(null);
                }
            } catch (err) {
                console.error('Failed to restore session:', err);
                localStorage.removeItem('token');
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = async (email: string, password: string) => {
        setError(null);
        try {
            const result = await loginApi({ email, password });

            if (result.error) {
                setError(result.error);
                return;
            }

            if (result.token) {
                localStorage.setItem('token', result.token);
                // The API format returns { token, user: {...} }
                setUser({
                    id: result.user.id.toString(),
                    uid: result.user.id.toString(),
                    email: result.user.email,
                    displayName: result.user.full_name || result.user.username,
                    role: result.user.role,
                    department: result.user.department,
                    isApproved: result.user.is_active,
                    createdAt: Date.now()
                } as unknown as AppUser);
            } else {
                setError('Giriş başarısız: Token alınamadı.');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Geçersiz e-posta veya şifre.');
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, error }}>
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
