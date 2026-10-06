import { TriangleAlert, Info } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

interface OpsiKonfirmasi {
  judul: string;
  pesan: ReactNode;
  teksYa?: string;
  teksBatal?: string;
  varian?: 'utama' | 'bahaya';
}

type FungsiKonfirmasi = (opsi: OpsiKonfirmasi) => Promise<boolean>;

const KonfirmasiContext = createContext<FungsiKonfirmasi | null>(null);

export function KonfirmasiProvider({ children }: { children: ReactNode }) {
  const [opsi, setOpsi] = useState<OpsiKonfirmasi | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const konfirmasi = useCallback<FungsiKonfirmasi>((o) => {
    resolver.current?.(false);
    setOpsi(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const selesai = (hasil: boolean) => {
    resolver.current?.(hasil);
    resolver.current = null;
    setOpen(false);
  };

  return (
    <KonfirmasiContext.Provider value={konfirmasi}>
      {children}
      <Modal
        open={open}
        onOpenChange={(o) => !o && selesai(false)}
        lebar="sm"
        judul={opsi?.judul ?? ''}
        ikon={opsi?.varian === 'bahaya' ? <TriangleAlert className="size-5" /> : <Info className="size-5" />}
        footer={
          <>
            <Button varian="kedua" onClick={() => selesai(false)}>
              {opsi?.teksBatal ?? 'Batal'}
            </Button>
            <Button varian={opsi?.varian === 'bahaya' ? 'bahaya' : 'utama'} onClick={() => selesai(true)} autoFocus>
              {opsi?.teksYa ?? 'Ya, lanjutkan'}
            </Button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-fg-muted">{opsi?.pesan}</div>
      </Modal>
    </KonfirmasiContext.Provider>
  );
}

export function useKonfirmasi(): FungsiKonfirmasi {
  const ctx = useContext(KonfirmasiContext);
  if (!ctx) throw new Error('useKonfirmasi harus dipakai di dalam KonfirmasiProvider');
  return ctx;
}
