import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  Bank,
  DashboardData,
  JenisBerkasMaster,
  JenisPengajuan,
  Konfig,
  MasterProjectTask,
  PengajuanDetail,
  RekapPegawaiData,
  RekapPengajuanData,
} from '../../shared/types';
import { PROJECT_TASK_AWAL } from '../support/project-task-awal';
import { FILE_CONTOH, TAHUN_INI, buatKonteks, dataKonsumsi, masuk, unggah, type Agent, type Konteks } from './helpers';

let ctx: Konteks;
let op: Agent;
let pum: Agent;
let pimpinan: Agent;
let admin: Agent;

beforeEach(async () => {
  ctx = await buatKonteks();
  op = await masuk(ctx, 'operator');
  pum = await masuk(ctx, 'pum');
  pimpinan = await masuk(ctx, 'pimpinan');
  admin = await masuk(ctx, 'admin');
});
afterEach(() => ctx.tutup());

const BORONGAN = {
  label: 'Kontrak Borongan',
  label_pendek: 'Borongan',
  prefix: 'kbr',
  deskripsi: 'Honor pegawai kontrak borongan',
  model: 'umum',
  maks_peserta: 3,
  kata_kunci_task: 'tenaga lepas',
  warna: 'ungu',
  ikon: 'hard-hat',
  berkas: ['laporan_pekerjaan', 'presensi', 'kontrak'],
};

async function buatBorongan(ubah: Record<string, unknown> = {}): Promise<JenisPengajuan> {
  const res = await admin.post('/api/master/jenis-pengajuan').send({ ...BORONGAN, ...ubah });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as JenisPengajuan;
}

function dataBorongan(peserta: { pegawai_id: number; nilai: number }[], ubah: Record<string, unknown> = {}) {
  return {
    kategori: 'kontrak_borongan',
    nama_kegiatan: 'Honor Borongan September',
    tanggal_kegiatan: `${TAHUN_INI}-09-01`,
    tanggal_selesai: `${TAHUN_INI}-09-30`,
    mekanisme: 'LS',
    peserta,
    ...ubah,
  };
}

describe('Konfigurasi & data awal master', () => {
  it('semua peran membaca konfigurasi: 3 jenis bawaan dengan berkas wajibnya & mekanisme tetap Transport', async () => {
    for (const agent of [op, pum, pimpinan, admin]) {
      const res = await agent.get('/api/master/konfig');
      expect(res.status).toBe(200);
      const k = res.body as Konfig;
      expect(k.jenisPengajuan.map((j) => [j.kode, j.prefix, j.model, j.bawaan, j.mekanisme_tetap, j.berkas.map((b) => b.kode)])).toEqual([
        ['konsumsi', 'KSM', 'konsumsi', true, null, ['notulen', 'undangan', 'invoice', 'daftar_hadir']],
        ['rumah_tangga', 'TRT', 'rumah_tangga', true, 'LS', ['surat_tugas', 'laporan_kegiatan']],
        ['perjadin', 'TPD', 'perjadin', true, 'LS', ['surat_tugas', 'laporan_kegiatan', 'invoice_hotel', 'invoice_tiket']],
      ]);
      expect(k.jenisPengajuan.every((j) => j.berkas.every((b) => b.wajib))).toBe(true);
      expect(k.jenisBerkas.find((b) => b.kode === 'notulen')?.label).toBe('Notula');
      expect(k.jenisBerkas.map((b) => b.kode)).toEqual(
        expect.arrayContaining(['laporan_pekerjaan', 'presensi', 'kontrak']),
      );
    }
  });

  it('master Project & Task 2026 sama persis dengan daftar Kasubdit + kode dana laporan sisa anggaran; bank 17', async () => {
    const pt = (await pum.get('/api/master/project-task')).body as MasterProjectTask;
    expect(pt.project).toHaveLength(15);
    expect(pt.task).toHaveLength(18);
    expect([...new Set([...pt.project, ...pt.task].map((x) => x.tahun))]).toEqual([2026]);
    const task = new Map(pt.task.map((t) => [t.id, t]));
    const pasangan = pt.project.flatMap((p) =>
      p.tasks.map((x) => `${p.kode}:${p.nama}|${task.get(x.id)!.kode}_${task.get(x.id)!.nama}|${x.kode_dana}`),
    );
    expect(pasangan.sort()).toEqual(PROJECT_TASK_AWAL.map((x) => `${x.project}|${x.task}|${x.kodeDana}`).sort());
    expect(pt.dana).toEqual([
      { kode: '51', nama: 'Dana Masyarakat (BP) - Tidak Terikat', aktif: true, dipakai: 32 },
      { kode: '61', nama: 'Dana Masyarakat (Non BP) - Tidak Terikat', aktif: true, dipakai: 6 },
    ]);
    const bank = (await op.get('/api/master/bank')).body as Bank[];
    expect(bank).toHaveLength(17);
    expect(bank[0]).toMatchObject({ nama: 'Bank Mandiri', aktif: true, dipakai: 0 });
  });

  it('hanya admin yang dapat menambah, mengubah, dan menghapus master', async () => {
    const tulis: [string, string, Record<string, unknown>][] = [
      ['post', '/api/master/jenis-pengajuan', BORONGAN],
      ['put', '/api/master/jenis-pengajuan/konsumsi', { ...BORONGAN, prefix: 'KSM' }],
      ['delete', '/api/master/jenis-pengajuan/konsumsi', {}],
      ['post', '/api/master/jenis-berkas', { label: 'Kuitansi' }],
      ['put', '/api/master/jenis-berkas/notulen', { label: 'Notulen' }],
      ['delete', '/api/master/jenis-berkas/kontrak', {}],
      ['post', '/api/master/bank', { nama: 'Bank Baru' }],
      ['put', '/api/master/bank/1', { nama: 'Bank Mandiri' }],
      ['delete', '/api/master/bank/1', {}],
      ['post', '/api/master/project', { kode: 'X1', nama: 'Project X' }],
      ['put', '/api/master/project/1', { kode: 'X1', nama: 'Project X' }],
      ['delete', '/api/master/project/1', {}],
      ['post', '/api/master/task', { kode: '799999', nama: 'Task X' }],
      ['put', '/api/master/task/1', { kode: '799999', nama: 'Task X' }],
      ['delete', '/api/master/task/1', {}],
      ['post', '/api/master/project-task/salin', { dari: 2026, ke: 2027 }],
      ['post', '/api/master/dana', { kode: '71', nama: 'Dana Lain' }],
      ['put', '/api/master/dana/51', { kode: '51', nama: 'Dana X' }],
      ['delete', '/api/master/dana/61', {}],
    ];
    for (const agent of [op, pum, pimpinan]) {
      for (const [metode, url, body] of tulis) {
        const res = await (agent[metode as 'post'] as (u: string) => { send: (b: unknown) => Promise<{ status: number }> })
          .call(agent, url)
          .send(body);
        expect(res.status, `${metode} ${url}`).toBe(403);
      }
    }
    for (const url of ['/api/master/jenis-pengajuan', '/api/master/jenis-berkas', '/api/master/bank', '/api/master/project-task', '/api/master/dana']) {
      expect((await pimpinan.get(url)).status, url).toBe(200);
    }
  });
});

