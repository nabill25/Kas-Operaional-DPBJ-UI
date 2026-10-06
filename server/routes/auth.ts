import { Router } from 'express';
import type { Role } from '../../shared/constants';
import type { User } from '../../shared/types';
import { validateGantiPassword } from '../../shared/validation';
import {
  LoginLimiter,
  SESSION_COOKIE,
  createSession,
  deleteSession,
  deleteUserSessions,
  hashPassword,
  readCookie,
  requireAuth,
  userOf,
  verifyPassword,
} from '../auth';
import type { AppConfig } from '../config';
import { nowIso, type Db } from '../db-pg';
import { HttpError, assertValid, badRequest } from '../http';

export interface UserRow {
  id: number;
  username: string;
  nama: string;
  role: Role;
  password_hash: string;
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
    aktif: row.aktif === true || (row.aktif as unknown as number) === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function authRoutes(db: Db, cfg: AppConfig): Router {
  const r = Router();
  const limiter = new LoginLimiter();
  const hashTiruan = hashPassword('tidak-dipakai-' + Math.random());

  r.post('/login', async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const errors: Record<string, string> = {};
    if (!username) errors.username = 'Username wajib diisi';
    if (!password) errors.password = 'Password wajib diisi';
    if (Object.keys(errors).length > 0) throw badRequest('Username dan password wajib diisi', errors);

    const key = `${req.ip ?? '-'}|${username}`;
    const sisa = limiter.sisaBlokirMenit(key);
    if (sisa > 0) throw new HttpError(429, `Terlalu banyak percobaan masuk. Coba lagi dalam ${sisa} menit.`);

    const row = await db.get<UserRow>('SELECT * FROM users WHERE username = ?', username);
    const cocok = verifyPassword(password, row?.password_hash ?? hashTiruan);
    if (!row || !cocok) {
      limiter.catatGagal(key);
      throw new HttpError(401, 'Username atau password salah');
    }
    if (!row.aktif && (row.aktif as unknown as number) !== 1) throw new HttpError(403, 'Akun Anda nonaktif. Hubungi administrator.');
    limiter.reset(key);

    const { token, expiresAt } = await createSession(db, row.id, cfg.sessionDays);
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
    if (!row || !verifyPassword(data.password_lama, row.password_hash)) {
      throw badRequest('Password lama salah', { password_lama: 'Password lama salah' });
    }
    await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(data.password_baru), nowIso(), user.id);
    await deleteUserSessions(db, user.id, readCookie(req, SESSION_COOKIE) ?? undefined);
    res.json({ ok: true });
  });

  return r;
}
