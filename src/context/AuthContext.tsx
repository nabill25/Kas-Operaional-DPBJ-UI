import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Role } from '../../shared/constants';
import type { User } from '../../shared/types';
import { ApiError, api, setUnauthorizedHandler } from '../lib/api';

interface AuthNilai {
  user: User | null;
  siap: boolean;
  masuk: (username: string, password: string) => Promise<User>;
  keluar: () => Promise<void>;
  punyaPeran: (...peran: Role[]) => boolean;
}

const AuthContext = createContext<AuthNilai | null>(null);

const tunda = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [siap, setSiap] = useState(false);
  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let batal = false;
    (async () => {
      // Server API mungkin baru menyala bersamaan dengan Vite → coba ulang beberapa kali.
      for (let percobaan = 0; percobaan < 12 && !batal; percobaan++) {
        try {
          const res = await api<{ user: User | null }>('/auth/me');
          if (!batal) setUser(res.user);
          break;
        } catch (err) {
          if (err instanceof ApiError && err.status > 0 && err.status < 500) break; // 401 = belum login
          await tunda(700);
        }
      }
      if (!batal) setSiap(true);
    })();
    return () => {
      batal = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!userRef.current) return;
      setUser(null);
      qc.clear();
      toast.error('Sesi Anda berakhir. Silakan masuk kembali.', { id: 'sesi-berakhir' });
    });
    return () => setUnauthorizedHandler(null);
  }, [qc]);

  const masuk = useCallback(
    async (username: string, password: string) => {
      const res = await api<{ user: User }>('/auth/login', { body: { username, password } });
      qc.clear();
      setUser(res.user);
      return res.user;
    },
    [qc],
  );

  const keluar = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      qc.clear();
      try {
        // Status per-tab (mis. ringkasan notifikasi sudah tampil) direset agar login berikutnya mendapat ringkasan lagi.
        sessionStorage.clear();
      } catch {
        // penyimpanan tidak tersedia
      }
    }
  }, [qc]);

  const punyaPeran = useCallback((...peran: Role[]) => !!user && peran.includes(user.role), [user]);

  const nilai = useMemo(() => ({ user, siap, masuk, keluar, punyaPeran }), [user, siap, masuk, keluar, punyaPeran]);
  return <AuthContext.Provider value={nilai}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthNilai {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}

/** User yang sudah pasti login (dipakai di halaman terlindungi). */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('Belum login');
  return user;
}
