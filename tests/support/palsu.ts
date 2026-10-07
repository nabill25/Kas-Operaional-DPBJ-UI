/**
 * Tiruan Supabase Auth & Storage untuk test. Auth menyimpan akun di tabel stub auth.users
 * (agar foreign key users.auth_id tetap berlaku); Storage menyimpan objek di memori.
 */
import type { Db } from '../../server/db-pg';
import { AuthGagal, type AuthProvider, type AuthUser, type StorageProvider } from '../../server/providers';

export class AuthPalsu implements AuthProvider {
  private readonly db: Db;
  /** Email yang diperlakukan "belum dikonfirmasi" oleh Supabase. */
  readonly belumDikonfirmasi = new Set<string>();

  constructor(db: Db) {
    this.db = db;
  }

  async masuk(email: string, password: string): Promise<AuthUser | null> {
    if (this.belumDikonfirmasi.has(email)) throw new AuthGagal('belum_dikonfirmasi', 'Email not confirmed');
    const r = await this.db.get<{ id: string; email: string }>(
      'SELECT id, email FROM auth.users WHERE email = ? AND encrypted_password = ?',
      email,
      password,
    );
    return r ? { id: r.id, email: r.email } : null;
  }

  async buat(email: string, password: string): Promise<AuthUser> {
    if (await this.cariByEmail(email)) throw new AuthGagal('email_sudah_ada', 'A user with this email address has already been registered');
    const r = await this.db.get<{ id: string }>(
      'INSERT INTO auth.users (email, encrypted_password, email_confirmed_at) VALUES (?, ?, now()) RETURNING id',
      email,
      password,
    );
    return { id: r!.id, email };
  }

  async cariByEmail(email: string): Promise<AuthUser | null> {
    const r = await this.db.get<{ id: string; email: string }>('SELECT id, email FROM auth.users WHERE email = ?', email);
    return r ? { id: r.id, email: r.email } : null;
  }

  async ubahPassword(id: string, password: string): Promise<void> {
    await this.db.run('UPDATE auth.users SET encrypted_password = ? WHERE id = ?', password, id);
  }

  async ubahEmail(id: string, email: string): Promise<void> {
    await this.db.run('UPDATE auth.users SET email = ? WHERE id = ?', email, id);
  }

  async hapus(id: string): Promise<void> {
    await this.db.run('DELETE FROM auth.users WHERE id = ?', id);
  }
}

export const URL_STORAGE = 'https://storage.test';

export class StoragePalsu implements StorageProvider {
  readonly objek = new Map<string, Buffer>();

  async buatUrlUnggah(key: string): Promise<string> {
    return `${URL_STORAGE}/upload/sign/berkas/${key}?token=uji`;
  }

  /** Meniru PUT dari browser ke URL unggah. */
  taruh(key: string, isi: Buffer): void {
    this.objek.set(key, isi);
  }

  async baca(key: string): Promise<Buffer | null> {
    return this.objek.get(key) ?? null;
  }

  async urlUnduh(key: string, namaUnduh: string | null, detik: number): Promise<string | null> {
    if (!this.objek.has(key)) return null;
    const q = new URLSearchParams({ detik: String(detik) });
    if (namaUnduh) q.set('download', namaUnduh);
    return `${URL_STORAGE}/object/sign/berkas/${key}?${q}`;
  }

  async hapus(keys: string[]): Promise<void> {
    for (const k of keys) this.objek.delete(k);
  }
}