describe('Master Jenis Berkas', () => {
  it('tambah, validasi nama unik, nonaktif & hapus sesuai pemakaian', async () => {
    let res = await admin.post('/api/master/jenis-berkas').send({ label: '  Kuitansi   Pembayaran ', keterangan: 'Bukti bayar' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kode: 'kuitansi_pembayaran', label: 'Kuitansi Pembayaran', aktif: true, bawaan: false });

    res = await admin.post('/api/master/jenis-berkas').send({ label: 'kuitansi pembayaran' });
    expect(res.status).toBe(400);
    expect(res.body.errors.label).toBeTruthy();
    res = await admin.post('/api/master/jenis-berkas').send({ label: 'Dokumen Lainnya' });
    expect(res.status).toBe(400);

    // Masih wajib pada Konsumsi → tidak bisa dinonaktifkan/dihapus; bawaan tidak bisa dihapus.
    res = await admin.put('/api/master/jenis-berkas/notulen').send({ label: 'Notula Rapat', aktif: false });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Konsumsi');
    res = await admin.put('/api/master/jenis-berkas/notulen').send({ label: 'Notula Rapat' });
    expect(res.status).toBe(200);
    expect(((await op.get('/api/master/konfig')).body as Konfig).jenisBerkas.find((b) => b.kode === 'notulen')?.label).toBe(
      'Notula Rapat',
    );
    expect((await admin.delete('/api/master/jenis-berkas/notulen')).status).toBe(409);

    // Tidak dipakai → boleh dinonaktifkan & dihapus.
    expect((await admin.put('/api/master/jenis-berkas/kontrak').send({ label: 'Kontrak', aktif: false })).status).toBe(200);
    expect((await admin.delete('/api/master/jenis-berkas/kontrak')).status).toBe(200);
    expect((await admin.delete('/api/master/jenis-berkas/kontrak')).status).toBe(404);
    const daftar = (await admin.get('/api/master/jenis-berkas')).body as JenisBerkasMaster[];
    expect(daftar.find((b) => b.kode === 'notulen')?.dipakai).toEqual({ jenis_pengajuan: ['konsumsi'], berkas: 0 });
  });

  it('jenis berkas yang sudah punya file di pengajuan tidak dapat dihapus', async () => {
    await buatBorongan({ berkas: ['laporan_pekerjaan', 'presensi'] });
    const draft = await op.post('/api/pengajuan').send(dataBorongan([{ pegawai_id: ctx.pegawai[0], nilai: 2_000_000 }]));
    expect((await unggah(ctx, op, draft.body.id, 'presensi', FILE_CONTOH.pdf, 'presensi.pdf')).status).toBe(201);
    // Dikeluarkan dari daftar wajib → masih ada file → tetap tidak dapat dihapus.
    expect((await admin.put('/api/master/jenis-pengajuan/kontrak_borongan').send({ ...BORONGAN, berkas: ['laporan_pekerjaan'] })).status).toBe(200);
    const res = await admin.delete('/api/master/jenis-berkas/presensi');
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('tercatat pada pengajuan');
  });
});

