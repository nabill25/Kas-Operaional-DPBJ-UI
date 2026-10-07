import { Router } from 'express';
import type { Role } from '../../shared/constants';
import type { User } from '../../shared/types';
import { EMAIL_RE, validateGantiPassword } from '../../shared/validation';
import {
  LoginLimiter,
  SESSION_COOKIE,
  createSession,
  deleteSession,
  deleteUserSessions,
  purgeExpiredSessions,
  readCookie,
  requireAuth,
  userOf,
} from '../auth';
import type { AppConfig } from '../config';
import { nowIso, type Db } from '../db-pg';
import { HttpError, assertValid, badRequest, conflict } from '../http';
import { AuthGagal, type AuthProvider } from '../providers';

export interface UserRow {
  id: number;
  auth_id: string | null;
  username: string;
  nama: string;
  role: Role;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export function keUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    nama: row.nama,
    role: row.role,
    aktif: row.aktif === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Terjemahkan kegagalan Supabase Auth menjadi respons HTTP yang bisa dipahami pengguna. */
function ubahGagalAuth(err: unknown): unknown {
  if (err instanceof AuthGagal) {
    if (err.kode === 'belum_dikonfirmasi') {
      return new HttpError(403, 'Email belum dikonfirmasi. Konfirmasi akun di Supabase Authentication, lalu coba lagi.');
    }
    if (err.kode === 'terbatas') {
      return new HttpError(429, 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    }
  }
  return err;
}

export function authRoutes(db: Db, cfg: AppConfig, auth: AuthProvider): Router {
  const r = Router();
  const limiter = new LoginLimiter();

  r.post('/login', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const errors: Record<string, string> = {};
    if (!email) errors.username = 'Email wajib diisi';
    else if (!EMAIL_RE.test(email)) errors.username = 'Format email tidak valid';
    if (!password) errors.password = 'Password wajib diisi';
    if (Object.keys(errors).length > 0) throw badRequest('Email dan password wajib diisi', errors);

    const key = `${req.ip ?? '-'}|${email}`;
    const sisa = limiter.sisaBlokirMenit(key);
    if (sisa > 0) throw new HttpError(429, `Terlalu banyak percobaan masuk. Coba lagi dalam ${sisa} menit.`);

    let akun;
    try {
      akun = await auth.masuk(email, password);
    } catch (err) {
      throw ubahGagalAuth(err);
    }
    if (!akun) {
      limiter.catatGagal(key);
      throw new HttpError(401, 'Email atau password salah');
    }

    let row = await db.get<UserRow>('SELECT * FROM users WHERE auth_id = ?', akun.id);
    if (!row) {
      // Profil dibuat sebelum akun login ada, atau akun login dibuat ulang di Supabase (uuid baru):
      // tautkan lewat email. Aman karena email sudah diverifikasi Supabase Auth dan profil hanya dibuat admin.
      row = await db.get<UserRow>(
        'UPDATE users SET auth_id = ?, updated_at = ? WHERE username = ? AND auth_id IS NULL RETURNING *',
        akun.id,
        nowIso(),
        email,
      );
    }
    if (!row) {
      throw new HttpError(403, 'Akun ini belum terdaftar di aplikasi. Minta administrator menambahkannya di menu Pengguna.');
    }
    if (!row.aktif) throw new HttpError(403, 'Akun Anda nonaktif. Hubungi administrator.');
    limiter.reset(key);

    const { token, expiresAt } = await createSession(db, row.id, cfg.sessionDays);
    purgeExpiredSessions(db).catch((err: Error) => console.error('[auth] purge sesi gagal:', err.message));
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cfg.cookieSecure,
      expires: expiresAt,
      path: '/',
    });
    res.json({ user: keUser(row) });
  });

  r.post('/logout', async (req, res) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await deleteSession(db, token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  r.get('/me', async (req, res) => {
    const row = req.user ? await db.get<UserRow>('SELECT * FROM users WHERE id = ?', req.user.id) : undefined;
    res.json({ user: row ? keUser(row) : null });
  });

  r.post('/password', requireAuth, async (req, res) => {
    const user = userOf(req);
    const data = assertValid(validateGantiPassword(req.body));
    const row = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', user.id);
    if (!row?.auth_id) throw conflict('Akun ini belum terhubung ke sistem login. Minta administrator memperbaikinya.');
    let cocok;
    try {
      cocok = await auth.masuk(row.username, data.password_lama);
    } catch (err) {
      throw ubahGagalAuth(err);
    }
    if (!cocok) throw badRequest('Password lama salah', { password_lama: 'Password lama salah' });
    await auth.ubahPassword(row.auth_id, data.password_baru);
    await db.run('UPDATE users SET updated_at = ? WHERE id = ?', nowIso(), user.id);
    await deleteUserSessions(db, user.id, readCookie(req, SESSION_COOKIE) ?? undefined);
    res.json({ ok: true });
  });

  return r;
}
