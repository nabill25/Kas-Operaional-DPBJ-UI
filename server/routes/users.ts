import { Router } from 'express';
import { validateUser } from '../../shared/validation';
import { deleteUserSessions, hashPassword, requireRole, userOf } from '../auth';
import { nowIso, type Db } from '../db-pg';
import { assertValid, badRequest, conflict, notFound, parseId } from '../http';
import { keUser, type UserRow } from './auth';

export function usersRoutes(db: Db): Router {
  const r = Router();
  r.use(requireRole('admin'));

  r.get('/', async (_req, res) => {
    const rows = await db.all<UserRow>('SELECT * FROM users ORDER BY aktif DESC, role ASC, nama ASC');
    res.json(rows.map(keUser));
  });

  r.post('/', async (req, res) => {
    const data = assertValid(validateUser(req.body, 'buat'));
    if (await db.get('SELECT id FROM users WHERE username = ?', data.username)) {
      throw badRequest('Username sudah dipakai', { username: 'Username sudah dipakai' });
    }
    const waktu = nowIso();
    const { lastInsertRowid } = await db.run(
      'INSERT INTO users (username, nama, role, password_hash, aktif, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      data.username,
      data.nama,
      data.role,
      hashPassword(data.password ?? ''),
      true,
      waktu,
      waktu,
    );
    res.status(201).json(keUser((await db.get<UserRow>('SELECT * FROM users WHERE id = ?', lastInsertRowid))!));
  });

  r.put('/:id', async (req, res) => {
    const me = userOf(req);
    const id = parseId(req.params.id, 'Pengguna');
    const lama = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);
    if (!lama) throw notFound('Pengguna tidak ditemukan');
    const data = assertValid(validateUser(req.body, 'ubah'));

    const dupe = await db.get<{ id: number }>('SELECT id FROM users WHERE username = ?', data.username);
    if (dupe && dupe.id !== id) throw badRequest('Username sudah dipakai', { username: 'Username sudah dipakai' });

    if (id === me.id && (data.role !== 'admin' || !data.aktif)) {
      throw conflict('Anda tidak dapat menurunkan peran atau menonaktifkan akun Anda sendiri');
    }
    const lamaAktif = lama.aktif === true || (lama.aktif as unknown as number) === 1;
    if (lama.role === 'admin' && lamaAktif && (data.role !== 'admin' || !data.aktif)) {
      const adminLain = (await db.get<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin' AND aktif = true AND id <> ?`,
        id,
      ))!.c;
      if (adminLain === 0) throw conflict('Minimal harus ada satu administrator aktif');
    }

    await db.tx(async (txDb) => {
      await txDb.run(
        'UPDATE users SET username = ?, nama = ?, role = ?, aktif = ?, updated_at = ? WHERE id = ?',
        data.username,
        data.nama,
        data.role,
        data.aktif,
        nowIso(),
        id,
      );
      if (data.password) await txDb.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(data.password), id);
      if (data.password || !data.aktif || data.role !== lama.role) {
        if (id !== me.id) await deleteUserSessions(txDb, id);
      }
    });
    res.json(keUser((await db.get<UserRow>('SELECT * FROM users WHERE id = ?', id))!));
  });

  return r;
}
