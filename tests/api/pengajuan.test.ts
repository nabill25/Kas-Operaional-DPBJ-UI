import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TAHUN_INI,
  buatKonteks,
  dataKonsumsi,
  dataPerjadin,
  dataRumahTangga,
  masuk,
  type Agent,
  type Konteks,
} from './helpers';

let ctx: Konteks;
let op: Agent;
let pum: Agent;
let pimpinan: Agent;

beforeEach(async () => {
  ctx = await buatKonteks();
  op = await masuk(ctx, 'operator');
  pum = await masuk(ctx, 'pum');
  pimpinan = await masuk(ctx, 'pimpinan');
});
afterEach(() => ctx.tutup());

describe('Pengajuan Konsumsi', () => {
  it('membuat draft dengan kode, total, dan kelengkapan awal', async () => {
    const res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[2]));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kode: `KSM-${TAHUN_INI}-0001`,
      kategori: 'konsumsi',
      status: 'draft',
      total: 1_250_000,
      jumlah_orang: 12,
      mekanisme: 'KO',
      jenis_konsumsi: 'kudapan_makan_siang',
      uang_siapa_id: ctx.pegawai[2],
      uang_siapa_nama: 'Nurul Hidayah',
      penerima: 'Nurul Hidayah',
      berkas_wajib: 4,
      berkas_terpenuhi: 0,
      catatan: 'Snack dan makan siang',
    });
    expect(res.body.kelengkapan.items.map((i: { jenis: string }) => i.jenis)).toEqual([
      'notulen',
      'undangan',
      'invoice',
      'daftar_hadir',
    ]);
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'dibuat', user_nama: 'Operator DPBJ' });
  });

  it('jenis konsumsi: wajib & valid untuk konsumsi, diabaikan untuk transport, perubahan tercatat', async () => {
    let res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { jenis_konsumsi: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.errors.jenis_konsumsi).toBe('Pilih jenis konsumsi');
    res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { jenis_konsumsi: 'sarapan' }));
    expect(res.status).toBe(400);
    expect(res.body.errors.jenis_konsumsi).toBeTruthy();

    res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { jenis_konsumsi: 'kudapan' }));
    expect(res.status).toBe(201);
    expect(res.body.jenis_konsumsi).toBe('kudapan');
    const id = res.body.id as number;

    res = await op.put(`/api/pengajuan/${id}`).send(dataKonsumsi(ctx.pegawai[0], { jenis_konsumsi: 'makan_siang' }));
    expect(res.status).toBe(200);
    expect(res.body.jenis_konsumsi).toBe('makan_siang');
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'diubah', keterangan: 'Jenis konsumsi Kudapan → Makan Siang' });
    const daftar = await op.get('/api/pengajuan');
    expect(daftar.body.data.find((p: { id: number }) => p.id === id).jenis_konsumsi).toBe('makan_siang');

    // Transport: nilai jenis konsumsi diabaikan (selalu null)
    res = await op
      .post('/api/pengajuan')
      .send(dataRumahTangga([{ pegawai_id: ctx.pegawai[1], nilai: 100_000 }], { jenis_konsumsi: 'kudapan' }));
    expect(res.status).toBe(201);
    expect(res.body.jenis_konsumsi).toBeNull();
  });

  it('menolak data tidak lengkap dengan error per field', async () => {
    const res = await op.post('/api/pengajuan').send({ kategori: 'konsumsi' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(
      ['jenis_konsumsi', 'jumlah_orang', 'mekanisme', 'nama_kegiatan', 'tanggal_kegiatan', 'total', 'uang_siapa_id'].sort(),
    );
  });

  it('menolak nilai tidak wajar', async () => {
    const res = await op.post('/api/pengajuan').send(
      dataKonsumsi(ctx.pegawai[0], { total: -5, jumlah_orang: 0, tanggal_kegiatan: '2026-02-30', mekanisme: 'XX' }),
    );
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({
      total: expect.any(String),
      jumlah_orang: expect.any(String),
      tanggal_kegiatan: 'Tanggal tidak valid',
      mekanisme: expect.any(String),
    });
  });

  it('menolak uang siapa yang tidak ada', async () => {
    const res = await op.post('/api/pengajuan').send(dataKonsumsi(99999));
    expect(res.status).toBe(400);
    expect(res.body.errors.uang_siapa_id).toBe('Pegawai tidak ditemukan');
  });

  it('kategori tidak valid ditolak', async () => {
    const res = await op.post('/api/pengajuan').send({ kategori: 'lain' });
    expect(res.status).toBe(400);
    expect(res.body.errors.kategori).toBeTruthy();
  });
});

