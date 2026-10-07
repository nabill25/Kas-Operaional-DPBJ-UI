import { Router } from 'express';
import type { Pegawai } from '../../shared/types';
import { validatePegawai } from '../../shared/validation';
import { requireRole } from '../auth';
import { nowIso, type Db, type SqlParam } from '../db-pg';
import { assertValid, badRequest, conflict, notFound, parseId, q } from '../http';
import { getPegawai } from '../services/rekap';

type PegawaiRow = Omit<Pegawai, 'aktif'> & { aktif: boolean | number };

const SELECT_PEGAWAI = `
  SELECT g.*,
         (SELECT COUNT(*) FROM pengajuan p WHERE p.uang_siapa_id = g.id)
       + (SELECT COUNT(*) FROM pengajuan_peserta ps WHERE ps.pegawai_id = g.id) AS dipakai
    FROM pegawai g`;

async function cekNipUnik(db: Db, nip: string | null, kecualiId?: number): Promise<void> {
  if (!nip) return;
  const ada = await db.get<{ id: number; nama: string }>('SELECT id, nama FROM pegawai WHERE nip = ?', nip);
  if (ada && ada.id !== kecualiId) {
    throw badRequest('NIP/NUP sudah terdaftar', { nip: `NIP/NUP sudah dipakai oleh ${ada.nama}` });
  }
}

export function pegawaiRoutes(db: Db): Router {
  const r = Router();

  r.get('/', async (req, res) => {
    const kondisi: string[] = [];
    const params: SqlParam[] = [];
    const status = q(req.query.status);
    if (status === 'aktif') kondisi.push('g.aktif = true');
    else if (status === 'nonaktif') kondisi.push('g.aktif = false');
    const kata = q(req.query.q);
    if (kata) {
      const like = `%${kata.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      kondisi.push(`(g.nama ILIKE ? OR g.nip ILIKE ? OR g.jabatan ILIKE ?)`);
      params.push(like, like, like);
    }
    const rows = await db.all<PegawaiRow>(
      `${SELECT_PEGAWAI} ${kondisi.length ? `WHERE ${kondisi.join(' AND ')}` : ''} ORDER BY g.aktif DESC, g.nama ASC`,
      ...params,
    );
    res.json(rows.map((row) => ({ ...row, aktif: row.aktif === true || (row.aktif as number) === 1 })));
  });

  r.get('/:id', async (req, res) => {
    const pegawai = await getPegawai(db, parseId(req.params.id, 'Pegawai'));
    if (!pegawai) throw notFound('Pegawai tidak ditemukan');
    res.json(pegawai);
  });

  r.post('/', requireRole('operator', 'admin'), async (req, res) => {
    const data = assertValid(validatePegawai(req.body));
    await cekNipUnik(db, data.nip);
    const waktu = nowIso();
    const { lastInsertRowid } = await db.run(
      'INSERT INTO pegawai (nama, nip, jabatan, aktif, created_at, updated_at) VALUES (?, ?, ?, true, ?, ?) RETURNING id',
      data.nama,
      data.nip,
      data.jabatan,
      waktu,
      waktu,
    );
    res.status(201).json(await getPegawai(db, lastInsertRowid));
  });

  r.put('/:id', requireRole('operator', 'admin'), async (req, res) => {
    const id = parseId(req.params.id, 'Pegawai');
    if (!(await getPegawai(db, id))) throw notFound('Pegawai tidak ditemukan');
    const data = assertValid(validatePegawai(req.body));
    await cekNipUnik(db, data.nip, id);
    await db.run(
      'UPDATE pegawai SET nama = ?, nip = ?, jabatan = ?, updated_at = ? WHERE id = ?',
      data.nama,
      data.nip,
      data.jabatan,
      nowIso(),
      id,
    );
    res.json(await getPegawai(db, id));
  });

  r.patch('/:id/aktif', requireRole('admin'), async (req, res) => {
    const id = parseId(req.params.id, 'Pegawai');
    if (!(await getPegawai(db, id))) throw notFound('Pegawai tidak ditemukan');
    const aktif = (req.body as Record<string, unknown> | undefined)?.aktif;
    if (typeof aktif !== 'boolean') throw badRequest('Nilai aktif harus true/false');
    await db.run('UPDATE pegawai SET aktif = ?, updated_at = ? WHERE id = ?', aktif, nowIso(), id);
    res.json(await getPegawai(db, id));
  });

  r.delete('/:id', requireRole('admin'), async (req, res) => {
    const id = parseId(req.params.id, 'Pegawai');
    const pegawai = await getPegawai(db, id);
    if (!pegawai) throw notFound('Pegawai tidak ditemukan');
    if (pegawai.dipakai > 0) {
      throw conflict(
        `${pegawai.nama} sudah tercatat di ${pegawai.dipakai} pengajuan sehingga tidak dapat dihapus. Nonaktifkan saja agar data rekap tetap utuh.`,
      );
    }
    await db.run('DELETE FROM pegawai WHERE id = ?', id);
    res.json({ ok: true });
  });

  return r;
}
