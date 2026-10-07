import { describe, expect, it } from 'vitest';
import { urlLewatPooler } from '../../server/db-pg';
import { bacaEnv } from '../../server/env';
import { PESAN_TANPA_SERVICE_KEY, buatSupabase, konfigSupabaseDariEnv, tambahNamaUnduh } from '../../server/supabase';

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.tandatangan`;

describe('Environment Vercel yang toleran', () => {
  it('nama tidak peka huruf besar/kecil; spasi & kutip di tepi dibuang', () => {
    expect(bacaEnv({ supabase_service_role_key: '  "abc"  ' }, 'SUPABASE_SERVICE_ROLE_KEY')).toBe('abc');
    expect(bacaEnv({ SUPABASE_URL: ' https://x.supabase.co ' }, 'SUPABASE_URL')).toBe('https://x.supabase.co');
    expect(bacaEnv({ A: '', B: 'isi' }, 'A', 'B')).toBe('isi');
    expect(bacaEnv({ A: '   ' }, 'A')).toBeUndefined();
  });

  it('service role key: nama huruf kecil diterima; kosong atau tertukar anon → server tetap jalan dengan peringatan', () => {
    const dasar = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) };
    const ok = konfigSupabaseDariEnv({ ...dasar, supabase_service_role_key: jwt({ role: 'service_role' }) });
    expect(ok.serviceKey).toContain('.');
    expect(ok.peringatan).toEqual([]);

    const tertukar = konfigSupabaseDariEnv({ ...dasar, SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'anon' }) });
    expect(tertukar.serviceKey).toBeNull();
    expect(tertukar.peringatan[0]).toContain('bukan service_role');

    const kosong = konfigSupabaseDariEnv(dasar);
    expect(kosong.serviceKey).toBeNull();
    expect(kosong.peringatan[0]).toContain('SUPABASE_SERVICE_ROLE_KEY belum diisi');

    // Kunci format baru (bukan JWT) tidak diperiksa isinya
    expect(konfigSupabaseDariEnv({ ...dasar, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' }).serviceKey).toBe('sb_secret_abc');
  });

  it('DATABASE_URL host direct (IPv6) dialihkan ke Transaction pooler; URL lain tidak diubah', () => {
    expect(urlLewatPooler('postgresql://postgres:p%40ss%23w@db.abcref.supabase.co:5432/postgres')).toBe(
      'postgresql://postgres.abcref:p%40ss%23w@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
    );
    expect(urlLewatPooler('postgres://postgres:x@db.abcref.supabase.co:5432/postgres', 'aws-1-eu-central-1.pooler.supabase.com')).toBe(
      'postgres://postgres.abcref:x@aws-1-eu-central-1.pooler.supabase.com:6543/postgres',
    );
    const pooler = 'postgresql://postgres.abcref:x@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';
    expect(urlLewatPooler(pooler)).toBe(pooler);
    expect(urlLewatPooler('postgres://postgres@127.0.0.1:5432/kas')).toBe('postgres://postgres@127.0.0.1:5432/kas');
    expect(urlLewatPooler('bukan url')).toBe('bukan url');
  });
});

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

  it('URL & anon key wajib: menyebut nama variabel yang kurang, tanpa membocorkan nilai', () => {
    expect(() => konfigSupabaseDariEnv({ SUPABASE_URL: 'https://rahasia.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 's' })).toThrow(
      'Variabel lingkungan Supabase belum diisi: SUPABASE_ANON_KEY.',
    );
    expect(() => konfigSupabaseDariEnv({})).toThrow('SUPABASE_URL, SUPABASE_ANON_KEY');
  });

  it('tanpa service key: fitur admin & storage menjawab 503 dengan petunjuk, bukan crash', async () => {
    const { auth, storage } = buatSupabase(konfigSupabaseDariEnv({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' }));
    await expect(storage.buatUrlUnggah('1/a.pdf')).rejects.toMatchObject({ status: 503, message: PESAN_TANPA_SERVICE_KEY });
    await expect(auth.buat('a@b.co', 'rahasia1')).rejects.toMatchObject({ status: 503 });
    await expect(storage.hapus(['1/a.pdf'])).rejects.toMatchObject({ status: 503 });
  });
});