describe('Pengajuan Transport Rumah Tangga', () => {
  it('total = SUM nilai peserta & jumlah orang dihitung server (nilai kiriman klien diabaikan)', async () => {
    const res = await op.post('/api/pengajuan').send({
      ...dataRumahTangga([
        { pegawai_id: ctx.pegawai[3], nilai: 150_000 },
        { pegawai_id: ctx.pegawai[0], nilai: 100_000 },
      ]),
      total: 1,
      jumlah_orang: 9,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kode: `TRT-${TAHUN_INI}-0001`,
      total: 250_000,
      jumlah_orang: 2,
      lokasi_tujuan: 'Gedung Rektorat UI, Depok',
      penerima: 'Bambang Sutrisno, Ahmad Fauzan',
      berkas_wajib: 2,
      uang_siapa_id: null,
    });
    expect(res.body.peserta.map((p: { nama: string; nilai: number; urutan: number }) => [p.nama, p.nilai, p.urutan])).toEqual([
      ['Bambang Sutrisno', 150_000, 1],
      ['Ahmad Fauzan', 100_000, 2],
    ]);
  });

  it('maksimal 2 orang', async () => {
    const res = await op.post('/api/pengajuan').send(
      dataRumahTangga([
        { pegawai_id: ctx.pegawai[0], nilai: 1000 },
        { pegawai_id: ctx.pegawai[1], nilai: 1000 },
        { pegawai_id: ctx.pegawai[2], nilai: 1000 },
      ]),
    );
    expect(res.status).toBe(400);
    expect(res.body.errors.peserta).toContain('Maksimal 2 orang');
  });

  it('minimal 1 orang, tanpa duplikat, nilai > 0, lokasi wajib', async () => {
    let res = await op.post('/api/pengajuan').send(dataRumahTangga([], { lokasi_tujuan: '' }));
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ peserta: expect.any(String), lokasi_tujuan: expect.any(String) });

    res = await op.post('/api/pengajuan').send(
      dataRumahTangga([
        { pegawai_id: ctx.pegawai[0], nilai: 50_000 },
        { pegawai_id: ctx.pegawai[0], nilai: 0 },
      ]),
    );
    expect(res.status).toBe(400);
    expect(res.body.errors['peserta.1.pegawai_id']).toBe('Pegawai ini sudah dipilih');
    expect(res.body.errors['peserta.1.nilai']).toBe('Nilai uang harus lebih dari 0');
  });

  it('peserta harus pegawai yang ada', async () => {
    const res = await op.post('/api/pengajuan').send(dataRumahTangga([{ pegawai_id: 424242, nilai: 50_000 }]));
    expect(res.status).toBe(400);
    expect(res.body.errors['peserta.0.pegawai_id']).toBe('Pegawai tidak ditemukan');
  });
});

describe('Pengajuan Transport Perjadin', () => {
  it('menyimpan rentang tanggal, jenis uang & jenis transport', async () => {
    const res = await op.post('/api/pengajuan').send(
      dataPerjadin([
        { pegawai_id: ctx.pegawai[0], nilai: 1_440_000 },
        { pegawai_id: ctx.pegawai[1], nilai: 1_440_000 },
      ]),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kode: `TPD-${TAHUN_INI}-0001`,
      tanggal_kegiatan: `${TAHUN_INI}-05-12`,
      tanggal_selesai: `${TAHUN_INI}-05-14`,
      jenis_uang: 'uang_harian',
      jenis_transport: 'luar_kota',
      total: 2_880_000,
      jumlah_orang: 2,
      berkas_wajib: 4,
    });
    expect(res.body.kelengkapan.items.map((i: { jenis: string }) => i.jenis)).toEqual([
      'surat_tugas',
      'laporan_kegiatan',
      'invoice_hotel',
      'invoice_tiket',
    ]);
  });

  it('validasi tanggal sampai, jenis uang, jenis transport', async () => {
    const res = await op.post('/api/pengajuan').send(
      dataPerjadin([{ pegawai_id: ctx.pegawai[0], nilai: 100_000 }], {
        tanggal_selesai: `${TAHUN_INI}-05-01`,
        jenis_uang: 'uang_lain',
        jenis_transport: '',
      }),
    );
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({
      tanggal_selesai: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
      jenis_uang: expect.any(String),
      jenis_transport: expect.any(String),
    });
  });

  it('maksimal 2 orang juga berlaku untuk perjadin', async () => {
    const res = await op.post('/api/pengajuan').send(
      dataPerjadin([
        { pegawai_id: ctx.pegawai[0], nilai: 1 },
        { pegawai_id: ctx.pegawai[1], nilai: 1 },
        { pegawai_id: ctx.pegawai[2], nilai: 1 },
      ]),
    );
    expect(res.status).toBe(400);
  });
});

