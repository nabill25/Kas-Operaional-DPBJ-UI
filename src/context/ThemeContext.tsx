import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Mode tampilan (terang/gelap). */
export type Tema = 'terang' | 'gelap';

/** Tema warna (palet) — diatur di halaman Pengaturan. Nilai CSS-nya ada di index.css ([data-warna]). */
export const WARNA_LIST = ['dpbj', 'ui'] as const;
export type Warna = (typeof WARNA_LIST)[number];

interface TemaNilai {
  tema: Tema;
  setTema: (t: Tema) => void;
  ganti: () => void;
  warna: Warna;
  setWarna: (w: Warna) => void;
}

const KUNCI = 'kas-tema';
const KUNCI_WARNA = 'kas-warna';
const TemaContext = createContext<TemaNilai | null>(null);

/** Warna bilah browser (meta theme-color) = warna latar halaman per tema warna & mode. */
const WARNA_BILAH: Record<Warna, Record<Tema, string>> = {
  dpbj: { terang: '#EEF2FA', gelap: '#050D24' },
  ui: { terang: '#F4F3ED', gelap: '#0C0C0B' },
};

function bacaTersimpan(): Tema | null {
  try {
    const v = localStorage.getItem(KUNCI);
    return v === 'terang' || v === 'gelap' ? v : null;
  } catch {
    return null;
  }
}

function bacaWarna(): Warna {
  try {
    const v = localStorage.getItem(KUNCI_WARNA);
    return (WARNA_LIST as readonly string[]).includes(v ?? '') ? (v as Warna) : 'dpbj';
  } catch {
    return 'dpbj';
  }
}

function temaSistem(): Tema {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(() => bacaTersimpan() ?? temaSistem());
  const [warna, setWarnaState] = useState<Warna>(bacaWarna);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', tema === 'gelap');
    root.dataset.warna = warna;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', WARNA_BILAH[warna][tema]);
  }, [tema, warna]);

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

  const setWarna = useCallback((w: Warna) => {
    setWarnaState(w);
    try {
      localStorage.setItem(KUNCI_WARNA, w);
    } catch {
      // penyimpanan tidak tersedia — pilihan tetap berlaku untuk sesi ini
    }
  }, []);

  const ganti = useCallback(() => setTema(tema === 'gelap' ? 'terang' : 'gelap'), [tema, setTema]);
  const nilai = useMemo(() => ({ tema, setTema, ganti, warna, setWarna }), [tema, setTema, ganti, warna, setWarna]);
  return <TemaContext.Provider value={nilai}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaNilai {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error('useTema harus dipakai di dalam ThemeProvider');
  return ctx;
}