describe('Master Jenis Pengajuan', () => {
  it('menambah jenis baru: kode dari nama, awalan huruf besar, berkas wajib urut', async () => {
    const j = await buatBorongan();
    expect(j).toMatchObject({
      kode: 'kontrak_borongan',
      prefix: 'KBR',
      model: 'umum',
      maks_peserta: 3,
      mekanisme_tetap: null,
      berkas: [
        { kode: 'laporan_pekerjaan', wajib: true },
        { kode: 'presensi', wajib: true },
        { kode: 'kontrak', wajib: true },
      ],
      bawaan: false,
      aktif: true,
      urutan: 4,
    });
    const k = (await op.get('/api/master/konfig')).body as Konfig;
    expect(k.jenisPengajuan.map((x) => x.kode)).toEqual(['konsumsi', 'rumah_tangga', 'perjadin', 'kontrak_borongan']);
  });

  it('validasi: nama & awalan unik, model, batas orang, berkas', async () => {
    await buatBorongan();
    let res = await admin.post('/api/master/jenis-pengajuan').send({ ...BORONGAN, label: 'kontrak borongan', prefix: 'KSM' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ label: expect.any(String), prefix: expect.stringContaining('Konsumsi') });

    res = await admin.post('/api/master/jenis-pengajuan').send({
      label: 'X',
      prefix: 'K1',
      model: 'lain',
      warna: 'pink',
      ikon: 'bebas',
      berkas: ['lainnya'],
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['berkas', 'ikon', 'label', 'label_pendek', 'maks_peserta', 'model', 'prefix', 'warna']);

    res = await admin.post('/api/master/jenis-pengajuan').send({ ...BORONGAN, label: 'Honor Lain', prefix: 'HNL', maks_peserta: 0 });
    expect(res.body.errors.maks_peserta).toBeTruthy();
    res = await admin.post('/api/master/jenis-pengajuan').send({ ...BORONGAN, label: 'Honor Lain', prefix: 'HNL', berkas: ['tidak_ada'] });
    expect(res.status).toBe(400);
    expect(res.body.errors.berkas).toContain('tidak_ada');

    // Jenis berkas nonaktif tidak dapat dipilih (Kontrak masih wajib pada Kontrak Borongan → tidak bisa dinonaktifkan).
    expect((await admin.put('/api/master/jenis-berkas/kontrak').send({ label: 'Kontrak', aktif: false })).status).toBe(409);
    await admin.post('/api/master/jenis-berkas').send({ label: 'Arsip Lama', aktif: false });
    res = await admin.post('/api/master/jenis-pengajuan').send({ ...BORONGAN, label: 'Honor Lain', prefix: 'HNL', berkas: ['arsip_lama'] });
    expect(res.status).toBe(400);
    expect(res.body.errors.berkas).toContain('Arsip Lama');

    // Model konsumsi tidak memakai batas orang.
    res = await admin.post('/api/master/jenis-pengajuan').send({ ...BORONGAN, label: 'Konsumsi Pimpinan', prefix: 'KSP', model: 'konsumsi', berkas: [] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ model: 'konsumsi', maks_peserta: null, berkas: [] });
  });

  it('alur lengkap pengajuan jenis baru (model Umum) sampai selesai, ikut rekap & dashboard', async () => {
    await buatBorongan();
    // Validasi model umum: tanpa lokasi, tanggal sampai opsional, batas orang dari master.
    let res = await op.post('/api/pengajuan').send(dataBorongan([]));
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ peserta: 'Tambahkan minimal 1 orang' });
    const empat = ctx.pegawai.slice(0, 4).map((id) => ({ pegawai_id: id, nilai: 1_000_000 }));
    res = await op.post('/api/pengajuan').send(dataBorongan(empat));
    expect(res.body.errors.peserta).toBe('Maksimal 3 orang per pengajuan');
    res = await op.post('/api/pengajuan').send(dataBorongan(empat.slice(0, 1), { tanggal_selesai: `${TAHUN_INI}-08-01` }));
    expect(res.body.errors.tanggal_selesai).toBeTruthy();

    res = await op.post('/api/pengajuan').send(
      dataBorongan(
        [
          { pegawai_id: ctx.pegawai[0], nilai: 3_500_000 },
          { pegawai_id: ctx.pegawai[1], nilai: 2_500_000 },
        ],
        { tanggal_selesai: '', lokasi_tujuan: 'diabaikan' },
      ),
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    let p = res.body as PengajuanDetail;
    expect(p.kode).toBe(`KBR-${TAHUN_INI}-0001`);
    expect(p).toMatchObject({ kategori: 'kontrak_borongan', total: 6_000_000, jumlah_orang: 2, lokasi_tujuan: null, tanggal_selesai: null });
    expect(p.penerima).toBe('Ahmad Fauzan, Rizky Pratama');
    expect(p.kelengkapan.items.map((i) => [i.jenis, i.label])).toEqual([
      ['laporan_pekerjaan', 'Laporan Pekerjaan'],
      ['presensi', 'Presensi'],
      ['kontrak', 'Kontrak'],
    ]);
    expect(p.riwayat[0].keterangan).toContain('Kontrak Borongan');

    // Hanya berkas jenis ini (atau Dokumen Lainnya) yang boleh diunggah.
    expect((await unggah(ctx, op, p.id, 'notulen', FILE_CONTOH.pdf, 'notula.pdf')).status).toBe(400);
    for (const jenis of BORONGAN.berkas) {
      expect((await unggah(ctx, op, p.id, jenis, FILE_CONTOH.pdf, `${jenis}.pdf`)).status).toBe(201);
    }
    expect((await op.post(`/api/pengajuan/${p.id}/ajukan`)).status).toBe(200);
    expect((await pum.put(`/api/pengajuan/${p.id}/cek-berkas`).send({ jenis: 'notulen', status: 'sesuai' })).status).toBe(400);
    for (const jenis of BORONGAN.berkas) {
      expect((await pum.put(`/api/pengajuan/${p.id}/cek-berkas`).send({ jenis, status: 'sesuai' })).status).toBe(200);
    }
    expect((await pum.post(`/api/pengajuan/${p.id}/verifikasi`).send({})).status).toBe(200);
    expect(
      (await pum.post(`/api/pengajuan/${p.id}/ajukan-mdk`).send({ no_invoice_mdk: 'INV-KBR-1', tanggal_invoice_mdk: `${TAHUN_INI}-10-01` })).status,
    ).toBe(200);
    res = await pum.post(`/api/pengajuan/${p.id}/selesai`);
    expect(res.status).toBe(200);
    p = res.body;
    expect(p.status).toBe('selesai');
    // Tanda "sudah dibayarkan" hanya untuk model Konsumsi.
    expect((await pum.put(`/api/pengajuan/${p.id}/dibayarkan`).send({ dibayarkan: true })).status).toBe(409);

    const daftar = (await pimpinan.get('/api/pengajuan?kategori=kontrak_borongan')).body;
    expect(daftar.data.map((x: { kode: string }) => x.kode)).toEqual([p.kode]);
    const rekap = (await admin.get('/api/rekap/pengajuan')).body as RekapPengajuanData;
    expect(rekap.ringkasan.perKategori.kontrak_borongan).toEqual({ jumlah: 1, nilai: 6_000_000 });
    const pegawai = (await admin.get('/api/rekap/pegawai')).body as RekapPegawaiData;
    expect(pegawai.rows.find((r) => r.pegawai_id === ctx.pegawai[0])?.perKategori).toEqual({ kontrak_borongan: 3_500_000 });
    expect(pegawai.total).toBe(rekap.ringkasan.nilai);
    const dash = (await admin.get(`/api/dashboard?tahun=${TAHUN_INI}`)).body as DashboardData;
    expect(dash.perKategori.map((k) => k.kategori)).toEqual(['konsumsi', 'rumah_tangga', 'perjadin', 'kontrak_borongan']);
    expect(dash.perKategori.at(-1)).toMatchObject({ jumlah: 1, nilai: 6_000_000 });
    expect(dash.perBulan[8].perKategori).toEqual({ kontrak_borongan: 6_000_000 });
    expect(dash.topPegawai[0].perKategori).toEqual({ kontrak_borongan: 3_500_000 });
  });

  it('mengubah berkas wajib: draft ikut berubah (tercatat di riwayat), yang sudah diajukan tidak', async () => {
    await buatBorongan();
    const satu = [{ pegawai_id: ctx.pegawai[0], nilai: 1_000_000 }];
    const draft = (await op.post('/api/pengajuan').send(dataBorongan(satu))).body as PengajuanDetail;
    const diajukan = (await op.post('/api/pengajuan').send(dataBorongan(satu))).body as PengajuanDetail;
    expect((await unggah(ctx, op, draft.id, 'presensi', FILE_CONTOH.pdf, 'presensi.pdf')).status).toBe(201);
    expect((await op.post(`/api/pengajuan/${diajukan.id}/ajukan`)).status).toBe(200);

    await admin.post('/api/master/jenis-berkas').send({ label: 'Kuitansi' });
    const res = await admin
      .put('/api/master/jenis-pengajuan/kontrak_borongan')
      .send({ ...BORONGAN, berkas: ['kuitansi', 'laporan_pekerjaan', 'presensi'] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ berkas: ['kuitansi', 'laporan_pekerjaan', 'presensi'].map((kode) => ({ kode, wajib: true })), disinkron: 1 });

    const d1 = (await op.get(`/api/pengajuan/${draft.id}`)).body as PengajuanDetail;
    expect(d1.kelengkapan.items.map((i) => i.jenis)).toEqual(['kuitansi', 'laporan_pekerjaan', 'presensi']);
    expect(d1).toMatchObject({ berkas_wajib: 3, berkas_terpenuhi: 1 });
    expect(d1.riwayat[0]).toMatchObject({ aksi: 'diubah', user_nama: 'Admin Sistem' });
    expect(d1.riwayat[0].keterangan).toBe('Berkas mengikuti master — wajib baru: Kuitansi · tidak wajib lagi: Kontrak');

    const d2 = (await pum.get(`/api/pengajuan/${diajukan.id}`)).body as PengajuanDetail;
    expect(d2.kelengkapan.items.map((i) => i.jenis)).toEqual(['laporan_pekerjaan', 'presensi', 'kontrak']);
    // Dikembalikan lalu diajukan ulang → mengikuti daftar terbaru.
    expect((await pum.post(`/api/pengajuan/${diajukan.id}/kembalikan`).send({ catatan: 'Lengkapi kuitansi' })).status).toBe(200);
    expect((await op.post(`/api/pengajuan/${diajukan.id}/ajukan`)).status).toBe(200);
    const d3 = (await pum.get(`/api/pengajuan/${diajukan.id}`)).body as PengajuanDetail;
    expect(d3.kelengkapan.items.map((i) => i.jenis)).toEqual(['kuitansi', 'laporan_pekerjaan', 'presensi']);
  });

  it('awalan kode, nonaktif, model tetap, dan hapus', async () => {
    await buatBorongan();
    // Belum dipakai → awalan boleh diganti.
    expect((await admin.put('/api/master/jenis-pengajuan/kontrak_borongan').send({ ...BORONGAN, prefix: 'KBO' })).status).toBe(200);
    const draft = (await op.post('/api/pengajuan').send(dataBorongan([{ pegawai_id: ctx.pegawai[0], nilai: 1 }]))).body;
    expect(draft.kode).toBe(`KBO-${TAHUN_INI}-0001`);
    let res = await admin.put('/api/master/jenis-pengajuan/kontrak_borongan').send({ ...BORONGAN, prefix: 'KBR' });
    expect(res.status).toBe(400);
    expect(res.body.errors.prefix).toContain('Sudah ada 1 pengajuan');

    // Model tidak dapat diganti (diabaikan).
    res = await admin.put('/api/master/jenis-pengajuan/kontrak_borongan').send({ ...BORONGAN, prefix: 'KBO', model: 'konsumsi' });
    expect(res.body.model).toBe('umum');

    // Nonaktif: tidak bisa dipakai untuk pengajuan baru, pengajuan lama tetap bisa diubah.
    expect((await admin.put('/api/master/jenis-pengajuan/kontrak_borongan').send({ ...BORONGAN, prefix: 'KBO', aktif: false })).status).toBe(200);
    res = await op.post('/api/pengajuan').send(dataBorongan([{ pegawai_id: ctx.pegawai[0], nilai: 1 }]));
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('nonaktif');
    expect((await op.put(`/api/pengajuan/${draft.id}`).send(dataBorongan([{ pegawai_id: ctx.pegawai[1], nilai: 2 }]))).status).toBe(200);

    // Hapus: bawaan & yang sudah dipakai ditolak; yang belum dipakai boleh.
    expect((await admin.delete('/api/master/jenis-pengajuan/konsumsi')).status).toBe(409);
    expect((await admin.delete('/api/master/jenis-pengajuan/kontrak_borongan')).status).toBe(409);
    await admin.post('/api/master/jenis-pengajuan').send({ ...BORONGAN, label: 'Honor Narasumber', prefix: 'HNR' });
    expect((await admin.delete('/api/master/jenis-pengajuan/honor_narasumber')).status).toBe(200);
    expect((await admin.delete('/api/master/jenis-pengajuan/honor_narasumber')).status).toBe(404);
  });

  it('minimal satu jenis aktif; kategori tak dikenal ditolak; filter transport ikut jenis bermodel transport', async () => {
    for (const kode of ['rumah_tangga', 'perjadin']) {
      const j = ((await admin.get('/api/master/konfig')).body as Konfig).jenisPengajuan.find((x) => x.kode === kode)!;
      expect((await admin.put(`/api/master/jenis-pengajuan/${kode}`).send({ ...j, aktif: false })).status).toBe(200);
    }
    const konsumsi = ((await admin.get('/api/master/konfig')).body as Konfig).jenisPengajuan[0];
    const res = await admin.put('/api/master/jenis-pengajuan/konsumsi').send({ ...konsumsi, aktif: false });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Minimal');

    const salah = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { kategori: 'tidak_ada' }));
    expect(salah.status).toBe(400);
    expect(salah.body.errors).toEqual({ kategori: 'Jenis pengajuan tidak valid' });

    await admin.post('/api/master/jenis-pengajuan').send({ ...BORONGAN, label: 'Transport Lain', prefix: 'TRL', model: 'rumah_tangga', berkas: [] });
    const tr = await op.post('/api/pengajuan').send({
      kategori: 'transport_lain',
      nama_kegiatan: 'Antar dokumen',
      tanggal_kegiatan: `${TAHUN_INI}-02-02`,
      mekanisme: 'KO',
      peserta: [{ pegawai_id: ctx.pegawai[0], nilai: 50_000 }],
    });
    expect(tr.status).toBe(400);
    expect(tr.body.errors).toEqual({ lokasi_tujuan: 'Lokasi tujuan wajib diisi' });
    const ok = await op
      .post('/api/pengajuan')
      .send({ kategori: 'transport_lain', nama_kegiatan: 'Antar dokumen', tanggal_kegiatan: `${TAHUN_INI}-02-02`, lokasi_tujuan: 'Salemba', mekanisme: 'KO', peserta: [{ pegawai_id: ctx.pegawai[0], nilai: 50_000 }] });
    expect(ok.status).toBe(201);
    expect(ok.body.kelengkapan).toMatchObject({ total: 0, lengkap: true, semuaSesuai: true });
    const daftar = (await op.get('/api/pengajuan?kategori=transport')).body;
    expect(daftar.data.map((x: { kategori: string }) => x.kategori)).toEqual(['transport_lain']);
  });
});

