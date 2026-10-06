import { Router, type Request } from 'express';
import { userOf } from '../auth';
import type { Db } from '../db-pg';
import { parseId, q } from '../http';
import type { FilterPengajuan } from '../services/pengajuan';
import { dashboard, notifikasi, rekapPegawai, rekapPegawaiDetail, rekapPengajuan, tandaiDibaca } from '../services/rekap';

function filterRekap(query: Request['query']): FilterPengajuan {
  return {
    kategori: q(query.kategori),
    status: q(query.status),
    mekanisme: q(query.mekanisme),
    dari: q(query.dari),
    sampai: q(query.sampai),
    tahun: q(query.tahun),
  };
}

export function laporanRoutes(db: Db): Router {
  const r = Router();

  r.get('/dashboard', async (req, res) => {
    const tahun = Number(q(req.query.tahun)) || new Date().getFullYear();
    res.json(await dashboard(db, userOf(req), tahun));
  });

  r.get('/notifikasi', async (req, res) => {
    res.json(await notifikasi(db, userOf(req)));
  });

  r.post('/notifikasi/baca', async (req, res) => {
    const user = userOf(req);
    const raw = (req.body as Record<string, unknown> | undefined)?.id;
    const id = raw === undefined || raw === null ? undefined : Number(raw);
    if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) {
      res.status(400).json({ message: 'Id notifikasi tidak valid' });
      return;
    }
    await tandaiDibaca(db, user, id);
    res.json(await notifikasi(db, user));
  });

  r.get('/rekap/pengajuan', async (req, res) => {
    res.json(await rekapPengajuan(db, userOf(req), filterRekap(req.query)));
  });

  r.get('/rekap/pegawai', async (req, res) => {
    res.json(await rekapPegawai(db, userOf(req), filterRekap(req.query)));
  });

  r.get('/rekap/pegawai/:id', async (req, res) => {
    res.json(await rekapPegawaiDetail(db, userOf(req), parseId(req.params.id, 'Pegawai'), filterRekap(req.query)));
  });

  return r;
}
