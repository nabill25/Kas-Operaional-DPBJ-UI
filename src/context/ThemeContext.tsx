import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Tema = 'terang' | 'gelap';

interface TemaNilai {
  tema: Tema;
  setTema: (t: Tema) => void;
  ganti: () => void;
}

const KUNCI = 'kas-tema';
const TemaContext = createContext<TemaNilai | null>(null);

function bacaTersimpan(): Tema | null {
  try {
    const v = localStorage.getItem(KUNCI);
    return v === 'terang' || v === 'gelap' ? v : null;
  } catch {
    return null;
  }
}

function temaSistem(): Tema {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(() => bacaTersimpan() ?? temaSistem());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', tema === 'gelap');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'gelap' ? '#050D24' : '#EEF2FA');
  }, [tema]);

  // Ikuti perubahan tema sistem selama pengguna belum memilih sendiri.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const ubah = () => {
      if (!bacaTersimpan()) setTemaState(mq.matches ? 'gelap' : 'terang');
    };
    mq.addEventListener('change', ubah);
    return () => mq.removeEventListener('change', ubah);
  }, []);

  const setTema = useCallback((t: Tema) => {
    setTemaState(t);
    try {
      localStorage.setItem(KUNCI, t);
    } catch {
      // penyimpanan tidak tersedia (mode privat) — tema tetap berlaku untuk sesi ini
    }
  }, []);

  const ganti = useCallback(() => setTema(tema === 'gelap' ? 'terang' : 'gelap'), [tema, setTema]);
  const nilai = useMemo(() => ({ tema, setTema, ganti }), [tema, setTema, ganti]);
  return <TemaContext.Provider value={nilai}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaNilai {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error('useTema harus dipakai di dalam ThemeProvider');
  return ctx;
}
