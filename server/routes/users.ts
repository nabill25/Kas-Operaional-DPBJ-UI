import { Router } from 'express';
import { validateUser } from '../../shared/validation';
import { deleteUserSessions, requireRole, userOf } from '../auth';
import { nowIso, type Db } from '../db-pg';
import { assertValid, badRequest, conflict, notFound, parseId } from '../http';
import { AuthGagal, type AuthProvider, type AuthUser } from '../providers';
import { keUser, type UserRow } from './auth';

export function usersRoutes(db: Db, auth: AuthProvider): Router {
  const r = Router();
  r.use(requireRole('admin'));

  r.get('/', async (_req, res) => {
    const rows = await db.all<UserRow>('SELECT * FROM users ORDER BY aktif DESC, role ASC, nama ASC');
    res.json(rows.map(keUser));
  });

  r.post('/', async (req, res) => {
    const data = assertValid(validateUser(req.body, 'buat'));
    if (await db.get('SELECT id FROM users WHERE username = ?', data.username)) {
      throw badRequest('Email sudah dipakai', { username: 'Email sudah dipakai' });
    }
    const password = data.password ?? '';

    let akun: AuthUser;
    let akunBaru = true;
    try {
      akun = await auth.buat(data.username, password);
    } catch (err) {
      if (!(err instanceof AuthGagal && err.kode === 'email_sudah_ada')) throw err;
      // Akun login sudah ada di Supabase (mis. dibuat manual): tautkan, dan setel password sesuai isian.
      const ada = await auth.cariByEmail(data.username);
      if (!ada) throw err;
      await auth.ubahPassword(ada.id, password);
      akun = ada;
      akunBaru = false;
    }

    const waktu = nowIso();
    try {
      const { lastInsertRowid } = await db.run(
        'INSERT INTO users (auth_id, username, nama, role, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
        akun.id,
        data.username,
        data.nama,
        data.role,
        data.aktif,
        waktu,
        waktu,
      );
      res.status(201).json(keUser((await db.get<UserRow>('SELECT * FROM users WHERE id = ?', lastInsertRowid))!));
    } catch (err) {
      // Profil gagal disimpan: batalkan akun login yang baru dibuat agar tidak menggantung.
      if (akunBaru) await auth.hapus(akun.id).catch((e: Error) => console.error('[users] rollback akun gagal:', e.message));
      throw err;
    }
  });

  r.put('/:id', async (req, res) => {
    const me = userOf(req);
    const id = parseId(req.params.id, 'Pengguna');
    const lama = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);
    if (!lama) throw notFound('Pengguna tidak ditemukan');
    const data = assertValid(validateUser(req.body, 'ubah'));

    const dupe = await db.get<{ id: number }>('SELECT id FROM users WHERE username = ?', data.username);
    if (dupe && dupe.id !== id) throw badRequest('Email sudah dipakai', { username: 'Email sudah dipakai' });

    if (id === me.id && (data.role !== 'admin' || !data.aktif)) {
      throw conflict('Anda tidak dapat menurunkan peran atau menonaktifkan akun Anda sendiri');
    }
    if (lama.role === 'admin' && lama.aktif && (data.role !== 'admin' || !data.aktif)) {
      const adminLain = (await db.get<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin' AND aktif = true AND id <> ?`,
        id,
      ))!.c;
      if (adminLain === 0) throw conflict('Minimal harus ada satu administrator aktif');
    }

    await db.tx(async (txDb) => {
      let authId = lama.auth_id;
      if (!authId) {
        const ada = await auth.cariByEmail(lama.username);
        if (!ada) {
          throw conflict('Akun login untuk email ini belum ada. Buat akunnya di Supabase Authentication lebih dulu.');
        }
        authId = ada.id;
      }
      if (data.username !== lama.username) await auth.ubahEmail(authId, data.username);
      if (data.password) await auth.ubahPassword(authId, data.password);
      await txDb.run(
        'UPDATE users SET auth_id = ?, username = ?, nama = ?, role = ?, aktif = ?, updated_at = ? WHERE id = ?',
        authId,
        data.username,
        data.nama,
        data.role,
        data.aktif,
        nowIso(),
        id,
      );
      if (data.password || !data.aktif || data.role !== lama.role) {
        if (id !== me.id) await deleteUserSessions(txDb, id);
      }
    });
    res.json(keUser((await db.get<UserRow>('SELECT * FROM users WHERE id = ?', id))!));
  });

  return r;
}
