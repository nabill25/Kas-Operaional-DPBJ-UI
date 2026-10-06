import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_MB, UPLOAD_DIIZINKAN } from '../../shared/constants';
import {
  validateCatatanWajib,
  validateCekBerkas,
  validateDataPum,
  validateInvoice,
  validatePengajuan,
  validateTeruskan,
} from '../../shared/validation';
import { requireRole, userOf } from '../auth';
import type { AppConfig } from '../config';
import type { Db } from '../db-pg';
import { HttpError, assertValid, badRequest, parseId, q } from '../http';
import {
  ajukan,
  ambilBerkas,
  batalkanSelesai,
  buatPengajuan,
  cekBerkas,
  getDetail,
  hapusBerkas,
  hapusFileAman,
  hapusPengajuan,
  jenisBerkasValid,
  kembalikan,
  listPengajuan,
  pastikanBisaKelolaBerkas,
  saranPum,
  selesaikan,
  setBerkasNa,
  tambahBerkas,
  tarikKembali,
  teruskanMdk,
  ubahDataPum,
  ubahInvoice,
  ubahPengajuan,
  type FilterPengajuan,
} from '../services/pengajuan';

function cocokTandaTangan(ext: string, head: Buffer): boolean {
  const mulai = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (ext) {
    case '.pdf':
      return head.subarray(0, 5).toString('latin1') === '%PDF-';
    case '.png':
      return mulai(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case '.jpg':
    case '.jpeg':
      return mulai(0xff, 0xd8, 0xff);
    case '.webp':
      return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
    case '.docx':
    case '.xlsx':
      return mulai(0x50, 0x4b, 0x03, 0x04);
    case '.doc':
    case '.xls':
      return mulai(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    default:
      return false;
  }
}

function bacaAwalFile(file: string): Buffer {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

function filterDariQuery(query: Request['query']): FilterPengajuan {
  return {
    kategori: q(query.kategori),
    status: q(query.status),
    mekanisme: q(query.mekanisme),
    q: q(query.q),
    dari: q(query.dari),
    sampai: q(query.sampai),
    tahun: q(query.tahun),
    pegawai_id: q(query.pegawai_id),
    kelengkapan: q(query.kelengkapan),
    sort: q(query.sort),
    page: q(query.page),
    limit: q(query.limit),
  };
}

export function pengajuanRoutes(db: Db, cfg: AppConfig): Router {
  const r = Router();
  try {
    fs.mkdirSync(cfg.uploadDir, { recursive: true });
  } catch (e) {
    // Abaikan jika read-only file system (misal di Vercel, pastikan KAS_UPLOAD_DIR diarahkan ke /tmp)
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, cfg.uploadDir),
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 10 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!UPLOAD_DIIZINKAN[ext]) {
        cb(new HttpError(400, 'Tipe file tidak didukung. Gunakan PDF, JPG, PNG, WEBP, DOC/DOCX, atau XLS/XLSX.'));
        return;
      }
      cb(null, true);
    },
  }).single('file');

  const terimaFile = (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, `Ukuran file maksimal ${MAX_UPLOAD_MB} MB`));
        return next(new HttpError(400, 'Unggahan tidak valid: kirim tepat satu file'));
      }
      next(err);
    });
  };

  r.get('/', async (req, res) => {
    res.json(await listPengajuan(db, userOf(req), filterDariQuery(req.query)));
  });

  r.get('/saran-pum', requireRole('pum', 'admin'), async (_req, res) => {
    res.json(await saranPum(db));
  });

  r.post('/', async (req, res) => {
    const user = userOf(req);
    const data = assertValid(validatePengajuan(req.body));
    const id = await buatPengajuan(db, user, data);
    res.status(201).json(await getDetail(db, user, id));
  });

  r.get('/:id', async (req, res) => {
    res.json(await getDetail(db, userOf(req), parseId(req.params.id, 'Pengajuan')));
  });

  r.put('/:id', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    const data = assertValid(validatePengajuan(req.body));
    await ubahPengajuan(db, user, id, data);
    res.json(await getDetail(db, user, id));
  });

  r.delete('/:id', async (req, res) => {
    await hapusPengajuan(db, userOf(req), parseId(req.params.id, 'Pengajuan'), cfg.uploadDir);
    res.json({ ok: true });
  });

  r.post('/:id/ajukan', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await ajukan(db, user, id);
    res.json(await getDetail(db, user, id));
  });

  r.post('/:id/tarik', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await tarikKembali(db, user, id);
    res.json(await getDetail(db, user, id));
  });

  r.put('/:id/cek-berkas', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await cekBerkas(db, user, id, assertValid(validateCekBerkas(req.body)));
    res.json(await getDetail(db, user, id));
  });

  r.post('/:id/teruskan', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await teruskanMdk(db, user, id, assertValid(validateTeruskan(req.body)));
    res.json(await getDetail(db, user, id));
  });

  r.put('/:id/data-pum', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await ubahDataPum(db, user, id, assertValid(validateDataPum(req.body)));
    res.json(await getDetail(db, user, id));
  });

  r.post('/:id/kembalikan', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    const { catatan } = assertValid(validateCatatanWajib(req.body, 'Catatan revisi'));
    await kembalikan(db, user, id, catatan);
    res.json(await getDetail(db, user, id));
  });

  r.post('/:id/selesai', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await selesaikan(db, user, id, assertValid(validateInvoice(req.body)));
    res.json(await getDetail(db, user, id));
  });

  r.put('/:id/invoice', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await ubahInvoice(db, user, id, assertValid(validateInvoice(req.body)));
    res.json(await getDetail(db, user, id));
  });

  r.post('/:id/batal-selesai', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    const { catatan } = assertValid(validateCatatanWajib(req.body, 'Alasan pembatalan'));
    await batalkanSelesai(db, user, id, catatan);
    res.json(await getDetail(db, user, id));
  });

  r.put('/:id/berkas-na', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.jenis !== 'string' || typeof body.na !== 'boolean') {
      throw badRequest('Kirim jenis berkas dan nilai na (true/false)');
    }
    await setBerkasNa(db, user, id, body.jenis, body.na);
    res.json(await getDetail(db, user, id));
  });

  r.post(
    '/:id/berkas',
    async (req, _res, next) => {
      try {
        await pastikanBisaKelolaBerkas(db, userOf(req), parseId(req.params.id, 'Pengajuan'));
        next();
      } catch (err) {
        next(err);
      }
    },
    terimaFile,
    async (req, res) => {
      const user = userOf(req);
      const id = parseId(req.params.id, 'Pengajuan');
      const file = req.file;
      if (!file) throw badRequest('Pilih file yang akan diunggah', { file: 'File wajib dipilih' });
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const jenis = typeof body.jenis === 'string' ? body.jenis : '';
        const row = await pastikanBisaKelolaBerkas(db, user, id);
        if (!jenisBerkasValid(row.kategori, jenis)) {
          throw badRequest('Jenis berkas tidak sesuai kategori pengajuan', { jenis: 'Jenis berkas tidak valid' });
        }
        const namaBerkas = typeof body.nama_berkas === 'string' ? body.nama_berkas.trim().replace(/\s+/g, ' ') : '';
        if (jenis === 'lainnya' && namaBerkas.length < 2) {
          throw badRequest('Beri nama dokumen lainnya', { nama_berkas: 'Nama dokumen wajib diisi (min. 2 karakter)' });
        }
        if (namaBerkas.length > 120) {
          throw badRequest('Nama dokumen terlalu panjang', { nama_berkas: 'Nama dokumen maksimal 120 karakter' });
        }
        const ext = path.extname(file.originalname).toLowerCase();
        if (!cocokTandaTangan(ext, bacaAwalFile(file.path))) {
          throw badRequest(`Isi file tidak sesuai dengan ekstensi ${ext}. Pastikan file tidak rusak.`);
        }
        const namaAsli = path.basename(file.originalname).slice(0, 200) || `berkas${ext}`;
        await tambahBerkas(db, user, id, {
          jenis,
          nama_berkas: jenis === 'lainnya' ? namaBerkas : null,
          nama_asli: namaAsli,
          nama_file: file.filename,
          mime: UPLOAD_DIIZINKAN[ext][0],
          ukuran: file.size,
        });
      } catch (err) {
        hapusFileAman(cfg.uploadDir, file.filename);
        throw err;
      }
      res.status(201).json(await getDetail(db, user, id));
    },
  );

  return r;
}

export function berkasRoutes(db: Db, cfg: AppConfig): Router {
  const r = Router();

  r.get('/:id/file', async (req, res) => {
    const b = await ambilBerkas(db, userOf(req), parseId(req.params.id, 'Berkas'));
    const lokasi = path.join(cfg.uploadDir, path.basename(b.nama_file));
    if (!fs.existsSync(lokasi)) throw new HttpError(404, 'File fisik tidak ditemukan di server');
    const unduh = q(req.query.unduh) === '1';
    const inline = !unduh && (b.mime === 'application/pdf' || b.mime.startsWith('image/'));
    const namaAman = b.nama_asli.replace(/["\\r\n]/g, '_');
    const ascii = namaAman.replace(/[^\x20-\x7e]/g, '_');
    res.setHeader('Content-Type', b.mime);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(namaAman)}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(lokasi);
  });

  r.delete('/:id', async (req, res) => {
    const user = userOf(req);
    const pengajuanId = await hapusBerkas(db, user, parseId(req.params.id, 'Berkas'), cfg.uploadDir);
    res.json(await getDetail(db, user, pengajuanId));
  });

  return r;
}