describe('Master Bank', () => {
  it('tambah, nama unik, ubah, nonaktif, hapus; pemakaian dihitung dari rekening', async () => {
    let res = await admin.post('/api/master/bank').send({ nama: '  Bank   Nagari ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nama: 'Bank Nagari', aktif: true, dipakai: 0 });
    const id = res.body.id as number;
    expect((await admin.post('/api/master/bank').send({ nama: 'bank nagari' })).status).toBe(400);
    expect((await admin.post('/api/master/bank').send({ nama: 'B' })).status).toBe(400);
    res = await admin.put(`/api/master/bank/${id}`).send({ nama: 'Bank Nagari Syariah', aktif: false });
    expect(res.body).toMatchObject({ nama: 'Bank Nagari Syariah', aktif: false });

    await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { rekening_bank: 'bni', rekening_nomor: '0123456789' }));
    await op.put(`/api/pegawai/${ctx.pegawai[1]}`).send({ nama: 'Rizky Pratama', rekening_bank: 'BNI', rekening_nomor: '0987654321' });
    const bni = ((await op.get('/api/master/bank')).body as Bank[]).find((b) => b.nama === 'BNI');
    expect(bni?.dipakai).toBe(2);

    expect((await admin.delete(`/api/master/bank/${id}`)).status).toBe(200);
    expect((await admin.delete(`/api/master/bank/${id}`)).status).toBe(404);
  });
});


