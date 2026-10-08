import crypto from 'node:crypto';
import path from 'node:path';
import { Router, type Request } from 'express';
import { MAX_UPLOAD_MB, UPLOAD_DIIZINKAN, type Kategori } from '../../shared/constants';
import {
  validateCatatanWajib,
  validateCekBerkas,
  validateDataPum,
  validateDibayarkan,
  validateInvoice,
  validatePengajuan,
  validateVerifikasi,
} from '../../shared/validation';
import { requireRole, userOf } from '../auth';
import type { Db } from '../db-pg';
import { HttpError, assertValid, badRequest, conflict, parseId, q } from '../http';
import type { StorageProvider } from '../providers';
import {
  ajukan,
  ajukanMdk,
  ambilBerkas,
  batalkanSelesai,
  buatPengajuan,
  cekBerkas,
  getDetail,
  hapusBerkas,
  hapusObjekAman,
  hapusPengajuan,
  jenisBerkasValid,
  kembalikan,
  listPengajuan,
  pastikanBisaKelolaBerkas,
  saranPum,
  selesaikan,
  setBerkasNa,
  tambahBerkas,
  tandaiDibayarkan,
  tarikKembali,
  ubahDataPum,
  ubahInvoice,
  ubahPengajuan,
  verifikasi,
  type FilterPengajuan,
} from '../services/pengajuan';

const BATAS_BYTE = MAX_UPLOAD_MB * 1024 * 1024;
/** Masa berlaku URL unduh berkas (detik). */
const MASA_UNDUH_DETIK = 300;

/** Cocokkan awal isi file dengan ekstensinya (tanda tangan/magic bytes). */
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

/** Kunci berkas harus `<pengajuan_id>/<uuid><ext>` — mencegah berkas pengajuan lain dicatat ke sini. */
function kunciBerkasValid(pengajuanId: number, key: string, ext: string): boolean {
  const pola = new RegExp(`^${pengajuanId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}${ext.replace('.', '\\.')}$`);
  return pola.test(key);
}

