import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NotifikasiData } from '../../shared/types';
import { buatKonteks, dataKonsumsi, dataRumahTangga, masuk, type Agent, type Konteks } from './helpers';

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

const REKENING = { rekening_bank: 'Bank Mandiri', rekening_nomor: '157-000 1234.567' };

/** Buat konsumsi lalu ajukan ke PUM (berkas boleh menyusul). */
async function konsumsiDiPum(ubah: Record<string, unknown> = REKENING): Promise<number> {
  const res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], ubah));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const aj = await op.post(`/api/pengajuan/${res.body.id}/ajukan`);
  expect(aj.status).toBe(200);
  return res.body.id as number;
}

describe('Rekening "uang siapa" (konsumsi)', () => {
  it('opsional; bila diisi tersimpan dengan nomor tanpa spasi/titik/strip', async () => {
    const tanpa = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    expect(tanpa.status).toBe(201);
    expect(tanpa.body).toMatchObject({ rekening_bank: null, rekening_nomor: null, dibayar_at: null });

    const res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { rekening_bank: '  BNI  ', rekening_nomor: '0123 456 789' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ rekening_bank: 'BNI', rekening_nomor: '0123456789' });
  });

  it('bank & nomor wajib berpasangan, nomor hanya angka 5–30 digit', async () => {
    let res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { rekening_bank: 'BRI' }));
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ rekening_nomor: 'Isi nomor rekening' });

    res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { rekening_nomor: '12345678' }));
    expect(res.body.errors).toEqual({ rekening_bank: 'Isi nama bank' });

    res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { rekening_bank: 'BRI', rekening_nomor: '12AB5678' }));
    expect(res.body.errors).toEqual({ rekening_nomor: 'Nomor rekening hanya boleh berisi angka' });

    res = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0], { rekening_bank: 'BRI', rekening_nomor: '1234' }));
    expect(res.body.errors).toEqual({ rekening_nomor: 'Nomor rekening harus 5–30 digit' });
  });

  it('transport tidak menyimpan rekening; perubahan rekening tercatat di riwayat', async () => {
    const rt = await op
      .post('/api/pengajuan')
      .send(dataRumahTangga([{ pegawai_id: ctx.pegawai[0], nilai: 50_000 }], { rekening_bank: 'BNI', rekening_nomor: '0123456789' }));
    expect(rt.status).toBe(201);
    expect(rt.body).toMatchObject({ rekening_bank: null, rekening_nomor: null });

    const { body } = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    const res = await op.put(`/api/pengajuan/${body.id}`).send(dataKonsumsi(ctx.pegawai[0], REKENING));
    expect(res.status).toBe(200);
    expect(res.body.rekening_nomor).toBe('1570001234567');
    expect(res.body.riwayat[0]).toMatchObject({ aksi: 'diubah', keterangan: 'Rekening - → Bank Mandiri 1570001234567' });
  });
});

describe('Tanda "sudah dibayarkan" oleh PUM', () => {
  it('PUM menandai & membatalkan; riwayat dicatat dan pengaju dinotifikasi', async () => {
    const id = await konsumsiDiPum();

    let res = await pum.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: true });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.dibayar_at).toEqual(expect.any(String));
    expect(res.body).toMatchObject({ dibayar_by_nama: 'Petugas PUM', status: 'diajukan_pum' });
    expect(res.body.riwayat[0]).toMatchObject({
      aksi: 'dibayarkan',
      keterangan: expect.stringContaining('Bank Mandiri 1570001234567'),
    });

    const n = (await op.get('/api/notifikasi')).body as NotifikasiData;
    expect(n.items[0]).toMatchObject({ pengajuan_id: id, jenis: 'dibayarkan', judul: 'Uang konsumsi sudah dibayarkan' });

    // Menandai dua kali ditolak
    res = await pum.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: true });
    expect(res.status).toBe(409);

    res = await pum.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dibayar_at: null, dibayar_by: null, dibayar_by_nama: null });
    expect(res.body.riwayat[0].aksi).toBe('dibayarkan_batal');

    res = await pum.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: false });
    expect(res.status).toBe(409);
  });

  it('boleh tanpa rekening (mis. dibayar tunai)', async () => {
    const id = await konsumsiDiPum({});
    const res = await pum.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: true });
    expect(res.status).toBe(200);
    expect(res.body.riwayat[0].keterangan).not.toContain('Bank');
  });

  it('hanya PUM/admin, hanya konsumsi, dan hanya setelah diajukan ke PUM', async () => {
    const id = await konsumsiDiPum();
    expect((await op.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: true })).status).toBe(403);
    expect((await pimpinan.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: true })).status).toBe(403);
    expect((await pum.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: 'ya' })).status).toBe(400);

    // Dikembalikan ke pengaju → tidak bisa ditandai
    expect((await pum.post(`/api/pengajuan/${id}/kembalikan`).send({ catatan: 'Lengkapi berkas' })).status).toBe(200);
    const res = await pum.put(`/api/pengajuan/${id}/dibayarkan`).send({ dibayarkan: true });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Dikembalikan');

    // Draft tidak terlihat oleh PUM
    const draft = await op.post('/api/pengajuan').send(dataKonsumsi(ctx.pegawai[0]));
    expect((await pum.put(`/api/pengajuan/${draft.body.id}/dibayarkan`).send({ dibayarkan: true })).status).toBe(404);

    // Transport ditolak
    const rt = await op.post('/api/pengajuan').send(dataRumahTangga([{ pegawai_id: ctx.pegawai[0], nilai: 50_000 }]));
    expect((await op.post(`/api/pengajuan/${rt.body.id}/ajukan`)).status).toBe(200);
    const tolak = await pum.put(`/api/pengajuan/${rt.body.id}/dibayarkan`).send({ dibayarkan: true });
    expect(tolak.status).toBe(409);
    expect(tolak.body.message).toContain('Konsumsi');
  });
});
