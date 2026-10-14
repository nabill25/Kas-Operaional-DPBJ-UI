import { Router } from 'express';
import {
  RE_KODE_DANA,
  validateBank,
  validateDana,
  validateJenisBerkas,
  validateJenisPengajuan,
  validateProject,
  validateSalinTahun,
  validateTask,
} from '../../shared/validation';
import { requireRole, userOf } from '../auth';
import type { Db } from '../db-pg';
import { assertValid, notFound, parseId } from '../http';
import {
  ambilJenisPengajuan,
  buatBank,
  buatDana,
  buatJenisBerkas,
  buatJenisPengajuan,
  buatProject,
  buatTask,
  daftarBank,
  daftarDana,
  daftarJenisBerkas,
  daftarJenisPengajuan,
  daftarProjectTask,
  hapusBank,
  hapusDana,
  hapusJenisBerkas,
  hapusJenisPengajuan,
  hapusProject,
  hapusTask,
  modelJenis,
  muatKonfig,
  salinTahun,
  ubahBank,
  ubahDana,
  ubahJenisBerkas,
  ubahJenisPengajuan,
  ubahProject,
  ubahSifatBerkas,
  ubahTask,
} from '../services/master';
import { sinkronDaftarBerkas } from '../services/pengajuan';

/** Kode master teks (jenis pengajuan / jenis berkas) dari parameter URL. */
function kodeParam(v: unknown, label: string): string {
  if (typeof v !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(v)) throw notFound(`${label} tidak ditemukan`);
  return v;
}

function kodeDanaParam(v: unknown): string {
  if (typeof v !== 'string' || !RE_KODE_DANA.test(v)) throw notFound('Kode dana tidak ditemukan');
  return v;
}

/**
 * Master data. Semua peran yang sudah login boleh membaca (dipakai form & tampilan);
 * menambah, mengubah, menonaktifkan, dan menghapus hanya admin.
 */
