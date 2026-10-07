import { describe, expect, it } from 'vitest';
import { konfigSupabaseDariEnv, tambahNamaUnduh } from '../../server/supabase';

describe('URL unduh Supabase Storage', () => {
  const signed = 'https://abc.supabase.co/storage/v1/object/sign/berkas/12/a.pdf?token=eyJ.x.y';

  it('nama file di-encode tepat satu kali (tidak ganda seperti opsi download storage-js)', () => {
    for (const nama of ['Notula Rapat (révisi).pdf', 'Invoice #12 & 13 + PPN 11%.pdf', "Daftar Hadir 'Final'.pdf"]) {
      const url = new URL(tambahNamaUnduh(signed, nama));
      expect(url.searchParams.get('download')).toBe(nama);
      expect(url.searchParams.get('token')).toBe('eyJ.x.y');
    }
  });

  it('memakai "?" bila URL belum punya query', () => {
    expect(tambahNamaUnduh('https://x.test/o', 'a b.pdf')).toBe('https://x.test/o?download=a%20b.pdf');
  });
});

describe('Konfigurasi Supabase dari environment', () => {
  it('menerima nama SUPABASE_* maupun VITE_SUPABASE_* (cadangan)', () => {
    expect(konfigSupabaseDariEnv({ SUPABASE_URL: 'u', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })).toMatchObject({ url: 'u', anonKey: 'a', serviceKey: 's', bucket: 'berkas' });
    expect(konfigSupabaseDariEnv({ VITE_SUPABASE_URL: 'u2', VITE_SUPABASE_ANON_KEY: 'a2', SUPABASE_SERVICE_ROLE_KEY: 's' })).toMatchObject({ url: 'u2', anonKey: 'a2' });
  });

  it('menyebut nama variabel yang kurang, tanpa membocorkan nilai', () => {
    expect(() => konfigSupabaseDariEnv({ SUPABASE_URL: 'https://rahasia.supabase.co' })).toThrow(
      'Variabel lingkungan Supabase belum diisi: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY',
    );
  });
});