describe('Master Project Costing, Task Name & kode dana (per tahun anggaran)', () => {
  it('tambah task & project dengan task + kode dananya, validasi kode & tahun, ubah, hapus', async () => {
    let res = await admin.post('/api/master/task').send({ tahun: 2026, kode: '721999', nama: 'Honor Kontrak Borongan' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tahun: 2026, kode: '721999' });
    const taskId = res.body.id as number;
    expect((await admin.post('/api/master/task').send({ tahun: 2026, kode: '721999', nama: 'Dobel' })).status).toBe(400);
    res = await admin.post('/api/master/task').send({ tahun: 2026, kode: '72_1', nama: 'Garis bawah' });
    expect(res.status).toBe(400);
    expect(res.body.errors.kode).toBeTruthy();
    expect((await admin.post('/api/master/task').send({ kode: '721998', nama: 'Tanpa tahun' })).body.errors).toMatchObject({ tahun: expect.any(String) });

    res = await admin
      .post('/api/master/project')
      .send({ tahun: 2026, kode: 'D0099.01.01.6.001', nama: 'Kontrak Borongan Kantor', tasks: [{ id: taskId, kode_dana: '51' }, { id: taskId, kode_dana: '61' }] });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ tahun: 2026, kode: 'D0099.01.01.6.001', aktif: true, tasks: [{ id: taskId, kode_dana: '51' }] });
    const projectId = res.body.id as number;
    expect((await admin.post('/api/master/project').send({ tahun: 2026, kode: 'D0099:01', nama: 'Titik dua' })).status).toBe(400);
    expect((await admin.post('/api/master/project').send({ tahun: 2026, kode: 'D0099.01.01.6.002', nama: 'Task salah', tasks: [{ id: 99999 }] })).status).toBe(400);
    res = await admin.post('/api/master/project').send({ tahun: 2026, kode: 'D0099.01.01.6.003', nama: 'Dana asing', tasks: [{ id: taskId, kode_dana: '99' }] });
    expect(res.status).toBe(400);
    expect(res.body.errors.tasks).toContain('99');

    res = await admin.put(`/api/master/project/${projectId}`).send({ tahun: 2026, kode: 'D0099.01.01.6.001', nama: 'Kontrak Borongan', aktif: false, tasks: [] });
    expect(res.body).toMatchObject({ nama: 'Kontrak Borongan', aktif: false, tasks: [] });
    // Tahun anggaran project tidak dapat dipindah lewat ubah.
    res = await admin.put(`/api/master/project/${projectId}`).send({ tahun: 2027, kode: 'D0099.01.01.6.001', nama: 'Kontrak Borongan' });
    expect(res.status).toBe(400);
    expect(res.body.errors.tahun).toBeTruthy();
    await admin
      .put(`/api/master/project/${projectId}`)
      .send({ tahun: 2026, kode: 'D0099.01.01.6.001', nama: 'Kontrak Borongan', tasks: [{ id: taskId, kode_dana: '61' }] });

    // Menghapus task ikut melepas pasangannya.
    expect((await admin.delete(`/api/master/task/${taskId}`)).status).toBe(200);
    const pt = (await pum.get('/api/master/project-task')).body as MasterProjectTask;
    expect(pt.project.find((p) => p.id === projectId)?.tasks).toEqual([]);
    expect((await admin.delete(`/api/master/project/${projectId}`)).status).toBe(200);
    expect((await admin.delete(`/api/master/project/${projectId}`)).status).toBe(404);
  });

  it('kelompok tahun: kode boleh sama di tahun lain, task harus setahun dengan project, salin 2026 → tahun kosong', async () => {
    // Task 2027 dengan kode yang sudah ada di 2026 → boleh.
    let res = await admin.post('/api/master/task').send({ tahun: 2027, kode: '723207', nama: 'Beban Konsumsi' });
    expect(res.status).toBe(201);
    const task27 = res.body.id as number;
    const pt = (await admin.get('/api/master/project-task')).body as MasterProjectTask;
    const task26 = pt.task.find((t) => t.tahun === 2026 && t.kode === '723207')!.id;
    // Project 2027 tidak boleh memakai task 2026.
    res = await admin.post('/api/master/project').send({ tahun: 2027, kode: 'D0030.07.01.7.001', nama: 'Sosialisasi', tasks: [{ id: task26, kode_dana: '51' }] });
    expect(res.status).toBe(400);
    expect(res.body.errors.tasks).toContain('2027');
    res = await admin.post('/api/master/project').send({ tahun: 2027, kode: 'D0030.07.01.7.001', nama: 'Sosialisasi', tasks: [{ id: task27, kode_dana: '51' }] });
    expect(res.status).toBe(201);

    // Salin hanya ke tahun yang masih kosong.
    res = await admin.post('/api/master/project-task/salin').send({ dari: 2026, ke: 2027 });
    expect(res.status).toBe(409);
    res = await admin.post('/api/master/project-task/salin').send({ dari: 2026, ke: 2028 });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ project: 15, task: 18, pasangan: 38 });
    const semua = res.body.data as MasterProjectTask;
    const task28 = new Map(semua.task.filter((t) => t.tahun === 2028).map((t) => [t.id, t.kode]));
    const pasangan28 = semua.project
      .filter((p) => p.tahun === 2028)
      .flatMap((p) => p.tasks.map((x) => `${p.kode}|${task28.get(x.id)}|${x.kode_dana}`))
      .sort();
    expect(pasangan28).toEqual(PROJECT_TASK_AWAL.map((x) => `${x.projectKode}|${x.taskKode}|${x.kodeDana}`).sort());
    expect((await admin.post('/api/master/project-task/salin').send({ dari: 2030, ke: 2031 })).status).toBe(404);
    expect((await admin.post('/api/master/project-task/salin').send({ dari: 2026, ke: 2026 })).status).toBe(400);
  });

  it('kode dana: tambah, ubah nama, nonaktif, hapus hanya bila belum dipakai; dipakai PUM saat verifikasi', async () => {
    let res = await admin.post('/api/master/dana').send({ kode: '71', nama: 'Dana Hibah' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ kode: '71', nama: 'Dana Hibah', aktif: true, dipakai: 0 });
    expect((await admin.post('/api/master/dana').send({ kode: '71', nama: 'Dobel' })).status).toBe(400);
    res = await admin.put('/api/master/dana/71').send({ kode: '72', nama: 'Ganti kode' });
    expect(res.status).toBe(400);
    expect(res.body.errors.kode).toBeTruthy();
    res = await admin.put('/api/master/dana/71').send({ kode: '71', nama: 'Dana Hibah Penelitian', aktif: false });
    expect(res.body).toMatchObject({ nama: 'Dana Hibah Penelitian', aktif: false });
    expect((await admin.delete('/api/master/dana/51')).status).toBe(409); // dipakai pasangan
    expect((await admin.delete('/api/master/dana/71')).status).toBe(200);
    expect((await admin.delete('/api/master/dana/71')).status).toBe(404);

    // Verifikasi PUM menyimpan kode dana; kode tak dikenal ditolak.
    const p = (await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]))).body as PengajuanDetail;
    for (const jenis of ['notulen', 'undangan', 'invoice', 'daftar_hadir']) await unggah(ctx, op, p.id, jenis, FILE_CONTOH.pdf, `${jenis}.pdf`);
    expect((await op.post(`/api/pengajuan/${p.id}/ajukan`)).status).toBe(200);
    for (const jenis of ['notulen', 'undangan', 'invoice', 'daftar_hadir']) {
      await pum.put(`/api/pengajuan/${p.id}/cek-berkas`).send({ jenis, status: 'sesuai' });
    }
    const project = 'D0030.07.01.6.001:Sosialisasi Revisi PRPBJ dan E-Proc';
    const task = '723207_Beban Konsumsi';
    res = await pum.post(`/api/pengajuan/${p.id}/verifikasi`).send({ project_hosting: project, task_name: task, kode_dana: '99' });
    expect(res.status).toBe(400);
    expect(res.body.errors.kode_dana).toContain('99');
    res = await pum.post(`/api/pengajuan/${p.id}/verifikasi`).send({ project_hosting: project, task_name: task, kode_dana: '51' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'diverifikasi_pum', task_name: task, project_hosting: project, kode_dana: '51' });
    expect(res.body.riwayat[0].keterangan).toContain('Kode dana: 51');
    // Ubah data PUM: kode dana ikut tercatat; daftar pengajuan memuat kode dana.
    res = await pum.put(`/api/pengajuan/${p.id}/data-pum`).send({ project_hosting: project, task_name: task, kode_dana: '61' });
    expect(res.body.kode_dana).toBe('61');
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'data_pum_diubah', keterangan: `Task: ${task} · Project: ${project} · Kode dana: 61` });
    const daftar = (await pum.get('/api/pengajuan?status=diverifikasi_pum')).body;
    expect(daftar.data[0]).toMatchObject({ kode_dana: '61', berkas_sesuai: 4, berkas_wajib: 4, berkas_revisi: 0 });
    // Kode dana yang sudah dipakai pengajuan tidak dapat dihapus walau tidak dipakai pasangan.
    await admin.post('/api/master/dana').send({ kode: '81', nama: 'Dana Khusus' });
    await pum.put(`/api/pengajuan/${p.id}/data-pum`).send({ project_hosting: project, task_name: task, kode_dana: '81' });
    expect((await admin.delete('/api/master/dana/81')).status).toBe(409);
  });
});