/** Validasi jenis, nama dokumen, dan nama file. Dipakai saat menyiapkan unggahan dan saat mengonfirmasinya. */
function bacaInputBerkas(kategori: Kategori, body: Record<string, unknown>) {
  const jenis = typeof body.jenis === 'string' ? body.jenis : '';
  if (!jenisBerkasValid(kategori, jenis)) {
    throw badRequest('Jenis berkas tidak sesuai kategori pengajuan', { jenis: 'Jenis berkas tidak valid' });
  }
  const namaBerkas = typeof body.nama_berkas === 'string' ? body.nama_berkas.trim().replace(/\s+/g, ' ') : '';
  if (jenis === 'lainnya' && namaBerkas.length < 2) {
    throw badRequest('Beri nama dokumen lainnya', { nama_berkas: 'Nama dokumen wajib diisi (min. 2 karakter)' });
  }
  if (namaBerkas.length > 120) {
    throw badRequest('Nama dokumen terlalu panjang', { nama_berkas: 'Nama dokumen maksimal 120 karakter' });
  }
  const namaAsli = typeof body.nama_asli === 'string' ? path.basename(body.nama_asli).slice(0, 200) : '';
  const ext = path.extname(namaAsli).toLowerCase();
  if (!namaAsli || !UPLOAD_DIIZINKAN[ext]) {
    throw badRequest('Tipe file tidak didukung. Gunakan PDF, JPG, PNG, WEBP, DOC/DOCX, atau XLS/XLSX.', {
      file: 'Tipe file tidak didukung',
    });
  }
  return {
    jenis,
    namaBerkas: jenis === 'lainnya' ? namaBerkas : null,
    namaAsli,
    ext,
    mime: UPLOAD_DIIZINKAN[ext][0],
  };
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

export function pengajuanRoutes(db: Db, storage: StorageProvider): Router {
  const r = Router();

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
    const kunci = await hapusPengajuan(db, userOf(req), parseId(req.params.id, 'Pengajuan'));
    await hapusObjekAman(storage, kunci);
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

  r.post('/:id/verifikasi', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await verifikasi(db, user, id, assertValid(validateVerifikasi(req.body)));
    res.json(await getDetail(db, user, id));
  });

  r.put('/:id/data-pum', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await ubahDataPum(db, user, id, assertValid(validateDataPum(req.body)));
    res.json(await getDetail(db, user, id));
  });

  r.put('/:id/dibayarkan', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    const { dibayarkan } = assertValid(validateDibayarkan(req.body));
    await tandaiDibayarkan(db, user, id, dibayarkan);
    res.json(await getDetail(db, user, id));
  });

  r.post('/:id/kembalikan', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    const { catatan } = assertValid(validateCatatanWajib(req.body, 'Catatan revisi'));
    await kembalikan(db, user, id, catatan);
    res.json(await getDetail(db, user, id));
  });

  // Input No. Invoice MDK = mengajukan ke MDK (menunggu verifikasi MDK di luar sistem).
  r.post('/:id/ajukan-mdk', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await ajukanMdk(db, user, id, assertValid(validateInvoice(req.body)));
    res.json(await getDetail(db, user, id));
  });

  // Proses MDK selesai → PUM menandai selesai (paid).
  r.post('/:id/selesai', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    await selesaikan(db, user, id);
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

  // Langkah 1 unggah: validasi lalu berikan URL unggah bertanda tangan. File TIDAK melewati server
  // (batas body fungsi Vercel 4,5 MB), melainkan dikirim langsung dari browser ke Supabase Storage.
  r.post('/:id/berkas/siapkan', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    const row = await pastikanBisaKelolaBerkas(db, user, id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = bacaInputBerkas(row.kategori, body);
    const ukuran = typeof body.ukuran === 'number' ? body.ukuran : Number.NaN;
    if (!Number.isFinite(ukuran) || ukuran <= 0) {
      throw badRequest('Ukuran file tidak valid', { file: 'Pilih file yang valid' });
    }
    if (ukuran > BATAS_BYTE) throw new HttpError(413, `Ukuran file maksimal ${MAX_UPLOAD_MB} MB`);

    const key = `${id}/${crypto.randomUUID()}${input.ext}`;
    const url = await storage.buatUrlUnggah(key);
    res.json({ key, url, contentType: input.mime });
  });

  // Langkah 2 unggah: periksa objek yang sudah ada di storage (isi & ukuran), lalu catat sebagai berkas.
  r.post('/:id/berkas/konfirmasi', async (req, res) => {
    const user = userOf(req);
    const id = parseId(req.params.id, 'Pengajuan');
    const row = await pastikanBisaKelolaBerkas(db, user, id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = bacaInputBerkas(row.kategori, body);
    const key = typeof body.key === 'string' ? body.key : '';
    if (!kunciBerkasValid(id, key, input.ext)) throw badRequest('Kunci berkas tidak valid. Unggah ulang file.');

    if (await db.get('SELECT id FROM berkas WHERE nama_file = ?', key)) {
      throw conflict('Berkas ini sudah tercatat di pengajuan');
    }
    const isi = await storage.baca(key);
    if (!isi) throw badRequest('File belum terunggah ke penyimpanan. Coba unggah ulang.');

    try {
      if (isi.length > BATAS_BYTE) throw new HttpError(413, `Ukuran file maksimal ${MAX_UPLOAD_MB} MB`);
      if (!cocokTandaTangan(input.ext, isi.subarray(0, 16))) {
        throw badRequest(`Isi file tidak sesuai dengan ekstensi ${input.ext}. Pastikan file tidak rusak.`);
      }
      await tambahBerkas(db, user, id, {
        jenis: input.jenis,
        nama_berkas: input.namaBerkas,
        nama_asli: input.namaAsli,
        nama_file: key,
        mime: input.mime,
        ukuran: isi.length,
      });
    } catch (err) {
      await hapusObjekAman(storage, [key]);
      throw err;
    }
    res.status(201).json(await getDetail(db, user, id));
  });

  return r;
}

export function berkasRoutes(db: Db, storage: StorageProvider): Router {
  const r = Router();

  // Berkas diunduh langsung dari Supabase Storage lewat URL sementara (302), tanpa melewati server.
  r.get('/:id/file', async (req, res) => {
    const b = await ambilBerkas(db, userOf(req), parseId(req.params.id, 'Berkas'));
    const unduh = q(req.query.unduh) === '1';
    const url = await storage.urlUnduh(b.nama_file, unduh ? b.nama_asli : null, MASA_UNDUH_DETIK);
    if (!url) throw new HttpError(404, 'File tidak ditemukan di penyimpanan');
    res.setHeader('Cache-Control', 'private, no-store');
    res.redirect(302, url);
  });

  r.delete('/:id', async (req, res) => {
    const user = userOf(req);
    const { pengajuanId, namaFile } = await hapusBerkas(db, user, parseId(req.params.id, 'Berkas'));
    await hapusObjekAman(storage, [namaFile]);
    res.json(await getDetail(db, user, pengajuanId));
  });

  return r;
}
