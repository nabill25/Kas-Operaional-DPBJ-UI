/**
 * Implementasi Supabase untuk AuthProvider (login) dan StorageProvider (berkas).
 *
 * - SUPABASE_URL + SUPABASE_ANON_KEY : verifikasi password (login & ganti password).
 * - SUPABASE_SERVICE_ROLE_KEY        : kelola akun (Admin API) & berkas di bucket privat. RAHASIA, hanya di server.
 * Nama VITE_SUPABASE_* juga diterima sebagai cadangan agar .env lokal tidak perlu diubah.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AuthGagal, type AuthProvider, type StorageProvider } from './providers';

export interface KonfigSupabase {
  url: string;
  anonKey: string;
  serviceKey: string;
  bucket: string;
}

export function konfigSupabaseDariEnv(env: NodeJS.ProcessEnv = process.env, bucket = 'berkas'): KonfigSupabase {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const kurang = [
    !url && 'SUPABASE_URL',
    !anonKey && 'SUPABASE_ANON_KEY',
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);
  if (kurang.length > 0) {
    throw new Error(`Variabel lingkungan Supabase belum diisi: ${kurang.join(', ')}`);
  }
  return { url: url!, anonKey: anonKey!, serviceKey: serviceKey!, bucket };
}

const SESI_NONAKTIF = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

function adalahTidakDitemukan(err: { message: string; statusCode?: string | number }): boolean {
  return String(err.statusCode ?? '') === '404' || /not found|does not exist/i.test(err.message);
}

/**
 * Tambahkan nama file unduhan ke URL bertanda tangan. Sengaja tidak memakai opsi `download` storage-js,
 * karena opsi itu meng-encode nama dua kali (URLSearchParams lalu encodeURI): "(révisi)" jadi "%28r%C3%A9visi%29".
 */
export function tambahNamaUnduh(signedUrl: string, nama: string): string {
  return `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(nama)}`;
}

function adalahEmailSudahAda(err: { message: string; code?: string; status?: number }): boolean {
  return err.code === 'email_exists' || /already (been )?registered|already exists/i.test(err.message);
}

export function buatSupabase(k: KonfigSupabase): { auth: AuthProvider; storage: StorageProvider } {
  const anon: SupabaseClient = createClient(k.url, k.anonKey, { auth: SESI_NONAKTIF });
  const admin: SupabaseClient = createClient(k.url, k.serviceKey, { auth: SESI_NONAKTIF });

  const auth: AuthProvider = {
    async masuk(email, password) {
      const { data, error } = await anon.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.code === 'email_not_confirmed') throw new AuthGagal('belum_dikonfirmasi', error.message);
        if (error.status === 429) throw new AuthGagal('terbatas', error.message);
        // Tanpa status (gangguan jaringan) atau 5xx: bukan salah password, biarkan jadi error server.
        if (!error.status || error.status >= 500) throw error;
        return null;
      }
      return data.user ? { id: data.user.id, email: data.user.email ?? email } : null;
    },

    async buat(email, password) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) {
        if (adalahEmailSudahAda(error)) throw new AuthGagal('email_sudah_ada', error.message);
        throw error;
      }
      return { id: data.user.id, email: data.user.email ?? email };
    },

    async cariByEmail(email) {
      const perHalaman = 1000;
      for (let halaman = 1; halaman <= 50; halaman++) {
        const { data, error } = await admin.auth.admin.listUsers({ page: halaman, perPage: perHalaman });
        if (error) throw error;
        const ketemu = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
        if (ketemu) return { id: ketemu.id, email: ketemu.email ?? email };
        if (data.users.length < perHalaman) break;
      }
      return null;
    },

    async ubahPassword(id, password) {
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
    },

    async ubahEmail(id, email) {
      const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (error) throw error;
    },

    async hapus(id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    },
  };

  const storage: StorageProvider = {
    async buatUrlUnggah(key) {
      const { data, error } = await admin.storage.from(k.bucket).createSignedUploadUrl(key);
      if (error) throw error;
      return data.signedUrl;
    },

    async baca(key) {
      const { data, error } = await admin.storage.from(k.bucket).download(key);
      if (error) {
        if (adalahTidakDitemukan(error)) return null;
        throw error;
      }
      return Buffer.from(await data.arrayBuffer());
    },

    async urlUnduh(key, namaUnduh, detik) {
      const { data, error } = await admin.storage.from(k.bucket).createSignedUrl(key, detik);
      if (error) {
        if (adalahTidakDitemukan(error)) return null;
        throw error;
      }
      return namaUnduh ? tambahNamaUnduh(data.signedUrl, namaUnduh) : data.signedUrl;
    },

    async hapus(keys) {
      if (keys.length === 0) return;
      const { error } = await admin.storage.from(k.bucket).remove(keys);
      if (error) throw error;
    },
  };

  return { auth, storage };
}
