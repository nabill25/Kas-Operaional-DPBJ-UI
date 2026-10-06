import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../shared/constants';
import { nowIso, type Db } from './db-pg';
import { forbidden, unauthorized } from './http';
import type { SessionUser } from './types';

export const SESSION_COOKIE = 'kas_sid';

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sha256(v: string): string {
  return crypto.createHash('sha256').update(v).digest('hex');
}

export async function createSession(db: Db, userId: number, days: number): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  await db.run(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    sha256(token),
    userId,
    nowIso(),
    expiresAt.toISOString(),
  );
  return { token, expiresAt };
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
}

export async function deleteUserSessions(db: Db, userId: number, kecualiToken?: string): Promise<void> {
  if (kecualiToken) {
    await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', userId, sha256(kecualiToken));
  } else {
    await db.run('DELETE FROM sessions WHERE user_id = ?', userId);
  }
}

export async function purgeExpiredSessions(db: Db): Promise<void> {
  await db.run('DELETE FROM sessions WHERE expires_at <= ?', nowIso());
}

export async function getUserByToken(db: Db, token: string): Promise<SessionUser | null> {
  const row = await db.get<SessionUser>(
    `SELECT u.id, u.username, u.nama, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.aktif = true`,
    sha256(token),
    nowIso(),
  );
  return row ? { id: row.id, username: row.username, nama: row.nama, role: row.role } : null;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Pasang req.user bila cookie sesi valid (tidak menolak request). */
export function sessionMiddleware(db: Db) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = readCookie(req, SESSION_COOKIE);
      if (token) req.user = (await getUserByToken(db, token)) ?? undefined;
    } catch (err) {
      console.error('[auth] sessionMiddleware error:', err);
    }
    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw unauthorized();
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Ambil user dari request yang sudah melewati requireAuth. */
export function userOf(req: Request): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

/** Pembatas percobaan login sederhana (in-memory) per IP + username. */
export class LoginLimiter {
  private readonly gagal = new Map<string, { jumlah: number; sejak: number; blokirSampai: number }>();
  private readonly maks: number;
  private readonly jendelaMs: number;

  constructor(maks = 10, jendelaMs = 15 * 60_000) {
    this.maks = maks;
    this.jendelaMs = jendelaMs;
  }

  sisaBlokirMenit(key: string): number {
    const e = this.gagal.get(key);
    if (!e) return 0;
    const sisa = e.blokirSampai - Date.now();
    return sisa > 0 ? Math.ceil(sisa / 60_000) : 0;
  }

  catatGagal(key: string): void {
    const now = Date.now();
    const e = this.gagal.get(key);
    if (!e || now - e.sejak > this.jendelaMs) {
      this.gagal.set(key, { jumlah: 1, sejak: now, blokirSampai: 0 });
      return;
    }
    e.jumlah++;
    if (e.jumlah >= this.maks) e.blokirSampai = now + this.jendelaMs;
  }

  reset(key: string): void {
    this.gagal.delete(key);
  }
}