describe('Berkas wajib & opsional (master Jenis Pengajuan)', () => {
  it('berkas opsional tampil tanpa dihitung kelengkapan; boleh diunggah & diperiksa PUM; revisi opsional menahan verifikasi', async () => {
    const j = await buatBorongan({
      berkas: [{ kode: 'laporan_pekerjaan' }, { kode: 'presensi', wajib: false }, { kode: 'kontrak', wajib: true }],
    });
    expect(j.berkas).toEqual([
      { kode: 'laporan_pekerjaan', wajib: true },
      { kode: 'presensi', wajib: false },
      { kode: 'kontrak', wajib: true },
    ]);
    let p = (await op.post('/api/pengajuan').send(dataBorongan([{ pegawai_id: ctx.pegawai[0], nilai: 1_000_000 }]))).body as PengajuanDetail;
    expect(p.kelengkapan.items.map((i) => [i.jenis, i.wajib])).toEqual([
      ['laporan_pekerjaan', true],
      ['presensi', false],
      ['kontrak', true],
    ]);
    expect(p).toMatchObject({ berkas_wajib: 2, berkas_terpenuhi: 0 });
    expect(p.kelengkapan).toMatchObject({ total: 2, terpenuhi: 0 });

    // Berkas opsional boleh diunggah tetapi tidak menambah hitungan; N/A hanya untuk berkas wajib.
    expect((await unggah(ctx, op, p.id, 'presensi', FILE_CONTOH.pdf, 'presensi.pdf')).status).toBe(201);
    expect((await op.put(`/api/pengajuan/${p.id}/berkas-na`).send({ jenis: 'presensi', na: true })).status).toBe(400);
    expect((await op.put(`/api/pengajuan/${p.id}/berkas-na`).send({ jenis: 'kontrak', na: true })).status).toBe(200);
    expect((await unggah(ctx, op, p.id, 'laporan_pekerjaan', FILE_CONTOH.pdf, 'laporan.pdf')).status).toBe(201);
    p = (await op.get(`/api/pengajuan/${p.id}`)).body;
    expect(p).toMatchObject({ berkas_wajib: 2, berkas_terpenuhi: 2 });
    expect(p.kelengkapan).toMatchObject({ lengkap: true, terpenuhi: 2, total: 2 });

    expect((await op.post(`/api/pengajuan/${p.id}/ajukan`)).status).toBe(200);
    for (const jenis of ['laporan_pekerjaan', 'kontrak']) {
      expect((await pum.put(`/api/pengajuan/${p.id}/cek-berkas`).send({ jenis, status: 'sesuai' })).status).toBe(200);
    }
    // PUM menandai berkas opsional perlu revisi → verifikasi ditahan.
    let res = await pum.put(`/api/pengajuan/${p.id}/cek-berkas`).send({ jenis: 'presensi', status: 'revisi', catatan: 'Presensi bulan salah' });
    expect(res.status).toBe(200);
    expect(res.body.kelengkapan).toMatchObject({ sesuai: 2, total: 2, semuaSesuai: true, revisi: 1, bisaVerifikasi: false });
    expect((await pum.get('/api/pengajuan?status=diajukan_pum')).body.data[0]).toMatchObject({ berkas_sesuai: 2, berkas_wajib: 2, berkas_revisi: 1 });
    res = await pum.post(`/api/pengajuan/${p.id}/verifikasi`).send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('perlu revisi');
    // Centang sesuai pada berkas opsional tidak menambah hitungan sesuai wajib.
    res = await pum.put(`/api/pengajuan/${p.id}/cek-berkas`).send({ jenis: 'presensi', status: 'sesuai' });
    expect(res.body.kelengkapan).toMatchObject({ sesuai: 2, revisi: 0, bisaVerifikasi: true });
    expect((await pum.get('/api/pengajuan?status=diajukan_pum')).body.data[0]).toMatchObject({ berkas_sesuai: 2, berkas_revisi: 0 });
    expect((await pum.post(`/api/pengajuan/${p.id}/verifikasi`).send({})).status).toBe(200);
  });

  it('mengubah sifat wajib ↔ opsional: draft ikut berubah & tercatat; tanda N/A dilepas dari berkas yang jadi opsional', async () => {
    await buatBorongan();
    const draft = (await op.post('/api/pengajuan').send(dataBorongan([{ pegawai_id: ctx.pegawai[0], nilai: 1 }]))).body as PengajuanDetail;
    expect((await op.put(`/api/pengajuan/${draft.id}/berkas-na`).send({ jenis: 'presensi', na: true })).status).toBe(200);
    await admin.post('/api/master/jenis-berkas').send({ label: 'Kuitansi' });
    const res = await admin.put('/api/master/jenis-pengajuan/kontrak_borongan').send({
      ...BORONGAN,
      berkas: [
        { kode: 'laporan_pekerjaan', wajib: true },
        { kode: 'presensi', wajib: false },
        { kode: 'kontrak', wajib: true },
        { kode: 'kuitansi', wajib: false },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.disinkron).toBe(1);
    const d = (await op.get(`/api/pengajuan/${draft.id}`)).body as PengajuanDetail;
    expect(d.kelengkapan.items.map((i) => `${i.jenis}:${i.wajib ? 'wajib' : 'opsional'}`)).toEqual([
      'laporan_pekerjaan:wajib',
      'presensi:opsional',
      'kontrak:wajib',
      'kuitansi:opsional',
    ]);
    expect(d.berkas_na).toEqual([]);
    expect(d).toMatchObject({ berkas_wajib: 2, berkas_terpenuhi: 0 });
    expect(d.riwayat[0].keterangan).toBe('Berkas mengikuti master — tidak wajib lagi: Presensi · opsional baru: Kuitansi');
  });
});

describe('Rekening per penerima & mekanisme tetap', () => {
  it('rekening tiap penerima tersimpan di pengajuan (tidak ikut berubah bila master pegawai berubah); perubahan tercatat', async () => {
    let res = await op.post('/api/pegawai').send({ nama: 'Pegawai Rek', rekening_bank: 'Bank Mandiri' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ rekening_nomor: 'Isi nomor rekening' });
    res = await op.post('/api/pegawai').send({ nama: 'Pegawai Rek', rekening_bank: ' Bank  Mandiri ', rekening_nomor: '157-00.01 234' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ rekening_bank: 'Bank Mandiri', rekening_nomor: '1570001234' });
    const id = res.body.id as number;

    await buatBorongan();
    res = await op.post('/api/pengajuan').send(
      dataBorongan([
        { pegawai_id: id, nilai: 10_000, rekening_bank: 'Bank Mandiri', rekening_nomor: '1570001234' } as never,
        { pegawai_id: ctx.pegawai[0], nilai: 5_000, rekening_bank: 'BNI', rekening_nomor: '' } as never,
      ]),
    );
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ 'peserta.1.rekening_nomor': 'Isi nomor rekening' });
    res = await op.post('/api/pengajuan').send(
      dataBorongan([
        { pegawai_id: id, nilai: 10_000, rekening_bank: 'Bank Mandiri', rekening_nomor: '1570001234' } as never,
        { pegawai_id: ctx.pegawai[0], nilai: 5_000 },
      ]),
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const p = res.body as PengajuanDetail;
    expect(p.peserta.map((x) => [x.rekening_bank, x.rekening_nomor])).toEqual([
      ['Bank Mandiri', '1570001234'],
      [null, null],
    ]);
    // Master pegawai berubah → rekening di pengajuan tetap.
    await op.put(`/api/pegawai/${id}`).send({ nama: 'Pegawai Rek', rekening_bank: '', rekening_nomor: '' });
    expect(((await op.get(`/api/pengajuan/${p.id}`)).body as PengajuanDetail).peserta[0]).toMatchObject({ rekening_bank: 'Bank Mandiri' });
    // Ubah rekening penerima → tercatat di riwayat.
    res = await op.put(`/api/pengajuan/${p.id}`).send(
      dataBorongan([
        { pegawai_id: id, nilai: 10_000, rekening_bank: 'BRI', rekening_nomor: '034101000123305' } as never,
        { pegawai_id: ctx.pegawai[0], nilai: 5_000 },
      ]),
    );
    expect(res.status).toBe(200);
    expect(res.body.riwayat[0].keterangan).toBe('Rekening Pegawai Rek Bank Mandiri 1570001234 → BRI 034101000123305');
    expect(((await admin.get('/api/master/bank')).body as Bank[]).find((b) => b.nama === 'BRI')?.dipakai).toBe(1);
  });

  it('Transport Rumah Tangga & Perjadin selalu LS walau dikirim KO; jenis lain mengikuti master', async () => {
    const rt = await op.post('/api/pengajuan').send({
      kategori: 'rumah_tangga',
      nama_kegiatan: 'Antar Dokumen',
      tanggal_kegiatan: `${TAHUN_INI}-04-02`,
      lokasi_tujuan: 'Rektorat',
      mekanisme: 'KO',
      peserta: [{ pegawai_id: ctx.pegawai[0], nilai: 100_000 }],
    });
    expect(rt.status).toBe(201);
    expect(rt.body.mekanisme).toBe('LS');
    // Tanpa isian mekanisme pun sah.
    const pd = await op.post('/api/pengajuan').send({
      kategori: 'perjadin',
      nama_kegiatan: 'Bimtek',
      tanggal_kegiatan: `${TAHUN_INI}-05-12`,
      tanggal_selesai: `${TAHUN_INI}-05-13`,
      lokasi_tujuan: 'Bandung',
      jenis_transport: 'luar_kota',
      peserta: [{ pegawai_id: ctx.pegawai[1], uang_harian: 300_000 }],
    });
    expect(pd.status, JSON.stringify(pd.body)).toBe(201);
    expect(pd.body.mekanisme).toBe('LS');
    // Admin bisa menetapkan mekanisme jenis lain, mis. Konsumsi selalu KO.
    const konsumsi = ((await admin.get('/api/master/konfig')).body as Konfig).jenisPengajuan[0];
    expect((await admin.put('/api/master/jenis-pengajuan/konsumsi').send({ ...konsumsi, mekanisme_tetap: 'KO' })).body.mekanisme_tetap).toBe('KO');
    const k = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { mekanisme: 'LS' }));
    expect(k.body.mekanisme).toBe('KO');
  });
});