export function masterRoutes(db: Db): Router {
  const r = Router();
  const admin = requireRole('admin');

  r.get('/konfig', async (_req, res) => {
    res.json(await muatKonfig(db));
  });

  // ── Jenis pengajuan ──
  r.get('/jenis-pengajuan', async (_req, res) => {
    res.json(await daftarJenisPengajuan(db, true));
  });

  r.post('/jenis-pengajuan', admin, async (req, res) => {
    const data = assertValid(validateJenisPengajuan(req.body));
    const kode = await buatJenisPengajuan(db, data);
    res.status(201).json(await ambilJenisPengajuan(db, kode));
  });

  r.put('/jenis-pengajuan/:kode', admin, async (req, res) => {
    const kode = kodeParam(req.params.kode, 'Jenis pengajuan');
    const model = await modelJenis(db, kode);
    if (!model) throw notFound('Jenis pengajuan tidak ditemukan');
    const data = assertValid(validateJenisPengajuan(req.body, model));
    const disinkron = await db.tx(async (tx) => {
      const berubah = await ubahJenisPengajuan(tx, kode, data);
      // Pengajuan yang masih draft/dikembalikan langsung mengikuti daftar berkas wajib yang baru.
      return berubah ? sinkronDaftarBerkas(tx, { kategori: kode }, userOf(req).id) : 0;
    });
    res.json({ ...(await ambilJenisPengajuan(db, kode)), disinkron });
  });

  r.delete('/jenis-pengajuan/:kode', admin, async (req, res) => {
    await hapusJenisPengajuan(db, kodeParam(req.params.kode, 'Jenis pengajuan'));
    res.json({ ok: true });
  });

  // ── Jenis berkas ──
  r.get('/jenis-berkas', async (_req, res) => {
    res.json(await daftarJenisBerkas(db, true));
  });

  r.post('/jenis-berkas', admin, async (req, res) => {
    const kode = await buatJenisBerkas(db, assertValid(validateJenisBerkas(req.body)));
    res.status(201).json((await daftarJenisBerkas(db, true)).find((b) => b.kode === kode));
  });

  // Nama/keterangan/aktif + sifat wajib/tidak wajib per jenis pengajuan pemakai (opsional, `sifat`).
  r.put('/jenis-berkas/:kode', admin, async (req, res) => {
    const kode = kodeParam(req.params.kode, 'Jenis berkas');
    const data = assertValid(validateJenisBerkas(req.body));
    const disinkron = await db.tx(async (tx) => {
      await ubahJenisBerkas(tx, kode, data);
      // Draft/dikembalikan jenis yang sifat berkasnya berubah langsung mengikuti (sama seperti ubah jenis pengajuan).
      let n = 0;
      for (const jenis of await ubahSifatBerkas(tx, kode, data.sifat)) {
        n += await sinkronDaftarBerkas(tx, { kategori: jenis }, userOf(req).id);
      }
      return n;
    });
    res.json({ ...(await daftarJenisBerkas(db, true)).find((b) => b.kode === kode), disinkron });
  });

  r.delete('/jenis-berkas/:kode', admin, async (req, res) => {
    await hapusJenisBerkas(db, kodeParam(req.params.kode, 'Jenis berkas'));
    res.json({ ok: true });
  });

  // ── Bank ──
  r.get('/bank', async (_req, res) => {
    res.json(await daftarBank(db));
  });

  r.post('/bank', admin, async (req, res) => {
    const id = await buatBank(db, assertValid(validateBank(req.body)));
    res.status(201).json((await daftarBank(db)).find((b) => b.id === id));
  });

  r.put('/bank/:id', admin, async (req, res) => {
    const id = parseId(req.params.id, 'Bank');
    await ubahBank(db, id, assertValid(validateBank(req.body)));
    res.json((await daftarBank(db)).find((b) => b.id === id));
  });

  r.delete('/bank/:id', admin, async (req, res) => {
    await hapusBank(db, parseId(req.params.id, 'Bank'));
    res.json({ ok: true });
  });

  // ── Project Costing & Task Name ──
  r.get('/project-task', async (_req, res) => {
    res.json(await daftarProjectTask(db));
  });

  r.post('/project', admin, async (req, res) => {
    const id = await buatProject(db, assertValid(validateProject(req.body)));
    res.status(201).json((await daftarProjectTask(db)).project.find((p) => p.id === id));
  });

  r.put('/project/:id', admin, async (req, res) => {
    const id = parseId(req.params.id, 'Project');
    await ubahProject(db, id, assertValid(validateProject(req.body)));
    res.json((await daftarProjectTask(db)).project.find((p) => p.id === id));
  });

  r.delete('/project/:id', admin, async (req, res) => {
    await hapusProject(db, parseId(req.params.id, 'Project'));
    res.json({ ok: true });
  });

  r.post('/task', admin, async (req, res) => {
    const id = await buatTask(db, assertValid(validateTask(req.body)));
    res.status(201).json((await daftarProjectTask(db)).task.find((t) => t.id === id));
  });

  r.put('/task/:id', admin, async (req, res) => {
    const id = parseId(req.params.id, 'Task');
    await ubahTask(db, id, assertValid(validateTask(req.body)));
    res.json((await daftarProjectTask(db)).task.find((t) => t.id === id));
  });

  r.delete('/task/:id', admin, async (req, res) => {
    await hapusTask(db, parseId(req.params.id, 'Task'));
    res.json({ ok: true });
  });

  // Salin master satu tahun anggaran ke tahun lain yang masih kosong (mis. 2026 → 2027).
  r.post('/project-task/salin', admin, async (req, res) => {
    const { dari, ke } = assertValid(validateSalinTahun(req.body));
    res.status(201).json({ ...(await salinTahun(db, dari, ke)), data: await daftarProjectTask(db) });
  });

  // ── Kode dana ──
  r.get('/dana', async (_req, res) => {
    res.json(await daftarDana(db));
  });

  r.post('/dana', admin, async (req, res) => {
    const kode = await buatDana(db, assertValid(validateDana(req.body)));
    res.status(201).json((await daftarDana(db)).find((d) => d.kode === kode));
  });

  r.put('/dana/:kode', admin, async (req, res) => {
    const kode = kodeDanaParam(req.params.kode);
    await ubahDana(db, kode, assertValid(validateDana(req.body)));
    res.json((await daftarDana(db)).find((d) => d.kode === kode));
  });

  r.delete('/dana/:kode', admin, async (req, res) => {
    await hapusDana(db, kodeDanaParam(req.params.kode));
    res.json({ ok: true });
  });

  return r;
}