describe('Kode, ubah, hapus, hak akses', () => {
  it('nomor kode berurutan per kategori & tidak dipakai ulang setelah dihapus', async () => {
    const a = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    const b = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    expect(a.body.kode).toBe(`KSM-${TAHUN_INI}-0001`);
    expect(b.body.kode).toBe(`KSM-${TAHUN_INI}-0002`);
    expect((await op.delete(`/api/pengajuan/${b.body.id}`)).status).toBe(200);
    const c = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    expect(c.body.kode).toBe(`KSM-${TAHUN_INI}-0003`);
    const d = await op.post('/api/pengajuan').send(dataRumahTangga([{ pegawai_id: ctx.pegawai[0], nilai: 5000 }]));
    expect(d.body.kode).toBe(`TRT-${TAHUN_INI}-0001`);
  });

  it('mengubah draft menghitung ulang total & mencatat riwayat', async () => {
    const { body } = await op.post('/api/pengajuan').send(dataRumahTangga([{ pegawai_id: ctx.pegawai[0], nilai: 100_000 }]));
    const res = await op.put(`/api/pengajuan/${body.id}`).send(
      dataRumahTangga([
        { pegawai_id: ctx.pegawai[1], nilai: 70_000 },
        { pegawai_id: ctx.pegawai[0], nilai: 30_000 },
      ]),
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(100_000);
    expect(res.body.jumlah_orang).toBe(2);
    expect(res.body.peserta.map((p: { pegawai_id: number }) => p.pegawai_id)).toEqual([ctx.pegawai[1], ctx.pegawai[0]]);
    expect(res.body.riwayat[0].aksi).toBe('diubah');
  });

  it('kategori tidak dapat diubah', async () => {
    const { body } = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    const res = await op.put(`/api/pengajuan/${body.id}`).send(dataRumahTangga([{ pegawai_id: ctx.pegawai[0], nilai: 5 }]));
    expect(res.status).toBe(400);
    expect(res.body.errors.kategori).toBeTruthy();
  });

  it('PUM & pimpinan tidak dapat membuat pengajuan & tidak dapat melihat draft', async () => {
    expect((await pum.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]))).status).toBe(403);
    expect((await pimpinan.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]))).status).toBe(403);
    const { body } = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    expect((await pum.get(`/api/pengajuan/${body.id}`)).status).toBe(404);
    expect((await pimpinan.get(`/api/pengajuan/${body.id}`)).status).toBe(404);
    expect((await pum.get('/api/pengajuan')).body.total).toBe(0);
    const list = await pimpinan.get('/api/pengajuan');
    expect(list.body.total).toBe(0);
    const listOp = await op.get('/api/pengajuan');
    expect(listOp.body.total).toBe(1);
  });

  it('id tidak valid → 404', async () => {
    expect((await op.get('/api/pengajuan/abc')).status).toBe(404);
    expect((await op.get('/api/pengajuan/999')).status).toBe(404);
  });

  it('hapus draft tercatat di riwayat (pengajuan_id menjadi NULL)', async () => {
    const { body } = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    expect((await op.delete(`/api/pengajuan/${body.id}`)).status).toBe(200);
    expect((await op.get(`/api/pengajuan/${body.id}`)).status).toBe(404);
    const log = await ctx.db.all<{ aksi: string; pengajuan_id: number | null; kode: string }>(
      `SELECT aksi, pengajuan_id, kode FROM riwayat WHERE kode = ? ORDER BY id`,
      body.kode,
    );
    expect(log.map((l) => l.aksi)).toEqual(['dibuat', 'dihapus']);
    expect(log.every((l) => l.pengajuan_id === null)).toBe(true);
  });

  it('daftar mendukung filter, pencarian, paginasi & jumlah nilai', async () => {
    await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { nama_kegiatan: 'Rapat Evaluasi Tender', total: 500_000 }));
    await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[1], { mekanisme: 'LS', total: 300_000 }));
    await op.post('/api/pengajuan').send(dataRumahTangga([{ pegawai_id: ctx.pegawai[3], nilai: 75_000 }]));

    let res = await op.get('/api/pengajuan?kategori=konsumsi');
    expect(res.body.total).toBe(2);
    expect(res.body.nilai).toBe(800_000);

    res = await op.get('/api/pengajuan?kategori=transport');
    expect(res.body.total).toBe(1);

    res = await op.get('/api/pengajuan?mekanisme=LS');
    expect(res.body.data.map((p: { mekanisme: string }) => p.mekanisme)).toEqual(['LS', 'LS']);

    res = await op.get('/api/pengajuan?q=evaluasi');
    expect(res.body.total).toBe(1);

    res = await op.get(`/api/pengajuan?q=${encodeURIComponent('Bambang')}`);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].kategori).toBe('rumah_tangga');

    res = await op.get(`/api/pengajuan?pegawai_id=${ctx.pegawai[1]}`);
    expect(res.body.total).toBe(1);

    res = await op.get('/api/pengajuan?limit=2&page=2');
    expect(res.body).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(res.body.data).toHaveLength(1);

    res = await op.get('/api/pengajuan?q=%25');
    expect(res.body.total).toBe(0); // karakter wildcard di-escape
  });
});
