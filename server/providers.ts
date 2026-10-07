/**
 * Kontrak untuk layanan Supabase yang dipakai server: login (Supabase Auth) dan berkas (Supabase Storage).
 * Implementasi nyata ada di supabase.ts; pengujian memakai implementasi tiruan di tests/support.
 */

export interface AuthUser {
  /** uuid dari auth.users (Supabase). */
  id: string;
  email: string;
}

export type AuthGagalKode = 'email_sudah_ada' | 'belum_dikonfirmasi' | 'terbatas';

export class AuthGagal extends Error {
  readonly kode: AuthGagalKode;

  constructor(kode: AuthGagalKode, message: string) {
    super(message);
    this.name = 'AuthGagal';
    this.kode = kode;
  }
}

export interface AuthProvider {
  /** Verifikasi email & password. Mengembalikan null bila kredensial salah. */
  masuk(email: string, password: string): Promise<AuthUser | null>;
  /** Buat akun login baru (email sudah dikonfirmasi). Melempar AuthGagal('email_sudah_ada') bila email terpakai. */
  buat(email: string, password: string): Promise<AuthUser>;
  cariByEmail(email: string): Promise<AuthUser | null>;
  ubahPassword(id: string, password: string): Promise<void>;
  ubahEmail(id: string, email: string): Promise<void>;
  hapus(id: string): Promise<void>;
}

export interface StorageProvider {
  /** URL bertanda tangan untuk unggah langsung (PUT) dari browser. Berlaku ±2 jam. */
  buatUrlUnggah(key: string): Promise<string>;
  /** Isi objek, atau null bila objek belum ada. */
  baca(key: string): Promise<Buffer | null>;
  /** URL unduh sementara, atau null bila objek tidak ada. `namaUnduh` bila diisi → unduhan dengan nama file tersebut. */
  urlUnduh(key: string, namaUnduh: string | null, detik: number): Promise<string | null>;
  hapus(keys: string[]): Promise<void>;
}
