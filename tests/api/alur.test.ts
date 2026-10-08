import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NotifikasiData, PengajuanDetail } from '../../shared/types';
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

const JENIS_KONSUMSI = ['notulen', 'undangan', 'invoice', 'daftar_hadir'];
const invoice = { no_invoice_mdk: 'MDK/INV/2026/0001', tanggal_invoice_mdk: `${TAHUN_INI}-03-20` };

async function buatDraft(berkasLengkap = false): Promise<number> {
  const res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
  expect(res.status).toBe(201);
  const id = res.body.id as number;
  if (berkasLengkap) {
    for (const jenis of JENIS_KONSUMSI) {
      const up = await unggah(ctx, op, id, jenis, FILE_CONTOH.pdf, `${jenis}.pdf`);
      expect(up.status).toBe(201);
    }
  }
  return id;
}

async function centangSemua(agent: Agent, id: number): Promise<PengajuanDetail> {
  let detail: PengajuanDetail | null = null;
  for (const jenis of JENIS_KONSUMSI) {
    const res = await agent.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis, status: 'sesuai' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    detail = res.body;
  }
  return detail!;
}

/** Draft berkas lengkap → diajukan → dicentang → diverifikasi PUM (→ opsional diajukan ke MDK). */
async function sampaiTahap(tahap: 'diverifikasi_pum' | 'diajukan_mdk'): Promise<number> {
  const id = await buatDraft(true);
  expect((await op.post(`/api/pengajuan/${id}/ajukan`)).status).toBe(200);
  await centangSemua(pum, id);
  expect((await pum.post(`/api/pengajuan/${id}/verifikasi`).send({})).status).toBe(200);
  if (tahap === 'diajukan_mdk') expect((await pum.post(`/api/pengajuan/${id}/ajukan-mdk`).send(invoice)).status).toBe(200);
  return id;
}

async function notif(agent: Agent): Promise<NotifikasiData> {
  return (await agent.get('/api/notifikasi')).body as NotifikasiData;
}

