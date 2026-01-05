'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'admin_token';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        if (savedToken) {
            setToken(savedToken);
            loadUser(savedToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    async function loadUser(authToken: string) {
        try {
            const profile = await api.getProfile(authToken);
            setUser(profile);
        } catch {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
        } finally {
            setIsLoading(false);
        }
    }

    async function login(email: string, password: string) {
        const result = await api.login(email, password);
        localStorage.setItem(TOKEN_KEY, result.accessToken);
        setToken(result.accessToken);
        await loadUser(result.accessToken);
    }

    async function register(email: string, password: string, name?: string) {
        const result = await api.register(email, password, name);
        localStorage.setItem(TOKEN_KEY, result.accessToken);
        setToken(result.accessToken);
        await loadUser(result.accessToken);
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
