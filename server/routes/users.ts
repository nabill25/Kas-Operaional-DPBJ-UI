import { Router } from 'express';
import { validateSetujui, validateUser } from '../../shared/validation';
import { deleteUserSessions, requireRole, userOf } from '../auth';
import { nowIso, type Db } from '../db-pg';
import { assertValid, badRequest, conflict, notFound, parseId } from '../http';
import { AuthGagal, type AuthProvider, type AuthUser } from '../providers';
import { SELECT_USER, keUser, type UserRow } from './auth';

/** Data pegawai yang ditautkan ke akun harus ada dan belum ditautkan ke akun lain (satu pegawai = satu akun). */
async function pastikanPegawaiBebas(db: Db, pegawaiId: number, userId: number | null): Promise<void> {
  if (!(await db.get('SELECT id FROM pegawai WHERE id = ?', pegawaiId))) {
    throw badRequest('Data pegawai tidak ditemukan', { pegawai_id: 'Data pegawai tidak ditemukan' });
  }
  const lain = await db.get<{ nama: string }>('SELECT nama FROM users WHERE pegawai_id = ? AND id <> ?', pegawaiId, userId ?? 0);
  if (lain) {
    throw badRequest('Data pegawai sudah ditautkan ke akun lain', { pegawai_id: `Sudah ditautkan ke akun ${lain.nama}` });
  }
}

export function usersRoutes(db: Db, auth: AuthProvider): Router {
  const r = Router();
  r.use(requireRole('admin'));
  const ambil = async (id: number) => keUser((await db.get<UserRow>(`${SELECT_USER} WHERE u.id = ?`, id))!);

  r.get('/', async (_req, res) => {
    const rows = await db.all<UserRow>(`${SELECT_USER} ORDER BY u.menunggu_persetujuan DESC, u.aktif DESC, u.role ASC, u.nama ASC`);
    res.json(rows.map(keUser));
  });

  r.post('/', async (req, res) => {
    const data = assertValid(validateUser(req.body, 'buat'));
    if (await db.get('SELECT id FROM users WHERE username = ?', data.username)) {
      throw badRequest('Email sudah dipakai', { username: 'Email sudah dipakai' });
    }
    if (data.pegawai_id) await pastikanPegawaiBebas(db, data.pegawai_id, null);
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
        `INSERT INTO users (auth_id, username, nama, role, aktif, pegawai_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        akun.id,
        data.username,
        data.nama,
        data.role,
        data.aktif,
        data.pegawai_id ?? null,
        waktu,
        waktu,
      );
      res.status(201).json(await ambil(lastInsertRowid));
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
    // undefined = tautan pegawai tidak diubah (klien lama), null = lepas tautan.
    const pegawaiId = data.pegawai_id === undefined ? lama.pegawai_id : data.pegawai_id;
    if (pegawaiId && pegawaiId !== lama.pegawai_id) await pastikanPegawaiBebas(db, pegawaiId, id);
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
        // Mengaktifkan akun yang menunggu persetujuan sekaligus menyetujuinya.
        `UPDATE users SET auth_id = ?, username = ?, nama = ?, role = ?, aktif = ?, pegawai_id = ?,
           menunggu_persetujuan = (menunggu_persetujuan AND NOT ?), updated_at = ? WHERE id = ?`,
        authId,
        data.username,
        data.nama,
        data.role,
        data.aktif,
        pegawaiId,
        data.aktif,
        nowIso(),
        id,
      );
      if (data.password || !data.aktif || data.role !== lama.role) {
        if (id !== me.id) await deleteUserSessions(txDb, id);
      }
    });
    res.json(await ambil(id));
  });

  // Pendaftaran mandiri: setujui (pilih peran [+ data pegawai] → akun aktif) atau tolak (profil & akun login dihapus).
  r.post('/:id/setujui', async (req, res) => {
    const id = parseId(req.params.id, 'Pengguna');
    const valid = validateSetujui(req.body);
    if (!valid.ok && valid.errors.role) throw badRequest('Pilih peran untuk akun ini', valid.errors);
    const data = assertValid(valid);
    const row = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);
    if (!row) throw notFound('Pengguna tidak ditemukan');
    if (!row.menunggu_persetujuan) throw conflict('Akun ini tidak sedang menunggu persetujuan');
    if (data.pegawai_id) await pastikanPegawaiBebas(db, data.pegawai_id, id);
    await db.run(
      'UPDATE users SET role = ?, aktif = true, menunggu_persetujuan = false, pegawai_id = ?, updated_at = ? WHERE id = ?',
      data.role,
      data.pegawai_id,
      nowIso(),
      id,
    );
    res.json(await ambil(id));
  });

  r.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'Pengguna');
    const row = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);
    if (!row) throw notFound('Pengguna tidak ditemukan');
    if (!row.menunggu_persetujuan) {
      throw conflict('Hanya pendaftaran yang menunggu persetujuan yang dapat ditolak. Nonaktifkan akun bila tidak dipakai lagi.');
    }
    await db.run('DELETE FROM users WHERE id = ?', id);
    if (row.auth_id) {
      await auth.hapus(row.auth_id).catch((e: Error) => console.error('[users] hapus akun login gagal:', e.message));
    }
    res.json({ ok: true });
  });

  return r;
}