describe('Alur status: Draft → PUM → Verifikasi PUM → Diajukan ke MDK → Selesai (paid)', () => {
  it('alur lengkap termasuk centang berkas, verifikasi, invoice, selesai, dan notifikasi', async () => {
    const id = await buatDraft(true);

    // Operator mengajukan ke PUM
    let res = await op.post(`/api/pengajuan/${id}/ajukan`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('diajukan_pum');
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'diajukan', keterangan: 'Berkas lengkap (4/4)' });

    // PUM menerima notifikasi otomatis
    let nPum = await notif(pum);
    expect(nPum.belumDibaca).toBe(1);
    expect(nPum.items[0]).toMatchObject({ pengajuan_id: id, jenis: 'diajukan', dibaca: false });
    expect(nPum.antrian).toEqual({ diajukan_pum: 1, diverifikasi_pum: 0, diajukan_mdk: 0, dikembalikan: 0, pendaftar: 0 });
    // Operator tidak menerima notifikasi atas aksinya sendiri
    expect((await notif(op)).belumDibaca).toBe(0);

    // Terkunci untuk operator
    expect((await op.put(`/api/pengajuan/${id}`).send(dataKonsumsi(ctx.pegawai[0], { total: 1 }))).status).toBe(409);
    expect((await op.delete(`/api/pengajuan/${id}`)).status).toBe(409);

    // Verifikasi ditolak sebelum semua berkas dicentang; invoice & selesai belum boleh
    res = await pum.post(`/api/pengajuan/${id}/verifikasi`).send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('0/4');
    expect((await pum.post(`/api/pengajuan/${id}/ajukan-mdk`).send(invoice)).status).toBe(409);
    expect((await pum.post(`/api/pengajuan/${id}/selesai`)).status).toBe(409);

    // PUM mencentang semua berkas
    const detail = await centangSemua(pum, id);
    expect(detail.kelengkapan).toMatchObject({ sesuai: 4, revisi: 0, semuaSesuai: true });
    expect(detail.berkas_sesuai).toBe(4);
    expect(detail.kelengkapan.items[0].cek).toMatchObject({ status: 'sesuai', diperiksa_by_nama: 'Petugas PUM' });

    // Verifikasi PUM dengan project costing & task name
    res = await pum.post(`/api/pengajuan/${id}/verifikasi`).send({ project_hosting: ' DPBJ-OPS-2026 ', task_name: 'Konsumsi Rapat' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'diverifikasi_pum',
      project_hosting: 'DPBJ-OPS-2026',
      task_name: 'Konsumsi Rapat',
      diverifikasi_by_nama: 'Petugas PUM',
      no_invoice_mdk: null,
      diajukan_mdk_at: null,
    });
    expect(res.body.diverifikasi_at).toBeTruthy();
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'diverifikasi' });
    expect(res.body.riwayat[0].keterangan).toContain('Project: DPBJ-OPS-2026');
    expect((await notif(pum)).antrian).toMatchObject({ diajukan_pum: 0, diverifikasi_pum: 1, diajukan_mdk: 0 });

    // Operator mendapat notifikasi diverifikasi; tidak bisa lagi menarik kembali
    let nOp = await notif(op);
    expect(nOp.items[0]).toMatchObject({ jenis: 'diverifikasi', judul: 'Berkas diverifikasi PUM', dibaca: false });
    expect((await op.post(`/api/pengajuan/${id}/tarik`)).status).toBe(409);
    expect((await op.put(`/api/pengajuan/${id}`).send(dataKonsumsi(ctx.pegawai[0]))).body.message).toContain('diverifikasi PUM');
    // Centang berkas & verifikasi ulang terkunci; selesai belum boleh (belum diajukan ke MDK)
    expect((await pum.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'notulen', status: null })).status).toBe(409);
    expect((await pum.post(`/api/pengajuan/${id}/verifikasi`).send({})).status).toBe(409);
    expect((await pum.post(`/api/pengajuan/${id}/selesai`)).status).toBe(409);
    expect((await pum.put(`/api/pengajuan/${id}/invoice`).send(invoice)).status).toBe(409);

    // Ubah data PUM sebelum input invoice
    res = await pum.put(`/api/pengajuan/${id}/data-pum`).send({ project_hosting: 'DPBJ-OPS-2026-B', task_name: 'Konsumsi Rapat' });
    expect(res.status).toBe(200);
    expect(res.body.project_hosting).toBe('DPBJ-OPS-2026-B');
    expect(res.body.riwayat[0].aksi).toBe('data_pum_diubah');

    // Input invoice MDK → diajukan ke MDK (belum selesai)
    res = await pum.post(`/api/pengajuan/${id}/ajukan-mdk`).send({ no_invoice_mdk: ' ', tanggal_invoice_mdk: 'x' });
    expect(res.status).toBe(400);
    res = await pum.post(`/api/pengajuan/${id}/ajukan-mdk`).send({ ...invoice, catatan: 'Berkas fisik dikirim' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'diajukan_mdk',
      no_invoice_mdk: 'MDK/INV/2026/0001',
      tanggal_invoice_mdk: invoice.tanggal_invoice_mdk,
      catatan_pum: 'Berkas fisik dikirim',
      diajukan_mdk_by_nama: 'Petugas PUM',
      diproses_at: null,
    });
    expect(res.body.diajukan_mdk_at).toBeTruthy();
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'diajukan_mdk', keterangan: 'No. Invoice MDK: MDK/INV/2026/0001' });
    nOp = await notif(op);
    expect(nOp.items[0]).toMatchObject({ jenis: 'diajukan_mdk', judul: 'Diajukan ke MDK, menunggu verifikasi MDK' });
    expect(nOp.items[0].pesan).toContain('MDK/INV/2026/0001');
    expect((await notif(pum)).antrian).toMatchObject({ diverifikasi_pum: 0, diajukan_mdk: 1 });
    // Invoice tidak bisa diinput dua kali; data invoice boleh diubah saat menunggu MDK
    expect((await pum.post(`/api/pengajuan/${id}/ajukan-mdk`).send(invoice)).status).toBe(409);
    res = await pum.put(`/api/pengajuan/${id}/invoice`).send({ ...invoice, no_invoice_mdk: 'MDK/INV/2026/0009', catatan: 'Berkas fisik dikirim' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'diajukan_mdk', no_invoice_mdk: 'MDK/INV/2026/0009' });

    // Proses MDK selesai → PUM menekan Selesai (paid); body tidak diperlukan
    res = await pum.post(`/api/pengajuan/${id}/selesai`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'selesai',
      no_invoice_mdk: 'MDK/INV/2026/0009',
      catatan_pum: 'Berkas fisik dikirim',
      diproses_by_nama: 'Petugas PUM',
    });
    expect(res.body.diproses_at).toBeTruthy();
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'selesai', keterangan: 'No. Invoice MDK: MDK/INV/2026/0009' });
    expect((await pum.post(`/api/pengajuan/${id}/selesai`)).status).toBe(409);
    nOp = await notif(op);
    expect(nOp.items[0]).toMatchObject({ jenis: 'selesai', judul: 'Pengajuan selesai (paid)' });
    expect(nOp.belumDibaca).toBe(3);

    // Tandai dibaca: satu, lalu semua
    res = await op.post('/api/notifikasi/baca').send({ id: nOp.items[0].id });
    expect((res.body as NotifikasiData).belumDibaca).toBe(2);
    res = await op.post('/api/notifikasi/baca').send({});
    expect((res.body as NotifikasiData).belumDibaca).toBe(0);
    // Tidak bisa menandai notifikasi milik orang lain
    nPum = await notif(pum);
    await op.post('/api/notifikasi/baca').send({ id: nPum.items[0].id });
    expect((await notif(pum)).belumDibaca).toBe(nPum.belumDibaca);

    // Urutan aksi utama di riwayat
    const aksi = (res = await op.get(`/api/pengajuan/${id}`)).body.riwayat.map((r: { aksi: string }) => r.aksi);
    expect(aksi.slice(0, 5)).toEqual(['selesai', 'invoice_diubah', 'diajukan_mdk', 'data_pum_diubah', 'diverifikasi']);
    expect(aksi.filter((a: string) => a === 'berkas_dicek')).toHaveLength(4);
  });

  it('PUM menandai berkas perlu revisi, mengembalikan, operator memperbaiki → centang direset', async () => {
    const id = await buatDraft(true);
    await op.post(`/api/pengajuan/${id}/ajukan`);

    // Revisi wajib catatan
    let res = await pum.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'invoice', status: 'revisi' });
    expect(res.status).toBe(400);
    expect(res.body.errors.catatan).toBeTruthy();

    await pum.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'notulen', status: 'sesuai' });
    res = await pum.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'invoice', status: 'revisi', catatan: 'Nominal tidak terbaca' });
    expect(res.status).toBe(200);
    expect(res.body.kelengkapan).toMatchObject({ sesuai: 1, revisi: 1, semuaSesuai: false });

    // Jenis bukan berkas wajib ditolak
    expect((await pum.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'invoice_hotel', status: 'sesuai' })).status).toBe(400);

    // Kembalikan: catatan wajib
    expect((await pum.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: '' })).status).toBe(400);
    res = await pum.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: 'Perbaiki invoice' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'dikembalikan', catatan_pum: 'Perbaiki invoice' });
    expect(res.body.riwayat[0].keterangan).toContain('Invoice (Nominal tidak terbaca)');

    // Notifikasi otomatis ke operator, memuat alasan & berkas yang perlu revisi
    const nOp = await notif(op);
    expect(nOp.belumDibaca).toBe(1);
    expect(nOp.items[0]).toMatchObject({ jenis: 'dikembalikan', judul: 'Pengajuan dikembalikan PUM' });
    expect(nOp.items[0].pesan).toContain('Perbaiki invoice');
    expect(nOp.items[0].pesan).toContain('Invoice (Nominal tidak terbaca)');
    expect(nOp.antrian.dikembalikan).toBe(1);

    // Operator mengganti file invoice → centang invoice direset, notulen tetap sesuai
    const detail = (await op.get(`/api/pengajuan/${id}`)).body as PengajuanDetail;
    const invoiceLama = detail.berkas.find((b) => b.jenis === 'invoice')!;
    await op.delete(`/api/berkas/${invoiceLama.id}`);
    res = await unggah(ctx, op, id, 'invoice', FILE_CONTOH.pdf, 'invoice-baru.pdf');
    expect(res.status).toBe(201);
    const k = (res.body as PengajuanDetail).kelengkapan;
    expect(k.items.find((i) => i.jenis === 'invoice')?.cek).toBeNull();
    expect(k.items.find((i) => i.jenis === 'notulen')?.cek?.status).toBe('sesuai');

    // Ajukan ulang → PUM mendapat notifikasi "diajukan ulang"
    res = await op.post(`/api/pengajuan/${id}/ajukan`);
    expect(res.body.status).toBe('diajukan_pum');
    expect(res.body.riwayat[0].keterangan).toContain('Diajukan ulang');
    expect((await notif(pum)).items[0]).toMatchObject({ judul: 'Pengajuan diajukan ulang' });
  });

  it('PUM dapat mengembalikan setelah verifikasi (sebelum invoice)', async () => {
    const id = await sampaiTahap('diverifikasi_pum');
    const res = await pum.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: 'Data kegiatan perlu diperbaiki' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('dikembalikan');
  });

  it('PUM dapat mengembalikan saat menunggu MDK (ditolak MDK) → invoice lama dihapus, tercatat di riwayat', async () => {
    const id = await sampaiTahap('diajukan_mdk');
    let res = await pum.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: 'MDK meminta revisi nominal' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'dikembalikan', no_invoice_mdk: null, tanggal_invoice_mdk: null });
    expect(res.body.riwayat[0].keterangan).toContain('Invoice MDK sebelumnya: MDK/INV/2026/0001');

    // Diajukan ulang → diverifikasi lagi → invoice baru → selesai
    expect((await op.post(`/api/pengajuan/${id}/ajukan`)).status).toBe(200);
    expect((await pum.post(`/api/pengajuan/${id}/verifikasi`).send({})).status).toBe(200);
    res = await pum.post(`/api/pengajuan/${id}/ajukan-mdk`).send({ ...invoice, no_invoice_mdk: 'MDK/INV/2026/0002' });
    expect(res.body).toMatchObject({ status: 'diajukan_mdk', no_invoice_mdk: 'MDK/INV/2026/0002' });
    expect((await pum.post(`/api/pengajuan/${id}/selesai`)).body.status).toBe('selesai');
  });

  it('hak akses aksi per peran', async () => {
    const id = await buatDraft(true);
    // PUM & pimpinan tidak melihat draft
    expect((await pum.get(`/api/pengajuan/${id}`)).status).toBe(404);
    expect((await pimpinan.get(`/api/pengajuan/${id}`)).status).toBe(404);
    expect((await pum.post(`/api/pengajuan/${id}/ajukan`)).status).toBe(404);
    expect((await op.post(`/api/pengajuan/${id}/ajukan`)).status).toBe(200);

    // Setelah diajukan: pimpinan boleh melihat, tapi tidak boleh melakukan aksi apa pun
    expect((await pimpinan.get(`/api/pengajuan/${id}`)).status).toBe(200);
    expect((await pimpinan.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'notulen', status: 'sesuai' })).status).toBe(403);
    expect((await pimpinan.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: 'abc' })).status).toBe(403);
    expect((await pimpinan.post(`/api/pengajuan/${id}/tarik`)).status).toBe(403);
    expect((await pimpinan.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]))).status).toBe(403);

    // PUM tidak boleh mengubah/mengajukan; operator tidak boleh memproses PUM
    expect((await pum.post(`/api/pengajuan/${id}/ajukan`)).status).toBe(403);
    expect((await pum.post(`/api/pengajuan/${id}/tarik`)).status).toBe(403);
    expect((await pum.put(`/api/pengajuan/${id}`).send(dataKonsumsi(ctx.pegawai[0]))).status).toBe(403);
    expect((await op.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'notulen', status: 'sesuai' })).status).toBe(403);
    expect((await op.post(`/api/pengajuan/${id}/verifikasi`).send({})).status).toBe(403);
    expect((await op.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: 'abc' })).status).toBe(403);
    expect((await op.get('/api/pengajuan/saran-pum')).status).toBe(403);

    // Admin boleh memproses seluruh alur
    await centangSemua(admin, id);
    expect((await admin.post(`/api/pengajuan/${id}/verifikasi`).send({ project_hosting: 'P1' })).status).toBe(200);
    expect((await op.post(`/api/pengajuan/${id}/ajukan-mdk`).send(invoice)).status).toBe(403);
    expect((await pimpinan.post(`/api/pengajuan/${id}/ajukan-mdk`).send(invoice)).status).toBe(403);
    expect((await admin.post(`/api/pengajuan/${id}/ajukan-mdk`).send(invoice)).status).toBe(200);
    expect((await op.post(`/api/pengajuan/${id}/selesai`)).status).toBe(403);
    expect((await pimpinan.post(`/api/pengajuan/${id}/selesai`)).status).toBe(403);
    expect((await admin.post(`/api/pengajuan/${id}/selesai`)).status).toBe(200);
    const saran = await pum.get('/api/pengajuan/saran-pum');
    expect(saran.body.project_hosting).toContain('P1');
  });

  it('transisi tidak valid ditolak (409)', async () => {
    const id = await buatDraft(true);
    expect((await op.post(`/api/pengajuan/${id}/tarik`)).status).toBe(409); // draft tidak bisa ditarik
    await op.post(`/api/pengajuan/${id}/ajukan`);
    expect((await op.post(`/api/pengajuan/${id}/ajukan`)).status).toBe(409); // sudah diajukan
    expect((await pum.post(`/api/pengajuan/${id}/ajukan-mdk`).send(invoice)).status).toBe(409); // belum diverifikasi
    expect((await pum.post(`/api/pengajuan/${id}/selesai`)).status).toBe(409); // belum diajukan ke MDK
    expect((await pum.put(`/api/pengajuan/${id}/invoice`).send(invoice)).status).toBe(409); // belum ada invoice
    expect((await pum.post(`/api/pengajuan/${id}/batal-selesai`).send({ catatan: 'salah' })).status).toBe(409);
    await pum.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: 'Revisi nominal' });
    expect((await pum.post(`/api/pengajuan/${id}/verifikasi`).send({})).status).toBe(409); // dikembalikan
    expect((await pum.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: 'lagi' })).status).toBe(409);
    expect((await pum.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'notulen', status: 'sesuai' })).status).toBe(409);
    expect((await pum.put(`/api/pengajuan/${id}/data-pum`).send({ task_name: 'x' })).status).toBe(409);
    // Endpoint lama "teruskan" sudah tidak ada
    expect((await pum.post(`/api/pengajuan/${id}/teruskan`).send({})).status).toBe(404);
  });

  it('tarik kembali: hanya saat masih di PUM, lalu tersembunyi lagi dari PUM', async () => {
    const id = await buatDraft();
    await op.post(`/api/pengajuan/${id}/ajukan`);
    const res = await op.post(`/api/pengajuan/${id}/tarik`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'draft', diajukan_at: null });
    expect((await pum.get(`/api/pengajuan/${id}`)).status).toBe(404);
  });

  it('ubah invoice & batalkan status selesai → kembali menunggu MDK, invoice tetap', async () => {
    const id = await sampaiTahap('diajukan_mdk');
    expect((await pum.post(`/api/pengajuan/${id}/selesai`)).status).toBe(200);

    let res = await pum.put(`/api/pengajuan/${id}/invoice`).send({ ...invoice, no_invoice_mdk: 'MDK/INV/2026/0002' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'selesai', no_invoice_mdk: 'MDK/INV/2026/0002' });
    expect(res.body.riwayat[0]).toMatchObject({
      aksi: 'invoice_diubah',
      keterangan: 'No. Invoice: MDK/INV/2026/0001 → MDK/INV/2026/0002',
    });

    expect((await op.put(`/api/pengajuan/${id}`).send(dataKonsumsi(ctx.pegawai[0]))).status).toBe(409);
    res = await pum.post(`/api/pengajuan/${id}/batal-selesai`).send({ catatan: '' });
    expect(res.status).toBe(400);
    res = await pum.post(`/api/pengajuan/${id}/batal-selesai`).send({ catatan: 'MDK belum membayar' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'diajukan_mdk',
      no_invoice_mdk: 'MDK/INV/2026/0002',
      diproses_by: null,
      diproses_at: null,
    });
    expect(res.body.diajukan_mdk_at).toBeTruthy();
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'selesai_dibatalkan', keterangan: 'MDK belum membayar' });
    // Pengaju menerima notifikasi berjenis "selesai_dibatalkan" (ikon & label khusus di klien)
    const nOp = await notif(op);
    expect(nOp.items[0]).toMatchObject({ pengajuan_id: id, jenis: 'selesai_dibatalkan', judul: 'Status selesai dibatalkan PUM' });
    // Bisa ditandai selesai lagi
    expect((await pum.post(`/api/pengajuan/${id}/selesai`)).body.status).toBe('selesai');
  });

  it('PUM membatalkan centang berkas → tercatat "berkas_cek_batal"', async () => {
    const id = await buatDraft(true);
    await op.post(`/api/pengajuan/${id}/ajukan`);
    await pum.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'notulen', status: 'sesuai' });
    const res = await pum.put(`/api/pengajuan/${id}/cek-berkas`).send({ jenis: 'notulen', status: null });
    expect(res.status).toBe(200);
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'berkas_cek_batal', keterangan: 'Notula' });
    expect((res.body as PengajuanDetail).kelengkapan.items.find((i) => i.jenis === 'notulen')?.cek).toBeNull();
  });

  it('notifikasi pengajuan baru jatuh ke admin bila tidak ada PUM aktif', async () => {
    await ctx.db.run(`UPDATE users SET aktif = false WHERE role = 'pum'`);
    const id = await buatDraft();
    await op.post(`/api/pengajuan/${id}/ajukan`);
    const nAdmin = await notif(admin);
    expect(nAdmin.items[0]).toMatchObject({ pengajuan_id: id, jenis: 'diajukan' });
  });
});
